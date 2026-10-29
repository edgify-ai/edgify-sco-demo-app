import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Add this line
import App from './App';
import setupLogCapture from './logCapture'; // <--- Import it

// Initialize the logger hook immediately
setupLogCapture();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);