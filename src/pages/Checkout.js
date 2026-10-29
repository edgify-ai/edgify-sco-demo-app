// src/pages/Checkout.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ScanLine, Scale, X, Zap, Loader2, ArrowLeft, Plus, Minus, HelpCircle, RefreshCw, Camera, Radio } from 'lucide-react';
import WebcamScanner from '../components/WebcamScanner';

// --- LOGGING HELPER: Removes Base64 images to keep logs clean ---
const sanitizeForLog = (data) => {
    if (!data || typeof data !== 'object') return data;

    try {
        if (Array.isArray(data)) {
            return data.map(item => {
                if (item && typeof item === 'object') {
                    const itemClone = { ...item };
                    if (itemClone.image) itemClone.image = '[BASE64 IMAGE OMITTED]';
                    return itemClone;
                }
                return item;
            });
        }
        const clean = { ...data };
        if (clean.image) clean.image = '[BASE64 IMAGE OMITTED]';
        if (clean.predictions && Array.isArray(clean.predictions)) {
            clean.predictions = clean.predictions.map(p => {
                const pClone = { ...p };
                if (pClone.image) pClone.image = '[BASE64 IMAGE OMITTED]';
                return pClone;
            });
        }
        if (clean.items && Array.isArray(clean.items)) {
            clean.items = clean.items.map(i => {
                const iClone = { ...i };
                if (iClone.image) iClone.image = '[BASE64 IMAGE OMITTED]';
                return iClone;
            });
        }
        return clean;
    } catch (e) {
        return data;
    }
};

// --- NEW COMPONENT: Displays the captured image from the agent ---
const CapturePreview = ({ image, sizeMode }) => {
    if (!image || sizeMode === 'hidden') return null;

    const imgSrc = image.startsWith('data:image') ? image : `data:image/jpeg;base64,${image}`;

    // Size Logic:
    // 'compact' = Half width (approx 1 category button wide), short height
    // 'normal' = Full width (spans container), taller height to use available space
    const isCompact = sizeMode === 'compact';

    return (
        <div className={`bg-white/60 backdrop-blur-md rounded-xl shadow-inner border border-white/40 flex flex-col items-center mb-2 flex-shrink-0 transition-all duration-300 mx-auto ${isCompact ? 'w-[48%] p-1 min-h-[60px] justify-center' : 'w-full p-3'}`}>

            <div className={`flex items-center gap-2 text-gray-600 ${isCompact ? 'mb-1' : 'mb-2'}`}>
                <Camera className={isCompact ? "w-3 h-3" : "w-4 h-4"} />
                <span className={`${isCompact ? 'text-[9px]' : 'text-xs'} font-bold uppercase tracking-wider`}>Agent Vision</span>
            </div>

            {/* Height scales with mode: compact is small strip, normal is large view */}
            <div className={`relative w-full bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center shadow-md transition-all duration-300 ${isCompact ? 'h-10' : 'h-24 lg:h-32'}`}>
                <img src={imgSrc} alt="Agent Capture" className="max-w-full max-h-full object-contain" />
            </div>
        </div>
    );
};
// ----------------------------------------------------------------

// (All helper components like useKeyboardScanner, Header, Basket, etc., remain unchanged)
const useKeyboardScanner = (onScan, isEnabled, timeout) => { const onScanRef = useRef(onScan); useEffect(() => { onScanRef.current = onScan; }, [onScan]); useEffect(() => { if (!isEnabled) return; const buffer = []; let timerId = null; const handleKeyDown = (event) => { if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA' || event.target.nodeName === 'SELECT') return; const isPrintableChar = event.key.length === 1; const isEnterKey = event.key === 'Enter'; if (!isPrintableChar && !isEnterKey) return; event.preventDefault(); event.stopPropagation(); if (timerId) clearTimeout(timerId); if (isEnterKey) { if (buffer.length > 2) { const barcode = buffer.join(''); onScanRef.current(barcode); } buffer.length = 0; } else { buffer.push(event.key); timerId = setTimeout(() => { buffer.length = 0; }, timeout); } }; window.addEventListener('keydown', handleKeyDown); return () => { window.removeEventListener('keydown', handleKeyDown); if (timerId) clearTimeout(timerId); }; }, [isEnabled, timeout]); };

// UPDATED HEADER: Now accepts onLogOff prop and uses a button instead of direct Link
const Header = ({ config, onLogOff }) => (
    <header className="flex justify-between items-center p-4 bg-white/80 backdrop-blur-sm rounded-t-2xl">
        {config?.resolved_logo_src && <img src={config.resolved_logo_src} alt="Logo" className="h-7" />}
        <div className="flex items-center gap-2">
            <Link to="/settings" className="text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition">Help</Link>
            <button onClick={onLogOff} className="text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition flex items-center gap-2">
                <LogOut size={16} /> Log off
            </button>
        </div>
    </header>
);

const Basket = ({ items, total }) => (<div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg h-full flex flex-col p-4"><div className="flex-grow overflow-y-auto">{items.length === 0 ? (<div className="h-full flex items-center justify-center text-gray-400"><p>Your basket is empty</p></div>) : (<table className="w-full text-left"><tbody>{items.map(item => (<tr key={`${item.id}-${Math.random()}`} className="border-b last:border-b-0"><td className="py-3 pr-2 w-1/2">{item.name}</td><td className="py-3 px-2 text-right w-1/4">{item.is_weight_based ? `${item.quantity.toFixed(2)} kg` : `x${item.quantity}`}</td><td className="py-3 pl-2 font-medium text-right w-1/4">${(item.price * item.quantity).toFixed(2)}</td></tr>))}</tbody></table>)}</div><div className="border-t pt-4 mt-4 flex justify-between items-center text-xl font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div></div>);

// Categories
const Categories = ({ categories, onCategoryClick }) => (
    <div className="grid grid-cols-2 gap-3 pb-2 h-full content-start">
        {categories.map(category => (
            <button
                key={category.id}
                onClick={() => onCategoryClick(category)}
                className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all text-center font-semibold text-gray-700 min-h-[96px] flex items-center justify-center"
            >
                {category.name}
            </button>
        ))}
    </div>
);

const EdgifyStatusIndicator = ({ status, isPinging, onClick, name, position }) => { const getStatusColor = () => { if (isPinging) return 'bg-yellow-400 animate-pulse'; switch (status) { case 'ok': return 'bg-green-500'; case 'error': return 'bg-red-500'; default: return 'bg-gray-400'; } }; return (<button onClick={onClick} className={`fixed ${position} flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg z-50 hover:scale-105 transition-transform`}><div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div><span className="text-xs font-semibold text-gray-700">{name}</span></button>); };
// Enrich a raw Edgify prediction option with the matching catalog product.
// Edgify may return label "Unknown" (MQTT schema §3.2) or a PLU we don't stock;
// neither has a catalog image, so flag isUnknown to render the question-mark
// icon (instead of a broken placeholder image) and route the click to the menu.
const enrichPredictionOption = async (option) => {
    const label = option?.label;
    const isUnknownLabel = label == null || String(label).trim().toLowerCase() === 'unknown';
    const product = isUnknownLabel ? null : await window.electronAPI.getProductById(label);
    if (!product || !product.id) {
        return { ...option, isUnknown: true, name: option?.name || 'Unknown' };
    }
    return { ...option, ...product };
};

// Thumbnail for a prediction card. Falls back to a question-mark icon for
// unknown predictions, options with no catalog image, or images that fail to
// load (e.g. an unreachable remote URL on an offline terminal).
const PredictionThumb = ({ item }) => {
    const [errored, setErrored] = useState(false);
    if (item.isUnknown || !item.image_url || errored) {
        return <HelpCircle className="w-20 h-20 text-gray-400" />;
    }
    return <img src={item.image_url} alt={item.name} onError={() => setErrored(true)} className="max-w-full max-h-full object-contain" />;
};

const ItemCarousel = ({ items, onAddItem, title, onClear }) => (<div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg h-[218px]"><h3 className="font-semibold mb-3 text-center text-gray-800">{title}</h3><div className="flex gap-4 overflow-x-auto pb-4">{items.map((item, index) => (<div key={item.id || index} onClick={item.isUnknown ? undefined : () => onAddItem(item)} className={`flex-shrink-0 flex flex-col items-center w-36 ${item.isUnknown ? 'cursor-default' : 'cursor-pointer group'}`}><div className="bg-white rounded-lg p-2 shadow-md group-hover:shadow-xl transition-shadow w-32 h-32 flex items-center justify-center"><PredictionThumb item={item} /></div><p className="mt-2 font-medium text-sm text-center text-gray-700 h-10">{item.name || 'Unknown'}</p>{item.price && <p className="text-xs text-gray-500">${item.price.toFixed(2)}</p>}{item.certainty && <p className="text-xs text-blue-600 font-bold">({(item.certainty * 100).toFixed(0)}%)</p>}</div>))}<div onClick={onClear} className="cursor-pointer group flex-shrink-0 flex flex-col items-center w-36"><div className="bg-gray-200 rounded-lg p-2 shadow-md group-hover:shadow-xl transition-shadow w-32 h-32 flex items-center justify-center hover:bg-gray-300"><RefreshCw className="w-16 h-16 text-gray-600" /></div><p className="mt-2 font-medium text-sm text-center text-gray-700 h-10">Try Again</p></div></div></div>);
const ActionArea = ({ scannerModel, onActionAreaClick, isPredictionLoading, onBarcodeScanned, webcamDeviceId }) => { if (isPredictionLoading) { return <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg flex items-center justify-center h-[218px]"><Loader2 className="w-16 h-16 text-blue-600 animate-spin" /></div>; } if (scannerModel === 'webcam_scanner' && webcamDeviceId) { return (<div className="h-[218px] rounded-xl overflow-hidden"><WebcamScanner onScan={onBarcodeScanned} deviceId={webcamDeviceId} /></div>); } if (scannerModel === 'keyboard_wedge' || scannerModel === 'zebra_jpos') { return (<div className="bg-blue-100/80 border border-blue-300 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center h-[218px] text-center"><Zap size={48} className="text-blue-600 mb-4" /><h3 className="text-xl font-bold text-blue-800">Scanner Active</h3><p className="text-blue-700">Scan any item to add it to the basket.</p></div>); } return (<div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg flex items-center justify-around h-[218px]"><div className="text-center space-y-2 text-gray-700"><ScanLine className="w-16 h-16 mx-auto" /><p className="font-semibold">Scan Barcode</p></div><div className="text-gray-300 font-light text-2xl">OR</div><div onClick={() => onActionAreaClick('action-area')} className="text-center space-y-2 text-gray-700 p-4 rounded-lg"><Scale className="w-16 h-16 mx-auto" /><p className="font-semibold">Place Item on Scale</p></div></div>); };
const ItemMenu = ({ category, onAddItem, onBack }) => { const [items, setItems] = useState([]); const [isLoading, setIsLoading] = useState(false); useEffect(() => { if (category) { const fetchItems = async () => { setIsLoading(true); const categoryItems = await window.electronAPI.getProductsByCategory(category.id); setItems(categoryItems); setIsLoading(false); }; fetchItems(); } }, [category]); return (<div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg h-full flex flex-col p-4"><div className="flex items-center mb-4 flex-shrink-0"><button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 mr-2"><ArrowLeft size={20} /></button><h2 className="text-xl font-bold">{category?.name}</h2></div><div className="flex-grow overflow-y-auto pr-2">{isLoading ? <p>Loading...</p> : (<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{items.map(item => (<div key={item.id} onClick={() => onAddItem(item, 'RegularMenu')} className="cursor-pointer group flex flex-col items-center p-2 border rounded-lg hover:shadow-lg hover:-translate-y-1 transition-all"><div className="w-full h-32 bg-white flex items-center justify-center rounded-md mb-2 p-1"><img src={item.image_url || 'https://via.placeholder.com/128'} alt={item.name} className="max-w-full max-h-full object-contain" /></div><p className="font-semibold text-center text-sm text-gray-800 flex-grow">{item.name}</p><p className="text-sm text-gray-600">${item.price.toFixed(2)}</p></div>))}</div>)}{items.length === 0 && !isLoading && <p className="text-center text-gray-500 py-8">No enabled items in this category.</p>}</div></div>); };
const QuantityModal = ({ isOpen, onClose, item, onConfirm }) => { const [quantity, setQuantity] = useState(1); useEffect(() => { if (isOpen) { setQuantity(1); } }, [isOpen]); if (!isOpen || !item) return null; const increment = () => setQuantity(q => q + 1); const decrement = () => setQuantity(q => Math.max(1, q - 1)); return (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center"><h2 className="text-2xl font-bold mb-2">Enter Quantity</h2><p className="text-lg text-gray-700 mb-6">{item.name}</p><div className="flex items-center justify-center gap-4 mb-8"><button onClick={decrement} className="p-3 bg-gray-200 rounded-full hover:bg-gray-300"><Minus size={24} /></button><span className="text-5xl font-bold w-24 text-center">{quantity}</span><button onClick={increment} className="p-3 bg-gray-200 rounded-full hover:bg-gray-300"><Plus size={24} /></button></div><div className="flex justify-between gap-4"><button onClick={onClose} className="flex-1 py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600">Cancel</button><button onClick={() => onConfirm(quantity)} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Confirm</button></div></div></div>); };


export default function CheckoutPage() {
    const [basket, setBasket] = useState([]);
    const [total, setTotal] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const [config, setConfig] = useState(null);
    const [categories, setCategories] = useState([]);

    const [predictionAgentStatus, setPredictionAgentStatus] = useState('pending');
    const [sessionAgentStatus, setSessionAgentStatus] = useState('pending');

    const [predictions, setPredictions] = useState(null);
    const [isPredictionLoading, setIsPredictionLoading] = useState(false);

    // Core state for Edgify logic
    const [lastPredictionResponse, setLastPredictionResponse] = useState(null);
    const lastPredictionResponseRef = useRef(lastPredictionResponse);
    // Last stable scale weight (kg) reported by JPOS. Used to fill the
    // weight/totalPrice fields of ITEM_SELECTED for weight-based items.
    const lastScaleWeightRef = useRef(null);

    // UI state for Agent Vision
    const [previewImage, setPreviewImage] = useState(null);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight); // Track screen height

    useEffect(() => { lastPredictionResponseRef.current = lastPredictionResponse; }, [lastPredictionResponse]);

    // Handle Window Resize for Vision Widget
    useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Determine Widget Size Mode
    const getWidgetSizeMode = () => {
        // STRICTER THRESHOLDS to prevent scrolling category list
        // < 800: No room, hide it completely.
        // 800 - 720: Tight space, show compact (half width, short).
        // > 720: Show normal (full width).
        if (windowHeight < 800) return 'hidden';
        if (windowHeight < 720) return 'compact';
        return 'normal';
    };

    const [isPinging, setIsPinging] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [viewMode, setViewMode] = useState('basket');
    const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
    const [itemPendingQuantity, setItemPendingQuantity] = useState(null);
    const [addTrigger, setAddTrigger] = useState(null);

    // RFID
    const [rfidScanLoading, setRfidScanLoading] = useState(false);
    const [rfidScanStatus, setRfidScanStatus] = useState(null);

    const predictionAgentConfig = useMemo(() => config ? {
        host: config.edgify_prediction_host,
        port: config.edgify_prediction_port,
        token: config.edgify_prediction_token,
    } : null, [config]);

    const sessionAgentConfig = useMemo(() => config ? {
        host: config.edgify_session_host,
        port: config.edgify_session_port,
        token: config.edgify_session_token,
    } : null, [config]);


    // ITEM_SELECTED feedback per MQTT schema 3.3. Fires only when MQTT is enabled
    // and we have a sampleId from a prior PREDICTION_RESPONSE — sampleId is the
    // spec-required correlation key for AI training.
    const fireItemSelected = useCallback((item, trigger, { count, weight: explicitWeight } = {}) => {
        if (config?.mqtt_enabled !== 'true') return;
        const lastPrediction = lastPredictionResponseRef.current;
        const sampleId = lastPrediction?.sampleId;
        if (!sampleId) return;
        if (trigger !== 'RegularMenu' && trigger !== 'RecommendationStrip') return;

        const labelTrigger = trigger === 'RegularMenu' ? 'RegularMenuSelection' : 'RecommendationStrip';
        const isWeightBased = item.product_type === 'weight' || item.is_weight_based;
        const weight = isWeightBased
            ? (explicitWeight != null ? explicitWeight : lastScaleWeightRef.current)
            : undefined;
        const effectiveCount = !isWeightBased ? (count || 1) : undefined;
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price);
        const multiplier = isWeightBased ? (weight || 0) : (effectiveCount || 1);
        const totalPrice = Number.isFinite(price) ? Number((price * multiplier).toFixed(2)) : undefined;

        window.electronAPI.edgifyPublishItemSelected({
            sampleId,
            label: item.id,
            barcode: item.id,
            name: item.name,
            family: item.category_name || selectedCategory?.name,
            category: item.category_name || selectedCategory?.name,
            labelTrigger,
            weight,
            price: Number.isFinite(price) ? price : undefined,
            totalPrice,
            count: effectiveCount,
        }).catch(err => console.error('[ITEM_SELECTED] publish failed:', err));
    }, [config, selectedCategory]);

    const handleQuantityConfirm = useCallback((quantity) => {
        if (!itemPendingQuantity) return;
        const productWithQuantity = { ...itemPendingQuantity, count: quantity, quantity: quantity, is_weight_based: false };
        setBasket(prev => {
            const existingItem = prev.find(i => i.id === productWithQuantity.id);
            if (existingItem) { return prev.map(i => (i.id === productWithQuantity.id ? { ...i, quantity: i.quantity + quantity } : i)); }
            return [...prev, productWithQuantity];
        });

        const lastPrediction = lastPredictionResponseRef.current;
        if (lastPrediction?.sampleId) {
            console.log('[handleQuantityConfirm] Updating Prediction Agent Sample');
            window.electronAPI.edgifyUpdateSample(predictionAgentConfig, lastPrediction.sampleId, productWithQuantity, addTrigger, lastPrediction.image, config?.edgify_prediction_enabled === 'true');
        }

        if (config?.edgify_session_enabled === 'true') {
            console.log(`[handleQuantityConfirm] Sending CaptureAndSave to Session Agent. Qty: ${quantity}, Trigger: ${addTrigger}`);
            window.electronAPI.edgifySendCaptureAndSave(sessionAgentConfig, productWithQuantity, true, addTrigger || "manual", addTrigger || "manual");
        }

        fireItemSelected(productWithQuantity, addTrigger, { count: quantity });

        setIsQuantityModalOpen(false);
        setItemPendingQuantity(null);
        setAddTrigger(null);
        setViewMode('basket');
        setPredictions(null);
        setPreviewImage(null); // Clear preview

    }, [itemPendingQuantity, addTrigger, predictionAgentConfig, sessionAgentConfig, config, fireItemSelected]);

    const handleAddItem = useCallback((item, trigger) => {
        console.log(`[handleAddItem] START - Trigger: "${trigger}"`, { item: sanitizeForLog(item) });

        if (!item) {
            console.log(`[handleAddItem] Error: Item is null or undefined. Returning.`);
            return;
        }

        const lastPrediction = lastPredictionResponseRef.current;
        console.log(`[handleAddItem] Current lastPrediction state:`, sanitizeForLog(lastPrediction));

        if (item.product_type === 'quantity') {
            console.log(`[handleAddItem] Item type is 'quantity'. Opening Quantity Modal.`);
            setItemPendingQuantity(item);
            setAddTrigger(trigger);
            setIsQuantityModalOpen(true);
        } else {
            console.log(`[handleAddItem] Item type is '${item.product_type}' (Weight/Single). Proceeding to auto-add.`);

            const isWeightBased = item.product_type === 'weight';
            const quantity = 1.00;

            const hasSampleId = !!lastPrediction?.sampleId;
            const isRecoOrMenu = trigger === "RecommendationStrip" || trigger === "RegularMenu";
            const isBarcode = trigger === "barcode";

            console.log(`[handleAddItem] Edgify Logic Check: hasSampleId=${hasSampleId}, isRecoOrMenu=${isRecoOrMenu}, isBarcode=${isBarcode}`);

            if (hasSampleId && isRecoOrMenu) {
                console.log(`[handleAddItem] Branch: Prediction Exists + Menu/Strip Click.`);
                const productWithCount = { ...item, count: 1.00 };

                // --- FIX: Compare CONTENT (Host & Port), not object references ---
                const isSameAgent =
                    sessionAgentConfig?.host === predictionAgentConfig?.host &&
                    String(sessionAgentConfig?.port) === String(predictionAgentConfig?.port);

                console.log(`[handleAddItem] Checking Agent Identity:`, {
                    sessionPort: sessionAgentConfig?.port,
                    predPort: predictionAgentConfig?.port,
                    isSameAgent: isSameAgent
                });

                // Only send to Session Agent if it is PHYSICALLY different from Prediction Agent
                if (!isSameAgent) {
                    console.log(`[handleAddItem] Session Agent is different from Prediction Agent. Sending Capture to Session Agent.`);
                    window.electronAPI.edgifySendCaptureAndSave(sessionAgentConfig, item, config?.edgify_session_enabled === 'true', trigger, trigger);
                } else {
                    console.log(`[handleAddItem] Agents are the same. Skipping redundant capture call.`);
                }

                console.log(`[handleAddItem] Updating Sample on Prediction Agent (SampleID: ${lastPrediction.sampleId}).`);
                window.electronAPI.edgifyUpdateSample(predictionAgentConfig, lastPrediction.sampleId, productWithCount, trigger, lastPrediction.image, config?.edgify_prediction_enabled === 'true');

            } else if (isBarcode) {
                console.log(`[handleAddItem] Branch: Barcode Scan. Sending CaptureAndSave to Session Agent.`);
                window.electronAPI.edgifySendCaptureAndSave(sessionAgentConfig, item, config?.edgify_session_enabled === 'true', trigger, trigger);
            } else {
                console.log(`[handleAddItem] Branch: Fallback. No Edgify API calls triggered. (Trigger was: ${trigger})`);
            }

            // Fire ITEM_SELECTED feedback to Edgify (MQTT, schema 3.3). No-op unless
            // MQTT is on, sampleId exists, and trigger is menu/recommendation.
            fireItemSelected(item, trigger, { count: isWeightBased ? undefined : 1 });

            console.log(`[handleAddItem] Updating Basket...`);
            const itemToAdd = { ...item, quantity, is_weight_based: isWeightBased };

            setBasket(prev => {
                const existingItem = prev.find(i => i.id === item.id);
                if (existingItem) {
                    console.log(`[handleAddItem] Updating quantity for existing item: ${item.name}`);
                    return prev.map(i => (i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i));
                }
                console.log(`[handleAddItem] Adding new item to basket: ${item.name}`);
                return [...prev, itemToAdd];
            });

            setViewMode('basket');
            setPredictions(null);
            setPreviewImage(null); // Clear preview on successful add
            console.log(`[handleAddItem] END - View reset to basket, predictions cleared.`);
        }
    }, [config, predictionAgentConfig, sessionAgentConfig, fireItemSelected]);

    const handleBarcodeScanned = useCallback(async (barcode) => {
        try { const product = await window.electronAPI.getProductById(barcode); if (product) { if (product.enabled) { handleAddItem(product, "barcode"); } else { alert(`Item "${product.name}" is currently disabled.`); } } else { console.warn(`Product not found: ${barcode}`); } }
        catch (error) { console.error("Error fetching product:", error); }
    }, [handleAddItem]);

    // Stable handle for the JPOS scanner effect. The effect must only re-run on
    // config changes — re-running on callback identity churn (e.g. category
    // clicks recreating fireItemSelected → handleAddItem → handleBarcodeScanned)
    // releases and re-claims the physical scanner and leaves it unresponsive.
    const handleBarcodeScannedRef = useRef(handleBarcodeScanned);
    useEffect(() => { handleBarcodeScannedRef.current = handleBarcodeScanned; }, [handleBarcodeScanned]);

    const isKeyboardScannerEnabled = config?.scanner_model !== 'none';
    const keyboardScannerTimeout = parseInt(config?.keyboard_scanner_timeout, 10) || 500;
    useKeyboardScanner(handleBarcodeScanned, isKeyboardScannerEnabled, keyboardScannerTimeout);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const appConfig = await window.electronAPI.getConfig(); setConfig(appConfig);
                const appCategories = await window.electronAPI.getCategories(); setCategories(appCategories);
            } catch (error) { console.error("Failed to fetch checkout data:", error); }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (config && location.state?.startupBarcode) {
            handleBarcodeScanned(location.state.startupBarcode);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [config, location.state?.startupBarcode, handleBarcodeScanned, navigate, location.pathname]);

    useEffect(() => {
        if (!config || config.scanner_model !== 'zebra_jpos') return;
        let isMounted = true;
        let hasClaimedDevice = false;
        const claimDevice = async () => {
            if (!isMounted || hasClaimedDevice) return;
            try {
                const response = await window.electronAPI.jposClaimDevice({ deviceName: config.jpos_device_name, scaleName: config.jpos_scale_name, webhookPort: '3006', jposBackendUrl: config.jpos_backend_url });
                if (response.success && isMounted) { hasClaimedDevice = true; console.log('[JPOS] Device claimed successfully'); }
                else if (isMounted) { console.error(`[JPOS] Claim Failed: ${response.message}`); }
            } catch (error) { if (isMounted) { console.error('[JPOS] Claim error:', error); } }
        };
        const handleScan = (scanData) => { if (isMounted && scanData?.barcodeData) { handleBarcodeScannedRef.current(scanData.barcodeData); } };
        const handleWeightEvent = (scanData) => {
            if (isMounted) {

                console.log(`[JPOS] Weight event: ${scanData.weight}`);

                if (scanData && typeof scanData.weight === 'number') {
                    lastScaleWeightRef.current = scanData.weight;
                }

                const minWeight = parseFloat(config.min_weight_threshold || '0');
                if (scanData && scanData.weight > minWeight) {
                    if (config.webhook_predictions_enabled === 'true') {
                        console.log(`[JPOS] Weight stable (${scanData.weight}). Prediction call skipped (Zebra Adaptor Webhooks Mode is ON).`);
                    } else {
                        console.log(`[JPOS] Weight event received (${scanData.weight} ${scanData.unit}). Calling to execute a prediction.`);
                        handleActionAreaClick('scale-stable', scanData.weight);
                    }
                } else {
                    console.log(`[JPOS] Prediction not called because the scale reported below the minimum weight threshold (${minWeight}) .`);
                }
            }
        };
        const handleError = (errorData) => { if (isMounted) { console.error(`[JPOS] Device Error: ${errorData.message}`); } };

        claimDevice();
        window.electronAPI.onJposScan(handleScan);
        window.electronAPI.onJposWeight(handleWeightEvent);
        window.electronAPI.onJposError(handleError);

        return () => {
            isMounted = false;
            if (hasClaimedDevice) { window.electronAPI.jposReleaseDevice({ jposBackendUrl: config.jpos_backend_url }); }
            window.electronAPI.removeJposListeners();
        };
    }, [config]);

    useEffect(() => {
        // Never log the full config object: it contains agent tokens and the MQTT password.
        console.log('[DEBUG] Setting up Edgify Listener. Prediction agent:', `${config?.edgify_prediction_host}:${config?.edgify_prediction_port}`);
        const isEnabled = config?.edgify_prediction_enabled === 'true';
        console.log('[DEBUG] Prediction Enabled?', isEnabled);

        if (!isEnabled) {
            console.log('[DEBUG] Listener NOT registered because prediction is disabled.');
            return;
        }

        const handleEdgifyPrediction = async (predictionData) => {
            console.log('[DEBUG] handleEdgifyPrediction - Handler triggered! Data received:', sanitizeForLog(predictionData));

            if (config.webhook_predictions_enabled !== 'true') {
                console.log('[Edgify Webhook] Ignored prediction details from the webhook because Zebra webhook Mode is OFF');
                return;
            }

            console.log('[Edgify Webhook] Prediction received via edgify webhook (Webhook Adaptor Mode is ON) - processing...');

            const normalizedData = {
                ...predictionData,
                sampleId: predictionData.sampleId || predictionData.uuid || predictionData.id || predictionData.prediction_uuid,
                image: predictionData.image || null
            };

            console.log('[Edgify Webhook] Normalized Data (Check for sampleId here):', sanitizeForLog(normalizedData));

            setLastPredictionResponse(normalizedData);
            setPreviewImage(normalizedData.image); // Set Preview

            if (predictionData?.predictions?.length > 0) {
                const enrichedOptions = await Promise.all(predictionData.predictions.map(enrichPredictionOption));
                setPredictions(enrichedOptions);
            } else {
                setPredictions([{ name: 'Unknown', certainty: 1.0, isUnknown: true }]);
            }
        };

        window.electronAPI.onEdgifyPrediction(handleEdgifyPrediction);
        console.log('[DEBUG] Listener registered successfully.');

        return () => {
            console.log('[DEBUG] Cleaning up Listener.');
            window.electronAPI.removeEdgifyListeners();
        };
    }, [config]);

    useEffect(() => {
        const isEnabled = config?.edgify_session_enabled === 'true';
        if (!isEnabled) return;

        console.log('[Edgify Session] Starting session...');
        window.electronAPI.edgifySendEvent(sessionAgentConfig, { name: "StartCustomerSession" }, isEnabled);
    }, [config, sessionAgentConfig]);

    useEffect(() => {
        if (!config) return;
        const pingAgents = async () => {
            const isPredEnabled = config.edgify_prediction_enabled === 'true';
            setPredictionAgentStatus(isPredEnabled ? (await window.electronAPI.edgifyPing(predictionAgentConfig, isPredEnabled)).success ? 'ok' : 'error' : 'disabled');

            const isSessionEnabled = config.edgify_session_enabled === 'true';
            setSessionAgentStatus(isSessionEnabled ? (await window.electronAPI.edgifyPing(sessionAgentConfig, isSessionEnabled)).success ? 'ok' : 'error' : 'disabled');
        };
        pingAgents();
        const interval = parseInt(config.edgify_prediction_ping_interval, 10) || 5000;
        const intervalId = setInterval(pingAgents, interval);
        return () => clearInterval(intervalId);
    }, [config, predictionAgentConfig, sessionAgentConfig]);

    const forcePing = useCallback(async () => {
        if (isPinging) return;
        setIsPinging(true);
        const isPredEnabled = config.edgify_prediction_enabled === 'true';
        if (isPredEnabled) {
            const result = await window.electronAPI.edgifyPing(predictionAgentConfig, isPredEnabled);
            setPredictionAgentStatus(result.success ? 'ok' : 'error');
        }
        const isSessionEnabled = config.edgify_session_enabled === 'true';
        if (isSessionEnabled) {
            const result = await window.electronAPI.edgifyPing(sessionAgentConfig, isSessionEnabled);
            setSessionAgentStatus(result.success ? 'ok' : 'error');
        }
        setIsPinging(false);
    }, [isPinging, config, predictionAgentConfig, sessionAgentConfig]);

    useEffect(() => { const newTotal = basket.reduce((acc, item) => acc + (item.price * item.quantity), 0); setTotal(newTotal); }, [basket]);

    const prevBasketCountRef = useRef(0);

    const handleCategoryClick = async (category) => {
        setSelectedCategory(category);
        setViewMode('itemMenu');

        const isPredictionEnabled = config?.edgify_prediction_enabled === 'true';
        const isMqttEnabled = config?.mqtt_enabled === 'true';
        const anyPredictionTransportEnabled = isPredictionEnabled || isMqttEnabled;
        const isGeneralCategory = category.name === 'General';
        const isAdaptorMode = config?.webhook_predictions_enabled === 'true';

        console.log(`[Predict Gate] handleCategoryClick "${category.name}" — REST=${isPredictionEnabled} MQTT=${isMqttEnabled} adaptor=${isAdaptorMode} general=${isGeneralCategory}`);

        if (anyPredictionTransportEnabled && !isGeneralCategory && !isAdaptorMode) {
            const transports = [isPredictionEnabled && 'REST', isMqttEnabled && 'MQTT'].filter(Boolean).join('+') || 'NONE';
            console.log(`[Predict Gate] Triggering prediction for "${category.name}" via ${transports}.`);
            setIsPredictionLoading(true);
            setPredictions(null);
            setPreviewImage(null); // Clear previous preview while loading

            const result = await window.electronAPI.edgifyGetPrediction(predictionAgentConfig, 'category-menu', category.name, isPredictionEnabled);

            console.log(`[Predict Gate] Prediction result source=${result?.source || 'rest'} success=${result?.success}`, sanitizeForLog(result.data));
            setLastPredictionResponse(result.data);
            setPreviewImage(result.data?.image); // Set new preview

            if (result.success && result.data?.options?.length > 0) {
                const enrichedOptions = await Promise.all(result.data.options.map(enrichPredictionOption));
                setPredictions(enrichedOptions);
            } else {
                setPredictions([{ name: 'Unknown', certainty: 1.0, isUnknown: true }]);
            }

            setIsPredictionLoading(false);
        } else {
            console.log(`[Predict Gate] Skipping prediction for "${category.name}" — anyTransport=${anyPredictionTransportEnabled} general=${isGeneralCategory} adaptor=${isAdaptorMode}`);
        }
    };


    const handleActionAreaClick = async (trigger, weight = null) => {
        const isEnabled = config?.edgify_prediction_enabled === 'true';
        const isMqttEnabled = config?.mqtt_enabled === 'true';
        const anyTransport = isEnabled || isMqttEnabled;

        console.log(`[Predict Gate] handleActionAreaClick trigger="${trigger}" weight=${weight ?? ''} — REST=${isEnabled} MQTT=${isMqttEnabled}`);

        if (!anyTransport) {
            console.log(`[Predict Gate] Skipping handleActionAreaClick — both REST and MQTT are disabled.`);
            return;
        }
        const transports = [isEnabled && 'REST', isMqttEnabled && 'MQTT'].filter(Boolean).join('+');
        console.log(`[Predict Gate] Triggering action-area prediction via ${transports}.`);

        setIsPredictionLoading(true); setPredictions(null); setPreviewImage(null);
        const result = await window.electronAPI.edgifyGetPrediction(predictionAgentConfig, trigger, null, isEnabled, weight);

        console.log(`[Predict Gate] ActionArea result source=${result?.source || 'rest'} success=${result?.success}`, sanitizeForLog(result.data));
        setLastPredictionResponse(result.data);
        setPreviewImage(result.data?.image);

        if (result.success && result.data?.options?.length > 0) {
            const enrichedOptions = await Promise.all(result.data.options.map(enrichPredictionOption));
            setPredictions(enrichedOptions);
        } else {
            setPredictions([{ name: 'Unknown', certainty: 1.0, isUnknown: true }]);
        }
        setIsPredictionLoading(false);
    };

    const handlePredictionClick = (prediction) => {
        if (prediction.isUnknown) { setViewMode('itemMenu'); setSelectedCategory({ name: "All Categories" }); setPredictions(null); return; }
        if (prediction.id) { handleAddItem(prediction, "RecommendationStrip"); }
    };

    const handleClearPrediction = () => {
        setPredictions(null);
        setPreviewImage(null); // Clear image on explicit clear
    };

    const rfidScanRunningRef = useRef(false);

    const handleRfidScan = useCallback(async () => {
        if (rfidScanRunningRef.current) return;
        rfidScanRunningRef.current = true;
        setRfidScanLoading(true);
        setRfidScanStatus(null);
        try {
            const result = await window.electronAPI.scanRfidTags();
            if (!result.success) {
                setRfidScanStatus({ type: 'error', message: result.message || 'Scan failed' });
                return;
            }
            if (!result.tags || result.tags.length === 0) {
                setRfidScanStatus({ type: 'info', message: 'No RFID tags detected' });
                return;
            }

            // Log JSON push + vision sample results from the prediction agent
            if (Array.isArray(result.samples) && result.samples.length > 0) {
                for (const s of result.samples) {
                    console.log(`[RFID->Agent] EPC=${s.epc} session=${s.sessionId} jsonOk=${s.jsonOk} visionOk=${s.visionOk}`);
                }
            }

            // RFID does NOT mutate the basket — basket is driven only by regular SCO flows
            // (barcode, menu, prediction). RFID's role here is to push labeled samples to
            // the Edgify Prediction Agent.
            const matchedCount = result.tags.filter(t => t.product && t.product.enabled).length;
            const unmatchedCount = result.tags.length - matchedCount;
            const sampleSummary = (result.samples || []).filter(s => s.jsonOk || s.visionOk).length;

            const parts = [];
            if (matchedCount) parts.push(`${matchedCount} tag${matchedCount !== 1 ? 's' : ''} recognized`);
            if (unmatchedCount) parts.push(`${unmatchedCount} unknown tag${unmatchedCount !== 1 ? 's' : ''}`);
            if (sampleSummary > 0) parts.push(`${sampleSummary} pushed to agent`);
            setRfidScanStatus({
                type: sampleSummary > 0 || matchedCount > 0 ? 'success' : 'error',
                message: parts.join(' · ') || 'No matching products found'
            });
        } catch (error) {
            setRfidScanStatus({ type: 'error', message: error.message });
        } finally {
            rfidScanRunningRef.current = false;
            setRfidScanLoading(false);
            setTimeout(() => setRfidScanStatus(null), 5000);
        }
    }, []);

    // Auto-trigger an RFID scan whenever an item is added to the basket (when RFID is enabled).
    // The scan only pushes samples to the Edgify Prediction Agent — it does not mutate
    // the basket, so there is no re-entrancy risk.
    useEffect(() => {
        const prevCount = prevBasketCountRef.current;
        const currentCount = basket.reduce((acc, i) => acc + (i.quantity || 0), 0);
        prevBasketCountRef.current = currentCount;
        if (config?.rfid_enabled === 'true' && currentCount > prevCount) {
            handleRfidScan();
        }
    }, [basket, config, handleRfidScan]);

    // --- NEW LOGOFF HANDLER ---
    const handleLogOff = () => {
        // Explicitly end session before navigating
        if (config?.edgify_session_enabled === 'true') {
            console.log('[Checkout] User logged off - Stopping Customer Session');
            window.electronAPI.edgifySendEvent(sessionAgentConfig, { name: "StopCustomerSession" }, true);
        }
        navigate('/');
    };

    const handlePay = async () => {
        const isSessionEnabled = config?.edgify_session_enabled === 'true';
        if (isSessionEnabled) {
            window.electronAPI.edgifySendEvent(sessionAgentConfig, { name: "PayNow" }, isSessionEnabled);
            console.log('[handlePay] Sending Pay Now event');
        }
        const isCartLossEnabled = config?.edgify_cart_loss_enabled === 'true';

        if (isSessionEnabled && isCartLossEnabled) {
            console.log('[Cart Loss Setting is true] Checking for unscanned items...');
            try {
                const result = await window.electronAPI.edgifyDetectCartLoss(sessionAgentConfig, true);
                console.log('[Cart Loss] Agent result is:', sanitizeForLog(result));

                if (result.success && result.items && result.items.length > 0) {
                    console.warn('[Cart Loss] BLOCKED. Unscanned items detected:', sanitizeForLog(result.items));
                    return;
                }

                if (result.timeout) {
                    console.log('[Cart Loss] Check timed out. Proceeding to payment.');
                } else if (!result.success) {
                    console.log('[Cart Loss] Check failed (API error). Proceeding to payment.');
                } else {
                    console.log('[Cart Loss] No unscanned items found. Proceeding.');
                }

            } catch (error) {
                console.error('[Cart Loss] Unexpected error during check. Proceeding.', error);
            }
        }
        setPreviewImage(null); // Clear before leaving page
        navigate('/payment', { state: { total } });
    };


    if (!config) { return <div className="min-h-screen w-full flex items-center justify-center bg-gray-200 text-2xl font-semibold">Loading...</div>; }

    return (
        <>
            <div className="min-h-screen w-full flex items-center justify-center bg-cover bg-center p-4" style={{ backgroundImage: `url(${config.background_image_url})` }}>
                <div className="w-full max-w-6xl h-[90vh] bg-transparent flex gap-4">
                    <div className="w-2/3 flex flex-col gap-4">
                        <div>
                            {predictions ? (
                                <ItemCarousel items={predictions} onAddItem={handlePredictionClick} title="Did you mean:" onClear={handleClearPrediction} />
                            ) : isPredictionLoading ? (
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg flex items-center justify-center h-[218px]"><Loader2 className="w-16 h-16 text-blue-600 animate-spin" /></div>
                            ) : (
                                <ActionArea onActionAreaClick={handleActionAreaClick} isPredictionLoading={isPredictionLoading} scannerModel={config.scanner_model} onBarcodeScanned={handleBarcodeScanned} webcamDeviceId={config.webcam_device_id} />
                            )}
                        </div>
                        <div className="flex-grow min-h-0">
                            {viewMode === 'basket' ? (<Basket items={basket} total={total} />) : (<ItemMenu category={selectedCategory} onAddItem={handleAddItem} onBack={() => setViewMode('basket')} />)}
                        </div>
                    </div>
                    <div className="w-1/3 bg-white/50 backdrop-blur-md rounded-2xl shadow-lg flex flex-col p-4 gap-4">
                        <Header config={config} onLogOff={handleLogOff} />

                        {/* Container for Categories and Preview to share vertical space */}
                        <div className="flex-grow flex flex-col min-h-0">
                            <div className="flex-grow overflow-y-auto mb-2">
                                <Categories categories={categories} onCategoryClick={handleCategoryClick} />
                            </div>

                            {config.edgify_show_agent_vision === 'true' && previewImage && (
                                <CapturePreview image={previewImage} sizeMode={getWidgetSizeMode()} />
                            )}
                        </div>

                        {config.rfid_enabled === 'true' && (
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={handleRfidScan}
                                    disabled={rfidScanLoading}
                                    className="w-full py-3 text-base font-bold text-white bg-purple-600 rounded-2xl shadow-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                                >
                                    {rfidScanLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
                                    {rfidScanLoading ? 'Scanning...' : 'Scan RFID Tags'}
                                </button>
                                {rfidScanStatus && (
                                    <div className={`text-xs text-center px-3 py-1 rounded-md ${rfidScanStatus.type === 'success' ? 'bg-green-100 text-green-700' : rfidScanStatus.type === 'info' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {rfidScanStatus.message}
                                    </div>
                                )}
                            </div>
                        )}
                        <button onClick={handlePay} disabled={basket.length === 0} className="w-full py-6 text-2xl font-bold text-white bg-green-500 rounded-2xl shadow-lg hover:bg-green-600 disabled:bg-gray-400">Pay</button>
                        <div className="text-center text-xs text-gray-600">Powered by <span className="font-semibold">Edgify</span></div>
                    </div>
                </div>
                {config.edgify_prediction_enabled === 'true' && <EdgifyStatusIndicator status={predictionAgentStatus} isPinging={isPinging} onClick={forcePing} name="Prediction Agent" position="bottom-4 right-4" />}
                {config.edgify_session_enabled === 'true' && <EdgifyStatusIndicator status={sessionAgentStatus} isPinging={isPinging} onClick={forcePing} name="Session Agent" position="bottom-4 left-4" />}
            </div>
            <QuantityModal isOpen={isQuantityModalOpen} onClose={() => setIsQuantityModalOpen(false)} item={itemPendingQuantity} onConfirm={handleQuantityConfirm} />
        </>
    );
}