const mysql = require('mysql2');
require('dotenv').config();

// Create the connection pool (better for performance than a single connection)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool to use promises so we can use modern async/await syntax
const db = pool.promise();

// Test the connection
db.getConnection()
    .then(connection => {
        console.log('Successfully connected to the MySQL database!');
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to the database:', err.message);
    });

module.exports = db;