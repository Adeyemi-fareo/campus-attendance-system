require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');

const app = express();

// --- MIDDLEWARE ---
app.use(cors({
    origin: ["http://localhost:5173", "https://nacos-attendance-portal.netlify.app"], // Add your exact Netlify link here
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json());

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: 25838,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) console.error("Database connection failed:", err);
    else console.log("Connected to MySQL database.");
});

// ==========================================
//        AUTHENTICATION ROUTES
// ==========================================

app.post('/api/register', async (req, res) => {
    // Added level to req.body destructurer
    const { matric_no, full_name, password, level } = req.body; 
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Added level variable placement to database insert logic array mapping
        db.query(`INSERT INTO students (matric_no, full_name, password, proxy_pin, level) VALUES (?, ?, ?, ?, ?)`, 
        [matric_no, full_name, hashedPassword, password, level || '200'], (err) => {
            if (err) {
                console.error("Student Reg DB Error:", err);
                return res.status(400).json({ message: "Registration failed." });
            }
            res.status(201).json({ message: "Registration successful!" });
        });
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});

app.post('/api/login', (req, res) => {
    const { matric_no, password } = req.body;
    db.query(`SELECT * FROM students WHERE matric_no = ?`, [matric_no], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database lookup failure." });
        if (results.length === 0) return res.status(404).json({ message: "Student not found." });
        
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
            res.status(200).json({ 
                studentData: { 
                    matric_no: results[0].matric_no, 
                    full_name: results[0].full_name,
                    level: results[0].level // Sent directly to frontend dashboard state memory module
                } 
            });
        } else {
            res.status(401).json({ message: "Incorrect PIN." });
        }
    });
});

app.post('/api/lecturer/login', (req, res) => {
    const { staff_id, password } = req.body;
    db.query(`SELECT * FROM lecturers WHERE staff_id = ?`, [staff_id], async (err, results) => {
        if (results.length === 0) return res.status(404).json({ message: "Lecturer not found." });
        const match = await bcrypt.compare(password, results[0].password);
        if (match) res.status(200).json({ lecturerData: { staff_id: results[0].staff_id, full_name: results[0].full_name } });
        else res.status(401).json({ message: "Incorrect PIN." });
    });
});

app.post('/api/lecturer/register', async (req, res) => {
    const { staff_id, full_name, password, access_code } = req.body;

    // --- THE DEPARTMENT BOUNCER ---
    const SECRET_PASSCODE = "NACOS-STAFF-2026";
    if (access_code !== SECRET_PASSCODE) {
        return res.status(403).json({ message: "Registration Blocked: Invalid Department Access Code." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(`INSERT INTO lecturers (staff_id, full_name, password) VALUES (?, ?, ?)`, 
        [staff_id, full_name, hashedPassword], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "This Staff ID is already registered." });
                return res.status(500).json({ message: "Database error during registration." });
            }
            res.status(201).json({ message: "Registration successful!" });
        });
    } catch (error) { 
        res.status(500).json({ message: "Server error during registration." }); 
    }
});

// ==========================================
//          CORE ATTENDANCE ROUTES
// ==========================================

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
}

const HALL_LOCATIONS = {
    'Coited Room 1': { lat: 6.499406, lng: 3.114119 },
    'Coited Annex Building': { lat: 6.499334, lng: 3.113444 },
    'Credo Hall': { lat: 6.501398, lng: 3.114351 },
    'ETF Building': { lat: 6.499506, lng: 3.113009 },
    'Computer Lab 1': { lat: 6.499334, lng: 3.113444 }, 
    'Computer Lab 2': { lat: 6.499334, lng: 3.113444 }  
};

app.post('/api/attendance', (req, res) => {
    const { matric_no, course, level, hall, lecturer_id, lat, lng } = req.body;
    const targetLocation = HALL_LOCATIONS[hall];

    if (!targetLocation) return res.status(400).json({ message: "Invalid hall location." });
    
    const distance = getDistanceInMeters(targetLocation.lat, targetLocation.lng, lat, lng);
    
    // --- PRODUCTION MODE: 50 Meter Radius ---
    if (distance > 50) {
        return res.status(403).json({ 
            message: `Location verification failed. You are ${Math.round(distance)}m away from the hall.` 
        }); 
    }

    db.query(`SELECT * FROM attendance_records WHERE matric_no = ? AND course_code = ? AND DATE(scan_time) = CURDATE()`, [matric_no, course], (err, results) => {
        if (results.length > 0) return res.status(400).json({ message: "Attendance already marked for today!" });
        
        db.query(`INSERT INTO attendance_records (matric_no, course_code, level, hall_name, lecturer_id) VALUES (?, ?, ?, ?, ?)`, 
        [matric_no, course, level, hall, lecturer_id], (err) => {
            if (err) {
                console.error("Save Error:", err);
                return res.status(500).json({ message: "Failed to save record." });
            }
            res.status(200).json({ message: `Attendance marked successfully for ${course}!` });
        });
    });
});

app.get('/api/attendance/count', (req, res) => {
    const { course } = req.query;
    db.query(`SELECT COUNT(*) AS total FROM attendance_records WHERE course_code = ? AND DATE(scan_time) = CURDATE()`, [course], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.status(200).json({ count: results[0].total });
    });
});

app.post('/api/attendance/export', (req, res) => {
    const { course, email } = req.body;
    const query = `
        SELECT a.matric_no, s.full_name, a.scan_time, a.level
        FROM attendance_records a 
        JOIN students s ON a.matric_no = s.matric_no 
        WHERE a.course_code = ? AND DATE(a.scan_time) = CURDATE()
    `;

    db.query(query, [course], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(404).json({ message: "No attendance records found for today." });

        try {
            const formattedData = results.map(row => ({
                "Matric Number": row.matric_no,
                "Student Name": row.full_name,
                "Level": row.level,
                "Time of Sign-in": new Date(row.scan_time).toLocaleString('en-NG')
            }));

            const worksheet = xlsx.utils.json_to_sheet(formattedData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Attendance");
            const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER, 
                    pass: process.env.EMAIL_PASS     
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: `NACOS Attendance Report: ${course}`,
                text: `Hello Lecturer,\n\nAttached is the automated Excel attendance record for ${course}.\n\nGenerated securely by Adrian FA's Campus Attendance System.`,
                attachments: [{ filename: `${course}_Attendance.xlsx`, content: excelBuffer }]
            };

            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: "Excel report sent successfully!" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Failed to generate or send email." });
        }
    });
});

// ==========================================
//     PERSISTENT CLASS LOGGING ROUTES
// ==========================================

// 1. START A CLASS LAYER
app.post('/api/classes/start', (req, res) => {
    const { lecturer_id, course_code, level, hall_name } = req.body;
    const query = `INSERT INTO classes (lecturer_id, course_code, level, hall_name) VALUES (?, ?, ?, ?)`;
    
    db.query(query, [lecturer_id, course_code, level, hall_name], (err, result) => {
        if (err) return res.status(500).json({ message: "Failed to initialize persistent class log entry." });
        res.status(201).json({ message: "Class session logged successfully.", classId: result.insertId });
    });
});

// 2. END A CLASS LAYER
app.post('/api/classes/end', (req, res) => {
    const { classId } = req.body;
    const query = `UPDATE classes SET end_time = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.query(query, [classId], (err) => {
        if (err) return res.status(500).json({ message: "Failed to terminate persistent class log timeline." });
        res.status(200).json({ message: "Class session closed accurately." });
    });
});

// 3. UPGRADED LECTURER HISTORY ROUTE (Reads from classes, drops in attendance counts)
app.get('/api/lecturer/history', (req, res) => {
    const { staff_id } = req.query;
    const query = `
        SELECT 
            c.course_code, 
            c.level, 
            c.hall_name, 
            DATE_FORMAT(c.start_time, '%Y-%m-%d') as class_date,
            DATE_FORMAT(c.start_time, '%H:%i') as started_at,
            IFNULL(DATE_FORMAT(c.end_time, '%H:%i'), 'Active') as ended_at,
            COUNT(a.id) as total_students
        FROM classes c
        LEFT JOIN attendance_records a ON c.course_code = a.course_code 
            AND DATE(c.start_time) = DATE(a.scan_time)
        WHERE c.lecturer_id = ?
        GROUP BY c.id
        ORDER BY c.start_time DESC
    `;

    db.query(query, [staff_id], (err, results) => {
        if (err) {
            console.error("History Fetch Error:", err);
            return res.status(500).json({ error: "Database mapping error." });
        }
        res.status(200).json(results);
    });
});


// ==========================================
//         ACCOUNT RECOVERY ROUTE
// ==========================================

app.post('/api/recovery/forgot-id', (sqlReq, sqlRes) => {
    const { full_name } = sqlReq.body;
    // Standard validation search mechanism mapping against upper string bounds
    db.query(`SELECT staff_id FROM lecturers WHERE UPPER(full_name) = ?`, [full_name.toUpperCase().trim()], (err, results) => {
        if (err) return sqlRes.status(500).json({ message: "Database validation lookup anomaly." });
        if (results.length === 0) return sqlRes.status(404).json({ message: "Lecturer profile identity not found inside database registries." });
        
        sqlRes.status(200).json({ staff_id: results[0].staff_id });
    });
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));