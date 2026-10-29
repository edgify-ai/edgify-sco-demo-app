// webhook-server.js
const express = require('express');
const cors = require('cors');

class WebhookServer {
  constructor(port, mainWindow) {
    this.port = port;
    this.mainWindow = mainWindow;
    this.app = express();
    this.server = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(cors());
  
    // Increase payload size limits - adjust these values based on your needs
    this.app.use(express.json({ 
      limit: '50mb',  // Increase JSON payload limit
      extended: true 
    }));
    
    this.app.use(express.urlencoded({ 
      limit: '50mb',  // Increase URL-encoded payload limit
      extended: true,
      parameterLimit: 50000  // Increase parameter limit if needed
    }));

  }
  
  setupRoutes() {
    this.app.post('/webhooks/scan-event', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- WEBHOOK: Scan Event Received ---');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('jpos-scan-event', req.body);
      }
      res.status(200).json({ status: 'received' });
    });
    
    this.app.post('/webhooks/weight-event', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- WEBHOOK: Weight Event Received ---');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('--------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('jpos-weight-event', req.body);
        //this.mainWindow.emit('internal-jpos-weight', req.body);
      }
      res.status(200).json({ status: 'received' });
    });
    
    this.app.post('/webhooks/device-status', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- WEBHOOK: Device Status Received ---');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('-----------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('jpos-device-status', req.body);
      }
      res.status(200).json({ status: 'received' });
    });
    

    this.app.post('/predict', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- Edgify WEBHOOK: Prediction Details Event Received from Agent ---');
      console.log('Timestamp:', new Date().toISOString());
      //console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('-----------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        
        console.log('--- WEBHOOK: passing the message to the app window ---');
        this.mainWindow.webContents.send('edgify-predict', req.body);
      }
      else {
        console.log('Main window is not available to receive the prediction event.');
      }
      res.status(200).json({ status: 'received' });
    });

    this.app.post('/alert-non-scan', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- WEBHOOK: Alert Non-Scan Event Received ---');
      console.log('Timestamp:', new Date().toISOString());
      //console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('-----------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('edgify-alert-non-scan', req.body);
      }
      res.status(200).json({ status: 'received' });
    });

    this.app.post('/alert-non-match', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- WEBHOOK: Alert Non-Match Event Received ---');
      console.log('Timestamp:', new Date().toISOString());
      //console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('-----------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('edgify-alert-non-match', req.body);
      }
      res.status(200).json({ status: 'received' });
    });


    this.app.post('/webhooks/error-event', (req, res) => {
      // --- ADDED DETAILED LOG ---
      console.log('--- WEBHOOK: ERROR Event Received ---');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('-------------------------------------');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('jpos-error-event', req.body);
      }
      res.status(200).json({ status: 'received' });
    });
  }
  
  start() {
    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`>>> Webhook server is active and listening on http://localhost:${this.port}`);
    });
  }
  
  stop() {
    if (this.server) {
      this.server.close();
      console.log('Webhook server stopped.');
    }
  }
}

module.exports = WebhookServer;