/**
 * Yankiii Barber Co. — Admin Controller
 * KPI metrics calculation, customer directory aggregation, and business hours management.
 */

const pool = require('../config/db');

async function getDashboardStats(req, res) {
    try {
        const [totalRows] = await pool.query('SELECT COUNT(*) AS total FROM bookings');
        const [todayRows] = await pool.query('SELECT COUNT(*) AS today FROM bookings WHERE booking_date = CURDATE()');
        const [pendingRows] = await pool.query('SELECT COUNT(*) AS pending FROM bookings WHERE status = "pending"');
        const [completedRows] = await pool.query('SELECT COUNT(*) AS completed FROM bookings WHERE status = "completed"');
        const [customerRows] = await pool.query('SELECT COUNT(*) AS customers FROM users WHERE role = "customer"');
        const [revenueRows] = await pool.query('SELECT COALESCE(SUM(total_price), 0) AS revenue FROM bookings WHERE status = "completed"');

        // Recent 5 bookings
        const [recent] = await pool.query(`
            SELECT b.id, b.booking_reference, b.customer_name, b.booking_date, b.start_time, b.total_price, b.status,
                   s.name AS service_name, br.name AS barber_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN barbers br ON b.barber_id = br.id
            ORDER BY b.created_at DESC
            LIMIT 5
        `);

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    total_bookings: totalRows[0].total,
                    today_bookings: todayRows[0].today,
                    pending_bookings: pendingRows[0].pending,
                    completed_bookings: completedRows[0].completed,
                    total_customers: customerRows[0].customers,
                    total_revenue: Number(revenueRows[0].revenue)
                },
                recent_bookings: recent
            }
        });
    } catch (err) {
        console.error('GetDashboardStats Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to calculate dashboard metrics.'
        });
    }
}

async function getCustomers(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
                   COUNT(b.id) AS total_bookings
            FROM users u
            LEFT JOIN bookings b ON (u.id = b.user_id OR u.email = b.customer_email)
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (err) {
        console.error('GetCustomers Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve customers list.'
        });
    }
}

async function getBusinessHours(req, res) {
    try {
        const [rows] = await pool.query(
            'SELECT day_of_week, is_open, open_time, close_time FROM business_hours ORDER BY day_of_week ASC'
        );

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (err) {
        console.error('GetBusinessHours Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve business hours.'
        });
    }
}

async function updateBusinessHours(req, res) {
    try {
        const { hours } = req.body; // Array of { day_of_week, is_open, open_time, close_time }

        if (!Array.isArray(hours)) {
            return res.status(400).json({
                success: false,
                message: 'Hours array is required.'
            });
        }

        for (const item of hours) {
            const isOpen = item.is_open ? 1 : 0;
            const openTime = item.open_time.length === 5 ? `${item.open_time}:00` : item.open_time;
            const closeTime = item.close_time.length === 5 ? `${item.close_time}:00` : item.close_time;

            await pool.query(
                `INSERT INTO business_hours (day_of_week, is_open, open_time, close_time)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_open = VALUES(is_open), open_time = VALUES(open_time), close_time = VALUES(close_time)`,
                [item.day_of_week, isOpen, openTime, closeTime]
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Business hours updated successfully.'
        });
    } catch (err) {
        console.error('UpdateBusinessHours Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to update business hours.'
        });
    }
}

module.exports = {
    getDashboardStats,
    getCustomers,
    getBusinessHours,
    updateBusinessHours
};

