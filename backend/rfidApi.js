// backend/rfidApi.js
const axios = require('axios');
const logger = require('./logger');

class RfidApi {
    constructor(host = 'localhost', port = 8080) {
        this.baseUrl = `http://${host}:${port}`;
    }

    updateConfig(host, port) {
        this.baseUrl = `http://${host}:${port}`;
    }

    async scanTags(txPower = null, antennas = null) {
        try {
            logger.log('[RFID API] Scanning for tags...');
            const params = {};
            if (txPower) params.tx_power = txPower;
            if (antennas) params.antennas = antennas;
            const response = await axios.get(`${this.baseUrl}/scan`, {
                timeout: 5000,
                params
            });

            if (Array.isArray(response.data)) {
                const normalizedTags = response.data.map(item => {
                    if (item.product) {
                        return {
                            sku: item.product.sku,
                            name: item.product.name,
                            manufacture_date: item.product.manufacte_date || item.product.manufacture_date,
                            expiry_date: item.product.expiry_date,
                            batch_number: item.product.batch_number,
                            epc: item.product.epc,
                            timestamp: item.product.timestamp,
                            error: item.product.error,
                            hardware: item.hardware
                        };
                    }
                    return item;
                });

                logger.log(`[RFID API] Found ${normalizedTags.length} tag(s)`);
                return { success: true, tags: normalizedTags };
            } else {
                logger.logError('[RFID API] Invalid scan response format');
                return { success: false, message: 'Invalid response format', tags: [] };
            }
        } catch (error) {
            logger.logError('[RFID API] Scan error:', error.message);
            return {
                success: false,
                message: `RFID Reader Error: ${error.message}`,
                error: error.code,
                tags: []
            };
        }
    }

    async testConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/health`, {
                timeout: 3000
            });
            return { success: true, status: response.status, data: response.data };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async reconnect() {
        try {
            logger.log('[RFID API] Sending reconnect request...');
            const response = await axios.post(`${this.baseUrl}/reconnect`, {}, {
                timeout: 8000
            });
            logger.log('[RFID API] Reconnect response:', response.data);
            return { success: response.data?.success ?? true, message: response.data?.message, data: response.data };
        } catch (error) {
            logger.logError('[RFID API] Reconnect error:', error.message);
            return { success: false, message: error.message };
        }
    }
}

module.exports = RfidApi;
