import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function ThankYouPage() {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(10);
    
    const [config, setConfig] = useState(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // One API call gets everything we need
                const appConfig = await window.electronAPI.getConfig();
                setConfig(appConfig);
            } catch (error) {
                console.error("Failed to fetch config:", error);
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        if (!config) return; // Don't start the countdown until the page has loaded
        if (countdown <= 0) {
            navigate('/');
            return;
        }
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, navigate, config]);

    const handleEarlyExit = () => navigate('/');
    
    if (!config) {
        return <div className="min-h-screen w-full flex items-center justify-center bg-gray-200">Loading...</div>;
    }

    return (
        <div
            className="relative min-h-screen w-full flex flex-col items-center justify-center bg-cover bg-center text-white p-4 cursor-pointer"
            style={{ backgroundImage: `url(${config.background_image_url})` }}
            onClick={handleEarlyExit}
        >
            <div className="absolute inset-0 bg-blue-900 bg-opacity-50 backdrop-blur-sm"></div>
            <header className="absolute top-0 left-0 w-full flex justify-between items-center p-6 z-10">
                {config.resolved_logo_src && <img src={config.resolved_logo_src} alt="Logo" className="h-8" />}
            </header>
            <main className="relative z-10 flex flex-col items-center text-center">
                <div className="bg-white/20 backdrop-blur-lg p-12 rounded-2xl shadow-2xl border border-white/30 text-center">
                    <CheckCircle className="w-24 h-24 mx-auto mb-6 text-green-300" />
                    <h1 className="text-6xl font-bold mb-4">Thank You!</h1>
                    <p className="text-lg">Please take your items.</p>
                </div>
                <p className="mt-8 text-sm text-white/70">
                    Returning to Welcome screen in {countdown} seconds...
                </p>
            </main>
        </div>
    );
}