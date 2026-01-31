const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
// MySQL connection (Appointments DB)
// ---------------------------
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Student@123",
  database: "Appointmentdbb",
  dateStrings: true,      // return DATE/TIME as strings
  timezone: "+05:00"      // Pakistan local time
});

connection.connect(err => {
  if (err) console.error("MySQL connection error:", err);
  else console.log("Connected to MySQL");
});

// ===========================
// BOOK APPOINTMENT
// ===========================
app.post("/book-appointment", (req, res) => {
  let { name, phone, from_outside_lahore, appointment_date, appointment_time, doctor_id } = req.body;

  if (!name || !phone || !doctor_id)
    return res.status(400).json({ message: "Name, Phone, and Doctor ID are required" });

  doctor_id = parseInt(doctor_id);
  if (appointment_date) appointment_date = appointment_date.slice(0, 10);
  if (appointment_time) appointment_time = appointment_time.slice(0, 5);

  const patientQuery = "INSERT INTO Patients (name, phone, from_outside_lahore) VALUES (?, ?, ?)";
  connection.query(patientQuery, [name, phone, from_outside_lahore ? 1 : 0], (err, result) => {
    if (err) return res.status(500).json({ message: "Error saving patient" });

    const patientId = result.insertId;

    const checkQuery = "SELECT * FROM Appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?";
    connection.query(checkQuery, [doctor_id, appointment_date, appointment_time], (errCheck, results) => {
      if (errCheck) return res.status(500).json({ message: "Error checking slot availability" });
      if (results.length > 0) return res.status(400).json({ message: "Slot not available" });

      const appointmentQuery = "INSERT INTO Appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)";
      connection.query(appointmentQuery, [patientId, doctor_id, appointment_date, appointment_time], (err2) => {
        if (err2) return res.status(500).json({ message: "Error saving appointment" });
        res.json({ message: "Appointment booked successfully" });
      });
    });
  });
});

// ===========================
// SEARCH APPOINTMENTS BY PATIENT NAME
// ===========================
app.get("/appointments/search/:name", (req, res) => {
  const name = req.params.name.trim();
  if (!name) return res.status(400).json({ message: "Name is required" });

  const query = `
    SELECT 
      a.appointment_id,
      p.name AS patient_name,
      p.phone,
      p.from_outside_lahore,
      d.name AS doctor_name,
      d.specialization,
      d.hospital,
      DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
TIME_FORMAT(CONVERT_TZ(a.appointment_time, '+00:00', '+05:00'), '%H:%i') AS appointment_time
    FROM Appointments a
    JOIN Patients p ON a.patient_id = p.patient_id
    JOIN Doctors d ON a.doctor_id = d.doctor_id
    WHERE p.name LIKE ?
    ORDER BY a.appointment_date, a.appointment_time
  `;

  connection.query(query, [`%${name}%`], (err, results) => {
    if (err) return res.status(500).json({ message: "Error searching appointments" });
    res.json(results);
  });
});

// ===========================
// GET SINGLE APPOINTMENT BY ID
// ===========================

app.get("/appointments/:id", (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT 
      a.appointment_id,
      p.name AS patient_name,
      p.phone,
      p.from_outside_lahore,
      d.name AS doctor_name,
      d.specialization,
      d.hospital,
      DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(CONVERT_TZ(a.appointment_time, '+00:00', '+05:00'), '%H:%i') AS appointment_time
    FROM Appointments a
    JOIN Patients p ON a.patient_id = p.patient_id
    JOIN Doctors d ON a.doctor_id = d.doctor_id
    WHERE a.appointment_id = ?
  `;

  connection.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ message: "Error fetching appointment detail" });
    if (results.length === 0) return res.status(404).json({ message: "Appointment not found" });
    res.json(results[0]);
  });
});

// ===========================
// GET ALL APPOINTMENTS
// ===========================
app.get("/appointments", (req, res) => {
  const query = `
    SELECT 
      a.appointment_id,
      p.name AS patient_name,
      d.name AS doctor_name,
      d.specialization,
      a.appointment_date,
      a.appointment_time
    FROM Appointments a
    JOIN Patients p ON a.patient_id = p.patient_id
    JOIN Doctors d ON a.doctor_id = d.doctor_id
    ORDER BY a.appointment_date, a.appointment_time
  `;
  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Error fetching appointments" });
    res.json(results);
  });
});

// ===========================
// DOCTOR SCHEDULE MODULE
// ===========================

// ADD DOCTOR SCHEDULE
app.post("/doctor-schedule", (req, res) => {
  let { doctor_id, available_date, start_time, end_time } = req.body;

  if (!doctor_id || !available_date || !start_time || !end_time) {
    return res.status(400).json({ message: "All fields are required" });
  }

  doctor_id = parseInt(doctor_id);
  available_date = available_date.slice(0, 10);
  start_time = start_time.slice(0, 5);
  end_time = end_time.slice(0, 5);

  const insertQuery = `
    INSERT INTO DoctorSchedules (doctor_id, available_date, start_time, end_time)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(insertQuery, [doctor_id, available_date, start_time, end_time], (err, result) => {
    if (err) return res.status(500).json({ message: "Error saving schedule" });

    const newSchedule = {
      availability_id: result.insertId,
      doctor_id,
      available_date,
      start_time,
      end_time
    };

    res.json([newSchedule]);
  });
});

// GET SCHEDULES BY DOCTOR ID
app.get("/doctor-schedules/:doctor_id", (req, res) => {
  const doctor_id = parseInt(req.params.doctor_id);

  const fetchQuery = `
    SELECT 
      ds.schedule_id AS availability_id,
      ds.doctor_id,
      d.hospital AS hospital_name,
      DATE_FORMAT(ds.available_date, '%Y-%m-%d') AS available_date,
      TIME_FORMAT(ds.start_time, '%H:%i') AS start_time,
      TIME_FORMAT(ds.end_time, '%H:%i') AS end_time
    FROM DoctorSchedules ds
    JOIN Doctors d ON ds.doctor_id = d.doctor_id
    WHERE ds.doctor_id = ?
    ORDER BY ds.available_date DESC, ds.start_time DESC
  `;

  connection.query(fetchQuery, [doctor_id], (err, results) => {
    if (err) return res.status(500).json({ message: "Error fetching schedules" });
    res.json(Array.isArray(results) ? results : []);
  });
});

// DELETE APPOINTMENT
app.delete("/appointments/:id", (req, res) => {
  const { id } = req.params;

  const checkQuery = "SELECT * FROM Appointments WHERE appointment_id = ?";
  connection.query(checkQuery, [id], (err, results) => {
    if (err) return res.status(500).json({ message: "Error checking appointment" });
    if (results.length === 0) return res.status(404).json({ message: "Appointment not found" });

    const deleteQuery = "DELETE FROM Appointments WHERE appointment_id = ?";
    connection.query(deleteQuery, [id], (err2) => {
      if (err2) return res.status(500).json({ message: "Error deleting appointment" });
      res.json({ message: "Appointment deleted successfully" });
    });
  });
});

// ===========================
// DNS Lab Module
// ===========================
const dnsDb = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Student@123",
  database: "DNSLab"
});

dnsDb.connect(err => {
  if (err) console.error("DNS Database connection error:", err);
  else console.log("Connected to DNS MySQL database");
});

// Get all DNS entries
app.get("/dns", (req, res) => {
  dnsDb.query("SELECT * FROM DNSEntries", (err, result) => {
    if (err) res.send(err);
    else res.json(result);
  });
});

// Add a DNS entry
app.post("/dns", (req, res) => {
  const { domain_name, ip_address, ip_class } = req.body;
  dnsDb.query(
    "INSERT INTO DNSEntries (domain_name, ip_address, ip_class) VALUES (?, ?, ?)",
    [domain_name, ip_address, ip_class],
    (err, result) => {
      if (err) res.send(err);
      else res.send("Entry added");
    }
  );
});

// Delete a DNS entry
app.delete("/dns/:id", (req, res) => {
  const { id } = req.params;
  dnsDb.query("DELETE FROM DNSEntries WHERE id = ?", [id], (err, result) => {
    if (err) res.send(err);
    else res.send("Entry deleted");
  });
});

// Resolve a domain
app.get("/dns/search/:domain", (req, res) => {
  const { domain } = req.params;
  dnsDb.query("SELECT * FROM DNSEntries WHERE domain_name = ?", [domain], (err, result) => {
    if (err) res.send(err);
    else res.json(result);
  });
});

// ===========================
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


