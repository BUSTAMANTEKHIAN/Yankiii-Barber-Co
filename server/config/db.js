/**
 * Yankiii Barber Co. — Database Connection Pool
 * Uses mysql2/promise for connection pooling and transaction support.
 * Supports local MySQL/MariaDB and TiDB Cloud with SSL.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '../../.env')
});

const projectRoot = path.join(__dirname, '../..');

const sslCaPath = process.env.DB_SSL_CA
    ? path.resolve(projectRoot, process.env.DB_SSL_CA)
    : path.join(__dirname, 'certs', 'tidb-ca.pem');

const useSSL = process.env.DB_SSL === 'true';

const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yankiii_barber',
    port: parseInt(process.env.DB_PORT || '3306', 10),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    dateStrings: true
};

// Enable SSL when connecting to TiDB Cloud
if (useSSL) {
    if (!fs.existsSync(sslCaPath)) {
        throw new Error(
            `TiDB SSL CA certificate not found: ${sslCaPath}`
        );
    }

    poolConfig.ssl = {
        ca: fs.readFileSync(sslCaPath),
        minVersion: 'TLSv1.2'
    };
}

const pool = mysql.createPool(poolConfig);

// Test connection non-destructively on startup
(async () => {
    try {
        const connection = await pool.getConnection();

        console.log(
            `✅ MySQL/TiDB Connected to database [${process.env.DB_NAME || 'yankiii_barber'}] successfully.`
        );

        connection.release();
    } catch (err) {
        console.warn('⚠️ Database Connection Notice:', err.message);
        console.warn(
            '   The server will start, but database operations may fail until the database connection is available.'
        );
    }
})();

module.exports = pool;