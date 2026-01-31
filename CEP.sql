CREATE DATABASE IF NOT EXISTS Appointmentdbb;
USE Appointmentdbb;
CREATE TABLE Doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    hospital VARCHAR(100) NOT NULL,
    specialization VARCHAR(50)
);
INSERT INTO Doctors
VALUES 
(1,'Dr. Salman Riaz', 'Iffat Anwar Medical Complex, Township, Lahore', 'General Medicine'),
(2,'Asst. Prof. Dr. Fahad Nazir', 'Iffat Anwar Medical Complex, Township, Lahore', 'Orthopedic Surgeon'),
(3,'Dr. Sidra Tul Muntaha', 'Iffat Anwar Medical Complex, Township, Lahore', 'Pediatric Surgeon'),
(4,'Dr. Mr Abid Harif Awan', 'Iffat Anwar Medical Complex, Township, Lahore', 'Physiotherapist'),
(5,'Dr. Ms Sabeeka Pervaiz', 'Iffat Anwar Medical Complex, Township, Lahore', 'Psychologist'),
(6,'Dr. Waseem Hassan', 'Iffat Anwar Medical Complex, Township, Lahore', 'Pain Management');
SELECT * FROM Doctors;

CREATE TABLE Patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    from_outside_lahore BOOLEAN
);
INSERT INTO Patients
VALUES 
(1,'Ali Khan', '03001234567', 0),
(2,'Sara Ahmed', '03007654321', 1),
(3,'Ashja Shahid', '03211234567', 0),
(4,'Fatima Noor', '03451234567', 1),
(5,'Bilal Riaz', '03121234567', 0);
select * from Patients;

CREATE TABLE Appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES Doctors(doctor_id)
);
INSERT INTO Appointments
VALUES 
(1,1, 1, '2025-12-20', '10:00:00'),
(2,2, 2, '2025-12-21', '11:30:00'),
(3,3, 3, '2025-12-22', '09:00:00'),
(4,4, 1, '2025-12-23', '14:00:00'),
(5,5, 2, '2025-12-24', '13:30:00'); 
select * from Appointments;

CREATE TABLE IF NOT EXISTS DoctorSchedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    available_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    FOREIGN KEY (doctor_id) REFERENCES Doctors(doctor_id)
);
INSERT INTO DoctorSchedules
VALUES 
(1,1, '2025-12-20', '09:00', '12:00'),
(2,2, '2025-12-20', '10:00', '13:00'),
(3,3, '2025-12-21', '08:00', '12:00'),
(4,4, '2025-12-22', '12:30', '15:30'),
(5,5, '2025-12-22', '13:00', '16:00');  
select * from DoctorSchedules;


CREATE TABLE Appointment_Delete_Log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT,
    patient_id INT,
    doctor_id INT,
    deleted_at DATETIME
);

DELIMITER $$
CREATE TRIGGER after_appointment_delete
AFTER DELETE ON Appointments
FOR EACH ROW
BEGIN
    INSERT INTO Appointment_Delete_Log
    (appointment_id, patient_id, doctor_id, deleted_at)
    VALUES
    (OLD.appointment_id, OLD.patient_id, OLD.doctor_id, NOW());
END$$
DELIMITER ;
DELETE FROM Appointments WHERE appointment_id = 3;
SELECT * FROM Appointment_Delete_Log;
DELIMITER $$

## stored peo for details
DELIMITER $$

CREATE PROCEDURE GetAppointmentDetails(IN p_appointment_id INT)
BEGIN
    SELECT 
        a.appointment_id,
        p.name AS patient_name,
        p.phone,
        p.from_outside_lahore,
        d.name AS doctor_name,
        d.specialization,
        d.hospital,
        a.appointment_date,
        a.appointment_time
    FROM Appointments a
    JOIN Patients p ON a.patient_id = p.patient_id
    JOIN Doctors d ON a.doctor_id = d.doctor_id
    WHERE a.appointment_id = p_appointment_id;
END$$

DELIMITER ;
CALL GetAppointmentDetails(4);



DELIMITER $$

CREATE PROCEDURE GetDoctorAppointments(IN p_doctor_id INT)
BEGIN
    SELECT 
        a.appointment_id,
        p.name AS patient_name,
        p.phone,
        p.from_outside_lahore,
        a.appointment_date,
        a.appointment_time
    FROM Appointments a
    JOIN Patients p ON a.patient_id = p.patient_id
    WHERE a.doctor_id = p_doctor_id
    ORDER BY a.appointment_date, a.appointment_time;
END$$

DELIMITER ;
CALL GetDoctorAppointments(2); 



START TRANSACTION;

INSERT INTO Patients (name, phone, from_outside_lahore)
VALUES ('Hamza', '03001234568', 1);

SET @pid = LAST_INSERT_ID();

INSERT INTO Appointments (patient_id, doctor_id, appointment_date, appointment_time)
VALUES (2, 50, '2025-12-20', '11:00');

COMMIT;

##count number of appointmnet per doctor
SELECT 
    d.name AS doctor_name,
    COUNT(a.appointment_id) AS total_appointments
FROM Appointments a
JOIN Doctors d ON a.doctor_id = d.doctor_id
GROUP BY d.doctor_id;

## who  have no appointment
SELECT name
FROM Doctors
WHERE doctor_id NOT IN (
    SELECT doctor_id
    FROM Appointments
);

##doctor with more than threee appointment
SELECT name, specialization
FROM Doctors
WHERE doctor_id IN (
    SELECT doctor_id
    FROM Appointments
    GROUP BY doctor_id
    HAVING COUNT(appointment_id) > 3
);

##doctors with earluest appointment
SELECT name, specialization
FROM Doctors
WHERE doctor_id = (
    SELECT doctor_id
    FROM Appointments
    ORDER BY appointment_date ASC, appointment_time ASC
    LIMIT 1
);

##appointment in current month
SELECT 
    p.name AS patient_name,
    p.phone,
    a.appointment_id,
    a.appointment_date
FROM Patients p
JOIN Appointments a ON p.patient_id = a.patient_id
WHERE MONTH(a.appointment_date) = MONTH(CURDATE())
  AND YEAR(a.appointment_date) = YEAR(CURDATE());

