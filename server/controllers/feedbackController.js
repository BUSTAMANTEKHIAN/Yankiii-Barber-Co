/**
 * Yankiii Barber Co. — Feedback & Reviews Controller
 *
 * Enforces business rules:
 * 1. Only authenticated customers who have a COMPLETED appointment can submit feedback.
 * 2. Only ONE review per completed appointment (enforced by DB UNIQUE(booking_id)).
 * 3. Sanitized input to protect against XSS.
 * 4. Admin moderation (approve, hide, delete).
 */

'use strict';

const pool = require('../config/db');

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * POST /api/feedback
 * Submit customer feedback for a completed appointment.
 */
async function createFeedback(req, res) {
    try {
        const userId = req.user.id;
        const { booking_id, rating, comment } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID is required.'
            });
        }

        const ratingNum = parseInt(rating, 10);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be an integer between 1 and 5 stars.'
            });
        }

        const cleanComment = (comment || '').trim();
        if (!cleanComment) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your feedback comment.'
            });
        }

        if (cleanComment.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Comment must not exceed 1000 characters.'
            });
        }

        // 1. Verify that the booking exists, belongs to this customer, and is completed
        const [bookings] = await pool.query(
            `
            SELECT id, user_id, barber_id, service_id, customer_name, status
            FROM bookings
            WHERE id = ?
            LIMIT 1
            `,
            [booking_id]
        );

        if (!bookings.length) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        const booking = bookings[0];

        // Authorization check: must belong to the logged-in customer (or admin)
        if (booking.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You can only review your own appointments.'
            });
        }

        // Status check: MUST be completed
        if (booking.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Feedback can only be submitted after your appointment has been completed.'
            });
        }

        // 2. Check if a review already exists for this booking
        const [existing] = await pool.query(
            'SELECT id FROM feedback WHERE booking_id = ? LIMIT 1',
            [booking_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'You have already submitted a review for this appointment.'
            });
        }

        // Get customer name from user record or booking
        const customerName = req.user.name || booking.customer_name || 'Valued Customer';

        // 3. Insert feedback
        const [result] = await pool.query(
            `
            INSERT INTO feedback
                (booking_id, user_id, barber_id, service_id, customer_name, rating, comment, status)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, 'approved')
            `,
            [
                booking.id,
                userId,
                booking.barber_id,
                booking.service_id,
                customerName,
                ratingNum,
                cleanComment
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Thank you for your feedback!',
            data: {
                id: result.insertId,
                booking_id: booking.id,
                rating: ratingNum,
                comment: cleanComment,
                status: 'approved'
            }
        });
    } catch (error) {
        console.error('Create feedback error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'You have already submitted a review for this appointment.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Unable to submit feedback. Please try again later.'
        });
    }
}

/**
 * GET /api/feedback
 * Public endpoint to fetch approved reviews for homepage & testimonials.
 */
async function getPublicFeedback(req, res) {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                f.id,
                f.customer_name,
                f.rating,
                f.comment,
                f.created_at,
                b.name AS barber_name,
                s.name AS service_name
            FROM feedback f
            LEFT JOIN barbers b ON f.barber_id = b.id
            LEFT JOIN services s ON f.service_id = s.id
            WHERE f.status = 'approved'
            ORDER BY f.created_at DESC
            LIMIT 12
            `
        );

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get public feedback error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve customer reviews.'
        });
    }
}

/**
 * GET /api/feedback/my
 * Customer endpoint to get all feedback submitted by the logged-in customer.
 */
async function getMyFeedback(req, res) {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(
            `
            SELECT
                f.id,
                f.booking_id,
                f.rating,
                f.comment,
                f.status,
                f.created_at
            FROM feedback f
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
            `,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get my feedback error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve your reviews.'
        });
    }
}

/**
 * GET /api/feedback/admin
 * Admin endpoint: list all feedback with optional status filter.
 */
async function getAllFeedbackAdmin(req, res) {
    try {
        const { status, search } = req.query;
        let query = `
            SELECT
                f.id,
                f.booking_id,
                f.user_id,
                f.customer_name,
                f.rating,
                f.comment,
                f.status,
                f.created_at,
                b.name AS barber_name,
                s.name AS service_name,
                bk.booking_reference
            FROM feedback f
            LEFT JOIN barbers b ON f.barber_id = b.id
            LEFT JOIN services s ON f.service_id = s.id
            LEFT JOIN bookings bk ON f.booking_id = bk.id
            WHERE 1=1
        `;
        const params = [];

        if (status && ['pending', 'approved', 'hidden'].includes(status)) {
            query += ' AND f.status = ?';
            params.push(status);
        }

        if (search) {
            query += ' AND (f.customer_name LIKE ? OR f.comment LIKE ? OR bk.booking_reference LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ' ORDER BY f.created_at DESC';

        const [rows] = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Admin get feedback error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to load feedback records.'
        });
    }
}

/**
 * PATCH /api/feedback/admin/:id
 * Admin endpoint: moderate feedback status ('approved', 'hidden', 'pending').
 */
async function updateFeedbackStatusAdmin(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['approved', 'hidden', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status required: approved, hidden, or pending.'
            });
        }

        const [result] = await pool.query(
            'UPDATE feedback SET status = ? WHERE id = ?',
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Feedback entry not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Feedback status updated to ${status}.`
        });
    } catch (error) {
        console.error('Update feedback status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to update feedback status.'
        });
    }
}

/**
 * DELETE /api/feedback/admin/:id
 * Admin endpoint: remove feedback entry.
 */
async function deleteFeedbackAdmin(req, res) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            'DELETE FROM feedback WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Feedback entry not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Feedback deleted successfully.'
        });
    } catch (error) {
        console.error('Delete feedback error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to delete feedback entry.'
        });
    }
}

module.exports = {
    createFeedback,
    getPublicFeedback,
    getMyFeedback,
    getAllFeedbackAdmin,
    updateFeedbackStatusAdmin,
    deleteFeedbackAdmin
};

