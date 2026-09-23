/**
 * Yankiii Barber Co. — Admin Authorization Middleware
 * Ensures user has 'admin' role. Must be used after verifyToken.
 */

const pool = require('../config/db');

async function verifyAdmin(req, res, next) {
    if (!req.user || !Number.isInteger(Number(req.user.id))) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to perform this action.'
        });
    }
    try {
        // Do not trust a role claim that may have become stale since token issue.
        const [rows] = await pool.query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        if (!rows.length || rows[0].role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to perform this action.' });
        }
        req.user.role = rows[0].role;
        return next();
    } catch (error) {
        console.error('Admin authorization lookup failed:', error.message);
        return res.status(503).json({ success: false, message: 'Unable to verify administrator access right now.' });
    }
}

module.exports = {
    verifyAdmin
};
