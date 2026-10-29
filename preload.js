// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Config and settings
  getConfig: () => ipcRenderer.invoke('db:get-config'),
  updateConfig: (key, value) => ipcRenderer.invoke('db:update-config', { key, value }),
  openLogoDialog: () => ipcRenderer.invoke('dialog:open-logo'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  maximizeApp: () => ipcRenderer.invoke('app:maximize'),
  defaultSizeApp: () => ipcRenderer.invoke('app:default-size'),
  toggleTitleBar: () => ipcRenderer.invoke('app:toggle-title-bar'),
  getTitleBarVisible: () => ipcRenderer.invoke('app:get-title-bar-visible'),

  // MQTT (Edgify broker)
  mqttTestConnection: (options) => ipcRenderer.invoke('mqtt:test-connection', options),

  // Categories
  getCategories: () => ipcRenderer.invoke('db:get-categories'),
  getProductsByCategory: (categoryId) => ipcRenderer.invoke('products:get-by-category', categoryId),
  addCategory: (category) => ipcRenderer.invoke('categories:add', category),
  updateCategory: (id, updates) => ipcRenderer.invoke('categories:update', { id, updates }),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  // Product functions
  getProducts: () => ipcRenderer.invoke('products:get'),
  addProduct: (product) => ipcRenderer.invoke('products:add', product),
  updateProduct: (id, updates) => ipcRenderer.invoke('products:update', { id, updates }),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  getProductById: (productId) => ipcRenderer.invoke('products:get-by-id', productId),

  // Data functions
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),

  // Logging function
  logMessage: (log) => ipcRenderer.send('log:message', log),

  // --- UPDATED EDGIFY API BRIDGE ---
  edgifyPing: (config, isEnabled) => ipcRenderer.invoke('edgify:ping', { config, isEnabled }),
  edgifySendEvent: (config, payload, isEnabled) => ipcRenderer.invoke('edgify:send-event', { config, payload, isEnabled }),

  edgifySendCaptureAndSave: (config, product, isEnabled, captureTrigger, labelTrigger) =>
    ipcRenderer.invoke('edgify:send-capture-and-save', { config, product, isEnabled, captureTrigger, labelTrigger }),
  edgifyGetPrediction: (config, trigger, category, isEnabled, weight) => ipcRenderer.invoke('edgify:get-prediction', { config, trigger, category, isEnabled, weight }),
  edgifyPublishItemSelected: (params) => ipcRenderer.invoke('edgify:publish-item-selected', params),
  startTransaction: () => ipcRenderer.invoke('session:start-transaction'),
  endTransaction: () => ipcRenderer.invoke('session:end-transaction'),
  edgifyUpdateSample: (config, sampleId, product, trigger, image, isEnabled) => ipcRenderer.invoke('edgify:update-sample', { config, sampleId, product, trigger, image, isEnabled }),
  edgifyDetectCartLoss: (config, isEnabled) => ipcRenderer.invoke('edgify:detect-cart-loss', { config, isEnabled }),
  // --- END UPDATED EDGIFY API BRIDGE ---

  // RFID Functions
  testRfidConnection: () => ipcRenderer.invoke('rfid:test-connection'),
  reconnectRfid: () => ipcRenderer.invoke('rfid:reconnect'),
  scanRfidTags: () => ipcRenderer.invoke('rfid:scan-tags'),

  // JPOS Functions
  jposClaimDevice: (options) => ipcRenderer.invoke('jpos:claim', options),
  jposReleaseDevice: (options) => ipcRenderer.invoke('jpos:release', options),

  // JPOS Event Listeners
  onJposScan: (callback) => ipcRenderer.on('jpos-scan-event', (_event, data) => callback(data)),
  onJposWeight: (callback) => ipcRenderer.on('jpos-weight-event', (_event, data) => callback(data)),
  onJposError: (callback) => ipcRenderer.on('jpos-error-event', (_event, data) => callback(data)),
  removeJposListeners: () => {
    ipcRenderer.removeAllListeners('jpos-scan-event');
    ipcRenderer.removeAllListeners('jpos-weight-event');
    ipcRenderer.removeAllListeners('jpos-error-event');
  },

  // Edgify Webhook Event Listeners
  onEdgifyPrediction: (callback) => ipcRenderer.on('edgify-predict', (_event, data) => callback(data)),
  onEdgifyNonScan: (callback) => ipcRenderer.on('edgify-alert-non-scan', (_event, data) => callback(data)),
  removeEdgifyListeners: () => {
    ipcRenderer.removeAllListeners('edgify-predict');
    ipcRenderer.removeAllListeners('edgify-alert-non-scan');
  }
});