import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import WelcomePage from './pages/Welcome';
import CheckoutPage from './pages/Checkout';
import PaymentPage from './pages/Payment';
import ThankYouPage from './pages/ThankYou';
import SettingsPage from './pages/Settings';
import './App.css'; // We will create this file next

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/thankyou" element={<ThankYouPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Router>
  );
}

export default App;