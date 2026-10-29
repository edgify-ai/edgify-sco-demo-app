// src/components/WebcamScanner.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

const WebcamScanner = ({ onScan, deviceId }) => {
    const videoRef = useRef(null);
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    const [lastResult, setLastResult] = useState(null);

    // Memoize the onScan prop to prevent the effect from re-running unnecessarily
    const memoizedOnScan = useCallback(onScan, []);

    useEffect(() => {
        if (!deviceId) {
            setStatusMessage('No camera selected.');
            return;
        }

        const codeReader = new BrowserMultiFormatReader();
        let controls = null;

        const startScanner = async () => {
            try {
                setStatusMessage('Starting camera...');
                console.log(`[WebcamScanner] Starting decode from video device: ${deviceId}`);

                // The decodeFromVideoDevice method starts the stream AND the decoding loop.
                // It returns a 'controls' object to stop it.
                controls = await codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result, error) => {
                    if (result) {
                        const newResultText = result.getText();
                        if (newResultText !== lastResult) {
                            console.log(`[WebcamScanner] DECODED: ${newResultText}`);
                            // We update a local state to prevent spamming.
                            setLastResult(newResultText); 
                            memoizedOnScan(newResultText);
                            setStatusMessage(`Detected!`);

                            // Set a cooldown to prevent immediate re-scans of the same code.
                            setTimeout(() => setLastResult(null), 2000); 
                        }
                    }
                    if (error && !(error instanceof NotFoundException)) {
                        console.error('[WebcamScanner] Decode Error:', error);
                        setStatusMessage('Error during scanning.');
                    }
                });
                
                setStatusMessage('Scanning...');
                console.log('[WebcamScanner] Scanner started successfully.');

            } catch (err) {
                console.error('[WebcamScanner] Failed to start video stream:', err);
                setStatusMessage('ERROR: Camera access denied.');
            }
        };

        startScanner();

        // The cleanup function is now much simpler and safer.
        return () => {
            console.log('[WebcamScanner] Cleanup: Stopping scanner...');
            if (controls) {
                controls.stop();
            }
        };
    }, [deviceId, memoizedOnScan, lastResult]); // `lastResult` is now a dependency to correctly manage state in the callback

    return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-lg">
            <video ref={videoRef} className="w-full h-full object-cover" />

            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
                <div className="w-full max-w-xs h-28 border-4 border-white/50 rounded-lg" style={{ willChange: 'transform' }}></div>
                <p className="mt-4 text-white font-semibold bg-black/50 px-3 py-1 rounded-md">
                    {statusMessage}
                </p>
            </div>
            
            <div className={`absolute top-3 right-3 w-4 h-4 rounded-full transition-colors ${statusMessage === 'Scanning...' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        </div>
    );
};

export default WebcamScanner;