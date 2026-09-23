'use strict';

const pool = require('../config/db');

async function runMigration() {
    try {
        console.log('Connecting to database and running migrations...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL UNIQUE,
                user_id INT NOT NULL,
                barber_id INT NULL,
                service_id INT NULL,
                customer_name VARCHAR(100) NOT NULL,
                rating INT NOT NULL DEFAULT 5,
                comment TEXT NOT NULL,
                status ENUM('pending', 'approved', 'hidden') DEFAULT 'approved',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_feedback_status (status),
                INDEX idx_feedback_user (user_id),
                INDEX idx_feedback_booking (booking_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Feedback table created/verified successfully.');

        // Clean up test spam services
        const [delResult] = await pool.query("DELETE FROM services WHERE name = 'J' AND price = 10.00");
        console.log(`✅ Cleaned test services: ${delResult.affectedRows} removed.`);

        // Ensure barber 30004 has a fallback image if null
        const [updBarber] = await pool.query("UPDATE barbers SET image = 'assets/images/barber-1.jpg' WHERE id = 30004 AND (image IS NULL OR image = '')");
        console.log(`✅ Updated barber image fallback: ${updBarber.affectedRows} updated.`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

runMigration();

