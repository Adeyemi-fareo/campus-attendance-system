require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');

const app = express();

app.use(cors({
    origin: ["http://localhost:5173", "https://nacos-attendance-portal.netlify.app"], 
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: 25838,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("Database pool connection failed:", err);
    } else {
        console.log("Connected to MySQL database via secure Pool.");
        connection.release(); 
    }
});

app.post('/api/register', async (req, res) => {
    const { matric_no, full_name, password, level } = req.body; 
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
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
                    level: results[0].level 
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
        if (err) return res.status(500).json({ message: "Database connection failure." });
        if (results.length === 0) return res.status(404).json({ message: "Lecturer profile not found." });
        
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
            res.status(200).json({ 
                lecturerData: { 
                    staff_id: results[0].staff_id, 
                    full_name: results[0].full_name,
                    email: results[0].email 
                } 
            });
        } else {
            res.status(401).json({ message: "Incorrect login PIN." });
        }
    });
});

app.post('/api/lecturer/register', async (req, res) => {
    const { staff_id, full_name, password, email } = req.body;
    
    if (!staff_id || !full_name || !password || !email) {
        return res.status(400).json({ message: "All registration fields (including email) are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(`INSERT INTO lecturers (staff_id, full_name, password, email) VALUES (?, ?, ?, ?)`, 
        [staff_id, full_name, hashedPassword, email], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "This Staff ID or Email is already registered." });
                return res.status(500).json({ message: "Database registration failure." });
            }
            
            res.status(201).json({ 
                message: "Registration successful!",
                lecturerData: { staff_id, full_name, email }
            });
        });
    } catch (error) { res.status(500).json({ message: "Server registry execution block." }); }
});

app.post('/api/recovery/forgot-id', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required." });

    const query = `SELECT staff_id, email FROM lecturers WHERE email = ?`;
    db.query(query, [email.trim()], (err, results) => {
        if (err) return res.status(500).json({ message: "Database lookup failure." });
        if (results.length === 0) return res.status(404).json({ message: "No registered lecturer profile found matching that email." });
        
        const targetEmail = results[0].email;
        const [namePart, domainPart] = targetEmail.split('@');
        const maskedEmail = `${namePart.substring(0, 2)}${'*'.repeat(Math.max(namePart.length - 2, 4))}@${domainPart}`;

        res.status(200).json({ 
            staff_id: results[0].staff_id,
            masked_email: maskedEmail
        });
    });
});

app.post('/api/recovery/forgot-pin', (req, res) => {
    const { role, identifier, email } = req.body; 
    
    if (!role || !identifier) {
        return res.status(400).json({ message: "Missing required profile data." });
    }

    const selectQuery = role === 'lecturer' 
        ? `SELECT full_name, email FROM lecturers WHERE staff_id = ?` 
        : `SELECT full_name FROM students WHERE matric_no = ?`;

    db.query(selectQuery, [identifier], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database verification anomaly." });
        if (results.length === 0) return res.status(404).json({ message: `Account profile not found.` });

        const userRecord = results[0];
        const targetEmail = role === 'lecturer' ? userRecord.email : email;

        if (!targetEmail) {
            return res.status(400).json({ message: "No valid email address is associated with this profile." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 300000);

        db.query(`INSERT INTO password_resets (email, token, role, expires_at) VALUES (?, ?, ?, ?)`, 
        [targetEmail, token, role, expiresAt], async (insertErr) => {
            if (insertErr) return res.status(500).json({ message: "Failed to generate security token." });

            try {
                const frontendUrl = process.env.NODE_ENV === 'production' 
                    ? 'https://nacos-attendance-portal.netlify.app' 
                    : 'http://localhost:5173';

                const resetLink = `${frontendUrl}/?token=${token}&email=${targetEmail}`;

                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': process.env.BREVO_API_KEY,
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: { name: "NACOS Portal Support", email: "fareosocials@gmail.com" },
                        to: [{ email: targetEmail }],
                        subject: "NACOS Portal Security: Password Reset Link",
                        htmlContent: `
                            <p>Hello ${userRecord.full_name},</p>
                            <p>You requested a password reset for your NACOS Attendance Portal account.</p>
                            <p>Please click the secure link below to set a new PIN:</p>
                            <p><a href="${resetLink}" style="background-color: #008751; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset My Portal PIN</a></p>
                            <p>This link is secure and will expire in 5 minutes.</p>
                            <hr/>
                            <p>Generated Securely by Adrian FA's Campus Support Engine.</p>
                        `
                    })
                });

                if (!response.ok) throw new Error("Brevo HTTP API delivery failure");
                
                let displayEmail = targetEmail;
                if (role === 'lecturer') {
                    const [namePart, domainPart] = targetEmail.split('@');
                    displayEmail = `${namePart.substring(0, 2)}${'*'.repeat(Math.max(namePart.length - 2, 4))}@${domainPart}`;
                }

                res.status(200).json({ message: `A password reset link has been sent to ${displayEmail}` });
            } catch (error) {
                console.error("Mailer Error:", error);
                res.status(500).json({ message: "Mailer module failed to transmit verification token." });
            }
        });
    });
});

app.post('/api/recovery/confirm-reset', (req, res) => {
    const { token, email, password } = req.body;

    db.query(`SELECT * FROM password_resets WHERE email = ? AND token = ? AND expires_at > CURRENT_TIMESTAMP`, 
    [email, token], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ message: "Invalid or expired recovery security token string." });

        const targetRole = results[0].role;
        const targetQuery = targetRole === 'student' 
            ? `UPDATE students SET password = ? WHERE matric_no = (SELECT identifier_placeholder_logic FROM accounts_temp_map)` 
            : `UPDATE lecturers SET password = ? WHERE email = ?`;

        const queryParams = targetRole === 'student' ? [await bcrypt.hash(password, 10)] : [await bcrypt.hash(password, 10), email];

        try {
            db.query(targetQuery, queryParams, async (updateErr) => {
                if (updateErr) return res.status(500).json({ message: "Failed to update profile password hash arrays." });
                
                db.query(`DELETE FROM password_resets WHERE email = ?`, [email]);
                
                try {
                    await fetch('https://api.brevo.com/v3/smtp/email', {
                        method: 'POST',
                        headers: {
                            'accept': 'application/json',
                            'api-key': process.env.BREVO_API_KEY,
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            sender: { name: "NACOS Portal Support", email: "support@lasued.edu.ng" },
                            to: [{ email: email }],
                            subject: "NACOS Portal Security: Password Successfully Changed",
                            htmlContent: `
                                <p>Hello,</p>
                                <p>This is a confirmation that the 4-Digit PIN for your NACOS Attendance Portal account has been successfully updated.</p>
                                <p>If you did not make this change, please contact the system administrator immediately.</p>
                                <hr/>
                                <p>Generated Securely by Adrian FA's Campus Support Engine.</p>
                            `
                        })
                    });
                } catch (mailErr) {
                    console.error("Failed to send confirmation email:", mailErr);
                }

                res.status(200).json({ message: "Password updated successfully!" });
            });
        } catch(hashErr) { res.status(500).json({ message: "Crypto packaging failure." }); }
    });
});

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
}

const HALL_LOCATIONS = {
    'Coited Room 1': { lat: 6.499369, lng: 3.114115 },
    'Coited Annex Building': { lat: 6.499385, lng: 3.113401 },
    'Credo Hall': { lat: 6.501393, lng: 3.114341 },
    'ETF Building': { lat: 6.499503, lng: 3.113986 },
    'Software Lab 1': { lat: 6.499419, lng: 3.113306 },
    'Software Lab 2': { lat: 6.499327, lng: 3.113288 }
};

app.post('/api/attendance', (req, res) => {
    const { matric_no, course, level, hall, lecturer_id, lat, lng } = req.body;
    const targetLocation = HALL_LOCATIONS[hall];

    if (!targetLocation) return res.status(400).json({ message: "Invalid hall location." });
    
    const distance = getDistanceInMeters(targetLocation.lat, targetLocation.lng, lat, lng);
    
    if (distance > 75) {
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
        WHERE a.course_code = ?
        ORDER BY a.scan_time DESC
    `;

    db.query(query, [course], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(404).json({ message: "No attendance records found for this course." });

        try {
            const formattedData = results.map(row => {
                const dateObj = new Date(row.scan_time);
                return {
                    "Matric Number": row.matric_no,
                    "Student Name": row.full_name,
                    "Level": row.level,
                    "Date": dateObj.toLocaleDateString('en-NG'),
                    "Time of Sign-in": dateObj.toLocaleTimeString('en-NG')
                };
            });

            const worksheet = xlsx.utils.json_to_sheet(formattedData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Full Attendance History");
            const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            const base64Content = excelBuffer.toString('base64');

            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': process.env.BREVO_API_KEY,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: "NACOS Attendance Support", email: "support@lasued.edu.ng" },
                    to: [{ email: email }],
                    subject: `NACOS Complete Attendance Report: ${course}`,
                    textContent: `Hello,\n\nAttached is the complete automated Excel attendance record for all ${course} sessions.\n\nGenerated securely by Adrian FA's Campus Attendance System.`,
                    attachment: [{
                        name: `${course}_Full_Attendance.xlsx`,
                        content: base64Content
                    }]
                })
            });

            if (!response.ok) throw new Error("Brevo export delivery failure");
            res.status(200).json({ message: "Excel report sent successfully!" });
        } catch (error) {
            console.error("Export Error:", error);
            res.status(500).json({ message: "Failed to generate or send email." });
        }
    });
});

app.post('/api/classes/start', (req, res) => {
    const { lecturer_id, course_code, level, hall_name } = req.body;
    const query = `INSERT INTO classes (lecturer_id, course_code, level, hall_name) VALUES (?, ?, ?, ?)`;
    
    db.query(query, [lecturer_id, course_code, level, hall_name], (err, result) => {
        if (err) return res.status(500).json({ message: "Failed to initialize persistent class log entry." });
        res.status(201).json({ message: "Class session logged successfully.", classId: result.insertId });
    });
});

app.post('/api/classes/end', (req, res) => {
    const { classId } = req.body;
    const query = `UPDATE classes SET end_time = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.query(query, [classId], (err) => {
        if (err) return res.status(500).json({ message: "Failed to terminate persistent class log timeline." });
        res.status(200).json({ message: "Class session closed accurately." });
    });
});

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));