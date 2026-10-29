// src/pages/Settings.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Image as ImageIcon, PlusCircle, Edit, Trash2, Upload, Download, Info, Eye, LogOut, Radio, X, CheckCircle, AlertCircle, Wifi } from 'lucide-react';


const ProductModal = ({ isOpen, onClose, onSubmit, product, categories }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        const initialData = product ? {
            ...product,
            product_type: product.is_weight_based ? 'weight' : (product.product_type || 'quantity')
        } : {
            id: '',
            name: '',
            price: '0.00',
            category_id: categories.length > 0 ? categories[0].id : '',
            image_url: '',
            product_type: 'quantity', // Default for new products
        };
        setFormData(initialData);
    }, [product, categories, isOpen]);


    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === "product_type") {
            setFormData(prev => ({ ...prev, product_type: value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSubmit = {
            ...formData,
            price: parseFloat(formData.price),
            is_weight_based: formData.product_type === 'weight',
            product_type: formData.product_type,
            category_id: parseInt(formData.category_id, 10),
            enabled: product ? !!product.enabled : true
        };
        onSubmit(dataToSubmit);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-4">{product ? 'Edit Product' : 'Add New Product'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Barcode / SKU</label>
                        <input type="text" name="id" value={formData.id || ''} onChange={handleChange} placeholder="e.g., 4011" className="w-full p-2 border rounded mt-1" required disabled={!!product} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Product Name</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g., Banana" className="w-full p-2 border rounded mt-1" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Price</label>
                        <input type="number" name="price" value={formData.price || ''} onChange={handleChange} placeholder="e.g., 1.99" step="0.01" className="w-full p-2 border rounded mt-1" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Category</label>
                        <select name="category_id" value={formData.category_id || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" required>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Image URL (Optional)</label>
                        <input type="text" name="image_url" value={formData.image_url || ''} onChange={handleChange} placeholder="https://..." className="w-full p-2 border rounded mt-1" />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Product Type</label>
                        <div className="flex items-center gap-4 mt-2">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="product_type" value="weight" checked={formData.product_type === 'weight'} onChange={handleChange} className="h-4 w-4" />
                                By Weight
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="product_type" value="single" checked={formData.product_type === 'single'} onChange={handleChange} className="h-4 w-4" />
                                Single
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="product_type" value="quantity" checked={formData.product_type === 'quantity'} onChange={handleChange} className="h-4 w-4" />
                                Quantity
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">Save Product</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
const ProductManagementTable = ({ products, onEdit, onDelete, onAdd, onToggleEnabled }) => (<div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8"><div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4"><h2 className="text-2xl font-bold text-gray-800">Product Inventory</h2><button onClick={onAdd} className="flex items-center gap-2 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-green-600 transition-colors"><PlusCircle size={18} /> Add New Product</button></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-50 border-b"><tr><th className="p-3 font-semibold text-gray-600">Image</th><th className="p-3 font-semibold text-gray-600">Barcode</th><th className="p-3 font-semibold text-gray-600">Name</th><th className="p-3 font-semibold text-gray-600">Price</th><th className="p-3 font-semibold text-gray-600">Enabled</th><th className="p-3 font-semibold text-gray-600 text-right">Actions</th></tr></thead><tbody>{products.map(p => (<tr key={p.id} className={`border-b hover:bg-gray-50 ${!p.enabled && 'opacity-50 bg-gray-50'}`}><td className="p-2">{p.image_url ? (<img src={p.image_url} alt={p.name} className="w-12 h-12 object-contain rounded-md bg-gray-100" />) : (<div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-md text-gray-400"><ImageIcon size={20} /></div>)}</td><td className="p-3 font-mono text-sm">{p.id}</td><td className="p-3">{p.name}</td><td className="p-3">${typeof p.price === 'number' ? p.price.toFixed(2) : 'N/A'}</td><td className="p-3"><button onClick={() => onToggleEnabled(p.id, !p.enabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${p.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${p.enabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></td><td className="p-3 flex gap-2 justify-end"><button onClick={() => onEdit(p)} title="Edit" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit size={16} /></button><button onClick={() => onDelete(p.id)} title="Delete" className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16} /></button></td></tr>))}</tbody></table>{products.length === 0 && <p className="text-center text-gray-500 py-8">No products found.</p>}</div></div>);
const CategoryManagement = ({ categories, onAdd, onUpdate, onDelete }) => { const [editingCategory, setEditingCategory] = useState(null); const [newCategoryName, setNewCategoryName] = useState(''); const handleEdit = (category) => { setEditingCategory({ ...category }); }; const handleSave = () => { if (!editingCategory?.name.trim()) return; onUpdate(editingCategory.id, { name: editingCategory.name }); setEditingCategory(null); }; const handleAdd = () => { if (!newCategoryName.trim() || categories.length >= 6) return; onAdd({ name: newCategoryName }); setNewCategoryName(''); }; return (<div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8"><h2 className="text-2xl font-bold text-gray-800 mb-4">Category Management (Max 6)</h2><div className="space-y-2">{categories.map(cat => (<div key={cat.id} className="flex items-center gap-2">{editingCategory?.id === cat.id ? (<input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))} className="flex-grow p-2 border rounded" />) : (<p className="flex-grow p-2">{cat.name}</p>)}{editingCategory?.id === cat.id ? (<button onClick={handleSave} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Save size={16} /></button>) : (<button onClick={() => handleEdit(cat)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit size={16} /></button>)}<button onClick={() => onDelete(cat.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16} /></button></div>))}</div>{categories.length < 6 && (<div className="flex items-center gap-2 mt-4 pt-4 border-t"><input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name..." className="flex-grow p-2 border rounded" /><button onClick={handleAdd} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"><PlusCircle size={20} /></button></div>)}</div>); };

export default function SettingsPage() {
    const navigate = useNavigate();
    const [config, setConfig] = useState(null);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [fallbackLogoUrl, setFallbackLogoUrl] = useState('');
    const [backgroundUrl, setBackgroundUrl] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [scannerModel, setScannerModel] = useState('none');
    const [videoDevices, setVideoDevices] = useState([]);
    const [selectedWebcamId, setSelectedWebcamId] = useState('');
    const [keyboardTimeout, setKeyboardTimeout] = useState(100);
    const [zebraAdaptorEnabled, setZebraAdaptorEnabled] = useState(false);

    // Edgify Prediction Agent State
    const [predEnabled, setPredEnabled] = useState(false);
    const [predHost, setPredHost] = useState('localhost');
    const [predPort, setPredPort] = useState(8090);
    const [predToken, setPredToken] = useState('');
    const [predPingInterval, setPredPingInterval] = useState(5000);

    // Edgify Session Agent State
    const [sessionEnabled, setSessionEnabled] = useState(false);
    const [sessionHost, setSessionHost] = useState('localhost');
    const [sessionPort, setSessionPort] = useState(8091);
    const [sessionToken, setSessionToken] = useState('');
    const [cartLossEnabled, setCartLossEnabled] = useState(false);

    // New: Agent Vision
    const [showAgentVision, setShowAgentVision] = useState(false);

    const [jposBackendUrl, setJposBackendUrl] = useState('http://localhost:8081');
    const [jposDeviceName, setJposDeviceName] = useState('ZebraScannerUSB');
    const [jposScaleName, setJposScaleName] = useState('ZebraScale');
    const [minWeightThreshold, setMinWeightThreshold] = useState(0);
    const [appVersion, setAppVersion] = useState('');
    const [titleBarVisible, setTitleBarVisible] = useState(false);

    // MQTT (Edgify broker) state - independent from REST agent settings
    const [mqttEnabled, setMqttEnabled] = useState(false);
    const [mqttHost, setMqttHost] = useState('127.0.0.1');
    const [mqttPort, setMqttPort] = useState(1883);
    const [mqttTls, setMqttTls] = useState(false);
    const [mqttUsername, setMqttUsername] = useState('edgify');
    const [mqttPassword, setMqttPassword] = useState('');
    const [mqttClientIdPrefix, setMqttClientIdPrefix] = useState('sco-terminal');
    const [mqttPublishTopic, setMqttPublishTopic] = useState('edgifyIn');
    const [mqttSubscribeTopic, setMqttSubscribeTopic] = useState('edgifyOut');
    const [mqttTestStatus, setMqttTestStatus] = useState(null);
    const [mqttTestLoading, setMqttTestLoading] = useState(false);

    // Terminal identity fields sent with ITEM_RECOGNITION_REQUEST predictions.
    // tillHost is derived from os.hostname() in the main process — no UI for it.
    const [storeCode, setStoreCode] = useState('');
    const [sourceSystem, setSourceSystem] = useState('SCO');

    // RFID Reader state
    const [rfidEnabled, setRfidEnabled] = useState(false);
    const [rfidHost, setRfidHost] = useState('localhost');
    const [rfidPort, setRfidPort] = useState('8080');
    const [rfidTxPower, setRfidTxPower] = useState('2700');
    const [rfidAntennas, setRfidAntennas] = useState([6, 8]);
    const [rfidStatus, setRfidStatus] = useState(null);
    const [reconnectStatus, setReconnectStatus] = useState(null);
    const [reconnectLoading, setReconnectLoading] = useState(false);
    const [testReadActive, setTestReadActive] = useState(false);
    const [testReadTags, setTestReadTags] = useState([]);
    const [testReadHistory, setTestReadHistory] = useState([]);
    const [testReadStatus, setTestReadStatus] = useState('idle');
    const testReadActiveRef = React.useRef(false);
    const testReadEmptyCount = React.useRef(0);

    const fetchData = useCallback(async () => {
        try {
            const appConfig = await window.electronAPI.getConfig();
            setConfig(appConfig);
            const [appProducts, appCategories] = await Promise.all([window.electronAPI.getProducts(), window.electronAPI.getCategories()]);
            setProducts(appProducts); setCategories(appCategories);
            setFallbackLogoUrl(appConfig.logo_url || '');
            setBackgroundUrl(appConfig.background_image_url || '');
            setScannerModel(appConfig.scanner_model || 'none');
            setSelectedWebcamId(appConfig.webcam_device_id || '');
            setKeyboardTimeout(parseInt(appConfig.keyboard_scanner_timeout, 10) || 100);
            setZebraAdaptorEnabled(appConfig.zebra_adaptor_enabled === 'true');

            // Load Prediction Agent Config
            setPredEnabled(appConfig.edgify_prediction_enabled === 'true');
            setPredHost(appConfig.edgify_prediction_host || 'localhost');
            setPredPort(parseInt(appConfig.edgify_prediction_port, 10) || 8090);
            setPredToken(appConfig.edgify_prediction_token || '');
            setPredPingInterval(parseInt(appConfig.edgify_prediction_ping_interval, 10) || 5000);

            // Load Session Agent Config
            setSessionEnabled(appConfig.edgify_session_enabled === 'true');
            setSessionHost(appConfig.edgify_session_host || 'localhost');
            setSessionPort(parseInt(appConfig.edgify_session_port, 10) || 8091);
            setSessionToken(appConfig.edgify_session_token || '');
            setCartLossEnabled(appConfig.edgify_cart_loss_enabled === 'true');

            // Load Vision Config
            setShowAgentVision(appConfig.edgify_show_agent_vision === 'true');

            setJposBackendUrl(appConfig.jpos_backend_url || 'http://localhost:8081');
            setJposDeviceName(appConfig.jpos_device_name || 'ZebraScannerUSB');
            setJposScaleName(appConfig.jpos_scale_name || 'ZebraScale');
            setMinWeightThreshold(parseFloat(appConfig.min_weight_threshold || '0'));

            // Load MQTT Config (independent from REST agent config)
            setMqttEnabled(appConfig.mqtt_enabled === 'true');
            setMqttHost(appConfig.mqtt_host || '127.0.0.1');
            setMqttPort(parseInt(appConfig.mqtt_port, 10) || 1883);
            setMqttTls(appConfig.mqtt_tls === 'true');
            setMqttUsername(appConfig.mqtt_username || 'edgify');
            setMqttPassword(appConfig.mqtt_password || '');
            setMqttClientIdPrefix(appConfig.mqtt_client_id_prefix || 'sco-terminal');
            setMqttPublishTopic(appConfig.mqtt_publish_topic || 'edgifyIn');
            setMqttSubscribeTopic(appConfig.mqtt_subscribe_topic || 'edgifyOut');

            // Terminal identity (used in ITEM_RECOGNITION_REQUEST payloads)
            setStoreCode(appConfig.store_code || '');
            setSourceSystem(appConfig.source_system || 'SCO');

            // Load RFID Config
            setRfidEnabled(appConfig.rfid_enabled === 'true');
            setRfidHost(appConfig.rfid_host || 'localhost');
            setRfidPort(appConfig.rfid_port || '8080');
            setRfidTxPower(appConfig.rfid_tx_power || '2700');
            const antStr = appConfig.rfid_antennas || '6,8';
            setRfidAntennas(antStr.split(',').map(Number).filter(n => n >= 1 && n <= 8));

            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            setVideoDevices(cameras);
            if (!appConfig.webcam_device_id && cameras.length > 0) {
                setSelectedWebcamId(cameras[0].deviceId);
            }

            if (window.electronAPI.getAppVersion) {
                const version = await window.electronAPI.getAppVersion();
                setAppVersion(version);
            }

            if (window.electronAPI.getTitleBarVisible) {
                const tb = await window.electronAPI.getTitleBarVisible();
                setTitleBarVisible(!!tb);
            }

        } catch (error) { console.error("Failed to fetch page data:", error); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveSettings = async () => {
        await window.electronAPI.updateConfig('background_image_url', backgroundUrl);
        await window.electronAPI.updateConfig('logo_url', fallbackLogoUrl);
        await window.electronAPI.updateConfig('scanner_model', scannerModel);
        await window.electronAPI.updateConfig('webcam_device_id', selectedWebcamId);
        await window.electronAPI.updateConfig('keyboard_scanner_timeout', String(keyboardTimeout));
        await window.electronAPI.updateConfig('zebra_adaptor_enabled', String(zebraAdaptorEnabled));

        // Save Prediction Agent Config
        await window.electronAPI.updateConfig('edgify_prediction_enabled', String(predEnabled));
        await window.electronAPI.updateConfig('edgify_prediction_host', predHost);
        await window.electronAPI.updateConfig('edgify_prediction_port', String(predPort));
        await window.electronAPI.updateConfig('edgify_prediction_token', predToken);
        await window.electronAPI.updateConfig('edgify_prediction_ping_interval', String(predPingInterval));

        // Save Session Agent Config
        await window.electronAPI.updateConfig('edgify_session_enabled', String(sessionEnabled));
        await window.electronAPI.updateConfig('edgify_session_host', sessionHost);
        await window.electronAPI.updateConfig('edgify_session_port', String(sessionPort));
        await window.electronAPI.updateConfig('edgify_session_token', sessionToken);
        await window.electronAPI.updateConfig('edgify_cart_loss_enabled', String(cartLossEnabled));

        // Save Vision Config
        await window.electronAPI.updateConfig('edgify_show_agent_vision', String(showAgentVision));

        await window.electronAPI.updateConfig('jpos_backend_url', jposBackendUrl);
        await window.electronAPI.updateConfig('jpos_device_name', jposDeviceName);
        await window.electronAPI.updateConfig('jpos_scale_name', jposScaleName);
        await window.electronAPI.updateConfig('min_weight_threshold', minWeightThreshold.toFixed(2));

        // Save MQTT Config (independent from REST agent config)
        await window.electronAPI.updateConfig('mqtt_enabled', String(mqttEnabled));
        await window.electronAPI.updateConfig('mqtt_host', mqttHost);
        await window.electronAPI.updateConfig('mqtt_port', String(mqttPort));
        await window.electronAPI.updateConfig('mqtt_tls', String(mqttTls));
        await window.electronAPI.updateConfig('mqtt_username', mqttUsername);
        await window.electronAPI.updateConfig('mqtt_password', mqttPassword);
        await window.electronAPI.updateConfig('mqtt_client_id_prefix', mqttClientIdPrefix);
        await window.electronAPI.updateConfig('mqtt_publish_topic', mqttPublishTopic);
        await window.electronAPI.updateConfig('mqtt_subscribe_topic', mqttSubscribeTopic);

        // Terminal identity (used in ITEM_RECOGNITION_REQUEST payloads)
        await window.electronAPI.updateConfig('store_code', storeCode);
        await window.electronAPI.updateConfig('source_system', sourceSystem || 'SCO');

        // Save RFID Config
        await window.electronAPI.updateConfig('rfid_enabled', String(rfidEnabled));
        await window.electronAPI.updateConfig('rfid_host', rfidHost);
        await window.electronAPI.updateConfig('rfid_port', rfidPort);
        await window.electronAPI.updateConfig('rfid_tx_power', rfidTxPower);
        await window.electronAPI.updateConfig('rfid_antennas', rfidAntennas.join(','));

        alert('Settings saved successfully! Some changes may require an app restart.');
    };

    const handleTestMqtt = async () => {
        if (!window.electronAPI.mqttTestConnection) return;
        setMqttTestLoading(true);
        setMqttTestStatus({ type: 'testing', message: 'Connecting to broker...' });
        try {
            const result = await window.electronAPI.mqttTestConnection({
                host: mqttHost,
                port: mqttPort,
                tls: mqttTls,
                username: mqttUsername,
                password: mqttPassword,
                clientIdPrefix: mqttClientIdPrefix,
                subscribeTopic: mqttSubscribeTopic,
            });
            if (result?.success) {
                const statusSuffix = result.status
                    ? ` Agent status: ${typeof result.status === 'object' ? (result.status.status || JSON.stringify(result.status)) : result.status}`
                    : '';
                setMqttTestStatus({ type: 'success', message: `${result.message || 'Connected.'}${statusSuffix}` });
            } else {
                setMqttTestStatus({ type: 'error', message: result?.message || 'Connection failed' });
            }
        } catch (error) {
            setMqttTestStatus({ type: 'error', message: error.message });
        } finally {
            setMqttTestLoading(false);
            setTimeout(() => setMqttTestStatus(null), 8000);
        }
    };

    const handleTestRfid = async () => {
        setRfidStatus({ type: 'testing', message: 'Testing connection...' });
        try {
            const result = await window.electronAPI.testRfidConnection();
            setRfidStatus(result.success
                ? { type: 'success', message: 'Connection successful' }
                : { type: 'error', message: result.message || 'Connection failed' });
        } catch (error) {
            setRfidStatus({ type: 'error', message: error.message });
        }
        setTimeout(() => setRfidStatus(null), 5000);
    };

    const handleReconnectRfid = async () => {
        setReconnectLoading(true);
        setReconnectStatus(null);
        try {
            const result = await window.electronAPI.reconnectRfid();
            setReconnectStatus(result.success
                ? { type: 'success', message: result.message || 'Reader reconnected successfully' }
                : { type: 'error', message: result.message || 'Reconnect failed' });
        } catch (error) {
            setReconnectStatus({ type: 'error', message: error.message });
        } finally {
            setReconnectLoading(false);
            setTimeout(() => setReconnectStatus(null), 6000);
        }
    };

    const performTestRead = async () => {
        if (!testReadActiveRef.current) return;
        try {
            const result = await window.electronAPI.scanRfidTags();
            if (!testReadActiveRef.current) return;

            if (!result.success || !result.tags?.length) {
                testReadEmptyCount.current += 1;
                setTestReadStatus('scanning');
                const delay = testReadEmptyCount.current > 3 ? 3000 : 1000;
                setTimeout(() => performTestRead(), delay);
                return;
            }

            testReadEmptyCount.current = 0;
            setTestReadStatus('detected');
            setTestReadTags(result.tags || []);
            setTestReadHistory(prev => [{
                timestamp: new Date().toISOString(),
                tags: result.tags,
                count: result.tags.length,
            }, ...prev].slice(0, 8));
            testReadActiveRef.current = false;
            setTestReadActive(false);
        } catch (err) {
            if (testReadActiveRef.current) setTimeout(() => performTestRead(), 3000);
        }
    };

    const handleToggleTestRead = () => {
        if (testReadActive) {
            testReadActiveRef.current = false;
            setTestReadActive(false);
            setTestReadStatus('idle');
        } else {
            testReadActiveRef.current = true;
            testReadEmptyCount.current = 0;
            setTestReadActive(true);
            setTestReadTags([]);
            setTestReadHistory([]);
            setTestReadStatus('scanning');
            performTestRead();
        }
    };

    const handleChangeLogo = async () => { await window.electronAPI.openLogoDialog(); fetchData(); };
    const handleOpenAddModal = () => { setEditingProduct(null); setIsModalOpen(true); };
    const handleOpenEditModal = (product) => { setEditingProduct(product); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingProduct(null); };
    const handleDeleteProduct = async (id) => { if (window.confirm('Are you sure?')) { await window.electronAPI.deleteProduct(id); fetchData(); } };
    const handleSubmitProduct = async (formData) => { const { category_name, ...dataToSave } = formData; try { if (editingProduct) { const { id, ...updateData } = dataToSave; await window.electronAPI.updateProduct(editingProduct.id, updateData); } else { await window.electronAPI.addProduct(dataToSave); } fetchData(); handleCloseModal(); } catch (error) { console.error("Failed to save product:", error); alert(`Error: ${error.message}`); } };
    const handleAddCategory = async (category) => { await window.electronAPI.addCategory(category); fetchData(); };
    const handleUpdateCategory = async (id, updates) => { await window.electronAPI.updateCategory(id, updates); fetchData(); };
    const handleDeleteCategory = async (id) => { try { if (window.confirm('Are you sure?')) { await window.electronAPI.deleteCategory(id); fetchData(); } } catch (error) { alert(`Error: ${error.message}`); } };
    const handleExport = async () => { const result = await window.electronAPI.exportData(); alert(result.message); };
    const handleImport = async () => { if (window.confirm('This will replace all data. Continue?')) { const result = await window.electronAPI.importData(); if (result.success) { fetchData(); } alert(result.message); } };
    const handleToggleProductEnabled = async (id, newEnabledState) => { try { await window.electronAPI.updateProduct(id, { enabled: newEnabledState }); fetchData(); } catch (error) { console.error("Failed to update product state:", error); alert("Error updating product."); } };

    if (!config) { return <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 text-lg">Loading Settings...</div>; }

    return (
        <>
            <div className="h-screen bg-gray-100 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto pb-8">
                    <header className="mb-8 flex items-center justify-between sticky top-0 bg-gray-100/80 backdrop-blur-sm py-4 z-10">
                        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow hover:bg-gray-200"><ArrowLeft className="h-5 w-5" /></button>
                        <div className="flex flex-col items-center">
                            <h1 className="text-3xl font-bold text-gray-800">Application Settings</h1>
                            {appVersion && (<span className="text-sm text-gray-500 mt-1">v{appVersion}</span>)}
                        </div>
                        <button onClick={handleSaveSettings} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-blue-700"><Save size={18} /> Save All Settings</button>
                    </header>

                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md space-y-6">
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">Application Logo</label><div className="flex items-center gap-4">{config.resolved_logo_src && <img src={config.resolved_logo_src} alt="Current Logo" className="h-12 bg-gray-100 p-1 rounded-md border" />}<button onClick={handleChangeLogo} className="flex items-center gap-2 bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50"><ImageIcon size={16} /> Change Local Logo...</button></div></div>
                        <div><label htmlFor="fallbackLogoUrl" className="block text-sm font-medium text-gray-700 mb-1">Fallback Logo URL</label><input type="text" id="fallbackLogoUrl" value={fallbackLogoUrl} onChange={(e) => setFallbackLogoUrl(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>
                        <div><label htmlFor="backgroundUrl" className="block text-sm font-medium text-gray-700 mb-1">Background Image URL</label><input type="text" id="backgroundUrl" value={backgroundUrl} onChange={(e) => setBackgroundUrl(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div>

                        {/* New Vision Toggle inside Main Config */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex items-center gap-2">
                                <Eye className="text-gray-500" size={20} />
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Agent Vision Widget</label>
                                    <p className="text-xs text-gray-500">Display the captured image from the agent on the checkout screen.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAgentVision(!showAgentVision)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showAgentVision ? 'bg-purple-600' : 'bg-gray-200'}`}>
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showAgentVision ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Scanner Integration</h2>
                        <div className="space-y-6">
                            <div><label htmlFor="scannerModel" className="block text-sm font-medium text-gray-700 mb-1">Input Device</label><select id="scannerModel" value={scannerModel} onChange={(e) => setScannerModel(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"><option value="none">None</option><option value="keyboard_wedge">Hand Scanner (Keyboard)</option><option value="webcam_scanner">Webcam Scanner</option><option value="zebra_jpos">Zebra Scanner (JPOS)</option></select></div>
                            {scannerModel === 'keyboard_wedge' && (<div><label htmlFor="keyboardTimeout" className="block text-sm font-medium text-gray-700 mb-1">Hand Scanner Timeout (ms)</label><input type="number" id="keyboardTimeout" value={keyboardTimeout} onChange={(e) => setKeyboardTimeout(parseInt(e.target.value, 10))} min="20" className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /><p className="text-xs text-gray-500 mt-1">Time between keystrokes. Use ~50 for hardware scanners and ~500 for manual typing.</p></div>)}
                            {scannerModel === 'webcam_scanner' && (<div><label htmlFor="webcamDeviceId" className="block text-sm font-medium text-gray-700 mb-1">Select Camera</label><select id="webcamDeviceId" value={selectedWebcamId} onChange={(e) => setSelectedWebcamId(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm">{videoDevices.length === 0 && <option>No cameras found</option>}{videoDevices.map(device => (<option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${videoDevices.indexOf(device) + 1}`}</option>))}</select></div>)}
                            {scannerModel === 'zebra_jpos' && (<div className="pt-4 mt-4 border-t space-y-4"><h3 className="text-lg font-semibold text-gray-700">JPOS Configuration</h3><div><label htmlFor="jposBackendUrl" className="block text-sm font-medium text-gray-700 mb-1">Java Backend URL</label><input type="text" id="jposBackendUrl" value={jposBackendUrl} onChange={(e) => setJposBackendUrl(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div><div><label htmlFor="jposDeviceName" className="block text-sm font-medium text-gray-700 mb-1">JPOS Logical Scanner Name</label><input type="text" id="jposDeviceName" value={jposDeviceName} onChange={(e) => setJposDeviceName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div><div><label htmlFor="jposScaleName" className="block text-sm font-medium text-gray-700 mb-1">JPOS Logical Scale Name</label><input type="text" id="jposScaleName" value={jposScaleName} onChange={(e) => setJposScaleName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /></div><div><label htmlFor="minWeightThreshold" className="block text-sm font-medium text-gray-700 mb-1">Minimum Weight Threshold (kg)</label><input type="number" id="minWeightThreshold" value={minWeightThreshold} onChange={(e) => setMinWeightThreshold(parseFloat(e.target.value))} step="0.01" min="0" className="w-full p-2 border border-gray-300 rounded-md shadow-sm" /><p className="text-xs text-gray-500 mt-1">Minimum weight required to trigger a prediction (default: 0).</p></div></div>)}

                            <div className="pt-4 mt-4 border-t">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700">Zebra Adaptor Mode</label>
                                    <button onClick={() => setZebraAdaptorEnabled(!zebraAdaptorEnabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${zebraAdaptorEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${zebraAdaptorEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                                </div>
                                <p className="text-xs text-gray-500">If enabled, predictions are accepted <strong>only</strong> from the external Zebra Adaptor webhook.</p>
                            </div>
                        </div>
                    </div>

                    {/* EDGIFY AGENT CONFIGURATION */}
                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Prediction Agent */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 col-span-full border-b pb-2">Prediction Agent</h2>
                            <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Enable Predictions</label><button onClick={() => setPredEnabled(!predEnabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${predEnabled ? 'bg-green-600' : 'bg-gray-200'}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${predEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
                            <div className={`${!predEnabled && 'opacity-50'}`}><label htmlFor="predHost" className="block text-sm font-medium text-gray-700 mb-1">Agent Host</label><input type="text" id="predHost" value={predHost} onChange={(e) => setPredHost(e.target.value)} disabled={!predEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>
                            <div className={`${!predEnabled && 'opacity-50'}`}><label htmlFor="predPort" className="block text-sm font-medium text-gray-700 mb-1">Agent Port</label><input type="number" id="predPort" value={predPort} onChange={(e) => setPredPort(parseInt(e.target.value, 10))} disabled={!predEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>
                            <div className={`${!predEnabled && 'opacity-50'}`}><label htmlFor="predToken" className="block text-sm font-medium text-gray-700 mb-1">Account Token</label><input type="password" id="predToken" value={predToken} onChange={(e) => setPredToken(e.target.value)} disabled={!predEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>
                            <div className={`${!predEnabled && 'opacity-50'}`}><label htmlFor="pingInterval" className="block text-sm font-medium text-gray-700 mb-1">Agent Ping Interval (ms)</label><input type="number" id="pingInterval" value={predPingInterval} onChange={(e) => setPredPingInterval(parseInt(e.target.value, 10))} min="1000" disabled={!predEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>
                        </div>

                        {/* Session Agent */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 col-span-full border-b pb-2">Session Agent</h2>
                            <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Enable Session Management</label><button onClick={() => setSessionEnabled(!sessionEnabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${sessionEnabled ? 'bg-green-600' : 'bg-gray-200'}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${sessionEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
                            <div className={`${!sessionEnabled && 'opacity-50'}`}><label htmlFor="sessionHost" className="block text-sm font-medium text-gray-700 mb-1">Agent Host</label><input type="text" id="sessionHost" value={sessionHost} onChange={(e) => setSessionHost(e.target.value)} disabled={!sessionEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>
                            <div className={`${!sessionEnabled && 'opacity-50'}`}><label htmlFor="sessionPort" className="block text-sm font-medium text-gray-700 mb-1">Agent Port</label><input type="number" id="sessionPort" value={sessionPort} onChange={(e) => setSessionPort(parseInt(e.target.value, 10))} disabled={!sessionEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>
                            <div className={`${!sessionEnabled && 'opacity-50'}`}><label htmlFor="sessionToken" className="block text-sm font-medium text-gray-700 mb-1">Account Token</label><input type="password" id="sessionToken" value={sessionToken} onChange={(e) => setSessionToken(e.target.value)} disabled={!sessionEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" /></div>

                            {/* Cart Loss Toggle */}
                            <div className={`flex items-center justify-between pt-4 border-t ${!sessionEnabled && 'opacity-50'}`}>
                                <div><label className="text-sm font-medium text-gray-700">Cart Loss Detection</label><p className="text-xs text-gray-500">Checks for unscanned items before payment.</p></div>
                                <button onClick={() => setCartLossEnabled(!cartLossEnabled)} disabled={!sessionEnabled} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${cartLossEnabled ? 'bg-red-500' : 'bg-gray-200'}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${cartLossEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            </div>
                        </div>
                    </div>

                    {/* ---- MQTT Broker (Edgify) ---- */}
                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8">
                        <div className="flex items-center justify-between border-b pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <Wifi className="text-teal-600" size={22} />
                                <h2 className="text-2xl font-bold text-gray-800">Edgify MQTT Broker</h2>
                            </div>
                            <button
                                onClick={() => setMqttEnabled(!mqttEnabled)}
                                className={`relative inline-flex items-center h-7 rounded-full w-12 transition-colors ${mqttEnabled ? 'bg-teal-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition-transform ${mqttEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            When enabled, the SCO will talk to the Edgify agent over MQTT instead of the direct REST API.
                            This configuration is independent from the Prediction/Session Agent REST settings above.
                        </p>

                        <div className={`space-y-4 ${!mqttEnabled && 'opacity-50 pointer-events-none'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Broker Host</label>
                                    <input type="text" value={mqttHost} onChange={(e) => setMqttHost(e.target.value)} placeholder="127.0.0.1" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Broker Port</label>
                                    <input type="number" value={mqttPort} onChange={(e) => setMqttPort(parseInt(e.target.value, 10) || 0)} placeholder="1883" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                    <p className="text-xs text-gray-500 mt-1">Typical: 1883 (plain) or 1884 (TLS).</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Use TLS</label>
                                    <p className="text-xs text-gray-500">Connect with mqtts://. Self-signed certs are accepted.</p>
                                </div>
                                <button
                                    onClick={() => setMqttTls(!mqttTls)}
                                    disabled={!mqttEnabled}
                                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${mqttTls ? 'bg-teal-600' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${mqttTls ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input type="text" value={mqttUsername} onChange={(e) => setMqttUsername(e.target.value)} placeholder="edgify" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input type="password" value={mqttPassword} onChange={(e) => setMqttPassword(e.target.value)} placeholder="••••••••" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID Prefix</label>
                                <input type="text" value={mqttClientIdPrefix} onChange={(e) => setMqttClientIdPrefix(e.target.value)} placeholder="sco-terminal" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                <p className="text-xs text-gray-500 mt-1">A unique suffix is appended automatically. Final client ID is capped at 23 chars (MQTT 3.1.1).</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Publish Topic</label>
                                    <input type="text" value={mqttPublishTopic} onChange={(e) => setMqttPublishTopic(e.target.value)} placeholder="edgifyIn" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 font-mono" />
                                    <p className="text-xs text-gray-500 mt-1">Topic the SCO publishes prediction requests to.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscribe Topic</label>
                                    <input type="text" value={mqttSubscribeTopic} onChange={(e) => setMqttSubscribeTopic(e.target.value)} placeholder="edgifyOut" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 font-mono" />
                                    <p className="text-xs text-gray-500 mt-1">Topic the agent publishes prediction responses to.</p>
                                </div>
                            </div>

                            <div className="pt-4 mt-2 border-t">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Terminal Identity</h3>
                                <p className="text-xs text-gray-500 mb-3">Sent on every ITEM_RECOGNITION_REQUEST. <span className="font-mono">tillHost</span> is auto-detected from the machine hostname.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Store Code</label>
                                        <input type="text" value={storeCode} onChange={(e) => setStoreCode(e.target.value)} placeholder="357" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Source System</label>
                                        <input type="text" value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} placeholder="SCO" disabled={!mqttEnabled} className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={handleTestMqtt}
                                    disabled={!mqttEnabled || mqttTestLoading}
                                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg shadow"
                                >
                                    {mqttTestLoading ? 'Testing...' : 'Test Connection'}
                                </button>
                                {mqttTestStatus && (
                                    <div className={`mt-3 px-3 py-2 rounded-md flex items-start gap-2 text-sm ${mqttTestStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : mqttTestStatus.type === 'testing' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                        {mqttTestStatus.type === 'success' ? <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
                                        <span>{mqttTestStatus.message}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Data Management</h2>
                        <div className="flex gap-4"><button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-green-600"><Upload size={18} /> Import Data</button><button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-gray-700"><Download size={18} /> Export Data</button></div>
                    </div>

                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md mb-8">
                        <div className="flex items-center gap-3 mb-4"><Info className="h-6 w-6 text-blue-600" /><h2 className="text-2xl font-bold text-gray-800">Application Information</h2></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                            <div><span className="font-medium text-gray-600">Version:</span><span className="ml-2 text-gray-800">{appVersion || 'Unknown'}</span></div>
                            <div><span className="font-medium text-gray-600">Platform:</span><span className="ml-2 text-gray-800">{navigator.platform}</span></div>
                        </div>

                        <div className="pt-6 border-t">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">System Actions</h3>
                            <div className="flex flex-col md:flex-row gap-4">
                                <button onClick={() => window.electronAPI.maximizeApp()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 flex-1">
                                    <span className="text-xl">⛶</span> Maximize / Restore
                                </button>
                                <button onClick={() => window.electronAPI.defaultSizeApp()} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 flex-1">
                                    <span className="text-xl">↺</span> Default Size
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!window.electronAPI.toggleTitleBar) return;
                                        const result = await window.electronAPI.toggleTitleBar();
                                        if (result && result.success) {
                                            setTitleBarVisible(!!result.titleBarVisible);
                                        }
                                    }}
                                    className={`${titleBarVisible ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'} text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 flex-1`}
                                    title="Show the standard Windows title bar so you can drag the app between screens"
                                >
                                    <span className="text-xl">▭</span> {titleBarVisible ? 'Hide Title Bar' : 'Show Title Bar'}
                                </button>
                                <button onClick={() => { if (window.confirm('Are you sure you want to close the application?')) window.electronAPI.quitApp(); }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 flex-1">
                                    <LogOut size={20} /> Close Application
                                </button>
                            </div>
                        </div>
                    </div>

                    <CategoryManagement categories={categories} onAdd={handleAddCategory} onUpdate={handleUpdateCategory} onDelete={handleDeleteCategory} />
                    <ProductManagementTable products={products} onAdd={handleOpenAddModal} onEdit={handleOpenEditModal} onDelete={handleDeleteProduct} onToggleEnabled={handleToggleProductEnabled} />

                    {/* ---- RFID Reader Configuration ---- */}
                    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md mt-8">
                        <div className="flex items-center justify-between border-b pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <Radio className="text-purple-600" size={22} />
                                <h2 className="text-2xl font-bold text-gray-800">RFID Reader Configuration</h2>
                            </div>
                            <button
                                onClick={() => setRfidEnabled(!rfidEnabled)}
                                className={`relative inline-flex items-center h-7 rounded-full w-12 transition-colors ${rfidEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition-transform ${rfidEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">Enable RFID scanning at checkout. When enabled, customers can scan RFID-tagged items to add them to the basket.</p>

                        <div className={`space-y-6 ${!rfidEnabled && 'opacity-50 pointer-events-none'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">RFID Host</label>
                                    <input
                                        type="text"
                                        value={rfidHost}
                                        onChange={(e) => setRfidHost(e.target.value)}
                                        disabled={!rfidEnabled}
                                        placeholder="localhost"
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">RFID Port</label>
                                    <input
                                        type="text"
                                        value={rfidPort}
                                        onChange={(e) => setRfidPort(e.target.value)}
                                        disabled={!rfidEnabled}
                                        placeholder="8080"
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
                                    />
                                </div>
                            </div>

                            {/* TX Power */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Read Distance (TX Power)</label>
                                <div className="flex gap-2 mb-3">
                                    {[
                                        { label: '~0.5 m', value: '1200' },
                                        { label: '~1 m', value: '1800' },
                                        { label: '~2 m', value: '2300' },
                                        { label: '~3 m+', value: '2700' },
                                    ].map(preset => (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setRfidTxPower(preset.value)}
                                            disabled={!rfidEnabled}
                                            className={`flex-1 py-2 px-1 rounded-md border text-xs font-semibold transition-colors ${rfidTxPower === preset.value ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="500"
                                        max="3000"
                                        step="100"
                                        value={rfidTxPower}
                                        onChange={(e) => setRfidTxPower(e.target.value)}
                                        disabled={!rfidEnabled}
                                        className="flex-1 accent-purple-600"
                                    />
                                    <span className="text-sm font-bold text-purple-700 w-20 text-right">
                                        {(parseInt(rfidTxPower) / 100).toFixed(2)} dBm
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Higher power = longer read range. Typical max: 30.00 dBm. Applied on next scan.</p>
                            </div>

                            {/* Active Antennas */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Active Antenna Ports</label>
                                <p className="text-xs text-gray-500 mb-3">Check only the ports that have a physical antenna connected. Scanning empty ports can slow down or destabilize the reader.</p>
                                <div className="grid grid-cols-8 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(port => {
                                        const active = rfidAntennas.includes(port);
                                        return (
                                            <div
                                                key={port}
                                                onClick={() => rfidEnabled && setRfidAntennas(prev =>
                                                    prev.includes(port)
                                                        ? prev.filter(p => p !== port)
                                                        : [...prev, port].sort((a, b) => a - b)
                                                )}
                                                className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-colors select-none cursor-pointer ${active ? 'border-purple-600 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${active ? 'border-purple-600 bg-purple-600' : 'border-gray-300 bg-white'}`}>
                                                    {active && <CheckCircle size={10} className="text-white" />}
                                                </div>
                                                <span className={`text-xs ${active ? 'font-bold text-purple-700' : 'text-gray-500'}`}>Ant {port}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {rfidAntennas.length === 0 && (
                                    <p className="text-xs text-red-600 mt-2">Select at least one antenna port.</p>
                                )}
                                {rfidAntennas.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Active: Port{rfidAntennas.length > 1 ? 's' : ''} {rfidAntennas.join(', ')} — mask value: {rfidAntennas.reduce((acc, p) => acc | (1 << (p - 1)), 0)}
                                    </p>
                                )}
                            </div>

                            {/* Test Connection */}
                            <div className="pt-4 border-t">
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleTestRfid}
                                        disabled={!rfidEnabled}
                                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg shadow"
                                    >
                                        Test Connection
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleReconnectRfid}
                                        disabled={!rfidEnabled || reconnectLoading}
                                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg shadow"
                                    >
                                        {reconnectLoading ? 'Reconnecting...' : 'Reconnect Reader'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleToggleTestRead}
                                        disabled={!rfidEnabled}
                                        className={`flex items-center gap-2 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg shadow ${testReadActive ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                                    >
                                        {testReadActive ? (<><X size={16} /> Stop Test Read</>) : (<><Radio size={16} /> Test Read</>)}
                                    </button>
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${testReadStatus === 'detected' ? 'bg-green-50 border-green-200' : testReadStatus === 'scanning' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className={`w-2 h-2 rounded-full ${testReadStatus === 'detected' ? 'bg-green-600' : testReadStatus === 'scanning' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
                                        <span className={`text-xs font-semibold ${testReadStatus === 'detected' ? 'text-green-700' : testReadStatus === 'scanning' ? 'text-yellow-700' : 'text-gray-500'}`}>
                                            {testReadStatus === 'detected' ? `${testReadTags.length} tag${testReadTags.length !== 1 ? 's' : ''} detected` : testReadStatus === 'scanning' ? 'Scanning...' : 'Idle'}
                                        </span>
                                    </div>
                                </div>

                                {rfidStatus && (
                                    <div className={`mt-3 px-3 py-2 rounded-md flex items-center gap-2 text-sm ${rfidStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : rfidStatus.type === 'testing' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                        {rfidStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        <span>{rfidStatus.message}</span>
                                    </div>
                                )}
                                {reconnectStatus && (
                                    <div className={`mt-3 px-3 py-2 rounded-md flex items-center gap-2 text-sm ${reconnectStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                        {reconnectStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        <span>{reconnectStatus.message}</span>
                                    </div>
                                )}

                                {testReadTags.length > 0 && (
                                    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 border-b flex items-center gap-2">
                                            Last Detected
                                            <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{testReadTags.length}</span>
                                        </div>
                                        {testReadTags.map((tag, i) => (
                                            <div key={tag.epc || i} className={`px-3 py-2 ${i < testReadTags.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                <p className="font-bold text-sm text-gray-800">{tag.product?.name || tag.name || 'Unknown product'}</p>
                                                <p className="text-xs text-gray-500">SKU: {tag.sku}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">EPC: {tag.epc}</p>
                                                {tag.hardware && (
                                                    <p className="text-[10px] text-orange-600 font-semibold mt-1">
                                                        Ant {tag.hardware.antenna_id}{tag.hardware.rssi ? ` · ${tag.hardware.rssi} dBm` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {testReadHistory.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">History</p>
                                        <div className="space-y-1">
                                            {testReadHistory.map((entry, i) => (
                                                <div key={i} className={`flex items-center gap-3 px-3 py-1.5 rounded-md border ${i === 0 ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
                                                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                                    <span className="text-xs text-gray-600 truncate flex-1">{entry.tags.map(t => t.product?.name || t.name).join(' · ')}</span>
                                                    <span className="text-xs font-bold text-purple-700 flex-shrink-0">{entry.count} tag{entry.count !== 1 ? 's' : ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ProductModal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmitProduct} product={editingProduct} categories={categories} />
        </>
    );
}