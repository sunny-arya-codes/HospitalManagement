# 🏥 Hospital Management System (HMS)

A full-stack Hospital Management System built with Flask (backend) and Vue.js (frontend).

---

## 📁 Project Structure

```
HospitalManagement/
├── Backend/
│   ├── app.py                  # Flask app factory & seeding
│   ├── config.py               # Configuration settings
│   ├── models.py               # SQLAlchemy ORM models
│   ├── tasks.py                # Celery tasks (reminders, reports, export)
│   ├── celery_worker.py        # Celery worker entry point
│   ├── requirements.txt
│   └── routes/
│       ├── auth_routes.py      # Login, Register, Me
│       ├── admin_routes.py     # Admin CRUD endpoints
│       ├── doctor_routes.py    # Doctor endpoints
│       └── patient_routes.py   # Patient endpoints
├── Frontend/
│   ├── index.html              # Single-page Vue app entry
│   ├── css/style.css           # Custom styles
│   └── js/
│       ├── utils.js            # API helper & utilities
│       ├── app.js              # Main Vue app
│       └── components/
│           ├── auth.js         # Login & Register pages
│           ├── admin.js        # Admin components
│           ├── doctor.js       # Doctor components
│           ├── patient.js      # Patient components
│           └── shared.js       # Shared components
└── README.md
```

---

## 🛠️ Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Backend  | Flask 3.x               |
| Database | SQLite + SQLAlchemy     |
| Auth     | JWT (Flask-JWT-Extended)|
| Cache    | Redis + Flask-Caching   |
| Jobs     | Celery + Redis          |
| Mail     | Flask-Mail (SMTP)       |
| Frontend | Vue.js 3 (CDN)          |
| Styling  | Bootstrap 5             |

---

## ⚙️ Setup & Installation

### 🚀 Quick start (run everything)
This repo includes a small helper script to start the backend API and frontend dev server together.

```bash
# From repo root:
chmod +x run.sh
./run.sh
```

> Tip: You can also follow the step-by-step instructions below for more control.

### Prerequisites
- Python 3.10+
- Redis (for caching and Celery)
- Node.js (optional, Vue is loaded via CDN)

### 1. Backend Setup

```bash
cd Backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment (optional — defaults work for dev)
cp .env.example .env
# Edit .env with your SMTP credentials, Redis URL, etc.

# Run the Flask server
python app.py
```

The server starts at **http://localhost:5000**

### 2. Frontend

Open `Frontend/index.html` directly in your browser, **or** serve it via a simple HTTP server:

```bash
cd Frontend
python -m http.server 8080
# Open http://localhost:8080
```

> **Important:** The frontend expects the backend at `http://localhost:5000`.

### 3. Redis

```bash
# Linux/macOS
redis-server

# Windows (WSL or Docker)
docker run -p 6379:6379 redis
```

### 4. Celery Worker & Beat (for background jobs)

```bash
cd Backend

# Worker (processes async tasks)
celery -A celery_worker.celery worker --loglevel=info

# Beat scheduler (for daily & monthly scheduled jobs)
celery -A celery_worker.celery beat --loglevel=info
```

---

## 🔐 Default Credentials

| Role   | Username | Password  |
|--------|----------|-----------|
| Admin  | admin    | Admin@123 |

> Register as a **Patient** via the UI. Doctors are added by Admin.

---

## 👥 Roles & Features

### 🔴 Admin
- Dashboard with stats (doctors, patients, appointments)
- Add / Edit / Delete / Blacklist doctors
- View and search all patients
- View and manage all appointments
- Search by name, specialization, phone

### 🔵 Doctor
- Dashboard with today's & weekly appointments
- Mark appointments as Completed with diagnosis & prescription
- Cancel appointments
- Set availability for next 7 days (with slot duration)
- View full patient treatment history

### 🟢 Patient
- Register and login
- Browse doctors by specialization / department / name
- View doctor availability (next 7 days) and available time slots
- Book, reschedule, or cancel appointments
- View complete treatment history
- Export treatment history as CSV (async job)

---

## 🔄 Background Jobs

| Job | Trigger | Description |
|-----|---------|-------------|
| Daily Reminders | Every day 8 AM | Emails patients with appointments today |
| Monthly Report  | 1st of each month | Sends HTML report to doctors |
| CSV Export | User triggered | Async CSV export for patient history |

---

## 🗄️ Database Models

- **User** — Auth for admin/doctor/patient
- **Department** — Medical specializations
- **Doctor** — Doctor profile + linked User
- **DoctorAvailability** — Per-day availability slots
- **Patient** — Patient profile + linked User
- **Appointment** — Booking between patient & doctor
- **Treatment** — Diagnosis/prescription per appointment
- **ExportJob** — Tracks async CSV exports

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Patient registration |
| GET | `/api/auth/me` | Current user |
| GET | `/api/admin/dashboard` | Admin stats |
| GET/POST | `/api/admin/doctors` | List / create doctors |
| PUT/DELETE | `/api/admin/doctors/<id>` | Update / delete doctor |
| GET | `/api/admin/search?q=&type=` | Search |
| GET | `/api/doctor/dashboard` | Doctor dashboard |
| PUT | `/api/doctor/appointments/<id>/complete` | Mark complete |
| POST | `/api/doctor/availability` | Set availability |
| GET | `/api/patient/dashboard` | Patient dashboard |
| GET | `/api/patient/doctors` | Browse doctors |
| GET | `/api/patient/doctors/<id>/slots?date=` | Available slots |
| POST | `/api/patient/appointments` | Book appointment |
| PUT | `/api/patient/appointments/<id>/cancel` | Cancel |
| POST | `/api/patient/export` | Trigger CSV export |

---

## 🔧 Configuration (`.env`)

```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=sqlite:///instance/hospital.db
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=HMS <your-email@gmail.com>

GCHAT_WEBHOOK_URL=your-google-chat-webhook-url
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@hospital.com
ADMIN_PASSWORD=Admin@123
```

---

## 🚀 Quick Demo

1. Start Redis: `redis-server`
2. Start Backend: `cd Backend && python app.py`
3. Open `Frontend/index.html` in browser
4. Login as **admin / Admin@123**
5. Add doctors, set their availability
6. Register as a patient and book appointments!
