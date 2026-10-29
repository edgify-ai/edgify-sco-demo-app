// backend/edgifyApi.js
const { DigestClient } = require('./lib/digest-fetch');
const logger = require('./logger');

const sendApiRequest = async (config, endpoint, payload, method = 'POST', isEnabled) => {
    // 1. Check if the specific agent is enabled. This is now the primary check.
    if (!isEnabled) {
        logger.log(`[Edgify API] Edgify is disabled, skipping API call to "${endpoint}".`);
        return { success: false, data: null, message: 'Edgify is disabled.' };
    }

    // 2. Validate the simplified config object that is received.
    if (!config || !config.host || !config.port) {
        logger.logError(`[Edgify API] Invalid agent configuration provided for endpoint "${endpoint}".`, config);
        return { success: false, data: null, message: 'Invalid agent configuration.' };
    }
    
    logger.log(`[Edgify API] Sending ${method} to "${endpoint}"`, payload);
    
    // 3. Use the simplified config keys (host, port, token) to build the request.
    const client = new DigestClient({ user: 'edgify', password: config.token });
    const url = `http://${config.host}:${config.port}${endpoint}`;
    
    try {
        const response = await client.fetch(url, {
            method: method,
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        const responseData = response.status !== 204 ? await response.json().catch(() => null) : null;
        if (response.ok) {
            logger.log(`[Edgify API] Call to "${endpoint}" successful.`, { status: response.status, response: responseData });
            return { success: true, data: responseData, status: response.status };
        } else {
            logger.logError(`[Edgify API] Failed to call "${endpoint}".`, { status: response.status, response: responseData });
            return { success: false, data: responseData, message: `API Error: ${response.status}` };
        }
    } catch (error) {
        logger.logError(`[Edgify API] Network error on call to "${endpoint}"`, { error: error.message });
        return { success: false, data: null, message: `Network Error: ${error.message}` };
    }
};

const sendEdgifyEvent = (config, payload, isEnabled) => {
    sendApiRequest(config, '/api/v2/events', payload, 'POST', isEnabled);
};

// Awaitable variant — used when we need to know whether the event posted successfully
const sendEdgifyEventAwaitable = (config, payload, isEnabled) => {
    return sendApiRequest(config, '/api/v2/events', payload, 'POST', isEnabled);
};

const sendEdgifyCaptureAndSave = (config, product, isEnabled, captureTrigger = "barcode", labelTrigger = "barcode") => {
    const payload = { 
        barcode: product.id, 
        captureTrigger: captureTrigger, // Now uses the parameter
        category: product.category_name || "Unknown", 
        count: product.count || 1, 
        family: product.category_name || "Unknown", 
        label: product.id, 
        labelTrigger: labelTrigger,     // Now uses the parameter
        name: product.name, 
        price: product.price, 
        totalPrice: product.price * (product.count || 1) 
    };
    sendApiRequest(config, '/api/v2/capture-and-save', payload, 'POST', isEnabled);
};


const getEdgifyPrediction = async (config, trigger, category = null, isEnabled) => {
    const payload = { captureTrigger: trigger };
    if (category) { payload.family = category; }
    return await sendApiRequest(config, '/api/v2/capture-and-predict', payload, 'POST', isEnabled);
};

const updateEdgifySample = (config, sampleId, product, trigger, imageBase64, isEnabled) => {
    if (!sampleId) {
        logger.logError('[Edgify API] Cannot update sample without a sampleId.');
        return;
    }
    const payload = {
        labelTrigger: trigger,
        category: product.category_name || "Unknown",
        image: imageBase64,
        label: product.id,
        name: product.name,
        price: product.price,
        weight: product.is_weight_based ? (product.count || 1.0) : undefined,
        count: !product.is_weight_based ? (product.count || 1) : undefined,
        totalPrice: product.price * (product.count || 1),
    };
    const endpoint = `/api/v2/samples/${sampleId}`;
    sendApiRequest(config, endpoint, payload, 'PUT', isEnabled);
};

// Generate deterministic UUID v4 from EPC (matches RFID demo's implementation)
const generateUUIDFromEPC = (epc) => {
    const sanitizedEPC = String(epc || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    let hash = 0;
    for (let i = 0; i < sanitizedEPC.length; i++) {
        const char = sanitizedEPC.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    hash = Math.abs(hash);
    const hashParts = [];
    for (let i = 0; i < 4; i++) {
        const variant = ((hash * (i + 1) * 2654435761) >>> 0).toString(16).padStart(8, '0');
        hashParts.push(variant);
    }
    let allHex = hashParts.join('');
    while (allHex.length < 30) allHex += allHex;
    allHex = allHex.replace(/[^0-9a-f]/g, '0').substring(0, 30);
    const part1 = allHex.substring(0, 8);
    const part2 = allHex.substring(8, 12);
    const part3 = '4' + allHex.substring(12, 15);
    const part4FirstChar = ['8', '9', 'a', 'b'][Math.abs(hash) % 4];
    const part4 = part4FirstChar + allHex.substring(15, 18);
    const part5 = allHex.substring(18, 30);
    const uuid = `${part1}-${part2}-${part3}-${part4}-${part5}`;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!uuidRegex.test(uuid)) {
        const ts = Date.now().toString(16).padStart(12, '0');
        const fb = (ts + ts + ts).substring(0, 30);
        return `${fb.substring(0,8)}-${fb.substring(8,12)}-4${fb.substring(12,15)}-8${fb.substring(15,18)}-${fb.substring(18,30)}`;
    }
    return uuid;
};

// POST /api/v2/private/json-data — push RFID tag JSON object to the agent
const sendJsonSample = async (config, tag, isEnabled) => {
    if (!isEnabled) return { success: false, message: 'Agent is disabled.' };
    const sessionId = generateUUIDFromEPC(tag.epc);
    const now = new Date().toISOString();
    const data = {
        epc: tag.epc,
        sku: tag.sku,
        name: tag.name,
        manufacture_date: tag.manufacture_date || null,
        expiry_date: tag.expiry_date || null,
        batch_number: tag.batch_number || null,
        price: tag.price !== undefined ? parseFloat(tag.price) : null,
        category: tag.category || null,
        family: tag.family || null,
        session_id: sessionId,
        timestamp: now,
    };
    const payload = {
        label: tag.sku,
        barcode: tag.sku,
        name: tag.name,
        data,
        session_id: sessionId,
        capture_trigger: 'rfid_read',
        label_trigger: 'rfid_read',
        captured_at: now,
        added_at: now,
        ...(tag.price !== undefined && { price: parseFloat(tag.price) }),
        ...(tag.category && { category: tag.category }),
        ...(tag.family && { family: tag.family }),
    };
    logger.log('[Edgify API] sendJsonSample — EPC: ' + tag.epc + ', Session: ' + sessionId);
    const result = await sendApiRequest(config, '/api/v2/private/json-data?report=true', payload, 'POST', isEnabled);
    return { ...result, tag, sessionId };
};

// POST /api/v2/private/capture-and-predict — request agent to capture an image (returns image + predictions)
const captureAndPredict = async (config, tag, role, isEnabled) => {
    if (!isEnabled) return { success: false, message: 'Agent is disabled.' };
    const sessionId = tag.epc ? generateUUIDFromEPC(tag.epc) : undefined;
    const payload = {
        capture_trigger: 'visionGate',
        role: role || 'predictor',
        ...(tag.family && { family: tag.family }),
        ...(sessionId && { uuid: sessionId }),
    };
    logger.log('[Edgify API] captureAndPredict — role: ' + (role || 'predictor'));
    return await sendApiRequest(config, '/api/v2/private/capture-and-predict', payload, 'POST', isEnabled);
};

// PUT /api/v2/private/samples — push a vision sample (image + label) tied to the same session_id as the JSON push
const sendVisionSample = async (config, tag, imageBase64, isEnabled) => {
    if (!isEnabled) return { success: false, message: 'Agent is disabled.' };
    const sessionId = generateUUIDFromEPC(tag.epc);
    const sampleUuid = require('crypto').randomUUID();
    const now = new Date().toISOString();
    let base64Image = imageBase64;
    if (imageBase64 && imageBase64.startsWith('data:image')) base64Image = imageBase64.split(',')[1];
    const payload = {
        label: tag.sku,
        barcode: tag.sku,
        name: tag.name,
        image: base64Image,
        session_id: sessionId,
        uuid: sampleUuid,
        group_id: sessionId,
        capture_trigger: 'visionGate',
        label_trigger: 'visionGate',
        captured_at: now,
        added_at: now,
        ...(tag.price !== undefined && { price: parseFloat(tag.price) }),
        ...(tag.category && { category: tag.category }),
        ...(tag.family && { family: tag.family }),
    };
    logger.log('[Edgify API] sendVisionSample — EPC: ' + tag.epc + ', Session: ' + sessionId);
    const result = await sendApiRequest(config, '/api/v2/private/samples?report=true', payload, 'PUT', isEnabled);
    return { ...result, tag, sessionId, sampleUuid };
};

module.exports = {
    sendEdgifyEvent,
    sendEdgifyEventAwaitable,
    sendEdgifyCaptureAndSave,
    getEdgifyPrediction,
    updateEdgifySample,
    generateUUIDFromEPC,
    sendJsonSample,
    captureAndPredict,
    sendVisionSample,
};