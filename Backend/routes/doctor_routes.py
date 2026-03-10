from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from models import db, User, Doctor, Patient, Appointment, Treatment, DoctorAvailability
from app import cache
import datetime

doctor_bp = Blueprint("doctor", __name__)


def doctor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != "doctor":
            return jsonify({"error": "Doctor access required"}), 403
        if not user.is_active:
            return jsonify({"error": "Account deactivated"}), 403
        return f(*args, **kwargs)
    return decorated


def get_current_doctor():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    return user.doctor_profile if user else None


# ─────────────────────────── DASHBOARD ───────────────────────────
@doctor_bp.route("/dashboard", methods=["GET"])
@doctor_required
def dashboard():
    doctor = get_current_doctor()
    if not doctor:
        return jsonify({"error": "Doctor profile not found"}), 404

    today = datetime.date.today()
    week_end = today + datetime.timedelta(days=7)

    today_appts = Appointment.query.filter_by(doctor_id=doctor.id, date=today).filter(
        Appointment.status == "Booked"
    ).all()

    week_appts = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.date >= today,
        Appointment.date <= week_end,
        Appointment.status == "Booked",
    ).order_by(Appointment.date, Appointment.time).all()

    # Unique patients
    patient_ids = list(set(a.patient_id for a in doctor.appointments))
    total_patients = len(patient_ids)
    completed = Appointment.query.filter_by(doctor_id=doctor.id, status="Completed").count()

    return jsonify({
        "doctor": doctor.to_dict(),
        "stats": {
            "today_appointments": len(today_appts),
            "week_appointments": len(week_appts),
            "total_patients": total_patients,
            "completed_appointments": completed,
        },
        "today_appointments": [a.to_dict() for a in today_appts],
        "week_appointments": [a.to_dict() for a in week_appts],
    }), 200


# ─────────────────────────── APPOINTMENTS ───────────────────────────
@doctor_bp.route("/appointments", methods=["GET"])
@doctor_required
def get_appointments():
    doctor = get_current_doctor()
    status = request.args.get("status")
    date_str = request.args.get("date")

    query = Appointment.query.filter_by(doctor_id=doctor.id)
    if status:
        query = query.filter_by(status=status)
    if date_str:
        try:
            date = datetime.date.fromisoformat(date_str)
            query = query.filter_by(date=date)
        except ValueError:
            pass

    appointments = query.order_by(Appointment.date.desc(), Appointment.time).all()
    return jsonify([a.to_dict() for a in appointments]), 200


@doctor_bp.route("/appointments/<int:appt_id>/complete", methods=["PUT"])
@doctor_required
def complete_appointment(appt_id):
    doctor = get_current_doctor()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_id != doctor.id:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    appt.status = "Completed"

    # Create or update treatment
    next_visit = None
    if data.get("next_visit"):
        try:
            next_visit = datetime.date.fromisoformat(data["next_visit"])
        except ValueError:
            pass

    if appt.treatment:
        appt.treatment.diagnosis = data.get("diagnosis", "")
        appt.treatment.prescription = data.get("prescription", "")
        appt.treatment.notes = data.get("notes", "")
        appt.treatment.next_visit = next_visit
    else:
        treatment = Treatment(
            appointment_id=appt.id,
            diagnosis=data.get("diagnosis", ""),
            prescription=data.get("prescription", ""),
            notes=data.get("notes", ""),
            next_visit=next_visit,
        )
        db.session.add(treatment)

    db.session.commit()
    return jsonify(appt.to_dict()), 200


@doctor_bp.route("/appointments/<int:appt_id>/cancel", methods=["PUT"])
@doctor_required
def cancel_appointment(appt_id):
    doctor = get_current_doctor()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_id != doctor.id:
        return jsonify({"error": "Unauthorized"}), 403
    appt.status = "Cancelled"
    db.session.commit()
    return jsonify(appt.to_dict()), 200


# ─────────────────────────── PATIENTS ───────────────────────────
@doctor_bp.route("/patients", methods=["GET"])
@doctor_required
def get_patients():
    doctor = get_current_doctor()
    patient_ids = list(set(a.patient_id for a in doctor.appointments))
    patients = Patient.query.filter(Patient.id.in_(patient_ids)).all()
    return jsonify([p.to_dict() for p in patients]), 200


@doctor_bp.route("/patients/<int:patient_id>/history", methods=["GET"])
@doctor_required
def get_patient_history(patient_id):
    doctor = get_current_doctor()
    patient = Patient.query.get_or_404(patient_id)

    # Only allow if this doctor has an appointment with patient
    has_appt = Appointment.query.filter_by(doctor_id=doctor.id, patient_id=patient_id).first()
    if not has_appt:
        return jsonify({"error": "Unauthorized"}), 403

    appointments = Appointment.query.filter_by(patient_id=patient_id).order_by(
        Appointment.date.desc()
    ).all()
    return jsonify({
        "patient": patient.to_dict(),
        "appointments": [a.to_dict() for a in appointments],
    }), 200


# ─────────────────────────── AVAILABILITY ───────────────────────────
@doctor_bp.route("/availability", methods=["GET"])
@doctor_required
def get_availability():
    doctor = get_current_doctor()
    today = datetime.date.today()
    week_end = today + datetime.timedelta(days=7)
    avail = DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor.id,
        DoctorAvailability.date >= today,
        DoctorAvailability.date <= week_end,
    ).order_by(DoctorAvailability.date).all()
    return jsonify([a.to_dict() for a in avail]), 200


@doctor_bp.route("/availability", methods=["POST"])
@doctor_required
def set_availability():
    doctor = get_current_doctor()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data"}), 400

    # data can be list or single item
    items = data if isinstance(data, list) else [data]
    today = datetime.date.today()
    results = []

    for item in items:
        try:
            date = datetime.date.fromisoformat(item["date"])
        except (ValueError, KeyError):
            continue

        if date < today or date > today + datetime.timedelta(days=7):
            continue

        existing = DoctorAvailability.query.filter_by(
            doctor_id=doctor.id, date=date
        ).first()

        if existing:
            existing.start_time = item.get("start_time", existing.start_time)
            existing.end_time = item.get("end_time", existing.end_time)
            existing.slot_duration = int(item.get("slot_duration", existing.slot_duration))
            existing.is_available = item.get("is_available", existing.is_available)
            results.append(existing.to_dict())
        else:
            avail = DoctorAvailability(
                doctor_id=doctor.id,
                date=date,
                start_time=item.get("start_time", "09:00"),
                end_time=item.get("end_time", "17:00"),
                slot_duration=int(item.get("slot_duration", 30)),
                is_available=item.get("is_available", True),
            )
            db.session.add(avail)
            results.append(avail.to_dict())

    db.session.commit()
    return jsonify(results), 201


@doctor_bp.route("/availability/<int:avail_id>", methods=["DELETE"])
@doctor_required
def delete_availability(avail_id):
    doctor = get_current_doctor()
    avail = DoctorAvailability.query.get_or_404(avail_id)
    if avail.doctor_id != doctor.id:
        return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(avail)
    db.session.commit()
    return jsonify({"message": "Availability removed"}), 200


# ─────────────────────────── TREATMENT ───────────────────────────
@doctor_bp.route("/treatments/<int:appt_id>", methods=["PUT"])
@doctor_required
def update_treatment(appt_id):
    doctor = get_current_doctor()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_id != doctor.id:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    next_visit = None
    if data.get("next_visit"):
        try:
            next_visit = datetime.date.fromisoformat(data["next_visit"])
        except ValueError:
            pass

    if appt.treatment:
        t = appt.treatment
        t.diagnosis = data.get("diagnosis", t.diagnosis)
        t.prescription = data.get("prescription", t.prescription)
        t.notes = data.get("notes", t.notes)
        t.next_visit = next_visit if next_visit else t.next_visit
    else:
        t = Treatment(
            appointment_id=appt.id,
            diagnosis=data.get("diagnosis", ""),
            prescription=data.get("prescription", ""),
            notes=data.get("notes", ""),
            next_visit=next_visit,
        )
        db.session.add(t)

    db.session.commit()
    return jsonify(appt.to_dict()), 200


# ─────────────────────────── PROFILE ───────────────────────────
@doctor_bp.route("/profile", methods=["GET"])
@doctor_required
def get_profile():
    doctor = get_current_doctor()
    return jsonify(doctor.to_dict()), 200


@doctor_bp.route("/profile", methods=["PUT"])
@doctor_required
def update_profile():
    doctor = get_current_doctor()
    data = request.get_json()
    doctor.name = data.get("name", doctor.name)
    doctor.specialization = data.get("specialization", doctor.specialization)
    doctor.qualification = data.get("qualification", doctor.qualification)
    doctor.experience_years = int(data.get("experience_years", doctor.experience_years))
    doctor.phone = data.get("phone", doctor.phone)
    doctor.bio = data.get("bio", doctor.bio)
    doctor.fee = float(data.get("fee", doctor.fee))
    db.session.commit()
    return jsonify(doctor.to_dict()), 200
