/**
 * Yankiii Barber Co. — Barbers Controller
 * Manages barber roster, specialties, and weekly working schedules.
 */

const pool = require('../config/db');

async function getAllBarbers(req, res) {
    try {
        const isAdmin = req.user && req.user.role === 'admin';
        const query = isAdmin 
            ? 'SELECT * FROM barbers ORDER BY id ASC' 
            : 'SELECT * FROM barbers WHERE status = "active" ORDER BY id ASC';

        const [rows] = await pool.query(query);
        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (err) {
        console.error('GetAllBarbers Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve barbers.'
        });
    }
}

async function getBarberById(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const [rows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Barber not found.'
            });
        }

        // Also fetch schedule
        const [schedules] = await pool.query(
            'SELECT day_of_week, is_working, start_time, end_time FROM barber_schedules WHERE barber_id = ? ORDER BY day_of_week ASC',
            [id]
        );

        return res.status(200).json({
            success: true,
            data: {
                ...rows[0],
                schedules
            }
        });
    } catch (err) {
        console.error('GetBarberById Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve barber profile.'
        });
    }
}

async function createBarber(req, res) {
    try {
        const { name, specialty, bio, image, status } = req.body;

        if (!name || !specialty) {
            return res.status(400).json({
                success: false,
                message: 'Barber name and specialty are required.'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO barbers (name, specialty, bio, image, status) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), specialty.trim(), bio ? bio.trim() : null, image || null, status || 'active']
        );

        const barberId = result.insertId;

        // Initialize default schedule for 7 days (Mon-Sat 09:00-18:00, Sun OFF)
        const defaultScheduleValues = [];
        for (let d = 0; d < 7; d++) {
            const isWorking = d !== 0; // Sunday off
            defaultScheduleValues.push([barberId, d, isWorking, '09:00:00', '18:00:00']);
        }

        await pool.query(
            'INSERT INTO barber_schedules (barber_id, day_of_week, is_working, start_time, end_time) VALUES ?',
            [defaultScheduleValues]
        );

        return res.status(201).json({
            success: true,
            message: 'Barber created successfully.',
            data: { id: barberId, name, specialty }
        });
    } catch (err) {
        console.error('CreateBarber Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to create barber profile.'
        });
    }
}

async function updateBarber(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { name, specialty, bio, image, status } = req.body;

        if (!name || !specialty) {
            return res.status(400).json({
                success: false,
                message: 'Barber name and specialty are required.'
            });
        }

        await pool.query(
            'UPDATE barbers SET name = ?, specialty = ?, bio = ?, image = ?, status = ? WHERE id = ?',
            [name.trim(), specialty.trim(), bio ? bio.trim() : null, image || null, status || 'active', id]
        );

        return res.status(200).json({
            success: true,
            message: 'Barber profile updated successfully.'
        });
    } catch (err) {
        console.error('UpdateBarber Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to update barber profile.'
        });
    }
}

async function deleteBarber(req, res) {
    try {
        const id = parseInt(req.params.id, 10);

        // Check if existing bookings reference this barber
        const [bookings] = await pool.query('SELECT id FROM bookings WHERE barber_id = ? LIMIT 1', [id]);
        if (bookings.length > 0) {
            await pool.query('UPDATE barbers SET status = "inactive" WHERE id = ?', [id]);
            return res.status(200).json({
                success: true,
                message: 'Barber has historical appointments; status has been set to inactive instead of deletion.'
            });
        }

        await pool.query('DELETE FROM barbers WHERE id = ?', [id]);
        return res.status(200).json({
            success: true,
            message: 'Barber deleted successfully.'
        });
    } catch (err) {
        console.error('DeleteBarber Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to delete barber.'
        });
    }
}

async function getBarberSchedule(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const [rows] = await pool.query(
            'SELECT day_of_week, is_working, start_time, end_time FROM barber_schedules WHERE barber_id = ? ORDER BY day_of_week ASC',
            [id]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (err) {
        console.error('GetBarberSchedule Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve barber schedule.'
        });
    }
}

async function updateBarberSchedule(req, res) {
    try {
        const barberId = parseInt(req.params.id, 10);
        const { schedule } = req.body; // Array of { day_of_week, is_working, start_time, end_time }

        if (!Array.isArray(schedule)) {
            return res.status(400).json({
                success: false,
                message: 'Schedule array is required.'
            });
        }

        for (const item of schedule) {
            const isWorking = item.is_working ? 1 : 0;
            const startTime = item.start_time.length === 5 ? `${item.start_time}:00` : item.start_time;
            const endTime = item.end_time.length === 5 ? `${item.end_time}:00` : item.end_time;

            await pool.query(
                `INSERT INTO barber_schedules (barber_id, day_of_week, is_working, start_time, end_time)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_working = VALUES(is_working), start_time = VALUES(start_time), end_time = VALUES(end_time)`,
                [barberId, item.day_of_week, isWorking, startTime, endTime]
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Barber schedule updated successfully.'
        });
    } catch (err) {
        console.error('UpdateBarberSchedule Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to update barber schedule.'
        });
    }
}

module.exports = {
    getAllBarbers,
    getBarberById,
    createBarber,
    updateBarber,
    deleteBarber,
    getBarberSchedule,
    updateBarberSchedule
};

