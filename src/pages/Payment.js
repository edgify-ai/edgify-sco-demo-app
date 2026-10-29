// src/pages/Payment.js
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, Landmark } from 'lucide-react';

export default function PaymentPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { total } = location.state || { total: 0 };
    const [config, setConfig] = useState(null);

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

    // Construct the session agent config needed for the API call
    const sessionAgentConfig = useMemo(() => config ? {
        host: config.edgify_session_host,
        port: config.edgify_session_port,
        token: config.edgify_session_token,
    } : null, [config]);

    const handlePayment = () => {
        // Updated logic: Check the correct flag and use the constructed config object
        const isSessionEnabled = config?.edgify_session_enabled === 'true';

        if (isSessionEnabled) {
            console.log('[Payment] Stopping Customer Session...');
            window.electronAPI.edgifySendEvent(sessionAgentConfig, { name: "StopCustomerSession" }, isSessionEnabled);
        }
        // END_TRANSACTION (MQTT Section 3.5) on payment/checkout complete.
        // Fire-and-forget; no-op in main when MQTT is disabled.
        if (window.electronAPI.endTransaction) {
            window.electronAPI.endTransaction().catch(() => {});
        }
        navigate('/thankyou');
    };

    if (!config) {
        return <div className="min-h-screen w-full flex items-center justify-center bg-gray-200">Loading...</div>;
    }

    return (
        <div
            className="relative min-h-screen w-full flex flex-col items-center justify-center bg-cover bg-center text-white p-4"
            style={{ backgroundImage: `url(${config.background_image_url})` }}
        >
            <div className="absolute inset-0 bg-blue-900 bg-opacity-50 backdrop-blur-sm"></div>
            <header className="absolute top-0 left-0 w-full flex justify-between items-center p-6 z-10">
                {config.resolved_logo_src && <img src={config.resolved_logo_src} alt="Logo" className="h-8" />}
            </header>
            <main className="relative z-10 flex flex-col items-center text-center">
                <div className="bg-white/20 backdrop-blur-lg p-10 rounded-2xl shadow-2xl border border-white/30 text-center">
                    <h1 className="text-5xl font-bold mb-4">Payment</h1>
                    <p className="text-2xl mb-8">Total: ${total.toFixed(2)}</p>
                    <div className="flex gap-8">
                        <button onClick={handlePayment} className="flex flex-col items-center justify-center w-48 h-32 bg-white/20 hover:bg-white/30 rounded-2xl transition-all transform hover:scale-105">
                            <CreditCard size={48} className="mb-2" />
                            <span className="text-xl font-semibold">Card</span>
                        </button>
                        <button onClick={handlePayment} className="flex flex-col items-center justify-center w-48 h-32 bg-white/20 hover:bg-white/30 rounded-2xl transition-all transform hover:scale-105">
                            <Landmark size={48} className="mb-2" />
                            <span className="text-xl font-semibold">Cash</span>
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}