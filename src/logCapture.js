// src/logCapture.js

const setupLogCapture = () => {
    // 1. Keep references to the original browser console methods
    // We need these so we don't break the F12 DevTools
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    // Helper function to format arguments (objects, arrays, strings) into one string
    const formatArgs = (args) => {
        return args.map(arg => {
            if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;
            if (typeof arg === 'object') return JSON.stringify(arg);
            return String(arg);
        }).join(' ');
    };

    // 2. Override console.log
    console.log = (...args) => {
        originalLog.apply(console, args); // Print to DevTools
        window.electronAPI?.logMessage({ 
            level: 'info', 
            message: formatArgs(args) 
        });
    };

    // 3. Override console.info (Treat as info)
    console.info = (...args) => {
        originalInfo.apply(console, args);
        window.electronAPI?.logMessage({ 
            level: 'info', 
            message: formatArgs(args) 
        });
    };

    // 4. Override console.warn (Treat as info or warning based on your logger)
    console.warn = (...args) => {
        originalWarn.apply(console, args);
        window.electronAPI?.logMessage({ 
            level: 'info', // Using 'info' because your logger.js might not have a specific 'warn' file
            message: `[WARN] ${formatArgs(args)}` 
        });
    };

    // 5. Override console.error
    console.error = (...args) => {
        originalError.apply(console, args);
        window.electronAPI?.logMessage({ 
            level: 'error', 
            message: formatArgs(args) 
        });
    };

    // 6. Catch Global React Crashes (Uncaught Exceptions)
    window.addEventListener('error', (event) => {
        window.electronAPI?.logMessage({
            level: 'error',
            message: `CRASH: ${event.message} at ${event.filename}:${event.lineno}`
        });
    });

    // 7. Catch Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
        window.electronAPI?.logMessage({
            level: 'error',
            message: `UNHANDLED PROMISE: ${event.reason}`
        });
    });

    console.log("--- Frontend Log Capture Initialized ---");
};

export default setupLogCapture;