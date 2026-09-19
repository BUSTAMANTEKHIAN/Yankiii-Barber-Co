/**
 * Yankiii Barber Co. — Database Initializer
 * Connects to MySQL, creates database `yankiii_barber`, tables, and seed records.
 * Run using: npm run db:init
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function initDatabase() {
    console.log('----------------------------------------------------');
    console.log('💈 Yankiii Barber Co. — Database Setup');
    console.log('----------------------------------------------------');

    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const port = parseInt(process.env.DB_PORT || '3306', 10);

    console.log(`Connecting to MySQL on ${host}:${port} as ${user}...`);

    let connection;
    try {
        connection = await mysql.createConnection({
            host,
            user,
            password,
            port,
            multipleStatements: true
        });
        console.log('✅ Connected to MySQL server successfully.');
    } catch (err) {
        console.error('❌ Could not connect to MySQL server:');
        console.error(err.message);
        console.log('\n💡 Tip: Verify MySQL is running and that credentials in server/.env are correct.');
        console.log('   Default: DB_HOST=localhost, DB_PORT=3306, DB_USER=root, DB_PASSWORD=');
        process.exit(1);
    }

    try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        console.log('⚙️ Executing database/schema.sql...');
        await connection.query(schemaSql);
        console.log('✅ Database `yankiii_barber` and tables created.');

        const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
        console.log('🌱 Executing database/seed.sql...');
        await connection.query(seedSql);
        console.log('✅ Initial services, barbers, schedules, and admin seeded successfully.');

        console.log('----------------------------------------------------');
        console.log('🎉 Setup Complete! You can now start the server with:');
        console.log('   npm start');
        console.log('----------------------------------------------------');
    } catch (err) {
        console.error('❌ SQL Execution error:', err.message);
    } finally {
        if (connection) await connection.end();
    }
}

initDatabase();

