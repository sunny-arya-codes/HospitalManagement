"""
Celery tasks for:
  1. Daily appointment reminders (via email / Google Chat webhook)
  2. Monthly activity report for doctors (via email)
  3. Async CSV export for patients
"""
from celery import Celery
from celery.schedules import crontab
import os, csv, io, datetime, requests, smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def make_celery(app):
    celery = Celery(
        app.import_name,
        broker=app.config["CELERY_BROKER_URL"],
        backend=app.config["CELERY_RESULT_BACKEND"],
    )
    celery.conf.update(app.config)

    celery.conf.beat_schedule = {
        "daily-reminders": {
            "task": "tasks.send_daily_reminders",
            "schedule": crontab(hour=8, minute=0),  # Every day at 8 AM
        },
        "monthly-report": {
            "task": "tasks.send_monthly_reports",
            "schedule": crontab(hour=7, minute=0, day_of_month=1),  # 1st of every month
        },
    }

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


# ─── Standalone celery instance (used when imported without app) ───
_celery = Celery(__name__)


def _get_celery():
    """Return the app-bound celery instance if available."""
    try:
        from celery_worker import celery as c
        return c
    except ImportError:
        return _celery


# ─────────────────────────── EMAIL HELPER ───────────────────────────
def _send_email(to_email, subject, html_body, config):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config.get("MAIL_DEFAULT_SENDER", "HMS <noreply@hospital.com>")
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(config.get("MAIL_SERVER", "smtp.gmail.com"), config.get("MAIL_PORT", 587)) as server:
            server.starttls()
            server.login(config.get("MAIL_USERNAME", ""), config.get("MAIL_PASSWORD", ""))
            server.sendmail(msg["From"], to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        return False


def _send_gchat(webhook_url, message):
    try:
        requests.post(webhook_url, json={"text": message}, timeout=10)
    except Exception as e:
        print(f"[GCHAT ERROR] {e}")


# ─────────────────────────── TASK 1: DAILY REMINDERS ───────────────────────────
def send_daily_reminders():
    """Send reminders to patients with appointments today."""
    from app import create_app
    app = create_app()
    with app.app_context():
        from models import Appointment
        today = datetime.date.today()
        appointments = Appointment.query.filter_by(date=today, status="Booked").all()

        config = app.config
        webhook_url = config.get("GCHAT_WEBHOOK_URL", "")

        for appt in appointments:
            patient = appt.patient
            doctor = appt.doctor
            if not patient or not doctor:
                continue

            email = patient.user.email if patient.user else None
            patient_name = patient.name
            doctor_name = doctor.name
            appt_time = appt.time

            subject = "🏥 Appointment Reminder - HMS"
            html_body = f"""
            <html><body>
            <h2>Appointment Reminder</h2>
            <p>Dear <b>{patient_name}</b>,</p>
            <p>This is a reminder that you have an appointment today:</p>
            <ul>
                <li><b>Doctor:</b> Dr. {doctor_name}</li>
                <li><b>Specialization:</b> {doctor.specialization}</li>
                <li><b>Date:</b> {today.strftime('%B %d, %Y')}</li>
                <li><b>Time:</b> {appt_time}</li>
                <li><b>Reason:</b> {appt.reason or 'General Consultation'}</li>
            </ul>
            <p>Please arrive 10 minutes early. Bring your previous records if any.</p>
            <p>Regards,<br>Hospital Management System</p>
            </body></html>
            """

            if email:
                _send_email(email, subject, html_body, config)
                print(f"[REMINDER] Sent to {patient_name} ({email}) for {appt_time}")

            if webhook_url:
                msg = (
                    f"🏥 *Appointment Reminder*\n"
                    f"Patient: {patient_name}\n"
                    f"Doctor: Dr. {doctor_name}\n"
                    f"Time: {appt_time} today"
                )
                _send_gchat(webhook_url, msg)

        print(f"[DAILY REMINDERS] Processed {len(appointments)} appointments for {today}")


# ─────────────────────────── TASK 2: MONTHLY REPORT ───────────────────────────
def send_monthly_reports():
    """Send monthly activity reports to all doctors."""
    from app import create_app
    app = create_app()
    with app.app_context():
        from models import Doctor, Appointment, Treatment
        config = app.config

        today = datetime.date.today()
        # Get last month's range
        first_of_this_month = today.replace(day=1)
        last_month_end = first_of_this_month - datetime.timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        doctors = Doctor.query.all()
        for doctor in doctors:
            if not doctor.user or not doctor.user.is_active:
                continue

            appointments = Appointment.query.filter(
                Appointment.doctor_id == doctor.id,
                Appointment.date >= last_month_start,
                Appointment.date <= last_month_end,
                Appointment.status == "Completed",
            ).all()

            month_name = last_month_start.strftime("%B %Y")
            rows = ""
            for appt in appointments:
                t = appt.treatment
                rows += f"""
                <tr>
                    <td>{appt.date.strftime('%d %b')}</td>
                    <td>{appt.time}</td>
                    <td>{appt.patient.name if appt.patient else 'N/A'}</td>
                    <td>{t.diagnosis if t else '-'}</td>
                    <td>{t.prescription if t else '-'}</td>
                </tr>"""

            html_report = f"""
            <html><body style="font-family:Arial,sans-serif;">
            <h1>Monthly Activity Report - {month_name}</h1>
            <h2>Dr. {doctor.name}</h2>
            <p><b>Specialization:</b> {doctor.specialization}</p>
            <hr>
            <h3>Summary</h3>
            <ul>
                <li>Total Completed Appointments: <b>{len(appointments)}</b></li>
                <li>Report Period: <b>{last_month_start.strftime('%d %b')} - {last_month_end.strftime('%d %b %Y')}</b></li>
            </ul>
            <h3>Appointment Details</h3>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
                <thead style="background:#4a90d9;color:#fff;">
                    <tr>
                        <th>Date</th><th>Time</th><th>Patient</th>
                        <th>Diagnosis</th><th>Prescription</th>
                    </tr>
                </thead>
                <tbody>{rows if rows else '<tr><td colspan="5">No appointments this month</td></tr>'}</tbody>
            </table>
            <br>
            <p style="color:#777;font-size:12px;">Generated by Hospital Management System on {today.strftime('%d %b %Y')}</p>
            </body></html>
            """

            email = doctor.user.email
            subject = f"📊 Monthly Report - {month_name} | Dr. {doctor.name}"
            _send_email(email, subject, html_report, config)
            print(f"[MONTHLY REPORT] Sent to Dr. {doctor.name} ({email})")


# ─────────────────────────── TASK 3: CSV EXPORT ───────────────────────────
def export_patient_csv(patient_id, job_id):
    """Async CSV export for patient treatment history."""
    from app import create_app
    app = create_app()
    with app.app_context():
        from models import Patient, ExportJob
        import os

        job = ExportJob.query.get(job_id)
        if not job:
            return

        try:
            patient = Patient.query.get(patient_id)
            if not patient:
                job.status = "failed"
                from models import db
                from models import db as _db
                _db.session.commit()
                return

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "Patient ID", "Patient Name", "Email",
                "Doctor", "Specialization", "Appointment Date",
                "Appointment Time", "Status", "Reason",
                "Diagnosis", "Prescription", "Notes", "Next Visit"
            ])

            for appt in sorted(patient.appointments, key=lambda a: a.date):
                t = appt.treatment
                writer.writerow([
                    patient.id, patient.name,
                    patient.user.email if patient.user else "",
                    appt.doctor.name if appt.doctor else "",
                    appt.doctor.specialization if appt.doctor else "",
                    appt.date.isoformat() if appt.date else "",
                    appt.time, appt.status, appt.reason or "",
                    t.diagnosis if t else "",
                    t.prescription if t else "",
                    t.notes if t else "",
                    t.next_visit.isoformat() if (t and t.next_visit) else "",
                ])

            export_dir = app.config.get("EXPORT_DIR", "exports")
            os.makedirs(export_dir, exist_ok=True)
            filename = f"patient_{patient_id}_history_{datetime.date.today().isoformat()}.csv"
            filepath = os.path.join(export_dir, filename)
            with open(filepath, "w", newline="") as f:
                f.write(output.getvalue())

            job.status = "completed"
            job.file_path = filename
            job.completed_at = datetime.datetime.utcnow()

            # Send notification email
            if patient.user and patient.user.email:
                html = f"""
                <html><body>
                <h2>Your Export is Ready</h2>
                <p>Dear {patient.name},</p>
                <p>Your treatment history CSV export has been generated.</p>
                <p>Login to the HMS portal to download your file.</p>
                <p>Regards,<br>Hospital Management System</p>
                </body></html>
                """
                _send_email(patient.user.email, "Your HMS Export is Ready", html, app.config)

        except Exception as e:
            print(f"[EXPORT ERROR] {e}")
            job.status = "failed"

        from models import db as _db
        _db.session.commit()
        print(f"[EXPORT] Job {job_id} for patient {patient_id} completed")


# ─── Register as Celery tasks when celery_worker imports this ───
try:
    from celery_worker import celery

    export_patient_csv = celery.task(name="tasks.export_patient_csv")(export_patient_csv)
    send_daily_reminders = celery.task(name="tasks.send_daily_reminders")(send_daily_reminders)
    send_monthly_reports = celery.task(name="tasks.send_monthly_reports")(send_monthly_reports)
except (ImportError, RuntimeError):
    pass
