from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from models import db, User, Doctor, Patient, Appointment, Department, DoctorAvailability, Treatment
import datetime

admin_bp = Blueprint("admin", __name__)


def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────── DASHBOARD ───────────────────────────
@admin_bp.route("/dashboard", methods=["GET"])
@admin_required
def dashboard():
    total_doctors = Doctor.query.join(User).filter(User.is_active == True).count()
    total_patients = Patient.query.join(User).filter(User.is_active == True).count()
    total_appointments = Appointment.query.count()
    booked = Appointment.query.filter_by(status="Booked").count()
    completed = Appointment.query.filter_by(status="Completed").count()
    cancelled = Appointment.query.filter_by(status="Cancelled").count()
    today = datetime.date.today()
    today_appointments = Appointment.query.filter_by(date=today).count()

    # Recent appointments
    recent = (
        Appointment.query.order_by(Appointment.created_at.desc()).limit(10).all()
    )

    return jsonify({
        "stats": {
            "total_doctors": total_doctors,
            "total_patients": total_patients,
            "total_appointments": total_appointments,
            "booked": booked,
            "completed": completed,
            "cancelled": cancelled,
            "today_appointments": today_appointments,
        },
        "recent_appointments": [a.to_dict() for a in recent],
    }), 200


# ─────────────────────────── DEPARTMENTS ───────────────────────────
@admin_bp.route("/departments", methods=["GET"])
@admin_required
def get_departments():
    depts = Department.query.all()
    return jsonify([d.to_dict() for d in depts]), 200


@admin_bp.route("/departments", methods=["POST"])
@admin_required
def create_department():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Department name required"}), 400
    if Department.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Department already exists"}), 409
    dept = Department(name=data["name"], description=data.get("description", ""))
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@admin_bp.route("/departments/<int:dept_id>", methods=["PUT"])
@admin_required
def update_department(dept_id):
    dept = Department.query.get_or_404(dept_id)
    data = request.get_json()
    dept.name = data.get("name", dept.name)
    dept.description = data.get("description", dept.description)
    db.session.commit()
    return jsonify(dept.to_dict()), 200


@admin_bp.route("/departments/<int:dept_id>", methods=["DELETE"])
@admin_required
def delete_department(dept_id):
    dept = Department.query.get_or_404(dept_id)
    db.session.delete(dept)
    db.session.commit()
    return jsonify({"message": "Department deleted"}), 200


# ─────────────────────────── DOCTORS ───────────────────────────
@admin_bp.route("/doctors", methods=["GET"])
@admin_required
def get_doctors():
    doctors = Doctor.query.all()
    return jsonify([d.to_dict() for d in doctors]), 200


@admin_bp.route("/doctors", methods=["POST"])
@admin_required
def create_doctor():
    data = request.get_json()
    required = ["username", "email", "password", "name"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already taken"}), 409
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        username=data["username"].strip(),
        email=data["email"].strip().lower(),
        role="doctor",
        is_active=True,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    doctor = Doctor(
        user_id=user.id,
        name=data["name"].strip(),
        specialization=data.get("specialization", ""),
        qualification=data.get("qualification", ""),
        experience_years=int(data.get("experience_years", 0)),
        phone=data.get("phone", ""),
        bio=data.get("bio", ""),
        fee=float(data.get("fee", 500.0)),
        department_id=data.get("department_id"),
    )
    db.session.add(doctor)
    db.session.commit()
    return jsonify(doctor.to_dict()), 201


@admin_bp.route("/doctors/<int:doctor_id>", methods=["GET"])
@admin_required
def get_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    d = doctor.to_dict()
    d["availability"] = [a.to_dict() for a in doctor.availability]
    return jsonify(d), 200


@admin_bp.route("/doctors/<int:doctor_id>", methods=["PUT"])
@admin_required
def update_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    data = request.get_json()
    doctor.name = data.get("name", doctor.name)
    doctor.specialization = data.get("specialization", doctor.specialization)
    doctor.qualification = data.get("qualification", doctor.qualification)
    doctor.experience_years = int(data.get("experience_years", doctor.experience_years))
    doctor.phone = data.get("phone", doctor.phone)
    doctor.bio = data.get("bio", doctor.bio)
    doctor.fee = float(data.get("fee", doctor.fee))
    doctor.department_id = data.get("department_id", doctor.department_id)
    if data.get("email"):
        doctor.user.email = data["email"]
    if data.get("is_active") is not None:
        doctor.user.is_active = data["is_active"]
    db.session.commit()
    return jsonify(doctor.to_dict()), 200


@admin_bp.route("/doctors/<int:doctor_id>", methods=["DELETE"])
@admin_required
def delete_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    user = doctor.user
    db.session.delete(doctor)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Doctor removed"}), 200


@admin_bp.route("/doctors/<int:doctor_id>/toggle-status", methods=["PUT"])
@admin_required
def toggle_doctor_status(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    doctor.user.is_active = not doctor.user.is_active
    db.session.commit()
    status = "activated" if doctor.user.is_active else "blacklisted"
    return jsonify({"message": f"Doctor {status}", "is_active": doctor.user.is_active}), 200


# ─────────────────────────── PATIENTS ───────────────────────────
@admin_bp.route("/patients", methods=["GET"])
@admin_required
def get_patients():
    patients = Patient.query.all()
    return jsonify([p.to_dict() for p in patients]), 200


@admin_bp.route("/patients/<int:patient_id>", methods=["GET"])
@admin_required
def get_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    p = patient.to_dict()
    p["appointments"] = [a.to_dict() for a in patient.appointments]
    return jsonify(p), 200


@admin_bp.route("/patients/<int:patient_id>", methods=["PUT"])
@admin_required
def update_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    data = request.get_json()
    patient.name = data.get("name", patient.name)
    patient.phone = data.get("phone", patient.phone)
    patient.address = data.get("address", patient.address)
    patient.blood_group = data.get("blood_group", patient.blood_group)
    patient.emergency_contact = data.get("emergency_contact", patient.emergency_contact)
    if data.get("email"):
        patient.user.email = data["email"]
    if data.get("is_active") is not None:
        patient.user.is_active = data["is_active"]
    db.session.commit()
    return jsonify(patient.to_dict()), 200


@admin_bp.route("/patients/<int:patient_id>/toggle-status", methods=["PUT"])
@admin_required
def toggle_patient_status(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    patient.user.is_active = not patient.user.is_active
    db.session.commit()
    status = "activated" if patient.user.is_active else "blacklisted"
    return jsonify({"message": f"Patient {status}", "is_active": patient.user.is_active}), 200


# ─────────────────────────── APPOINTMENTS ───────────────────────────
@admin_bp.route("/appointments", methods=["GET"])
@admin_required
def get_appointments():
    status = request.args.get("status")
    query = Appointment.query.order_by(Appointment.date.desc(), Appointment.time.desc())
    if status:
        query = query.filter_by(status=status)
    appointments = query.all()
    return jsonify([a.to_dict() for a in appointments]), 200


@admin_bp.route("/appointments/<int:appt_id>", methods=["GET"])
@admin_required
def get_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    return jsonify(appt.to_dict()), 200


@admin_bp.route("/appointments/<int:appt_id>", methods=["DELETE"])
@admin_required
def delete_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    db.session.delete(appt)
    db.session.commit()
    return jsonify({"message": "Appointment deleted"}), 200


# ─────────────────────────── SEARCH ───────────────────────────
@admin_bp.route("/search", methods=["GET"])
@admin_required
def search():
    q = request.args.get("q", "").strip()
    search_type = request.args.get("type", "all")

    results = {"doctors": [], "patients": []}

    if search_type in ("all", "doctor") and q:
        doctors = Doctor.query.filter(
            (Doctor.name.ilike(f"%{q}%")) |
            (Doctor.specialization.ilike(f"%{q}%")) |
            (Doctor.phone.ilike(f"%{q}%"))
        ).all()
        results["doctors"] = [d.to_dict() for d in doctors]

    if search_type in ("all", "patient") and q:
        patients = Patient.query.filter(
            (Patient.name.ilike(f"%{q}%")) |
            (Patient.phone.ilike(f"%{q}%")) |
            (Patient.blood_group.ilike(f"%{q}%"))
        ).all()
        results["patients"] = [p.to_dict() for p in patients]

    return jsonify(results), 200
