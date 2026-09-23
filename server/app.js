/**
 * Yankiii Barber Co. — Main Application Entry Point
 * Express HTTP Server, Static Asset Delivery, and REST API Dispatcher.
 */
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '../.env')
});

if (process.env.NODE_ENV === 'production') {
    const originalError = console.error.bind(console);
    console.error = label => originalError(String(label || 'Application error').split(':')[0]);
}

const express = require('express');
const cors = require('cors');
const { createRateLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const barberRoutes = require('./routes/barberRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Production-safe baseline headers and origin policy. No cross-origin credentials
// are used by the current Bearer-token API.
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

const configuredOrigins = [
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
    process.env.SITE_URL || '',
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
].map(value => {
    try { return new URL(value.trim()).origin; } catch (_) { return ''; }
}).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
    allowedOrigins.add('http://localhost:8080');
    allowedOrigins.add(`http://localhost:${PORT}`);
    allowedOrigins.add(`http://127.0.0.1:${PORT}`);
}
app.use(cors({
    origin(origin, callback) {
        // Permit same-origin and non-browser clients that omit Origin.
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '32kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }));
app.use('/api/auth', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many authentication attempts. Please wait and try again.' }));
app.use('/api/contact', createRateLimiter({ windowMs: 60 * 60 * 1000, max: 8, message: 'Too many messages were sent. Please try again later.' }));

// Serve static frontend files from project root
const clientPath = path.join(__dirname, '../public');

const publicSiteUrl = (process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NODE_ENV !== 'production' ? `http://localhost:${PORT}` : '')))
    .replace(/\/$/, '');
app.get('/robots.txt', (req, res, next) => {
    if (!publicSiteUrl) return res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /dashboard\nDisallow: /confirmation\n');
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /dashboard\nDisallow: /confirmation\nSitemap: ${publicSiteUrl}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res, next) => {
    if (!publicSiteUrl || !/^https?:\/\//i.test(publicSiteUrl)) return res.status(404).type('text/plain').send('Sitemap is unavailable until SITE_URL is configured.');
    const pages = ['/', '/about', '/services', '/barbers', '/contact', '/cookie-policy.html'];
    const xml = pages.map(page => `<url><loc>${publicSiteUrl}${page}</loc></url>`).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xml}</urlset>`);
});

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
app.use('/api/feedback', feedbackRoutes);

// Friendly 404 for API calls and unknown page routes.
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'The requested endpoint was not found.' });
    }
    if (req.accepts('html')) return res.status(404).sendFile(path.join(clientPath, '404.html'));
    return res.status(404).json({ success: false, message: 'Page not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request is too large.' });
    }
    if (err.message === 'Origin is not allowed by CORS') {
        return res.status(403).json({ success: false, message: 'This site is not allowed to make that request.' });
    }
    if (process.env.NODE_ENV !== 'production') console.error('Unhandled Application Error:', err);
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
