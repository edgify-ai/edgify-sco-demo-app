// backend/edgifyMqtt.js
// Persistent MQTT client for the Edgify agent. Used for item recognition
// (capture-and-predict). Kept independent from the REST agent integration.
//
// Wire model: a single Publish topic for requests (default: edgifyIn) and a
// single Subscribe topic for responses (default: edgifyOut). Responses are
// correlated to requests by the eventId we send (echoed as requestEventId)
// when available, but an id match is not required: an unmatched response is
// applied to the oldest pending request instead of being dropped.
//
// Outbound request shape — ITEM_RECOGNITION_REQUEST (aligned with the SCO
// integration spec):
//   {
//     eventType: "ITEM_RECOGNITION_REQUEST",
//     eventId,
//     transactionNumber,            // per-session counter (string)
//     storeCode,                    // from settings
//     tillHost,                     // os.hostname() of the SCO machine
//     sourceSystem,                 // from settings (default "SCO")
//     eventTimeStamp,               // epoch ms
//     captureTrigger,               // e.g. "menu", "category-menu", "scale-stable"
//     family,                       // category name (when known)
//     weight                        // last stable scale weight (string, kg) — optional
//   }
//
// Inbound response shape (as published by the agent):
//   {
//     eventType: "PREDICTION_RESPONSE",
//     eventId, requestEventId, eventTimeStamp,
//     certain: bool, deviceId, sampleId,
//     image: "<base64 jpeg, no data: prefix>",
//     options: [{ label: "<product id/sku>", certainty: <0..1> }, ...]
//   }
// Errors are signalled by the agent with error_code / error_message fields.
const mqtt = require('mqtt');
const crypto = require('crypto');
const logger = require('./logger');

let client = null;
let connectedConfigKey = null;
let connectingPromise = null;
let activeSubscribeTopic = null;
const pendingPredictions = new Map(); // session_id -> { resolve, reject, timer }

function configKey(opts) {
    return [
        opts.tls ? 'mqtts' : 'mqtt',
        opts.host,
        opts.port,
        opts.username || '',
        opts.clientIdPrefix || '',
        opts.subscribeTopic || '',
    ].join('|');
}

function buildClientId(prefix) {
    const safePrefix = (prefix || 'sco-terminal').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'sco';
    return `${safePrefix}-${Date.now().toString(36)}`.slice(0, 23);
}

function attachClientHandlers(c) {
    c.on('message', (topic, payload) => {
        if (topic !== activeSubscribeTopic) return;

        const raw = payload.toString();
        logger.log(`[Edgify MQTT] <- ${topic} (${raw.length} bytes)`);

        let msg;
        try { msg = JSON.parse(raw); }
        catch (e) {
            logger.logError(`[Edgify MQTT] Bad JSON on ${topic}: ${e.message}`);
            return;
        }

        // Correlate the response to a pending request. We still prefer an
        // explicit id match (requestEventId, then session_id / sessionId, then
        // eventId) when the agent provides one, but the match is no longer
        // required: if nothing matches, fall back to the oldest pending request.
        // This makes the app tolerant of agents that don't echo the request id.
        const correlationId = msg && (msg.requestEventId || msg.session_id || msg.sessionId || msg.eventId);

        let key = (correlationId != null && pendingPredictions.has(correlationId)) ? correlationId : undefined;
        if (key === undefined) {
            // Map preserves insertion order — the first key is the oldest request.
            key = pendingPredictions.keys().next().value;
            if (key !== undefined) {
                logger.log(`[Edgify MQTT] No id match (correlation id=${correlationId ?? 'none'}); resolving oldest pending request instead.`);
            }
        }

        if (key === undefined) {
            logger.log(`[Edgify MQTT] Message on ${topic} but no pending prediction request to resolve — ignored.`);
            return;
        }

        const pending = pendingPredictions.get(key);
        pendingPredictions.delete(key);
        clearTimeout(pending.timer);

        if (msg.error_code || msg.error_message) {
            pending.reject(new Error(msg.error_message || msg.error_code));
        } else {
            logger.log(`[Edgify MQTT] Matched prediction (key=${key}) — ${(msg.options || msg.predictions || []).length} option(s)`);
            pending.resolve(msg);
        }
    });

    c.on('error', (err) => {
        logger.logError(`[Edgify MQTT] Client error: ${err.message}`);
    });

    c.on('close', () => {
        logger.log('[Edgify MQTT] Connection closed.');
    });

    c.on('reconnect', () => {
        logger.log('[Edgify MQTT] Reconnecting...');
    });
}

async function ensureConnected(opts) {
    const key = configKey(opts);

    if (client && connectedConfigKey === key && client.connected) {
        return client;
    }

    if (connectingPromise) {
        try { await connectingPromise; } catch (_) { /* fall through to retry */ }
        if (client && connectedConfigKey === key && client.connected) return client;
    }

    if (client) {
        try { client.end(true); } catch (_) { /* ignore */ }
        client = null;
        connectedConfigKey = null;
        activeSubscribeTopic = null;
    }

    connectingPromise = new Promise((resolve, reject) => {
        const protocol = opts.tls ? 'mqtts' : 'mqtt';
        const url = `${protocol}://${opts.host}:${opts.port}`;
        const clientId = buildClientId(opts.clientIdPrefix);
        const subscribeTopic = opts.subscribeTopic || 'edgifyOut';

        const c = mqtt.connect(url, {
            username: opts.username || undefined,
            password: opts.password || undefined,
            clientId,
            clean: true,
            connectTimeout: 5000,
            reconnectPeriod: 5000,
            rejectUnauthorized: false,
        });

        let opened = false;
        const timer = setTimeout(() => {
            if (opened) return;
            try { c.end(true); } catch (_) { /* ignore */ }
            reject(new Error(`MQTT connection to ${url} timed out`));
        }, 6000);

        c.once('connect', () => {
            opened = true;
            clearTimeout(timer);
            logger.log(`[Edgify MQTT] Connected to ${url} as ${clientId}, subscribing to "${subscribeTopic}"`);
            c.subscribe(subscribeTopic, { qos: 1 }, (err) => {
                if (err) {
                    logger.logError(`[Edgify MQTT] Subscribe error: ${err.message}`);
                    reject(err);
                    try { c.end(true); } catch (_) { /* ignore */ }
                    return;
                }
                client = c;
                connectedConfigKey = key;
                activeSubscribeTopic = subscribeTopic;
                attachClientHandlers(c);
                resolve(c);
            });
        });

        c.once('error', (err) => {
            if (opened) return;
            clearTimeout(timer);
            try { c.end(true); } catch (_) { /* ignore */ }
            reject(err);
        });
    }).finally(() => { connectingPromise = null; });

    return await connectingPromise;
}

async function requestPrediction(opts, {
    timeoutMs = 5000,
    transactionNumber,
    storeCode,
    tillHost,
    sourceSystem,
    captureTrigger,
    family,
    weight,
} = {}) {
    await ensureConnected(opts);
    const publishTopic = opts.publishTopic || 'edgifyIn';
    const eventId = crypto.randomUUID();

    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingPredictions.delete(eventId);
            reject(new Error(`MQTT prediction timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        pendingPredictions.set(eventId, { timer, resolve, reject });

        // Outbound request — agent echoes eventId back as requestEventId.
        const requestPayload = {
            eventType: 'ITEM_RECOGNITION_REQUEST',
            eventId,
            transactionNumber: transactionNumber != null ? String(transactionNumber) : undefined,
            storeCode: storeCode || undefined,
            tillHost: tillHost || undefined,
            sourceSystem: sourceSystem || 'SCO',
            eventTimeStamp: Date.now(),
            captureTrigger: captureTrigger || undefined,
            family: family || undefined,
            weight: weight != null && weight !== '' ? String(weight) : undefined,
        };
        const payload = JSON.stringify(requestPayload);

        logger.log(`[Edgify MQTT] -> ${publishTopic} eventId=${eventId} tx=${requestPayload.transactionNumber} store=${requestPayload.storeCode} till=${requestPayload.tillHost} trigger=${requestPayload.captureTrigger} family=${requestPayload.family || ''} weight=${requestPayload.weight || ''}`);
        try {
            client.publish(publishTopic, payload, { qos: 1 }, (err) => {
                if (err) {
                    const pending = pendingPredictions.get(eventId);
                    if (pending) {
                        pendingPredictions.delete(eventId);
                        clearTimeout(pending.timer);
                        pending.reject(err);
                    }
                }
            });
        } catch (e) {
            const pending = pendingPredictions.get(eventId);
            if (pending) {
                pendingPredictions.delete(eventId);
                clearTimeout(pending.timer);
                pending.reject(e);
            }
        }
    });
}

// Fire-and-forget publish on the configured publishTopic. Used for events that
// don't expect a correlated response (e.g. ITEM_SELECTED). Connects on demand.
async function publishEvent(opts, payload) {
    await ensureConnected(opts);
    const publishTopic = opts.publishTopic || 'edgifyIn';
    const body = JSON.stringify(payload);
    return await new Promise((resolve, reject) => {
        try {
            client.publish(publishTopic, body, { qos: 1 }, (err) => {
                if (err) {
                    logger.logError(`[Edgify MQTT] publishEvent failed on ${publishTopic}: ${err.message}`);
                    reject(err);
                } else {
                    logger.log(`[Edgify MQTT] -> ${publishTopic} ${payload && payload.eventType} eventId=${payload && payload.eventId}`);
                    resolve();
                }
            });
        } catch (e) {
            logger.logError(`[Edgify MQTT] publishEvent threw: ${e.message}`);
            reject(e);
        }
    });
}

// Normalize a response message coming back on the Subscribe topic into the
// shape the REST flow returns from /api/v2/capture-and-predict so the renderer
// can stay unchanged.
//
// Accepts the following payload shapes:
//   1) Agent ws-style response (preferred): { options: [{ label, certainty }], image: "<base64>", certain, sampleId, ... }
//   2) Doc edgify/prediction:                { ..., predictions: [{ product_id, product_name, confidence, weight_grams }] }
//   3) Doc edgify/prediction/confirmed:      { ..., product_id, product_name, confidence, weight_grams }
function normalizePrediction(msg) {
    if (!msg) return null;

    let options = [];
    let confirmed = !!msg.certain;

    if (Array.isArray(msg.options) && msg.options.length > 0) {
        // Shape 1 — agent ws-style (PREDICTION_RESPONSE)
        options = msg.options.map(o => ({
            label: o.label,
            certainty: o.certainty,
            ...(o.name ? { name: o.name } : {}),
        }));
    } else if (Array.isArray(msg.predictions)) {
        // Shape 2 — doc edgify/prediction
        options = msg.predictions.map(p => ({
            label: p.product_id,
            certainty: p.confidence,
            name: p.product_name,
            weight_grams: p.weight_grams,
        }));
    } else if (msg.product_id && (msg.confidence !== undefined || msg.product_name)) {
        // Shape 3 — doc edgify/prediction/confirmed (single product)
        confirmed = true;
        options = [{
            label: msg.product_id,
            certainty: msg.confidence,
            name: msg.product_name,
            weight_grams: msg.weight_grams,
            price_per_kg: msg.price_per_kg,
            total_price: msg.total_price,
        }];
    }

    // Image arrives as a raw base64 jpeg string (no data: prefix). The renderer
    // hands this off directly to an <img src>, so we need to add the prefix.
    let image = null;
    if (msg.image) {
        image = msg.image.startsWith('data:image')
            ? msg.image
            : `data:image/jpeg;base64,${msg.image}`;
    }

    return {
        image,
        options,
        confirmed,
        top_prediction: msg.top_prediction || null,
        sampleId: msg.sampleId || null,
        _source: 'mqtt',
        _raw: msg,
    };
}

module.exports = {
    ensureConnected,
    requestPrediction,
    publishEvent,
    normalizePrediction,
};
