/**
 * Yankiii Barber Co. — Database Connection Pool
 * Uses mysql2/promise for connection pooling and transaction support.
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yankiii_barber',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true // Keep date and time formats consistent as strings
});

// Test connection non-destructively on startup
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log(`💈 MySQL Connected to database [${process.env.DB_NAME || 'yankiii_barber'}] successfully.`);
        connection.release();
    } catch (err) {
        console.warn('⚠️  Database Connection Notice:', err.message);
        console.warn('   The server will start, but database operations will require MySQL running.');
        console.warn('   Run `npm run db:init` once your MySQL service is active to create the schema & seeds.');
    }
})();

module.exports = pool;

