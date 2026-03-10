from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from models import db, User, Doctor, Patient, Appointment, Treatment, DoctorAvailability, Department, ExportJob
from app import cache
import datetime, os

patient_bp = Blueprint("patient", __name__)


def patient_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != "patient":
            return jsonify({"error": "Patient access required"}), 403
        if not user.is_active:
            return jsonify({"error": "Account deactivated. Contact admin."}), 403
        return f(*args, **kwargs)
    return decorated


def get_current_patient():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    return user.patient_profile if user else None


# ─────────────────────────── DASHBOARD ───────────────────────────
@patient_bp.route("/dashboard", methods=["GET"])
@patient_required
def dashboard():
    patient = get_current_patient()
    if not patient:
        return jsonify({"error": "Patient profile not found"}), 404

    today = datetime.date.today()
    upcoming = Appointment.query.filter(
        Appointment.patient_id == patient.id,
        Appointment.date >= today,
        Appointment.status == "Booked",
    ).order_by(Appointment.date, Appointment.time).all()

    recent = Appointment.query.filter(
        Appointment.patient_id == patient.id,
        Appointment.status == "Completed",
    ).order_by(Appointment.date.desc()).limit(5).all()

    departments = Department.query.all()

    return jsonify({
        "patient": patient.to_dict(),
        "upcoming_appointments": [a.to_dict() for a in upcoming],
        "recent_history": [a.to_dict() for a in recent],
        "departments": [d.to_dict() for d in departments],
        "stats": {
            "upcoming": len(upcoming),
            "total_appointments": len(patient.appointments),
            "completed": Appointment.query.filter_by(patient_id=patient.id, status="Completed").count(),
        }
    }), 200


# ─────────────────────────── PROFILE ───────────────────────────
@patient_bp.route("/profile", methods=["GET"])
@patient_required
def get_profile():
    patient = get_current_patient()
    return jsonify(patient.to_dict()), 200


@patient_bp.route("/profile", methods=["PUT"])
@patient_required
def update_profile():
    patient = get_current_patient()
    data = request.get_json()
    patient.name = data.get("name", patient.name)
    patient.phone = data.get("phone", patient.phone)
    patient.address = data.get("address", patient.address)
    patient.blood_group = data.get("blood_group", patient.blood_group)
    patient.emergency_contact = data.get("emergency_contact", patient.emergency_contact)
    patient.gender = data.get("gender", patient.gender)
    if data.get("date_of_birth"):
        try:
            patient.date_of_birth = datetime.date.fromisoformat(data["date_of_birth"])
        except ValueError:
            pass
    if data.get("email"):
        patient.user.email = data["email"]
    db.session.commit()
    return jsonify(patient.to_dict()), 200


# ─────────────────────────── DEPARTMENTS ───────────────────────────
@patient_bp.route("/departments", methods=["GET"])
@patient_required
@cache.cached(timeout=300, key_prefix="departments_all")
def get_departments():
    depts = Department.query.all()
    return jsonify([d.to_dict() for d in depts]), 200


# ─────────────────────────── DOCTORS ───────────────────────────
@patient_bp.route("/doctors", methods=["GET"])
@patient_required
def get_doctors():
    specialization = request.args.get("specialization", "")
    department_id = request.args.get("department_id")
    name = request.args.get("name", "")
    today = datetime.date.today()
    week_end = today + datetime.timedelta(days=7)

    query = Doctor.query.join(User).filter(User.is_active == True)
    if specialization:
        query = query.filter(Doctor.specialization.ilike(f"%{specialization}%"))
    if department_id:
        query = query.filter_by(department_id=department_id)
    if name:
        query = query.filter(Doctor.name.ilike(f"%{name}%"))

    doctors = query.all()
    result = []
    for d in doctors:
        doc_dict = d.to_dict()
        # Get availability for next 7 days
        avail = DoctorAvailability.query.filter(
            DoctorAvailability.doctor_id == d.id,
            DoctorAvailability.date >= today,
            DoctorAvailability.date <= week_end,
            DoctorAvailability.is_available == True,
        ).order_by(DoctorAvailability.date).all()
        doc_dict["availability"] = [a.to_dict() for a in avail]
        result.append(doc_dict)
    return jsonify(result), 200


@patient_bp.route("/doctors/<int:doctor_id>", methods=["GET"])
@patient_required
def get_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    today = datetime.date.today()
    week_end = today + datetime.timedelta(days=7)
    d = doctor.to_dict()
    avail = DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor.id,
        DoctorAvailability.date >= today,
        DoctorAvailability.date <= week_end,
        DoctorAvailability.is_available == True,
    ).all()
    d["availability"] = [a.to_dict() for a in avail]
    return jsonify(d), 200


# ─────────────────────────── APPOINTMENTS ───────────────────────────
@patient_bp.route("/appointments", methods=["GET"])
@patient_required
def get_appointments():
    patient = get_current_patient()
    status = request.args.get("status")
    query = Appointment.query.filter_by(patient_id=patient.id).order_by(
        Appointment.date.desc(), Appointment.time
    )
    if status:
        query = query.filter_by(status=status)
    appointments = query.all()
    return jsonify([a.to_dict() for a in appointments]), 200


@patient_bp.route("/appointments", methods=["POST"])
@patient_required
def book_appointment():
    patient = get_current_patient()
    data = request.get_json()

    required = ["doctor_id", "date", "time"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    try:
        appt_date = datetime.date.fromisoformat(data["date"])
    except ValueError:
        return jsonify({"error": "Invalid date format (use YYYY-MM-DD)"}), 400

    if appt_date < datetime.date.today():
        return jsonify({"error": "Cannot book appointment in the past"}), 400

    doctor = Doctor.query.get(data["doctor_id"])
    if not doctor:
        return jsonify({"error": "Doctor not found"}), 404
    if not doctor.user.is_active:
        return jsonify({"error": "Doctor is not available"}), 400

    # Check double booking — same doctor, date, time
    existing = Appointment.query.filter_by(
        doctor_id=data["doctor_id"],
        date=appt_date,
        time=data["time"],
        status="Booked",
    ).first()
    if existing:
        return jsonify({"error": "This slot is already booked. Please choose another time."}), 409

    # Check patient doesn't already have appointment at same time
    patient_conflict = Appointment.query.filter_by(
        patient_id=patient.id,
        date=appt_date,
        time=data["time"],
        status="Booked",
    ).first()
    if patient_conflict:
        return jsonify({"error": "You already have an appointment at this time"}), 409

    appt = Appointment(
        patient_id=patient.id,
        doctor_id=data["doctor_id"],
        date=appt_date,
        time=data["time"],
        reason=data.get("reason", ""),
        status="Booked",
    )
    db.session.add(appt)
    db.session.commit()
    return jsonify(appt.to_dict()), 201


@patient_bp.route("/appointments/<int:appt_id>", methods=["PUT"])
@patient_required
def reschedule_appointment(appt_id):
    patient = get_current_patient()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != patient.id:
        return jsonify({"error": "Unauthorized"}), 403
    if appt.status != "Booked":
        return jsonify({"error": "Only Booked appointments can be rescheduled"}), 400

    data = request.get_json()
    try:
        new_date = datetime.date.fromisoformat(data["date"])
    except (ValueError, KeyError):
        return jsonify({"error": "Valid date required"}), 400

    if new_date < datetime.date.today():
        return jsonify({"error": "Cannot reschedule to past date"}), 400

    new_time = data.get("time", appt.time)

    # Check conflict
    existing = Appointment.query.filter_by(
        doctor_id=appt.doctor_id,
        date=new_date,
        time=new_time,
        status="Booked",
    ).filter(Appointment.id != appt_id).first()
    if existing:
        return jsonify({"error": "Slot already taken"}), 409

    appt.date = new_date
    appt.time = new_time
    appt.reason = data.get("reason", appt.reason)
    db.session.commit()
    return jsonify(appt.to_dict()), 200


@patient_bp.route("/appointments/<int:appt_id>/cancel", methods=["PUT"])
@patient_required
def cancel_appointment(appt_id):
    patient = get_current_patient()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != patient.id:
        return jsonify({"error": "Unauthorized"}), 403
    if appt.status != "Booked":
        return jsonify({"error": "Only booked appointments can be cancelled"}), 400
    appt.status = "Cancelled"
    db.session.commit()
    return jsonify(appt.to_dict()), 200


# ─────────────────────────── HISTORY ───────────────────────────
@patient_bp.route("/history", methods=["GET"])
@patient_required
def get_history():
    patient = get_current_patient()
    appointments = Appointment.query.filter_by(
        patient_id=patient.id, status="Completed"
    ).order_by(Appointment.date.desc()).all()
    return jsonify([a.to_dict() for a in appointments]), 200


# ─────────────────────────── EXPORT ───────────────────────────
@patient_bp.route("/export", methods=["POST"])
@patient_required
def trigger_export():
    patient = get_current_patient()
    try:
        from tasks import export_patient_csv
        job = ExportJob(patient_id=patient.id, status="processing")
        db.session.add(job)
        db.session.commit()
        task = export_patient_csv.delay(patient.id, job.id)
        job.task_id = task.id
        db.session.commit()
        return jsonify({"message": "Export started", "job_id": job.id, "task_id": task.id}), 202
    except Exception as e:
        # If Celery not running, do sync export
        return _sync_export(patient)


def _sync_export(patient):
    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Patient ID", "Patient Name", "Doctor", "Specialization",
        "Date", "Time", "Status", "Diagnosis", "Prescription", "Notes", "Next Visit"
    ])
    for appt in patient.appointments:
        t = appt.treatment
        writer.writerow([
            patient.id, patient.name,
            appt.doctor.name if appt.doctor else "",
            appt.doctor.specialization if appt.doctor else "",
            appt.date.isoformat() if appt.date else "",
            appt.time, appt.status,
            t.diagnosis if t else "",
            t.prescription if t else "",
            t.notes if t else "",
            t.next_visit.isoformat() if (t and t.next_visit) else "",
        ])
    csv_data = output.getvalue()
    export_dir = current_app.config.get("EXPORT_DIR", "exports")
    os.makedirs(export_dir, exist_ok=True)
    filename = f"patient_{patient.id}_history_{datetime.date.today().isoformat()}.csv"
    filepath = os.path.join(export_dir, filename)
    with open(filepath, "w", newline="") as f:
        f.write(csv_data)
    return jsonify({
        "message": "Export ready",
        "download_url": f"/api/patient/export/download/{filename}",
    }), 200


@patient_bp.route("/export/jobs", methods=["GET"])
@patient_required
def get_export_jobs():
    patient = get_current_patient()
    jobs = ExportJob.query.filter_by(patient_id=patient.id).order_by(
        ExportJob.created_at.desc()
    ).limit(10).all()
    return jsonify([j.to_dict() for j in jobs]), 200


@patient_bp.route("/export/download/<filename>", methods=["GET"])
@patient_required
def download_export(filename):
    patient = get_current_patient()
    export_dir = current_app.config.get("EXPORT_DIR", "exports")
    filepath = os.path.join(export_dir, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    # Validate it belongs to this patient
    if not filename.startswith(f"patient_{patient.id}_"):
        return jsonify({"error": "Unauthorized"}), 403
    return send_file(filepath, as_attachment=True, download_name=filename)


# ─────────────────────────── SLOTS ───────────────────────────
@patient_bp.route("/doctors/<int:doctor_id>/slots", methods=["GET"])
@patient_required
def get_available_slots(doctor_id):
    date_str = request.args.get("date")
    if not date_str:
        return jsonify({"error": "date parameter required"}), 400
    try:
        date = datetime.date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400

    avail = DoctorAvailability.query.filter_by(
        doctor_id=doctor_id, date=date, is_available=True
    ).first()

    if not avail:
        return jsonify({"slots": []}), 200

    # Generate slots
    booked_times = {
        a.time for a in Appointment.query.filter_by(
            doctor_id=doctor_id, date=date, status="Booked"
        ).all()
    }

    slots = []
    start = datetime.datetime.strptime(avail.start_time, "%H:%M")
    end = datetime.datetime.strptime(avail.end_time, "%H:%M")
    duration = datetime.timedelta(minutes=avail.slot_duration)
    current = start
    while current < end:
        slot_time = current.strftime("%H:%M")
        slots.append({
            "time": slot_time,
            "available": slot_time not in booked_times,
        })
        current += duration

    return jsonify({"slots": slots, "availability": avail.to_dict()}), 200
