const fs = require('fs');
const path = require('path');

let logFilePath;

// --- Secret redaction ---------------------------------------------------------
// Every line written to the log file passes through redact(), so tokens and
// passwords never land on disk even if a caller logs a whole config object.
// This also covers renderer logs, which arrive here through the 'log:message' IPC.
const SECRET_KEY_PATTERN = '[A-Za-z0-9_]*(?:token|password|passwd|secret|api_?key|authorization)[A-Za-z0-9_]*';
const JSON_SECRET_RE = new RegExp(`("${SECRET_KEY_PATTERN}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'gi');
const KV_SECRET_RE = new RegExp(`\\b(${SECRET_KEY_PATTERN}\\s*[=:]\\s*)(?!")[^\\s,;&}]+`, 'gi');
const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const DIGEST_RE = /(Digest\s+)[^\n]*/g;

function redact(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(DIGEST_RE, '$1[REDACTED]')
        .replace(JSON_SECRET_RE, '$1"[REDACTED]"')
        .replace(KV_SECRET_RE, '$1[REDACTED]')
        .replace(JWT_RE, '[REDACTED_JWT]');
}

// Helper to format date for filenames
function getTimestampForFilename() {
    const now = new Date();
    return now.getFullYear() + '-' +
           String(now.getMonth() + 1).padStart(2, '0') + '-' +
           String(now.getDate()).padStart(2, '0') + '_' +
           String(now.getHours()).padStart(2, '0') + '-' +
           String(now.getMinutes()).padStart(2, '0') + '-' +
           String(now.getSeconds()).padStart(2, '0');
}

function init(app) {
    try {
        // 1. Determine where to put the logs
        // If packaged (.exe): Next to the executable
        // If dev (npm run dev): Project root folder (next to package.json)
        const baseDir = app.isPackaged 
            ? path.dirname(app.getPath('exe')) 
            : process.cwd(); 

        const logDir = path.join(baseDir, 'logs');
        
        // 2. Ensure directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // 3. Generate unique filename
        const filename = `session_${getTimestampForFilename()}.log`;
        logFilePath = path.join(logDir, filename);

        // 4. Create the file
        fs.writeFileSync(logFilePath, `--- Log Session Started: ${new Date().toISOString()} ---\n`);
        console.log(`[Logger] Logs are being written to: ${logFilePath}`);
        
    } catch (e) {
        console.error("Failed to initialize logger:", e);
    }
}

function log(message) {
    if (!logFilePath) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [INFO] ${redact(String(message))}\n`;
    
    console.log(formattedMessage.trim()); 
    
    try {
        fs.appendFileSync(logFilePath, formattedMessage);
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
}

function logError(error) {
    if (!logFilePath) return;

    const timestamp = new Date().toISOString();
    const errorMessage = (error instanceof Error) ? (error.stack || error.message) : JSON.stringify(error);
    const formattedMessage = `\n[${timestamp}] [ERROR] --- \n${redact(errorMessage)}\n--- END ERROR ---\n`;
    
    console.error(formattedMessage.trim());
    
    try {
        fs.appendFileSync(logFilePath, formattedMessage);
    } catch (err) {
        console.error('Failed to write error to log file:', err);
    }
}

module.exports = { init, log, logError, redact };