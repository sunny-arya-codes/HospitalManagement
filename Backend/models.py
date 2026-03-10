from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # admin / doctor / patient
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    doctor_profile = db.relationship("Doctor", backref="user", uselist=False, cascade="all, delete-orphan")
    patient_profile = db.relationship("Patient", backref="user", uselist=False, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, default="")
    doctors = db.relationship("Doctor", backref="department", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "doctors_count": len(self.doctors),
        }


class Doctor(db.Model):
    __tablename__ = "doctors"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    specialization = db.Column(db.String(100), default="")
    qualification = db.Column(db.String(200), default="")
    experience_years = db.Column(db.Integer, default=0)
    phone = db.Column(db.String(20), default="")
    bio = db.Column(db.Text, default="")
    fee = db.Column(db.Float, default=500.0)

    availability = db.relationship("DoctorAvailability", backref="doctor", lazy=True, cascade="all, delete-orphan")
    appointments = db.relationship("Appointment", backref="doctor", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "specialization": self.specialization,
            "qualification": self.qualification,
            "experience_years": self.experience_years,
            "phone": self.phone,
            "bio": self.bio,
            "fee": self.fee,
            "department": self.department.to_dict() if self.department else None,
            "is_active": self.user.is_active if self.user else True,
            "email": self.user.email if self.user else "",
        }


class DoctorAvailability(db.Model):
    __tablename__ = "doctor_availability"
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(10), nullable=False)
    end_time = db.Column(db.String(10), nullable=False)
    slot_duration = db.Column(db.Integer, default=30)  # minutes
    is_available = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "doctor_id": self.doctor_id,
            "date": self.date.isoformat() if self.date else None,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "slot_duration": self.slot_duration,
            "is_available": self.is_available,
        }


class Patient(db.Model):
    __tablename__ = "patients"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(10), default="")
    phone = db.Column(db.String(20), default="")
    address = db.Column(db.Text, default="")
    blood_group = db.Column(db.String(5), default="")
    emergency_contact = db.Column(db.String(20), default="")

    appointments = db.relationship("Appointment", backref="patient", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "gender": self.gender,
            "phone": self.phone,
            "address": self.address,
            "blood_group": self.blood_group,
            "emergency_contact": self.emergency_contact,
            "email": self.user.email if self.user else "",
            "username": self.user.username if self.user else "",
            "is_active": self.user.is_active if self.user else True,
        }


class Appointment(db.Model):
    __tablename__ = "appointments"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(20), default="Booked")  # Booked / Completed / Cancelled
    reason = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    treatment = db.relationship("Treatment", backref="appointment", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "doctor_id": self.doctor_id,
            "date": self.date.isoformat() if self.date else None,
            "time": self.time,
            "status": self.status,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "patient_name": self.patient.name if self.patient else "",
            "doctor_name": self.doctor.name if self.doctor else "",
            "doctor_specialization": self.doctor.specialization if self.doctor else "",
            "treatment": self.treatment.to_dict() if self.treatment else None,
        }


class Treatment(db.Model):
    __tablename__ = "treatments"
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    diagnosis = db.Column(db.Text, default="")
    prescription = db.Column(db.Text, default="")
    notes = db.Column(db.Text, default="")
    next_visit = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "appointment_id": self.appointment_id,
            "diagnosis": self.diagnosis,
            "prescription": self.prescription,
            "notes": self.notes,
            "next_visit": self.next_visit.isoformat() if self.next_visit else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ExportJob(db.Model):
    __tablename__ = "export_jobs"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    task_id = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default="pending")  # pending / processing / completed / failed
    file_path = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    patient = db.relationship("Patient", backref="export_jobs")

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "task_id": self.task_id,
            "status": self.status,
            "file_path": self.file_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
