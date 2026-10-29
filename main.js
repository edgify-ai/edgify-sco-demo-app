// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const logger = require('./backend/logger');
const dbManager = require('./backend/database/db');
const WebhookServer = require('./webhook-server');

// Config keys that hold secrets (agent tokens, MQTT password). Excluded from
// data export so a shared or committed export file never carries credentials.
// Import merges config key by key, so importing such a file keeps existing secrets.
const SECRET_CONFIG_KEY_RE = /(token|password|secret|api_?key)/i;
const edgifyApi = require('./backend/edgifyApi');
const edgifyMqtt = require('./backend/edgifyMqtt');
const RfidApi = require('./backend/rfidApi');
const { DigestClient } = require('./backend/lib/digest-fetch');
const mqtt = require('mqtt');

// ... (rest of the file setup is unchanged)
let mainWindow;
let webhookServer;
let rfidApi;
let isRecreatingWindow = false;

// Helper: normalize SKU by removing leading zeros so '0049000042566' matches '49000042566'
const normalizeSKU = (sku) => {
    if (sku === undefined || sku === null) return '';
    const str = String(sku);
    return str.replace(/^0+/, '') || '0';
};

// Per-session transaction counter for ITEM_RECOGNITION_REQUEST payloads.
// Bumped from the renderer at the start of every customer session (Welcome → Checkout).
let transactionCounter = 0;
const TILL_HOST = (() => {
    try { return os.hostname() || 'sco-terminal'; }
    catch (_) { return 'sco-terminal'; }
})();

// Publish a transaction-lifecycle event — START_TRANSACTION (Section 3.4) or
// END_TRANSACTION (Section 3.5). Both are fire-and-forget on the publish topic
// and share the recognition-request envelope. transactionNumber is the
// session-level correlation key (consistent across START → END of one session).
// No-op when MQTT is disabled; errors are logged, never thrown, so lifecycle
// events can never block or break the session flow.
async function publishTransactionLifecycleEvent(eventType) {
    const db = dbManager.getDb();
    const rows = await db('config').whereIn('key', [
        'mqtt_enabled', 'mqtt_host', 'mqtt_port', 'mqtt_tls',
        'mqtt_username', 'mqtt_password', 'mqtt_client_id_prefix',
        'mqtt_publish_topic', 'mqtt_subscribe_topic',
        'store_code', 'source_system',
    ]);
    const cfg = rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
    if (cfg.mqtt_enabled !== 'true') {
        logger.log(`[Edgify MQTT] ${eventType} skipped — MQTT is disabled.`);
        return { success: false, message: 'MQTT disabled.' };
    }

    const payload = {
        eventType,
        eventId: require('crypto').randomUUID(),
        transactionNumber: String(transactionCounter || 1),
        storeCode: cfg.store_code || undefined,
        tillHost: TILL_HOST,
        sourceSystem: cfg.source_system || 'SCO',
        eventTimeStamp: Date.now(),
    };

    try {
        await edgifyMqtt.publishEvent({
            host: (cfg.mqtt_host || '127.0.0.1').trim(),
            port: parseInt(cfg.mqtt_port, 10) || 1883,
            tls: cfg.mqtt_tls === 'true',
            username: cfg.mqtt_username || '',
            password: cfg.mqtt_password || '',
            clientIdPrefix: cfg.mqtt_client_id_prefix || 'sco-terminal',
            publishTopic: (cfg.mqtt_publish_topic || 'edgifyIn').trim(),
            subscribeTopic: (cfg.mqtt_subscribe_topic || 'edgifyOut').trim(),
        }, payload);
        return { success: true, eventId: payload.eventId };
    } catch (err) {
        logger.logError(`[Edgify MQTT] ${eventType} publish failed: ${err.message}`);
        return { success: false, message: err.message };
    }
}

logger.init(app);
logger.log('--- Application Process Started ---');

try {
    const isDev = !app.isPackaged;
    async function getTitleBarVisible() {
        try {
            const db = dbManager.getDb();
            const row = await db('config').where({ key: 'app_title_bar_visible' }).first();
            return row && row.value === 'true';
        } catch (e) {
            return false;
        }
    }
    async function createWindow(restoreState = null) {
        const titleBarVisible = await getTitleBarVisible();
        const bounds = restoreState?.bounds;
        mainWindow = new BrowserWindow({
            x: bounds?.x,
            y: bounds?.y,
            width: bounds?.width || 1280,
            height: bounds?.height || 800,
            frame: titleBarVisible, // When true, show the standard Windows title bar (draggable)
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        mainWindow.setMenu(null);
        if (restoreState?.maximized) { mainWindow.maximize(); }
        if (isDev) { mainWindow.webContents.openDevTools(); }
        const startUrl = isDev ? process.env.ELECTRON_START_URL : `file://${path.join(__dirname, 'build/index.html')}`;
        mainWindow.loadURL(startUrl);
        if (webhookServer) { webhookServer.mainWindow = mainWindow; }
    }



    // --- NON-EDGIFY HANDLERS (UNCHANGED) ---
    ipcMain.on('log:message', (event, { level, message, data }) => { const logMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message; if (level === 'error') { logger.logError(`[Renderer] ${logMessage}`); } else { logger.log(`[Renderer] ${logMessage}`); } });
    ipcMain.handle('db:get-config', async () => { const db = dbManager.getDb(); const configData = await db('config').select('*'); const configObject = configData.reduce((obj, item) => { obj[item.key] = item.value; return obj; }, {}); let logoSrc = null; const localLogoPath = configObject.logo_local_path; if (localLogoPath && fs.existsSync(localLogoPath)) { const fileData = fs.readFileSync(localLogoPath); const base64Data = fileData.toString('base64'); const fileExtension = path.extname(localLogoPath).substring(1); const mimeType = `image/${fileExtension === 'svg' ? 'svg+xml' : fileExtension}`; logoSrc = `data:${mimeType};base64,${base64Data}`; } else { logoSrc = configObject.logo_url; } configObject.resolved_logo_src = logoSrc; return configObject; });
    ipcMain.handle('db:update-config', async (event, { key, value }) => {
        const db = dbManager.getDb();
        const result = await db('config').insert({ key, value }).onConflict('key').merge();
        if (rfidApi && (key === 'rfid_host' || key === 'rfid_port')) {
            const rows = await db('config').whereIn('key', ['rfid_host', 'rfid_port']);
            const cfg = rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
            rfidApi.updateConfig(cfg.rfid_host || 'localhost', cfg.rfid_port || '8080');
        }
        return result;
    });
    ipcMain.handle('dialog:open-logo', async () => { const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }] }); if (canceled || filePaths.length === 0) return null; const originalPath = filePaths[0]; const appDataPath = app.getPath('userData'); const imagesDir = path.join(appDataPath, 'images'); if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir); const newFileName = `logo${path.extname(originalPath)}`; const newPath = path.join(imagesDir, newFileName); fs.copyFileSync(originalPath, newPath); const db = dbManager.getDb(); await db('config').insert({ key: 'logo_local_path', value: newPath }).onConflict('key').merge(); return newPath; });
    ipcMain.handle('db:get-categories', async () => { const db = dbManager.getDb(); return await db('categories').select('*').orderBy('id'); });
    ipcMain.handle('categories:add', async (event, category) => { const db = dbManager.getDb(); return await db('categories').insert(category); });
    ipcMain.handle('categories:update', async (event, { id, updates }) => { const db = dbManager.getDb(); return await db('categories').where({ id }).update(updates); });
    ipcMain.handle('categories:delete', async (event, id) => { const db = dbManager.getDb(); const productsUsingCategory = await db('products').where({ category_id: id }).first(); if (productsUsingCategory) { throw new Error('Cannot delete category because it is still being used by one or more products.'); } return await db('categories').where({ id }).del(); });
    ipcMain.handle('products:get', async () => { const db = dbManager.getDb(); return await db('products').leftJoin('categories', 'products.category_id', '=', 'categories.id').select('products.*', 'categories.name as category_name').orderBy('products.name'); });
    ipcMain.handle('products:get-by-category', async (event, categoryId) => { const db = dbManager.getDb(); if (!categoryId) return []; return await db('products').where({ category_id: categoryId, enabled: true }); });
    ipcMain.handle('products:get-by-id', async (event, productId) => { const db = dbManager.getDb(); if (!productId) return null; return await db('products').where('products.id', productId).leftJoin('categories', 'products.category_id', '=', 'categories.id').select('products.*', 'categories.name as category_name').first(); });
    ipcMain.handle('products:add', async (event, product) => { const db = dbManager.getDb(); return await db('products').insert(product); });
    ipcMain.handle('products:update', async (event, { id, updates }) => { const db = dbManager.getDb(); return await db('products').where({ id: id }).update(updates); });
    ipcMain.handle('products:delete', async (event, id) => { const db = dbManager.getDb(); return await db('products').where({ id: id }).del(); });
    ipcMain.handle('data:export', async () => { const db = dbManager.getDb(); const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Export All Application Data', defaultPath: 'sco-data-export.json', filters: [{ name: 'JSON Files', extensions: ['json'] }] }); if (canceled || !filePath) { return { success: false, message: 'Export cancelled.' }; } try { const config = (await db('config').select('*')).filter(row => !SECRET_CONFIG_KEY_RE.test(row.key)); /* tokens and passwords are never exported */ const products = await db('products').select('*'); const categories = await db('categories').select('*'); const exportData = JSON.stringify({ version: 1, config, products, categories }, null, 2); fs.writeFileSync(filePath, exportData); return { success: true, message: `Data successfully exported to ${filePath}` }; } catch (error) { console.error('Export failed:', error); return { success: false, message: `Export failed: ${error.message}` }; } });
    ipcMain.handle('data:import', async () => { const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Import Application Data', properties: ['openFile'], filters: [{ name: 'JSON Files', extensions: ['json'] }] }); if (canceled || !filePaths || filePaths.length === 0) { return { success: false, message: 'Import cancelled.' }; } const filePath = filePaths[0]; const db = dbManager.getDb(); try { const fileContent = fs.readFileSync(filePath, 'utf-8'); const importData = JSON.parse(fileContent); if (!importData.products && !importData.categories) { throw new Error('Invalid import file format.'); } await db.transaction(async trx => { if (importData.categories && Array.isArray(importData.categories)) { await trx('products').del(); await trx('categories').del(); if (importData.categories.length > 0) { await trx.batchInsert('categories', importData.categories); } } if (importData.products && Array.isArray(importData.products)) { await trx('products').del(); if (importData.products.length > 0) { await trx.batchInsert('products', importData.products); } } if (importData.config && Array.isArray(importData.config)) { for (const configItem of importData.config) { if (configItem.key && configItem.value !== undefined) { await trx('config').insert({ key: configItem.key, value: configItem.value }).onConflict('key').merge(); } } } }); return { success: true, message: 'Data successfully imported.' }; } catch (error) { console.error('Import failed:', error); return { success: false, message: `Import failed: ${error.message}` }; } });


    // --- UPDATED EDGIFY IPC HANDLERS ---
    ipcMain.handle('edgify:ping', async (event, { config, isEnabled }) => {
        if (!isEnabled) {
            logger.log('[Edgify IPC] Ping skipped, agent is disabled.');
            return { success: false, message: 'Agent disabled' };
        }
        const client = new DigestClient({ user: 'edgify', password: config.token });
        const url = `http://${config.host}:${config.port}/api/v2/ping`;
        try {
            const response = await client.fetch(url, { method: 'GET' });
            return { success: response.ok, status: response.status };
        } catch (error) {
            logger.logError('[Edgify IPC] Ping failed:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('edgify:send-event', (event, { config, payload, isEnabled }) => {
        edgifyApi.sendEdgifyEvent(config, payload, isEnabled);
    });


    ipcMain.handle('edgify:send-capture-and-save', (event, { config, product, isEnabled, captureTrigger, labelTrigger }) => {
        edgifyApi.sendEdgifyCaptureAndSave(config, product, isEnabled, captureTrigger, labelTrigger);
    });

    ipcMain.handle('session:start-transaction', () => {
        transactionCounter += 1;
        logger.log(`[Session] Transaction counter bumped to ${transactionCounter}.`);
        // START_TRANSACTION (Section 3.4) — fire-and-forget. Not awaited so the
        // transactionNumber the renderer needs isn't delayed by MQTT connect.
        publishTransactionLifecycleEvent('START_TRANSACTION');
        return { transactionNumber: transactionCounter };
    });

    // END_TRANSACTION (Section 3.5) — fired by the renderer on payment/checkout
    // complete. Fire-and-forget on the publish topic.
    ipcMain.handle('session:end-transaction', async () => {
        return await publishTransactionLifecycleEvent('END_TRANSACTION');
    });

    // ITEM_SELECTED (Section 3.3 of the MQTT schema). Fire-and-forget on the same
    // publish topic as the recognition request. Skipped if MQTT is disabled or no
    // sampleId is supplied — sampleId is the spec-required correlation key.
    ipcMain.handle('edgify:publish-item-selected', async (event, params = {}) => {
        const { sampleId, label, name, family, category, barcode,
            labelTrigger, weight, price, totalPrice, count, image } = params;

        if (!sampleId) {
            logger.log('[Edgify MQTT] ITEM_SELECTED skipped — no sampleId from a prior PREDICTION_RESPONSE.');
            return { success: false, message: 'No sampleId available.' };
        }

        const db = dbManager.getDb();
        const rows = await db('config').whereIn('key', [
            'mqtt_enabled', 'mqtt_host', 'mqtt_port', 'mqtt_tls',
            'mqtt_username', 'mqtt_password', 'mqtt_client_id_prefix',
            'mqtt_publish_topic', 'mqtt_subscribe_topic',
            'store_code', 'source_system',
        ]);
        const cfg = rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
        if (cfg.mqtt_enabled !== 'true') {
            logger.log('[Edgify MQTT] ITEM_SELECTED skipped — MQTT is disabled.');
            return { success: false, message: 'MQTT disabled.' };
        }

        const now = Date.now();
        const payload = {
            eventType: 'ITEM_SELECTED',
            eventId: require('crypto').randomUUID(),
            sampleId,
            transactionNumber: String(transactionCounter || 1),
            storeCode: cfg.store_code || undefined,
            tillHost: TILL_HOST,
            sourceSystem: cfg.source_system || 'SCO',
            eventTimeStamp: now,
            capturedAt: now,
            label: label != null ? String(label) : undefined,
            labelTrigger: labelTrigger || undefined,
            name: name || undefined,
            family: family || undefined,
            category: category || undefined,
            barcode: barcode != null ? String(barcode) : undefined,
            ...(weight != null && weight !== '' ? { weight: Number(weight) } : {}),
            ...(price != null ? { price: Number(price) } : {}),
            ...(totalPrice != null ? { totalPrice: Number(totalPrice) } : {}),
            ...(count != null ? { count: Number(count) } : {}),
            ...(image ? { image } : {}),
        };

        try {
            await edgifyMqtt.publishEvent({
                host: (cfg.mqtt_host || '127.0.0.1').trim(),
                port: parseInt(cfg.mqtt_port, 10) || 1883,
                tls: cfg.mqtt_tls === 'true',
                username: cfg.mqtt_username || '',
                password: cfg.mqtt_password || '',
                clientIdPrefix: cfg.mqtt_client_id_prefix || 'sco-terminal',
                publishTopic: (cfg.mqtt_publish_topic || 'edgifyIn').trim(),
                subscribeTopic: (cfg.mqtt_subscribe_topic || 'edgifyOut').trim(),
            }, payload);
            return { success: true, eventId: payload.eventId };
        } catch (err) {
            logger.logError(`[Edgify MQTT] ITEM_SELECTED publish failed: ${err.message}`);
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('edgify:get-prediction', async (event, { config, trigger, category, isEnabled, weight }) => {
        // Read MQTT + terminal-identity settings — independent from the REST agent toggle.
        const db = dbManager.getDb();
        const mqttRows = await db('config').whereIn('key', [
            'mqtt_enabled', 'mqtt_host', 'mqtt_port', 'mqtt_tls',
            'mqtt_username', 'mqtt_password', 'mqtt_client_id_prefix',
            'mqtt_publish_topic', 'mqtt_subscribe_topic',
            'store_code', 'source_system',
        ]);
        const mqttCfg = mqttRows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
        const mqttEnabled = mqttCfg.mqtt_enabled === 'true';

        logger.log(`[Predict IPC] edgify:get-prediction — trigger="${trigger}" category="${category || ''}" REST=${!!isEnabled} MQTT=${mqttEnabled}`);

        if (!mqttEnabled) {
            logger.log(`[Predict IPC] MQTT disabled — taking REST path (REST enabled=${!!isEnabled}).`);
            return await edgifyApi.getEdgifyPrediction(config, trigger, category, isEnabled);
        }

        // MQTT path. If the REST agent toggle is also on, fire REST in parallel
        // (in addition) for side effects, but the response we surface comes from MQTT.
        const restInAddition = !!isEnabled && config && config.host && config.port;
        const publishTopic = (mqttCfg.mqtt_publish_topic || 'edgifyIn').trim();
        const subscribeTopic = (mqttCfg.mqtt_subscribe_topic || 'edgifyOut').trim();
        const brokerUrl = `${mqttCfg.mqtt_tls === 'true' ? 'mqtts' : 'mqtt'}://${(mqttCfg.mqtt_host || '127.0.0.1').trim()}:${parseInt(mqttCfg.mqtt_port, 10) || 1883}`;
        logger.log(`[Predict IPC] MQTT path — broker=${brokerUrl} publishTopic="${publishTopic}" subscribeTopic="${subscribeTopic}" restInAddition=${restInAddition}`);

        const restPromise = restInAddition
            ? edgifyApi.getEdgifyPrediction(config, trigger, category, isEnabled).catch(err => ({
                success: false, message: err.message, data: null
            }))
            : null;

        try {
            const mqttMsg = await edgifyMqtt.requestPrediction({
                host: (mqttCfg.mqtt_host || '127.0.0.1').trim(),
                port: parseInt(mqttCfg.mqtt_port, 10) || 1883,
                tls: mqttCfg.mqtt_tls === 'true',
                username: mqttCfg.mqtt_username || '',
                password: mqttCfg.mqtt_password || '',
                clientIdPrefix: mqttCfg.mqtt_client_id_prefix || 'sco-terminal',
                publishTopic,
                subscribeTopic,
            }, {
                transactionNumber: transactionCounter || 1,
                storeCode: mqttCfg.store_code,
                tillHost: TILL_HOST,
                sourceSystem: mqttCfg.source_system || 'SCO',
                captureTrigger: trigger,
                family: category,
                weight,
            });

            const data = edgifyMqtt.normalizePrediction(mqttMsg);
            logger.log(`[Edgify MQTT] Prediction received for session ${mqttMsg && mqttMsg.session_id} — options=${data?.options?.length || 0}`);
            return { success: true, data, source: 'mqtt' };
        } catch (mqttErr) {
            logger.logError(`[Edgify MQTT] Prediction failed: ${mqttErr.message}`);

            // If REST was already in flight (in addition), fall back to its result so the
            // user still gets a prediction when only MQTT failed.
            if (restPromise) {
                logger.log(`[Predict IPC] MQTT failed — falling back to REST result.`);
                const restResult = await restPromise;
                return { ...restResult, source: 'rest', mqttError: mqttErr.message };
            }
            return { success: false, data: null, message: mqttErr.message, source: 'mqtt' };
        }
    });

    ipcMain.handle('edgify:update-sample', (event, { config, sampleId, product, trigger, image, isEnabled }) => {
        edgifyApi.updateEdgifySample(config, sampleId, product, trigger, image, isEnabled);
    });

    ipcMain.handle('edgify:detect-cart-loss', async (event, { config, isEnabled }) => {
        // If disabled, return empty array (success)
        if (!isEnabled) return { success: true, items: [] };

        const url = `http://${config.host}:${config.port}/api/v2/detect-cart-loss`;
        const client = new DigestClient({ user: 'edgify', password: config.token });

        // 2-second fail-safe timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                //logger.log('[Edgify] Cart Loss Check timed out. Proceeding.');
                resolve({ timeout: true });
            }, 2000);
        });

        const apiPromise = (async () => {
            try {
                const response = await client.fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                if (response.ok) {
                    const data = await response.json();

                    // --- CHANGED LOGIC HERE ---
                    // The API returns an array directly: [{ id: "...", type: "LEFT_IN_CART", ... }]
                    // So we check if it is an array
                    if (Array.isArray(data)) {
                        return { success: true, items: data };
                    }
                    // Fallback if it returns { items: [] } in the future
                    else if (data && Array.isArray(data.items)) {
                        return { success: true, items: data.items };
                    }
                    else {
                        // Unexpected format, treat as empty
                        return { success: true, items: [] };
                    }
                } else {
                    logger.logError(`[Edgify] Cart Loss API Error: ${response.status}`);
                    return { success: false, error: response.status };
                }
            } catch (error) {
                logger.logError(`[Edgify] Cart Loss Network Error: ${error.message}`);
                return { success: false, error: error.message };
            }
        })();

        return await Promise.race([apiPromise, timeoutPromise]);
    });

    // --- RFID HANDLERS ---
    ipcMain.handle('rfid:test-connection', async () => {
        if (!rfidApi) return { success: false, message: 'RFID client not initialized' };
        return await rfidApi.testConnection();
    });

    ipcMain.handle('rfid:reconnect', async () => {
        if (!rfidApi) return { success: false, message: 'RFID client not initialized' };
        return await rfidApi.reconnect();
    });

    ipcMain.handle('rfid:scan-tags', async () => {
        if (!rfidApi) return { success: false, message: 'RFID client not initialized', tags: [] };
        const db = dbManager.getDb();
        const rows = await db('config').select('*');
        const cfg = rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
        const txPower = cfg.rfid_tx_power || '2700';
        const antennas = cfg.rfid_antennas || '6,8';

        const scanResult = await rfidApi.scanTags(txPower, antennas);
        if (!scanResult.success) return scanResult;

        // Enrich each tag with the matching product (by normalized SKU)
        const products = await db('products')
            .leftJoin('categories', 'products.category_id', '=', 'categories.id')
            .select('products.*', 'categories.name as category_name');

        const enriched = scanResult.tags.map(tag => {
            const tagSku = normalizeSKU(tag.sku);
            const product = products.find(p => normalizeSKU(p.id) === tagSku);
            if (product) {
                return {
                    ...tag,
                    product,
                    price: product.price,
                    category: product.category_name || null,
                    family: product.category_name || null,
                };
            }
            return { ...tag, product: null };
        });

        // Push to Edgify Prediction Agent: JSON object first, then captured image as a vision sample
        // sharing the same session_id (derived from EPC). Mirrors the RFID demo's flow.
        const predictionEnabled = cfg.edgify_prediction_enabled === 'true';
        const predictionConfig = {
            host: cfg.edgify_prediction_host,
            port: cfg.edgify_prediction_port,
            token: cfg.edgify_prediction_token,
        };
        const samples = [];
        if (predictionEnabled && enriched.length > 0) {
            for (const tag of enriched) {
                if (!tag.epc) continue;
                const jsonResult = await edgifyApi.sendJsonSample(predictionConfig, tag, true);

                // Fire 'Added-to-basket' event for the JSON sample
                let jsonEventOk = false;
                let jsonSampleId = null;
                if (jsonResult?.success) {
                    const jd = jsonResult?.data || {};
                    jsonSampleId =
                        jd.sampleId ||
                        jd.sample_id ||
                        jd.uuid ||
                        jd.id ||
                        jsonResult?.sessionId ||
                        null;
                    if (jsonSampleId) {
                        const evt = await edgifyApi.sendEdgifyEventAwaitable(
                            predictionConfig,
                            { name: 'Added-to-basket', sampleId: jsonSampleId },
                            true
                        );
                        jsonEventOk = !!evt?.success;
                    }
                }

                const captureResult = await edgifyApi.captureAndPredict(predictionConfig, tag, 'predictor', true);
                let capturedImage = null;
                if (captureResult?.data?.image) {
                    capturedImage = captureResult.data.image.startsWith('data:image')
                        ? captureResult.data.image
                        : `data:image/jpeg;base64,${captureResult.data.image}`;
                }
                let visionResult = null;
                if (capturedImage) {
                    visionResult = await edgifyApi.sendVisionSample(predictionConfig, tag, capturedImage, true);
                }
                let addedToBasketEventOk = false;
                let resolvedSampleId = null;
                if (jsonResult?.success && visionResult?.success) {
                    // Prefer the sample id returned by the agent for the vision sample we just pushed,
                    // then fall back to the client-generated uuid we sent, then session id.
                    const vd = visionResult?.data || {};
                    resolvedSampleId =
                        vd.sampleId ||
                        vd.sample_id ||
                        vd.uuid ||
                        vd.id ||
                        visionResult?.sampleUuid ||
                        jsonResult?.sessionId ||
                        null;
                    if (resolvedSampleId) {
                        const eventResult = await edgifyApi.sendEdgifyEventAwaitable(
                            predictionConfig,
                            { name: 'Added-to-basket', sampleId: resolvedSampleId },
                            true
                        );
                        addedToBasketEventOk = !!eventResult?.success;
                    }
                }
                samples.push({
                    epc: tag.epc,
                    sessionId: jsonResult?.sessionId || null,
                    jsonSampleId,
                    visionSampleId: resolvedSampleId,
                    capturedImage,
                    predictions: captureResult?.data?.predictions || null,
                    jsonOk: !!jsonResult?.success,
                    visionOk: !!visionResult?.success,
                    addedToBasketJsonOk: jsonEventOk,
                    addedToBasketVisionOk: addedToBasketEventOk,
                });
            }
        }

        return { ...scanResult, tags: enriched, samples };
    });

    // --- JPOS AND OTHER HANDLERS (UNCHANGED) ---
    ipcMain.handle('jpos:claim', async (event, { deviceName, scaleName, webhookPort, jposBackendUrl }) => {
        try {
            logger.log(`[JPOS] Claiming device "${deviceName}" via backend at ${jposBackendUrl}`);
            const response = await axios.post(`${jposBackendUrl}/api/device/claim`, { deviceName, scaleName, webhookPort });
            logger.log('[JPOS] Claim response:', response.data);
            return { success: true, message: response.data.message };
        } catch (error) {
            const errorMsg = error.response ? error.response.data.message : error.message;
            logger.logError(`[JPOS] Claim failed: ${errorMsg}`);
            return { success: false, message: errorMsg };
        }
    });

    ipcMain.handle('jpos:release', async (event, { jposBackendUrl }) => {
        try {
            logger.log(`[JPOS] Releasing devices via backend at ${jposBackendUrl}`);
            const response = await axios.post(`${jposBackendUrl}/api/device/release`);
            logger.log('[JPOS] Release response:', response.data);
            return { success: true, message: response.data.message };
        } catch (error) {
            const errorMsg = error.response ? error.response.data.message : error.message;
            logger.logError(`[JPOS] Release failed: ${errorMsg}`);
            return { success: false, message: errorMsg };
        }
    });

    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('app:quit', () => {
        app.quit();
    });

    ipcMain.handle('app:maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle('app:default-size', () => {
        if (mainWindow) {
            mainWindow.setSize(1280, 800);
            mainWindow.center();
        }
    });

    ipcMain.handle('app:toggle-title-bar', async () => {
        try {
            const db = dbManager.getDb();
            const current = await getTitleBarVisible();
            const next = !current;
            await db('config').insert({ key: 'app_title_bar_visible', value: String(next) }).onConflict('key').merge();

            let restoreState = null;
            isRecreatingWindow = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
                const maximized = mainWindow.isMaximized();
                const bounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
                restoreState = { bounds, maximized };
                const oldWindow = mainWindow;
                mainWindow = null;
                oldWindow.removeAllListeners('close');
                oldWindow.destroy();
            }
            await createWindow(restoreState);
            isRecreatingWindow = false;
            return { success: true, titleBarVisible: next };
        } catch (error) {
            isRecreatingWindow = false;
            logger.logError('[app:toggle-title-bar] Failed:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('app:get-title-bar-visible', async () => {
        return await getTitleBarVisible();
    });

    // --- MQTT TEST CONNECTION ---
    ipcMain.handle('mqtt:test-connection', async (event, options = {}) => {
        const host = (options.host || '127.0.0.1').trim();
        const port = options.port || 1883;
        const tls = !!options.tls;
        const username = options.username || '';
        const password = options.password || '';
        const clientIdPrefix = (options.clientIdPrefix || 'sco-terminal').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'sco';
        const subscribeTopic = (options.subscribeTopic || 'edgifyOut').trim();

        return await new Promise((resolve) => {
            const protocol = tls ? 'mqtts' : 'mqtt';
            const url = `${protocol}://${host}:${port}`;
            const clientId = `${clientIdPrefix}-test-${Date.now().toString(36)}`.slice(0, 23);

            let resolved = false;
            let testClient;

            const finalize = (result) => {
                if (resolved) return;
                resolved = true;
                try { if (testClient) testClient.end(true); } catch (_) { /* ignore */ }
                resolve(result);
            };

            try {
                testClient = mqtt.connect(url, {
                    username: username || undefined,
                    password: password || undefined,
                    clientId,
                    clean: true,
                    connectTimeout: 5000,
                    reconnectPeriod: 0,
                    rejectUnauthorized: false,
                });
            } catch (error) {
                logger.logError(`[MQTT Test] Setup error: ${error.message}`);
                return finalize({ success: false, message: `Setup error: ${error.message}` });
            }

            const overallTimeout = setTimeout(() => {
                finalize({ success: false, message: 'Connection timed out after 7 seconds.' });
            }, 7000);

            testClient.on('connect', () => {
                logger.log(`[MQTT Test] Connected to ${url} as ${clientId}`);
                testClient.subscribe(subscribeTopic, { qos: 1 }, (err) => {
                    clearTimeout(overallTimeout);
                    if (err) {
                        return finalize({ success: false, message: `Subscribe error on "${subscribeTopic}": ${err.message}` });
                    }
                    finalize({
                        success: true,
                        broker: url,
                        clientId,
                        message: `Connected and subscribed to "${subscribeTopic}".`,
                    });
                });
            });

            testClient.on('error', (err) => {
                logger.logError(`[MQTT Test] Error: ${err.message}`);
                clearTimeout(overallTimeout);
                finalize({ success: false, message: err.message || 'Connection error' });
            });
        });
    });

    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => { if (isDev && url.startsWith('https://localhost')) { event.preventDefault(); callback(true); } else { callback(false); } });

    app.whenReady().then(async () => {
        logger.log('App is ready.');
        try {
            const dbPath = path.join(app.getPath('userData'), 'sco-database.db');
            dbManager.init(dbPath);
            await dbManager.initializeDatabase();
            logger.log('SUCCESS: Database initialized.');

            const db = dbManager.getDb();
            const rfidConfigRows = await db('config').whereIn('key', ['rfid_host', 'rfid_port']);
            const rfidCfg = rfidConfigRows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
            rfidApi = new RfidApi(rfidCfg.rfid_host || 'localhost', rfidCfg.rfid_port || '8080');
            logger.log('RFID API initialized');

            await createWindow();

            webhookServer = new WebhookServer(3006, mainWindow);
            webhookServer.start();

            app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) { await createWindow(); } });
        } catch (error) {
            logger.logError(error);
            dialog.showErrorBox('Fatal Error', `Application failed during startup.\n\n${error.message}`);
            app.quit();
        }
    });

    app.on('window-all-closed', () => {
        if (isRecreatingWindow) {
            logger.log('Window destroyed for title-bar toggle, skipping quit.');
            return;
        }
        logger.log('All windows closed, quitting app.');
        if (webhookServer) { webhookServer.stop(); }
        if (process.platform !== 'darwin') { app.quit(); }
    });

} catch (error) {
    logger.logError(error);
    if (app && dialog) { dialog.showErrorBox('Fatal Startup Error', `A critical error occurred: ${error.message}\n\nCheck main-debug.log for details.`); }
    app.quit();
}