/**
 * Yankiii Barber Co. — Services Controller
 * Public listing of active services and Admin CRUD management.
 */

const pool = require('../config/db');

async function getAllServices(req, res) {
    try {
        const isAdmin = req.user && req.user.role === 'admin';
        const query = isAdmin 
            ? 'SELECT * FROM services ORDER BY id ASC' 
            : 'SELECT * FROM services WHERE status = "active" ORDER BY price ASC';

        const [rows] = await pool.query(query);
        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (err) {
        console.error('GetAllServices Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve services catalog.'
        });
    }
}

async function getServiceById(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });
    } catch (err) {
        console.error('GetServiceById Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve service details.'
        });
    }
}

async function createService(req, res) {
    try {
        const { name, description, price, duration, image, status } = req.body;

        if (!name || price === undefined || duration === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Service name, price, and duration are required.'
            });
        }

        const numPrice = Number(price);
        const numDuration = parseInt(duration, 10);

        if (isNaN(numPrice) || numPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be a non-negative number.'
            });
        }

        if (isNaN(numDuration) || numDuration <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Duration must be greater than zero minutes.'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO services (name, description, price, duration, image, status) VALUES (?, ?, ?, ?, ?, ?)',
            [name.trim(), description ? description.trim() : null, numPrice, numDuration, image || null, status || 'active']
        );

        return res.status(201).json({
            success: true,
            message: 'Service created successfully.',
            data: {
                id: result.insertId,
                name,
                price: numPrice,
                duration: numDuration
            }
        });
    } catch (err) {
        console.error('CreateService Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to create service.'
        });
    }
}

async function updateService(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { name, description, price, duration, image, status } = req.body;

        if (!name || price === undefined || duration === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Service name, price, and duration are required.'
            });
        }

        const numPrice = Number(price);
        const numDuration = parseInt(duration, 10);

        if (isNaN(numPrice) || numPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be a valid non-negative number.'
            });
        }

        if (isNaN(numDuration) || numDuration <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Duration must be greater than zero.'
            });
        }

        await pool.query(
            'UPDATE services SET name = ?, description = ?, price = ?, duration = ?, image = ?, status = ? WHERE id = ?',
            [name.trim(), description ? description.trim() : null, numPrice, numDuration, image || null, status || 'active', id]
        );

        return res.status(200).json({
            success: true,
            message: 'Service updated successfully.'
        });
    } catch (err) {
        console.error('UpdateService Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to update service.'
        });
    }
}

async function deleteService(req, res) {
    try {
        const id = parseInt(req.params.id, 10);

        // Check if existing bookings reference this service
        const [bookings] = await pool.query('SELECT id FROM bookings WHERE service_id = ? LIMIT 1', [id]);
        if (bookings.length > 0) {
            // Soft delete/deactivate instead of deleting foreign key
            await pool.query('UPDATE services SET status = "inactive" WHERE id = ?', [id]);
            return res.status(200).json({
                success: true,
                message: 'Service has existing appointment records; it has been deactivated instead of deleted.'
            });
        }

        await pool.query('DELETE FROM services WHERE id = ?', [id]);
        return res.status(200).json({
            success: true,
            message: 'Service deleted successfully.'
        });
    } catch (err) {
        console.error('DeleteService Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to delete service.'
        });
    }
}

module.exports = {
    getAllServices,
    getServiceById,
    createService,
    updateService,
    deleteService
};

