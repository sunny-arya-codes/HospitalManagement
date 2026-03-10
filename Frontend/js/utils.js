// ── API Base URL ──────────────────────────────────────────
const API_BASE = "http://localhost:5001/api";

// ── API helper ────────────────────────────────────────────
const createApi = (getToken) => {
  const headers = () => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const request = async (method, path, body = null) => {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...(data || {}) };
    return data;
  };

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),

    // Auth
    login: (data) => request("POST", "/auth/login", data),
    register: (data) => request("POST", "/auth/register", data),
    me: () => request("GET", "/auth/me"),
    changePassword: (data) => request("PUT", "/auth/change-password", data),

    // Admin
    adminDashboard: () => request("GET", "/admin/dashboard"),
    adminDoctors: () => request("GET", "/admin/doctors"),
    adminCreateDoctor: (data) => request("POST", "/admin/doctors", data),
    adminUpdateDoctor: (id, data) => request("PUT", `/admin/doctors/${id}`, data),
    adminDeleteDoctor: (id) => request("DELETE", `/admin/doctors/${id}`),
    adminToggleDoctorStatus: (id) => request("PUT", `/admin/doctors/${id}/toggle-status`),
    adminPatients: () => request("GET", "/admin/patients"),
    adminGetPatient: (id) => request("GET", `/admin/patients/${id}`),
    adminUpdatePatient: (id, data) => request("PUT", `/admin/patients/${id}`, data),
    adminTogglePatientStatus: (id) => request("PUT", `/admin/patients/${id}/toggle-status`),
    adminAppointments: (status) => request("GET", `/admin/appointments${status ? "?status=" + status : ""}`),
    adminDeleteAppointment: (id) => request("DELETE", `/admin/appointments/${id}`),
    adminSearch: (q, type) => request("GET", `/admin/search?q=${encodeURIComponent(q)}&type=${type || "all"}`),
    adminDepartments: () => request("GET", "/admin/departments"),
    adminCreateDepartment: (data) => request("POST", "/admin/departments", data),

    // Doctor
    doctorDashboard: () => request("GET", "/doctor/dashboard"),
    doctorAppointments: (status, date) => {
      let qs = [];
      if (status) qs.push("status=" + status);
      if (date) qs.push("date=" + date);
      return request("GET", `/doctor/appointments${qs.length ? "?" + qs.join("&") : ""}`);
    },
    doctorCompleteAppointment: (id, data) => request("PUT", `/doctor/appointments/${id}/complete`, data),
    doctorCancelAppointment: (id) => request("PUT", `/doctor/appointments/${id}/cancel`),
    doctorPatients: () => request("GET", "/doctor/patients"),
    doctorPatientHistory: (id) => request("GET", `/doctor/patients/${id}/history`),
    doctorAvailability: () => request("GET", "/doctor/availability"),
    doctorSetAvailability: (data) => request("POST", "/doctor/availability", data),
    doctorDeleteAvailability: (id) => request("DELETE", `/doctor/availability/${id}`),
    doctorUpdateTreatment: (id, data) => request("PUT", `/doctor/treatments/${id}`, data),
    doctorProfile: () => request("GET", "/doctor/profile"),
    doctorUpdateProfile: (data) => request("PUT", "/doctor/profile", data),

    // Patient
    patientDashboard: () => request("GET", "/patient/dashboard"),
    patientProfile: () => request("GET", "/patient/profile"),
    patientUpdateProfile: (data) => request("PUT", "/patient/profile", data),
    patientDepartments: () => request("GET", "/patient/departments"),
    patientDoctors: (params) => {
      let qs = Object.entries(params || {}).filter(([,v]) => v).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      return request("GET", `/patient/doctors${qs ? "?" + qs : ""}`);
    },
    patientGetDoctor: (id) => request("GET", `/patient/doctors/${id}`),
    patientSlots: (doctorId, date) => request("GET", `/patient/doctors/${doctorId}/slots?date=${date}`),
    patientAppointments: (status) => request("GET", `/patient/appointments${status ? "?status=" + status : ""}`),
    patientBookAppointment: (data) => request("POST", "/patient/appointments", data),
    patientReschedule: (id, data) => request("PUT", `/patient/appointments/${id}`, data),
    patientCancelAppointment: (id) => request("PUT", `/patient/appointments/${id}/cancel`),
    patientHistory: () => request("GET", "/patient/history"),
    patientExport: () => request("POST", "/patient/export"),
    patientExportJobs: () => request("GET", "/patient/export/jobs"),
  };
};

// ── Helpers ──────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getInitial = (name) => (name || "?")[0].toUpperCase();

const statusClass = (status) => {
  if (status === "Booked") return "status-booked";
  if (status === "Completed") return "status-completed";
  if (status === "Cancelled") return "status-cancelled";
  return "bg-secondary text-white";
};

// ── Next 7 days ───────────────────────────────────────────
const next7Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    days.push({
      iso,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return days;
};
