// ─── Patient Components ───────────────────────────────────────────────

const PatientDashboard = {
  name: "PatientDashboard",
  props: ["api"],
  emits: ["navigate"],
  data() { return { data: null, loading: true }; },
  async mounted() {
    try { this.data = await this.api.patientDashboard(); }
    catch(e) { console.error(e); }
    finally { this.loading = false; }
  },
  computed: {
    stats() { return this.data?.stats || {}; },
    upcoming() { return this.data?.upcoming_appointments || []; },
    recent() { return this.data?.recent_history || []; },
    departments() { return this.data?.departments || []; },
  },
  methods: { fmt: formatDate, statusCls: statusClass },
  template: `
    <div>
      <div class="page-header">
        <h2><i class="bi bi-heart-pulse me-2"></i>Patient Dashboard</h2>
        <p v-if="data">Welcome, {{ data.patient?.name }}!</p>
      </div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <template v-else-if="data">
        <div class="row g-3 mb-4">
          <div class="col-6 col-lg-4"><div class="stat-card stat-blue"><i class="bi bi-calendar-check stat-icon"></i><div><div class="stat-value">{{ stats.upcoming }}</div><div class="stat-label">Upcoming</div></div></div></div>
          <div class="col-6 col-lg-4"><div class="stat-card stat-green"><i class="bi bi-check-circle stat-icon"></i><div><div class="stat-value">{{ stats.completed }}</div><div class="stat-label">Completed</div></div></div></div>
          <div class="col-12 col-lg-4"><div class="stat-card stat-orange"><i class="bi bi-calendar stat-icon"></i><div><div class="stat-value">{{ stats.total_appointments }}</div><div class="stat-label">Total</div></div></div></div>
        </div>
        <div class="row g-3 mb-4">
          <div class="col-lg-7">
            <div class="hms-card p-3">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-bold mb-0"><i class="bi bi-calendar-event me-2 text-primary"></i>Upcoming Appointments</h6>
                <button class="btn btn-sm btn-outline-primary" @click="$emit('navigate','patient-appointments')">View All</button>
              </div>
              <div v-if="!upcoming.length" class="empty-state py-3"><i class="bi bi-calendar-x"></i><p>No upcoming appointments. <a href="#" @click.prevent="$emit('navigate','patient-doctors')">Book one now!</a></p></div>
              <div v-for="a in upcoming" :key="a.id" class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                <div>
                  <div class="fw-semibold">{{ a.doctor_name }}</div>
                  <div class="small text-muted">{{ a.doctor_specialization }} · {{ fmt(a.date) }} at {{ a.time }}</div>
                </div>
                <span class="badge status-booked">Booked</span>
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="hms-card p-3">
              <h6 class="fw-bold mb-3"><i class="bi bi-grid me-2 text-success"></i>Specializations</h6>
              <div class="row g-2">
                <div class="col-6" v-for="d in departments.slice(0,6)" :key="d.id">
                  <div class="p-2 bg-light rounded text-center cursor-pointer" style="cursor:pointer" @click="$emit('navigate','patient-doctors')">
                    <div class="small fw-semibold">{{ d.name }}</div>
                    <div class="smaller text-muted">{{ d.doctors_count }} dr(s)</div>
                  </div>
                </div>
              </div>
              <button class="btn btn-sm btn-outline-primary w-100 mt-2" @click="$emit('navigate','patient-doctors')"><i class="bi bi-search me-1"></i>Find Doctors</button>
            </div>
          </div>
        </div>
        <div class="hms-card p-3" v-if="recent.length">
          <h6 class="fw-bold mb-3"><i class="bi bi-clock-history me-2 text-secondary"></i>Recent Treatment History</h6>
          <div v-for="a in recent" :key="a.id" class="border rounded p-3 mb-2">
            <div class="d-flex justify-content-between mb-1">
              <div class="fw-semibold">{{ a.doctor_name }} — {{ a.doctor_specialization }}</div>
              <span class="small text-muted">{{ fmt(a.date) }}</span>
            </div>
            <div v-if="a.treatment" class="small text-muted">
              <span><i class="bi bi-clipboard-pulse me-1"></i>{{ a.treatment.diagnosis || '—' }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  `,
};

const PatientDoctors = {
  name: "PatientDoctors",
  props: ["api"],
  emits: ["navigate"],
  data() {
    return {
      doctors: [], loading: true, departments: [],
      filters: { name:"", specialization:"", department_id:"" },
      showBookModal: false, selectedDoctor: null,
      selectedDate: "", slots: [], loadingSlots: false,
      selectedSlot: "", bookingReason: "", booking: false,
      bookError: "",
    };
  },
  async mounted() {
    try {
      [this.doctors, this.departments] = await Promise.all([
        this.api.patientDoctors({}),
        this.api.patientDepartments(),
      ]);
    } finally { this.loading = false; }
  },
  methods: {
    async search() {
      this.loading = true;
      try { this.doctors = await this.api.patientDoctors(this.filters); }
      finally { this.loading = false; }
    },
    openBook(doctor) {
      this.selectedDoctor = doctor; this.selectedDate = ""; this.slots = []; this.selectedSlot = ""; this.bookingReason = ""; this.bookError = "";
      this.showBookModal = true;
    },
    async loadSlots() {
      if (!this.selectedDate || !this.selectedDoctor) return;
      this.loadingSlots = true; this.slots = []; this.selectedSlot = "";
      try {
        const res = await this.api.patientSlots(this.selectedDoctor.id, this.selectedDate);
        this.slots = res.slots || [];
      } finally { this.loadingSlots = false; }
    },
    async bookAppointment() {
      if (!this.selectedSlot) { this.bookError = "Please select a time slot"; return; }
      this.booking = true; this.bookError = "";
      try {
        await this.api.patientBookAppointment({
          doctor_id: this.selectedDoctor.id,
          date: this.selectedDate,
          time: this.selectedSlot,
          reason: this.bookingReason,
        });
        this.showBookModal = false;
        alert("✅ Appointment booked successfully!");
        this.$emit("navigate", "patient-appointments");
      } catch(e) { this.bookError = e.error || "Booking failed"; }
      finally { this.booking = false; }
    },
    days7: next7Days,
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-search me-2"></i>Find Doctors</h2><p>Search and book appointments with our specialists</p></div>
      <!-- Filters -->
      <div class="hms-card p-3 mb-4">
        <div class="row g-2">
          <div class="col-md-4"><div class="position-relative"><i class="bi bi-search search-icon"></i><input v-model="filters.name" class="form-control hms-search" placeholder="Doctor name…" @keyup.enter="search"/></div></div>
          <div class="col-md-3"><input v-model="filters.specialization" type="text" class="form-control" placeholder="Specialization…" @keyup.enter="search"/></div>
          <div class="col-md-3"><select v-model="filters.department_id" class="form-select" @change="search"><option value="">All Departments</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></div>
          <div class="col-auto"><button class="btn btn-primary" @click="search" :disabled="loading"><i class="bi bi-search"></i></button></div>
        </div>
      </div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <div v-else>
        <div v-if="!doctors.length" class="empty-state"><i class="bi bi-person-x"></i><p>No doctors found</p></div>
        <div class="row g-3">
          <div class="col-md-4" v-for="d in doctors" :key="d.id">
            <div class="doctor-card h-100">
              <div class="d-flex align-items-center gap-3 mb-3">
                <div class="doctor-avatar">{{ d.name[0] }}</div>
                <div>
                  <div class="fw-bold">{{ d.name }}</div>
                  <div class="small text-muted">{{ d.specialization }}</div>
                  <div class="small text-muted" v-if="d.department">{{ d.department.name }}</div>
                </div>
              </div>
              <div class="small mb-1"><i class="bi bi-award me-1 text-warning"></i>{{ d.experience_years }} years exp. · {{ d.qualification || '' }}</div>
              <div class="small mb-2 text-success fw-semibold"><i class="bi bi-currency-rupee"></i>{{ d.fee }} per visit</div>
              <div v-if="d.availability && d.availability.length" class="mb-2">
                <div class="small text-muted mb-1"><i class="bi bi-calendar-check me-1"></i>Available:</div>
                <div class="d-flex flex-wrap gap-1">
                  <span v-for="av in d.availability.slice(0,4)" :key="av.id" class="badge bg-light text-success border">{{ av.date }}</span>
                </div>
              </div>
              <div v-else class="small text-muted mb-2"><i class="bi bi-calendar-x me-1"></i>No upcoming availability set</div>
              <button class="btn btn-primary btn-sm w-100 mt-auto" @click="openBook(d)" :disabled="!d.availability || !d.availability.length">
                <i class="bi bi-calendar-plus me-1"></i>Book Appointment
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Booking Modal -->
      <div v-if="showBookModal && selectedDoctor" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Book with {{ selectedDoctor.name }}</h5>
            <button class="btn-close" @click="showBookModal=false"></button>
          </div>
          <div class="modal-body">
            <div v-if="bookError" class="alert alert-danger py-2 small mb-3">{{ bookError }}</div>
            <div class="mb-3">
              <label class="form-label fw-bold">Select Date</label>
              <div class="row g-2">
                <div class="col-4" v-for="day in selectedDoctor.availability" :key="day.date">
                  <div class="day-slot" :class="{selected: selectedDate===day.date}" @click="selectedDate=day.date; loadSlots()">
                    <div class="small fw-bold">{{ day.date }}</div>
                    <div class="small">{{ day.start_time }}–{{ day.end_time }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedDate" class="mb-3">
              <label class="form-label fw-bold">Select Time Slot</label>
              <div v-if="loadingSlots" class="text-center py-2"><div class="spinner-border spinner-border-sm text-primary"></div></div>
              <div v-else-if="!slots.length" class="text-muted small">No slots available</div>
              <div v-else class="d-flex flex-wrap gap-2">
                <button v-for="s in slots" :key="s.time"
                  class="slot-btn" :class="{selected: selectedSlot===s.time}"
                  :disabled="!s.available"
                  @click="selectedSlot = s.available ? s.time : selectedSlot">
                  {{ s.time }}<span v-if="!s.available" class="ms-1 small">✗</span>
                </button>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Reason for Visit</label>
              <textarea v-model="bookingReason" class="form-control" rows="2" placeholder="Describe your symptoms or reason…"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showBookModal=false">Cancel</button>
            <button class="btn btn-primary" @click="bookAppointment" :disabled="booking || !selectedSlot">
              <span v-if="booking" class="spinner-border spinner-border-sm me-1"></span>
              Confirm Booking
            </button>
          </div>
        </div></div>
      </div>
    </div>
  `,
};

const PatientAppointments = {
  name: "PatientAppointments",
  props: ["api"],
  data() {
    return {
      appointments: [], loading: true, statusFilter: "",
      showRescheduleModal: false, rescheduling: null,
      rescheduleForm: { date:"", time:"", reason:"" },
      slots: [], loadingSlots: false, saving: false, rescheduleError: "",
    };
  },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.appointments = await this.api.patientAppointments(this.statusFilter); }
      finally { this.loading = false; }
    },
    async cancel(id) {
      if (!confirm("Cancel this appointment?")) return;
      try { await this.api.patientCancelAppointment(id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
    openReschedule(a) {
      this.rescheduling = a;
      this.rescheduleForm = { date: a.date, time: a.time, reason: a.reason || "" };
      this.slots = []; this.rescheduleError = "";
      this.showRescheduleModal = true;
    },
    async loadSlots() {
      if (!this.rescheduleForm.date || !this.rescheduling) return;
      this.loadingSlots = true; this.slots = [];
      try {
        const res = await this.api.patientSlots(this.rescheduling.doctor_id, this.rescheduleForm.date);
        this.slots = res.slots || [];
      } finally { this.loadingSlots = false; }
    },
    async saveReschedule() {
      if (!this.rescheduleForm.date || !this.rescheduleForm.time) { this.rescheduleError = "Select date and time"; return; }
      this.saving = true; this.rescheduleError = "";
      try {
        await this.api.patientReschedule(this.rescheduling.id, this.rescheduleForm);
        this.showRescheduleModal = false; await this.load();
      } catch(e) { this.rescheduleError = e.error || "Failed"; }
      finally { this.saving = false; }
    },
    fmt: formatDate, statusCls: statusClass,
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-calendar-check me-2"></i>My Appointments</h2><p>View and manage your appointments</p></div>
      <div class="hms-card p-3">
        <div class="d-flex gap-2 mb-3 flex-wrap">
          <button class="btn btn-sm" :class="statusFilter==='' ? 'btn-primary' : 'btn-outline-primary'" @click="statusFilter=''; load()">All</button>
          <button class="btn btn-sm" :class="statusFilter==='Booked' ? 'btn-primary' : 'btn-outline-primary'" @click="statusFilter='Booked'; load()">Booked</button>
          <button class="btn btn-sm" :class="statusFilter==='Completed' ? 'btn-success' : 'btn-outline-success'" @click="statusFilter='Completed'; load()">Completed</button>
          <button class="btn btn-sm" :class="statusFilter==='Cancelled' ? 'btn-danger' : 'btn-outline-danger'" @click="statusFilter='Cancelled'; load()">Cancelled</button>
        </div>
        <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
        <div v-else>
          <div v-if="!appointments.length" class="empty-state"><i class="bi bi-calendar-x"></i><p>No appointments found</p></div>
          <div v-for="a in appointments" :key="a.id" class="border rounded p-3 mb-3 hover-shadow">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div class="fw-bold fs-6">Dr. {{ a.doctor_name }}</div>
                <div class="small text-muted">{{ a.doctor_specialization }}</div>
                <div class="small mt-1"><i class="bi bi-calendar me-1"></i>{{ fmt(a.date) }} at <b>{{ a.time }}</b></div>
                <div class="small text-muted" v-if="a.reason"><i class="bi bi-chat-text me-1"></i>{{ a.reason }}</div>
              </div>
              <span class="badge fs-6 py-2 px-3" :class="statusCls(a.status)">{{ a.status }}</span>
            </div>
            <div v-if="a.treatment && a.status === 'Completed'" class="mt-2 p-2 bg-light rounded">
              <div class="small"><b><i class="bi bi-clipboard-pulse me-1 text-primary"></i>Diagnosis:</b> {{ a.treatment.diagnosis || '—' }}</div>
              <div class="small"><b><i class="bi bi-capsule me-1 text-success"></i>Prescription:</b> {{ a.treatment.prescription || '—' }}</div>
              <div class="small" v-if="a.treatment.next_visit"><b><i class="bi bi-calendar-plus me-1 text-warning"></i>Next Visit:</b> {{ fmt(a.treatment.next_visit) }}</div>
            </div>
            <div v-if="a.status === 'Booked'" class="mt-2 d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" @click="openReschedule(a)"><i class="bi bi-calendar-event me-1"></i>Reschedule</button>
              <button class="btn btn-sm btn-outline-danger" @click="cancel(a.id)"><i class="bi bi-x-circle me-1"></i>Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <!-- Reschedule Modal -->
      <div v-if="showRescheduleModal" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Reschedule Appointment</h5><button class="btn-close" @click="showRescheduleModal=false"></button></div>
          <div class="modal-body">
            <div v-if="rescheduleError" class="alert alert-danger py-2 small">{{ rescheduleError }}</div>
            <div class="mb-3"><label class="form-label">New Date</label><input v-model="rescheduleForm.date" type="date" class="form-control" @change="loadSlots" :min="new Date().toISOString().split('T')[0]"/></div>
            <div v-if="rescheduleForm.date" class="mb-3">
              <label class="form-label">Time Slot</label>
              <div v-if="loadingSlots" class="text-center"><div class="spinner-border spinner-border-sm text-primary"></div></div>
              <div v-else class="d-flex flex-wrap gap-2">
                <button v-for="s in slots" :key="s.time" class="slot-btn" :class="{selected: rescheduleForm.time===s.time}" :disabled="!s.available" @click="rescheduleForm.time = s.available ? s.time : rescheduleForm.time">{{ s.time }}</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showRescheduleModal=false">Cancel</button>
            <button class="btn btn-primary" @click="saveReschedule" :disabled="saving"><span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Confirm</button>
          </div>
        </div></div>
      </div>
    </div>
  `,
};

const PatientHistory = {
  name: "PatientHistory",
  props: ["api"],
  data() { return { history: [], loading: true, exporting: false, exportMsg: "" }; },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.history = await this.api.patientHistory(); }
      finally { this.loading = false; }
    },
    async exportCSV() {
      this.exporting = true; this.exportMsg = "";
      try {
        const res = await this.api.patientExport();
        this.exportMsg = res.message || "Export started...";
        if (res.download_url) {
          const token = localStorage.getItem("hms_token");
          const url = `${res.download_url}?token=${token}`;
          window.location.href = url;
          this.exporting = false;
        } else if (res.job_id) {
          this.pollExportJob(res.job_id);
        } else {
          this.exporting = false;
        }
      } catch(e) { 
        this.exportMsg = e.error || "Export failed"; 
        this.exporting = false;
      }
    },
    pollExportJob(jobId) {
      let attempts = 0;
      const maxAttempts = 30; // ~1 min
      const check = async () => {
        try {
          const jobs = await this.api.patientExportJobs();
          const job = jobs.find(j => j.id === jobId);
          if (job) {
            if (job.status === "completed" && job.file_path) {
              this.exportMsg = "Export complete! Downloading...";
              const filename = job.file_path.split('/').pop().split('\\').pop();
              setTimeout(async () => {
                try {
                  const token = localStorage.getItem("hms_token");
                  const url = `/api/patient/export/download/${filename}?token=${token}`;
                  window.location.href = url;
                  
                  this.exporting = false;
                  this.exportMsg = "Export downloaded.";
                  setTimeout(() => { this.exportMsg = ""; }, 3000);
                } catch (err) {
                  this.exportMsg = "Failed: " + err.message;
                  this.exporting = false;
                }
              }, 1000);
              return;
            } else if (job.status === "failed") {
              this.exportMsg = "Export failed on server.";
              this.exporting = false;
              return;
            }
          }
        } catch (e) {
          console.error("Poller error", e);
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          this.exportMsg = "Export is taking longer than expected. Please check your email later.";
          this.exporting = false;
        }
      };
      setTimeout(check, 2000);
    },
    fmt: formatDate,
  },
  template: `
    <div>
      <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><h2><i class="bi bi-clock-history me-2"></i>Treatment History</h2><p>Your complete medical history</p></div>
        <button class="btn btn-light" @click="exportCSV" :disabled="exporting">
          <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-download me-1"></i>Export CSV
        </button>
      </div>
      <div v-if="exportMsg" class="alert alert-info py-2 mb-3 small"><i class="bi bi-info-circle me-2"></i>{{ exportMsg }}</div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <div v-else>
        <div v-if="!history.length" class="empty-state"><i class="bi bi-clipboard-x"></i><p>No treatment history yet</p></div>
        <div class="timeline">
          <div class="timeline-item" v-for="a in history" :key="a.id">
            <div class="hms-card p-3">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div class="fw-bold">Dr. {{ a.doctor_name }}</div>
                  <div class="small text-muted">{{ a.doctor_specialization }}</div>
                </div>
                <div class="text-end">
                  <div class="small text-muted">{{ fmt(a.date) }}</div>
                  <div class="small text-muted">{{ a.time }}</div>
                </div>
              </div>
              <div v-if="a.treatment">
                <div class="row g-2">
                  <div class="col-md-6">
                    <div class="p-2 bg-light rounded">
                      <div class="small fw-semibold text-primary mb-1"><i class="bi bi-clipboard-pulse me-1"></i>Diagnosis</div>
                      <div class="small">{{ a.treatment.diagnosis || 'Not recorded' }}</div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="p-2 bg-light rounded">
                      <div class="small fw-semibold text-success mb-1"><i class="bi bi-capsule me-1"></i>Prescription</div>
                      <div class="small">{{ a.treatment.prescription || 'None' }}</div>
                    </div>
                  </div>
                  <div class="col-12" v-if="a.treatment.notes">
                    <div class="p-2 bg-light rounded">
                      <div class="small fw-semibold text-secondary mb-1"><i class="bi bi-sticky me-1"></i>Doctor's Notes</div>
                      <div class="small">{{ a.treatment.notes }}</div>
                    </div>
                  </div>
                  <div class="col-12" v-if="a.treatment.next_visit">
                    <div class="small"><i class="bi bi-calendar-plus me-1 text-warning"></i><b>Next Visit:</b> {{ fmt(a.treatment.next_visit) }}</div>
                  </div>
                </div>
              </div>
              <div v-else class="small text-muted">No treatment notes recorded</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

const PatientProfile = {
  name: "PatientProfile",
  props: ["api"],
  data() { return { profile: null, loading: true, saving: false, editMode: false, form: {} }; },
  async mounted() {
    try { this.profile = await this.api.patientProfile(); this.form = { ...this.profile }; }
    finally { this.loading = false; }
  },
  methods: {
    async save() {
      this.saving = true;
      try { this.profile = await this.api.patientUpdateProfile(this.form); this.editMode = false; }
      catch(e) { alert(e.error || "Failed"); }
      finally { this.saving = false; }
    },
    fmt: formatDate,
  },
  template: `
    <div>
      <div class="page-header d-flex justify-content-between align-items-center">
        <div><h2><i class="bi bi-person-circle me-2"></i>My Profile</h2></div>
        <button v-if="!editMode" class="btn btn-light" @click="editMode=true"><i class="bi bi-pencil me-2"></i>Edit Profile</button>
      </div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <div v-else-if="profile" class="hms-card p-4">
        <div class="row g-3">
          <div class="col-12 text-center mb-2">
            <div class="doctor-avatar mx-auto mb-2" style="width:80px;height:80px;font-size:2rem;background:linear-gradient(135deg,#34a853,#6fcf97)">{{ profile.name[0] }}</div>
            <h4 class="fw-bold">{{ profile.name }}</h4>
            <p class="text-muted">{{ profile.email }}</p>
          </div>
          <template v-if="!editMode">
            <div class="col-md-6"><label class="form-label text-muted">Phone</label><p class="fw-semibold">{{ profile.phone || '—' }}</p></div>
            <div class="col-md-6"><label class="form-label text-muted">Gender</label><p class="fw-semibold">{{ profile.gender || '—' }}</p></div>
            <div class="col-md-6"><label class="form-label text-muted">Date of Birth</label><p class="fw-semibold">{{ fmt(profile.date_of_birth) }}</p></div>
            <div class="col-md-6"><label class="form-label text-muted">Blood Group</label><p class="fw-semibold"><span class="badge bg-danger fs-6">{{ profile.blood_group || 'Unknown' }}</span></p></div>
            <div class="col-md-6"><label class="form-label text-muted">Emergency Contact</label><p class="fw-semibold">{{ profile.emergency_contact || '—' }}</p></div>
            <div class="col-12"><label class="form-label text-muted">Address</label><p class="fw-semibold">{{ profile.address || '—' }}</p></div>
          </template>
          <template v-else>
            <div class="col-md-6"><label class="form-label">Full Name</label><input v-model="form.name" type="text" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Email</label><input v-model="form.email" type="email" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Phone</label><input v-model="form.phone" type="tel" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Gender</label><select v-model="form.gender" class="form-select"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
            <div class="col-md-6"><label class="form-label">Date of Birth</label><input v-model="form.date_of_birth" type="date" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Blood Group</label><select v-model="form.blood_group" class="form-select"><option value="">Select</option><option v-for="bg in ['A+','A-','B+','B-','O+','O-','AB+','AB-']" :key="bg">{{ bg }}</option></select></div>
            <div class="col-md-6"><label class="form-label">Emergency Contact</label><input v-model="form.emergency_contact" type="tel" class="form-control"/></div>
            <div class="col-12"><label class="form-label">Address</label><textarea v-model="form.address" class="form-control" rows="2"></textarea></div>
            <div class="col-12 d-flex gap-2">
              <button class="btn btn-primary" @click="save" :disabled="saving"><span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Save Changes</button>
              <button class="btn btn-outline-secondary" @click="editMode=false">Cancel</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  `,
};
