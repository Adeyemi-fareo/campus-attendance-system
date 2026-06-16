const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize the Express app
const app = express();
const db = require('./db'); // Imports your database connection

// Middleware
app.use(cors()); 
app.use(express.json()); 

// A simple test route
// The API endpoint that receives the attendance scan
app.post('/api/attendance', async (req, res) => {
    const { matric_no, qr_token, lat, lng } = req.body;
    
    // Log the data to the terminal so we can see it arrive!
    console.log(`\n--- New Attendance Scan ---`);
    console.log(`Student: ${matric_no}`);
    console.log(`Token: ${qr_token}`);
    console.log(`Coordinates: ${lat}, ${lng}`);
    console.log(`---------------------------\n`);

    // For this test, we are just telling the frontend we received it safely.
    // Next, we will add the Geofencing Math and MySQL insert here!
    res.json({ message: "Attendance received by backend!" });
});

// Set the port 
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is successfully running on port ${PORT}`);
});