/**
 * Yankiii Barber Co. — Main Application Entry Point
 * Express HTTP Server, Static Asset Delivery, and REST API Dispatcher.
 */
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '../.env')
});

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const barberRoutes = require('./routes/barberRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard Security & Body Parsing Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from project root
const clientPath = path.join(__dirname, '../public');

app.use(express.static(clientPath));

const pages = {
    '/': 'index.html',
    '/about': 'about.html',
    '/barbers': 'barbers.html',
    '/booking': 'booking.html',
    '/confirmation': 'confirmation.html',
    '/contact': 'contact.html',
    '/dashboard': 'dashboard.html',
    '/login': 'login.html',
    '/register': 'register.html',
    '/forgot-password': 'forgot-password.html',
    '/verify-reset-code': 'verify-reset-code.html',
    '/reset-password': 'reset-password.html',
    '/services': 'services.html'
};

Object.entries(pages).forEach(([route, file]) => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(clientPath, file));
    });
});
// API Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Yankiii Barber Co. API is online.',
        timestamp: new Date().toISOString()
    });
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err);
    res.status(500).json({
        success: false,
        message: 'An unexpected internal server error occurred.'
    });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('====================================================');
        console.log('💈 YANKIII BARBER CO. — FULL-STACK PLATFORM RUNNING');
        console.log(`🌐 Public Website:   http://localhost:${PORT}`);
        console.log(`🛠️  Admin Portal:    http://localhost:${PORT}/admin/dashboard.html`);
        console.log(`📡 REST API Health: http://localhost:${PORT}/api/health`);
        console.log('====================================================');
    });
}

module.exports = app;

