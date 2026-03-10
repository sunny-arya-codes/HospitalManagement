# 🏥 Hospital Management System — Step-by-Step Guide

> This guide maps every policy requirement to the actual code, so you can confidently explain each feature during your viva.

---

## 📁 Folder Structure (as per policy)

```
HospitalManagement/
├── Backend/
│   ├── app.py                  # Flask app factory & database seeding
│   ├── config.py               # Configuration (DB, Redis, JWT, Mail)
│   ├── models.py               # SQLAlchemy ORM models (8 tables)
│   ├── tasks.py                # Celery tasks (reminders, reports, export)
│   ├── celery_worker.py        # Celery worker entry point
│   ├── requirements.txt        # Python dependencies
│   └── routes/
│       ├── auth_routes.py      # Login, Register, Me, Change Password
│       ├── admin_routes.py     # Admin CRUD endpoints
│       ├── doctor_routes.py    # Doctor endpoints
│       └── patient_routes.py   # Patient endpoints
├── Frontend/
│   ├── index.html              # Single-page Vue app (CDN)
│   ├── css/style.css           # Custom styles (Bootstrap 5 based)
│   └── js/
│       ├── utils.js            # API helper & utilities
│       ├── app.js              # Main Vue app with routing
│       └── components/
│           ├── auth.js         # Login & Register pages
│           ├── admin.js        # Admin components
│           ├── doctor.js       # Doctor components
│           ├── patient.js      # Patient components
│           └── shared.js       # Shared components (Navbar etc.)
├── run.sh                      # Quick-start script
├── README.md
└── STEP-BY-STEP.md             # ← You are here
```

---

## ✅ Frameworks Used (Policy Compliance)

| Requirement          | Used                              | Where                          |
|----------------------|-----------------------------------|--------------------------------|
| Flask for API        | Flask 3.0.3                       | `Backend/app.py`               |
| VueJS for UI         | Vue.js 3 (CDN)                    | `Frontend/index.html`          |
| Jinja2 for entry     | Used only in `index.html` entry   | `Frontend/index.html`          |
| Bootstrap for styling| Bootstrap 5 (CDN)                 | `Frontend/index.html`          |
| SQLite for database  | SQLite via SQLAlchemy             | `Backend/config.py`            |
| Redis for caching    | Redis + Flask-Caching             | `Backend/config.py`, routes    |
| Redis + Celery       | Celery 5.4 + Redis broker         | `Backend/tasks.py`, `celery_worker.py` |
| JWT Authentication   | Flask-JWT-Extended                | `Backend/routes/auth_routes.py`|

**Database is created programmatically** — see `app.py` line 62: `db.create_all()` and `_seed_initial_data()`.

---

## 🗄️ Database Models (ER Diagram Tables)

All defined in `Backend/models.py`:

| # | Model               | Table Name            | Key Fields                                                     |
|---|---------------------|-----------------------|----------------------------------------------------------------|
| 1 | **User**            | `users`               | id, username, email, password_hash, role (admin/doctor/patient), is_active |
| 2 | **Department**      | `departments`         | id, name, description, doctors (relationship)                  |
| 3 | **Doctor**          | `doctors`             | id, user_id (FK), department_id (FK), name, specialization, qualification, experience_years, phone, bio, fee |
| 4 | **DoctorAvailability** | `doctor_availability` | id, doctor_id (FK), date, start_time, end_time, slot_duration, is_available |
| 5 | **Patient**         | `patients`            | id, user_id (FK), name, date_of_birth, gender, phone, address, blood_group, emergency_contact |
| 6 | **Appointment**     | `appointments`        | id, patient_id (FK), doctor_id (FK), date, time, status (Booked/Completed/Cancelled), reason |
| 7 | **Treatment**       | `treatments`          | id, appointment_id (FK), diagnosis, prescription, notes, next_visit |
| 8 | **ExportJob**       | `export_jobs`         | id, patient_id (FK), task_id, status, file_path               |

### Relationships:
- User ↔ Doctor (one-to-one)
- User ↔ Patient (one-to-one)
- Department ↔ Doctor (one-to-many)
- Doctor ↔ DoctorAvailability (one-to-many)
- Doctor ↔ Appointment (one-to-many)
- Patient ↔ Appointment (one-to-many)
- Appointment ↔ Treatment (one-to-one)
- Patient ↔ ExportJob (one-to-many)

---

## 👥 Roles & Features — Policy Mapping

### 🔴 Admin — `admin_routes.py`

| Policy Requirement                                       | ✅ Implemented | Code Location                    |
|----------------------------------------------------------|:-----------:|----------------------------------|
| Admin pre-exists (created programmatically)              | ✅ | `app.py` → `_seed_initial_data()` |
| Dashboard: total doctors, patients, appointments         | ✅ | `GET /api/admin/dashboard`       |
| Add/Update/Delete doctor profiles                        | ✅ | `POST/PUT/DELETE /api/admin/doctors` |
| View and manage all appointments                         | ✅ | `GET /api/admin/appointments`    |
| Search patients/doctors by name/specialization/phone     | ✅ | `GET /api/admin/search?q=&type=` |
| Blacklist/activate doctors                               | ✅ | `PUT /api/admin/doctors/<id>/toggle-status` |
| Blacklist/activate patients                              | ✅ | `PUT /api/admin/patients/<id>/toggle-status` |
| Edit patient info                                        | ✅ | `PUT /api/admin/patients/<id>`   |
| Manage departments                                       | ✅ | `CRUD /api/admin/departments`    |

### 🔵 Doctor — `doctor_routes.py`

| Policy Requirement                                       | ✅ Implemented | Code Location                    |
|----------------------------------------------------------|:-----------:|----------------------------------|
| Dashboard: today's & weekly appointments                 | ✅ | `GET /api/doctor/dashboard`      |
| List of patients assigned to doctor                      | ✅ | `GET /api/doctor/patients`       |
| Mark appointments as Completed (with diagnosis/prescription) | ✅ | `PUT /api/doctor/appointments/<id>/complete` |
| Cancel appointments                                      | ✅ | `PUT /api/doctor/appointments/<id>/cancel` |
| Set availability for next 7 days                         | ✅ | `POST /api/doctor/availability`  |
| Update patient treatment history                         | ✅ | `PUT /api/doctor/treatments/<id>` |
| View full patient history                                | ✅ | `GET /api/doctor/patients/<id>/history` |
| View/update own profile                                  | ✅ | `GET/PUT /api/doctor/profile`    |

### 🟢 Patient — `patient_routes.py`

| Policy Requirement                                       | ✅ Implemented | Code Location                    |
|----------------------------------------------------------|:-----------:|----------------------------------|
| Register and login                                       | ✅ | `POST /api/auth/register`, `/api/auth/login` |
| Dashboard: departments, doctor availability, stats       | ✅ | `GET /api/patient/dashboard`     |
| Search doctors by specialization/name/department         | ✅ | `GET /api/patient/doctors?specialization=&name=` |
| View doctor availability (7 days) + slots                | ✅ | `GET /api/patient/doctors/<id>/slots?date=` |
| Book appointment                                         | ✅ | `POST /api/patient/appointments` |
| Reschedule appointment                                   | ✅ | `PUT /api/patient/appointments/<id>` |
| Cancel appointment                                       | ✅ | `PUT /api/patient/appointments/<id>/cancel` |
| View appointment history + treatments                    | ✅ | `GET /api/patient/history`       |
| Edit profile                                             | ✅ | `PUT /api/patient/profile`       |
| Export history as CSV                                    | ✅ | `POST /api/patient/export`       |

---

## 🔄 Backend Jobs — `tasks.py`

| # | Job Type                     | Trigger               | Code                                 |
|---|------------------------------|-----------------------|--------------------------------------|
| 1 | **Daily Reminders**          | Celery Beat — 8 AM daily | `send_daily_reminders()` — sends email + Google Chat webhook to patients with appointments today |
| 2 | **Monthly Activity Report**  | Celery Beat — 1st of every month | `send_monthly_reports()` — creates HTML report with appointment table, sends via email to each doctor |
| 3 | **CSV Export (Async)**       | User triggered from patient dashboard | `export_patient_csv()` — generates CSV with treatment details, sends email notification when done |

**Celery Beat Schedule** (in `tasks.py`):
```python
celery.conf.beat_schedule = {
    "daily-reminders": {
        "task": "tasks.send_daily_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    "monthly-report": {
        "task": "tasks.send_monthly_reports",
        "schedule": crontab(hour=7, minute=0, day_of_month=1),
    },
}
```

---

## ⚡ Performance & Caching

| Feature                    | Location                             |
|----------------------------|--------------------------------------|
| Redis Cache (admin doctors list) | `admin_routes.py` — `@cache.cached(timeout=60)` |
| Redis Cache (departments)  | `patient_routes.py` — `@cache.cached(timeout=300)` |
| Cache invalidation on write | `admin_routes.py` — `cache.delete("admin_doctors_list")` after add/update/delete |
| Fallback to SimpleCache    | `app.py` — if Redis unavailable, falls back to SimpleCache |

---

## 🛡️ Other Core Functionalities

| Feature                                                | ✅ | Location                              |
|--------------------------------------------------------|:-:|---------------------------------------|
| **Prevent double booking** (same doctor, date, time)   | ✅ | `patient_routes.py` → `book_appointment()` |
| **Prevent patient conflict** (same patient, same time) | ✅ | `patient_routes.py` → `book_appointment()` |
| **Dynamic status update** (Booked → Completed / Cancelled) | ✅ | Doctor/Patient routes                |
| **Conflict check on reschedule**                       | ✅ | `patient_routes.py` → `reschedule_appointment()` |
| **Role-based access** (admin_required, doctor_required, patient_required) | ✅ | Decorators in each route file      |
| **Deactivated account check**                          | ✅ | Login + route decorators             |
| **Backend validation** (required fields, format checks) | ✅ | All POST/PUT routes                 |

---

## 📡 API Endpoints Reference

### Auth (`/api/auth`)
| Method | Endpoint          | Description          |
|--------|-------------------|----------------------|
| POST   | `/login`          | Login                |
| POST   | `/register`       | Patient registration |
| GET    | `/me`             | Current user info    |
| PUT    | `/change-password` | Change password     |

### Admin (`/api/admin`)
| Method | Endpoint                          | Description                |
|--------|-----------------------------------|----------------------------|
| GET    | `/dashboard`                      | Admin stats                |
| GET/POST | `/departments`                 | List / create departments  |
| PUT/DELETE | `/departments/<id>`          | Update / delete department |
| GET/POST | `/doctors`                     | List / create doctors      |
| GET/PUT/DELETE | `/doctors/<id>`          | View / update / delete     |
| PUT    | `/doctors/<id>/toggle-status`     | Blacklist / activate       |
| GET    | `/patients`                       | List all patients          |
| GET/PUT | `/patients/<id>`                | View / update patient      |
| PUT    | `/patients/<id>/toggle-status`    | Blacklist / activate       |
| GET    | `/appointments`                   | All appointments           |
| GET/DELETE | `/appointments/<id>`         | View / delete appointment  |
| GET    | `/search?q=&type=`                | Search doctors/patients    |

### Doctor (`/api/doctor`)
| Method | Endpoint                            | Description                  |
|--------|-------------------------------------|------------------------------|
| GET    | `/dashboard`                        | Doctor dashboard & stats     |
| GET    | `/appointments`                     | List appointments            |
| PUT    | `/appointments/<id>/complete`       | Mark complete + diagnosis    |
| PUT    | `/appointments/<id>/cancel`         | Cancel appointment           |
| GET    | `/patients`                         | List assigned patients       |
| GET    | `/patients/<id>/history`            | Patient history              |
| GET/POST | `/availability`                  | View / set availability      |
| DELETE | `/availability/<id>`                | Remove availability          |
| PUT    | `/treatments/<id>`                  | Update treatment             |
| GET/PUT | `/profile`                        | View / update profile        |

### Patient (`/api/patient`)
| Method | Endpoint                          | Description                  |
|--------|-----------------------------------|------------------------------|
| GET    | `/dashboard`                      | Patient dashboard            |
| GET/PUT | `/profile`                       | View / update profile        |
| GET    | `/departments`                    | List departments             |
| GET    | `/doctors`                        | Browse doctors               |
| GET    | `/doctors/<id>`                   | Doctor details               |
| GET    | `/doctors/<id>/slots?date=`       | Available time slots         |
| GET/POST | `/appointments`                | List / book appointment      |
| PUT    | `/appointments/<id>`              | Reschedule                   |
| PUT    | `/appointments/<id>/cancel`       | Cancel                       |
| GET    | `/history`                        | Treatment history            |
| POST   | `/export`                         | Trigger CSV export           |
| GET    | `/export/jobs`                    | Export job status             |
| GET    | `/export/download/<filename>`     | Download CSV file            |

---

## 🚀 How to Run the Project

### Prerequisites
- Python 3.10+
- Redis server running

### Quick Start
```bash
chmod +x run.sh
./run.sh
```

### Manual Start
```bash
# 1. Redis (must be running)
redis-server

# 2. Backend
cd Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
# → Runs on http://localhost:5001

# 3. Frontend
cd Frontend
python -m http.server 8080
# → Open http://localhost:8080

# 4. Celery (optional — for background jobs)
cd Backend
celery -A celery_worker.celery worker --loglevel=info
celery -A celery_worker.celery beat --loglevel=info
```

### Default Login
| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | Admin@123 |

> Patients register via UI. Doctors are added by Admin.

---

## 🎥 Video Presentation Guide (5-10 min)

### 1. Intro (30 sec)
- Your name, enrollment number, project title (Hospital Management System)

### 2. Approach (30 sec)
- "I built a full-stack HMS using Flask for the REST API and Vue.js 3 (CDN) for the frontend"
- "The database is SQLite managed via SQLAlchemy ORM — created entirely programmatically"
- "JWT-based authentication with role-based access control for 3 roles"

### 3. Feature Demo (90 sec)
- **Admin**: Login → Dashboard → Add doctor → Search → Blacklist
- **Doctor**: Login → Dashboard → Set availability → Complete appointment with diagnosis
- **Patient**: Register → Browse doctors → View slots → Book → View history → Export CSV

### 4. Additional Features (30 sec)
- Daily email reminders (Celery Beat)
- Monthly HTML reports for doctors
- Redis caching with cache invalidation
- Double-booking prevention
- CSV export with email notification

---

## 📝 Project Report Checklist

Your report (max 5 pages) should include:
1. ☐ Student details (Name, Enrollment, Section)
2. ☐ Project description & approach
3. ☐ AI/LLM Declaration
4. ☐ Frameworks & libraries used (table above)
5. ☐ ER Diagram (use models table above)
6. ☐ API endpoints (table above)
7. ☐ Drive link of presentation video
