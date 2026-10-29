// src/pages/Welcome.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScanLine, Search, Hand } from 'lucide-react';

const useKeyboardScanner = (onScan, isEnabled, timeout) => {
    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);
    useEffect(() => {
        if (!isEnabled) return;
        const buffer = [];
        let timerId = null;
        const handleKeyDown = (event) => {
            if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA' || event.target.nodeName === 'SELECT') return;
            const isPrintableChar = event.key.length === 1;
            const isEnterKey = event.key === 'Enter';
            if (!isPrintableChar && !isEnterKey) return;
            event.preventDefault();
            event.stopPropagation();
            if (timerId) clearTimeout(timerId);
            if (isEnterKey) {
                if (buffer.length > 2) {
                    const barcode = buffer.join('');
                    onScanRef.current(barcode);
                }
                buffer.length = 0;
            } else {
                buffer.push(event.key);
                timerId = setTimeout(() => { buffer.length = 0; }, timeout);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timerId) clearTimeout(timerId);
        };
    }, [isEnabled, timeout]);
};

export default function Welcome() {
    const [config, setConfig] = useState(null);
    const navigate = useNavigate();

    const startSessionAndNavigate = useCallback((path, state = {}) => {
        // Bump the per-session transaction counter on every Welcome → Checkout entry,
        // regardless of which prediction/session agent is enabled.
        if (window.electronAPI.startTransaction) {
            window.electronAPI.startTransaction().catch(() => {});
        }
        if (config?.edgify_enabled === 'true') {
            window.electronAPI.edgifySendEvent(config, { name: "StartCustomerSession", shopperId: "1" });
        }
        navigate(path, { state });
    }, [config, navigate]);

    const handleBarcodeScanned = useCallback(async (scannedBarcode) => {
        if (!config) return;
        try {
            const product = await window.electronAPI.getProductById(scannedBarcode);
            if (product) {
                if (config.edgify_enabled === 'true') {
                    window.electronAPI.edgifySendCaptureAndSave(config, product, config?.edgify_enabled === 'true', "barcode", "barcode");
                }
                startSessionAndNavigate('/checkout', { startupBarcode: scannedBarcode });
            } else {
                console.warn(`[WelcomePage] Product with barcode ${scannedBarcode} not found.`);
            }
        } catch (error) {
            console.error("[WelcomePage] Error processing startup scan:", error);
        }
    }, [startSessionAndNavigate, config]);

    const isKeyboardScannerEnabled = config?.scanner_model !== 'none';
    const keyboardScannerTimeout = parseInt(config?.keyboard_scanner_timeout, 10) || 500;
    
    useKeyboardScanner(handleBarcodeScanned, isKeyboardScannerEnabled, keyboardScannerTimeout);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const appConfig = await window.electronAPI.getConfig();
                setConfig(appConfig);
            } catch (error) {
                console.error("Failed to fetch config:", error);
            }
        };
        fetchConfig();
    }, []);

    if (!config) {
        return <div className="min-h-screen w-full flex items-center justify-center bg-gray-200 text-2xl font-semibold">Loading...</div>;
    }

    return (
        <div
            className="relative min-h-screen w-full flex flex-col items-center justify-center bg-cover bg-center text-white p-4"
            style={{ backgroundImage: `url(${config.background_image_url})` }}
        >
            <div className="absolute inset-0 bg-blue-900 bg-opacity-60"></div>
            <header className="absolute top-0 left-0 w-full flex justify-between items-center p-6 z-10">
                {config.resolved_logo_src && <img src={config.resolved_logo_src} alt="Logo" className="h-8" />}
                <Link to="/settings" className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-lg transition">
                    Help
                </Link>
            </header>
            <main className="relative z-10 flex flex-col items-center text-center">
                <div className="bg-white/20 backdrop-blur-lg p-10 rounded-2xl shadow-2xl border border-white/30">
                    <h1 className="text-5xl font-bold mb-2">Welcome to Self-Checkout</h1>
                    <p className="mb-8 text-white/80">Touch to start or scan your first item.</p>
                    <button
                        onClick={() => startSessionAndNavigate('/checkout')}
                        className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-xl text-xl transition-all transform hover:scale-105 mb-6"
                    >
                        <Hand className="w-6 h-6 inline mr-2" />
                        Touch to Start
                    </button>
                    <div className="flex justify-center gap-6 mt-6">
                        <div className="flex flex-col items-center p-4 bg-white/10 rounded-lg">
                            <ScanLine className="w-8 h-8 mb-2" />
                            <span>Scan Item</span>
                        </div>
                        <div className="flex flex-col items-center p-4 bg-white/10 rounded-lg">
                            <Search className="w-8 h-8 mb-2" />
                            <span>Look up Item</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}