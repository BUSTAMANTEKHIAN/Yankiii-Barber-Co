/**
 * Yankiii Barber Co. — Admin Authorization Middleware
 * Ensures user has 'admin' role. Must be used after verifyToken.
 */

function verifyAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to perform this action.'
        });
    }
    next();
}

module.exports = {
    verifyAdmin
};

