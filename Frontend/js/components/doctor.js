// ─── Doctor Components ───────────────────────────────────────────────

const DoctorDashboard = {
  name: "DoctorDashboard",
  props: ["api"],
  emits: ["navigate"],
  data() { return { data: null, loading: true }; },
  async mounted() {
    try { this.data = await this.api.doctorDashboard(); }
    catch(e) { console.error(e); }
    finally { this.loading = false; }
  },
  computed: {
    stats() { return this.data?.stats || {}; },
    todayAppts() { return this.data?.today_appointments || []; },
    weekAppts() { return this.data?.week_appointments || []; },
  },
  methods: { fmt: formatDate, statusCls: statusClass },
  template: `
    <div>
      <div class="page-header">
        <h2><i class="bi bi-activity me-2"></i>Doctor Dashboard</h2>
        <p v-if="data">Welcome, Dr. {{ data.doctor?.name }}!</p>
      </div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <template v-else-if="data">
        <div class="row g-3 mb-4">
          <div class="col-6 col-lg-3"><div class="stat-card stat-blue"><i class="bi bi-calendar-day stat-icon"></i><div><div class="stat-value">{{ stats.today_appointments }}</div><div class="stat-label">Today</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card stat-orange"><i class="bi bi-calendar-week stat-icon"></i><div><div class="stat-value">{{ stats.week_appointments }}</div><div class="stat-label">This Week</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card stat-green"><i class="bi bi-people stat-icon"></i><div><div class="stat-value">{{ stats.total_patients }}</div><div class="stat-label">Patients</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card stat-teal"><i class="bi bi-check-circle stat-icon"></i><div><div class="stat-value">{{ stats.completed_appointments }}</div><div class="stat-label">Completed</div></div></div></div>
        </div>
        <div class="row g-3">
          <div class="col-lg-6">
            <div class="hms-card p-3">
              <h6 class="fw-bold mb-3"><i class="bi bi-calendar-day me-2 text-primary"></i>Today's Appointments</h6>
              <div v-if="!todayAppts.length" class="empty-state py-3"><i class="bi bi-calendar-x"></i><p>No appointments today</p></div>
              <div v-for="a in todayAppts" :key="a.id" class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                <div>
                  <div class="fw-semibold">{{ a.patient_name }}</div>
                  <div class="small text-muted"><i class="bi bi-clock me-1"></i>{{ a.time }} · {{ a.reason || 'General' }}</div>
                </div>
                <span class="badge" :class="statusCls(a.status)">{{ a.status }}</span>
              </div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="hms-card p-3">
              <h6 class="fw-bold mb-3"><i class="bi bi-calendar-week me-2 text-orange"></i>Upcoming This Week</h6>
              <div v-if="!weekAppts.length" class="empty-state py-3"><i class="bi bi-calendar-x"></i><p>No upcoming appointments</p></div>
              <div v-for="a in weekAppts" :key="a.id" class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                <div>
                  <div class="fw-semibold">{{ a.patient_name }}</div>
                  <div class="small text-muted"><i class="bi bi-calendar me-1"></i>{{ fmt(a.date) }} at {{ a.time }}</div>
                </div>
                <span class="badge status-booked">Booked</span>
              </div>
            </div>
          </div>
        </div>
        <div class="row g-3 mt-1">
          <div class="col-md-4"><button class="btn btn-primary w-100" @click="$emit('navigate','doctor-appointments')"><i class="bi bi-calendar-check me-2"></i>View Appointments</button></div>
          <div class="col-md-4"><button class="btn btn-success w-100" @click="$emit('navigate','doctor-patients')"><i class="bi bi-people me-2"></i>My Patients</button></div>
          <div class="col-md-4"><button class="btn btn-info text-white w-100" @click="$emit('navigate','doctor-availability')"><i class="bi bi-clock me-2"></i>Set Availability</button></div>
        </div>
      </template>
    </div>
  `,
};

const DoctorAppointments = {
  name: "DoctorAppointments",
  props: ["api"],
  data() {
    return {
      appointments: [], loading: true, statusFilter: "",
      showTreatmentModal: false, treating: null,
      treatmentForm: { diagnosis: "", prescription: "", notes: "", next_visit: "" },
      saving: false,
    };
  },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.appointments = await this.api.doctorAppointments(this.statusFilter); }
      finally { this.loading = false; }
    },
    openTreatment(a) {
      this.treating = a;
      const t = a.treatment || {};
      this.treatmentForm = { diagnosis: t.diagnosis||"", prescription: t.prescription||"", notes: t.notes||"", next_visit: t.next_visit||"" };
      this.showTreatmentModal = true;
    },
    async saveComplete() {
      this.saving = true;
      try {
        await this.api.doctorCompleteAppointment(this.treating.id, this.treatmentForm);
        this.showTreatmentModal = false; await this.load();
      } catch(e) { alert(e.error || "Failed"); }
      finally { this.saving = false; }
    },
    async cancel(id) {
      if (!confirm("Cancel this appointment?")) return;
      try { await this.api.doctorCancelAppointment(id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
    fmt: formatDate, statusCls: statusClass,
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-calendar-check me-2"></i>My Appointments</h2><p>Manage patient appointments</p></div>
      <div class="hms-card p-3">
        <div class="d-flex gap-2 mb-3 flex-wrap">
          <button class="btn btn-sm" :class="statusFilter==='' ? 'btn-primary' : 'btn-outline-primary'" @click="statusFilter=''; load()">All</button>
          <button class="btn btn-sm" :class="statusFilter==='Booked' ? 'btn-primary' : 'btn-outline-primary'" @click="statusFilter='Booked'; load()">Booked</button>
          <button class="btn btn-sm" :class="statusFilter==='Completed' ? 'btn-success' : 'btn-outline-success'" @click="statusFilter='Completed'; load()">Completed</button>
          <button class="btn btn-sm" :class="statusFilter==='Cancelled' ? 'btn-danger' : 'btn-outline-danger'" @click="statusFilter='Cancelled'; load()">Cancelled</button>
        </div>
        <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
        <div v-else class="table-responsive">
          <table class="table hms-table table-hover mb-0">
            <thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-if="!appointments.length"><td colspan="6" class="text-center py-4 text-muted">No appointments found</td></tr>
              <tr v-for="a in appointments" :key="a.id">
                <td><div class="fw-semibold">{{ a.patient_name }}</div></td>
                <td>{{ fmt(a.date) }}</td><td>{{ a.time }}</td>
                <td class="text-muted small">{{ a.reason || '—' }}</td>
                <td><span class="badge" :class="statusCls(a.status)">{{ a.status }}</span></td>
                <td>
                  <template v-if="a.status === 'Booked'">
                    <button class="btn btn-sm btn-success me-1" @click="openTreatment(a)" title="Mark Complete"><i class="bi bi-check-circle me-1"></i>Complete</button>
                    <button class="btn btn-sm btn-outline-danger" @click="cancel(a.id)" title="Cancel"><i class="bi bi-x-circle"></i></button>
                  </template>
                  <template v-else-if="a.status === 'Completed'">
                    <button class="btn btn-sm btn-outline-primary" @click="openTreatment(a)"><i class="bi bi-pencil me-1"></i>Edit Notes</button>
                  </template>
                  <span v-else class="text-muted small">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Treatment Modal -->
      <div v-if="showTreatmentModal && treating" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Treatment Notes — {{ treating.patient_name }}</h5>
            <button class="btn-close" @click="showTreatmentModal=false"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-bold">Diagnosis</label>
              <textarea v-model="treatmentForm.diagnosis" class="form-control" rows="2" placeholder="Enter diagnosis…"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Prescription</label>
              <textarea v-model="treatmentForm.prescription" class="form-control" rows="2" placeholder="Medicines, dosage…"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Notes</label>
              <textarea v-model="treatmentForm.notes" class="form-control" rows="2" placeholder="Additional notes…"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Next Visit Date</label>
              <input v-model="treatmentForm.next_visit" type="date" class="form-control"/>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showTreatmentModal=false">Cancel</button>
            <button class="btn btn-success" @click="saveComplete" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              Mark as Completed
            </button>
          </div>
        </div></div>
      </div>
    </div>
  `,
};

const DoctorPatients = {
  name: "DoctorPatients",
  props: ["api"],
  emits: ["navigate"],
  data() { return { patients: [], loading: true, showModal: false, history: null, loadingHistory: false }; },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.patients = await this.api.doctorPatients(); }
      finally { this.loading = false; }
    },
    async viewHistory(p) {
      this.loadingHistory = true; this.showModal = true; this.history = null;
      try { this.history = await this.api.doctorPatientHistory(p.id); }
      finally { this.loadingHistory = false; }
    },
    fmt: formatDate, statusCls: statusClass,
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-people me-2"></i>My Patients</h2><p>All patients assigned to you</p></div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <div v-else>
        <div v-if="!patients.length" class="empty-state"><i class="bi bi-people"></i><p>No patients yet</p></div>
        <div class="row g-3" v-else>
          <div class="col-md-4" v-for="p in patients" :key="p.id">
            <div class="hms-card p-3">
              <div class="d-flex align-items-center gap-3 mb-2">
                <div class="doctor-avatar" style="width:50px;height:50px;font-size:1.2rem;background:linear-gradient(135deg,#34a853,#6fcf97)">{{ p.name[0] }}</div>
                <div><div class="fw-bold">{{ p.name }}</div><div class="small text-muted">{{ p.gender || '' }} · {{ p.blood_group || '?' }}</div></div>
              </div>
              <div class="small text-muted mb-2"><i class="bi bi-phone me-1"></i>{{ p.phone || 'N/A' }}</div>
              <button class="btn btn-sm btn-outline-primary w-100" @click="viewHistory(p)"><i class="bi bi-clock-history me-1"></i>View History</button>
            </div>
          </div>
        </div>
      </div>
      <!-- History Modal -->
      <div v-if="showModal" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog modal-lg"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Patient History — {{ history?.patient?.name || '…' }}</h5><button class="btn-close" @click="showModal=false"></button></div>
          <div class="modal-body">
            <div v-if="loadingHistory" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
            <div v-else-if="history">
              <div v-if="!history.appointments.length" class="empty-state"><i class="bi bi-clock-history"></i><p>No appointments yet</p></div>
              <div v-for="a in history.appointments" :key="a.id" class="border rounded p-3 mb-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div><div class="fw-semibold">{{ fmt(a.date) }} at {{ a.time }}</div><div class="small text-muted">{{ a.reason || 'General' }}</div></div>
                  <span class="badge" :class="statusCls(a.status)">{{ a.status }}</span>
                </div>
                <div v-if="a.treatment" class="mt-2 p-2 bg-light rounded">
                  <div class="small"><b>Diagnosis:</b> {{ a.treatment.diagnosis || '—' }}</div>
                  <div class="small"><b>Prescription:</b> {{ a.treatment.prescription || '—' }}</div>
                  <div class="small" v-if="a.treatment.notes"><b>Notes:</b> {{ a.treatment.notes }}</div>
                  <div class="small" v-if="a.treatment.next_visit"><b>Next Visit:</b> {{ fmt(a.treatment.next_visit) }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" @click="showModal=false">Close</button></div>
        </div></div>
      </div>
    </div>
  `,
};

const DoctorAvailability = {
  name: "DoctorAvailability",
  props: ["api"],
  data() {
    return {
      availability: [], loading: true, saving: false,
      days: next7Days(),
      form: { date:"", start_time:"09:00", end_time:"17:00", slot_duration:30, is_available:true },
      showForm: false,
    };
  },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.availability = await this.api.doctorAvailability(); }
      finally { this.loading = false; }
    },
    getAvail(date) { return this.availability.find(a => a.date === date); },
    selectDay(day) {
      const existing = this.getAvail(day.iso);
      this.form = existing
        ? { date: day.iso, start_time: existing.start_time, end_time: existing.end_time, slot_duration: existing.slot_duration, is_available: existing.is_available }
        : { date: day.iso, start_time:"09:00", end_time:"17:00", slot_duration:30, is_available:true };
      this.showForm = true;
    },
    async save() {
      this.saving = true;
      try { await this.api.doctorSetAvailability([this.form]); this.showForm = false; await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
      finally { this.saving = false; }
    },
    async remove(id) {
      if (!confirm("Remove this availability slot?")) return;
      try { await this.api.doctorDeleteAvailability(id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-clock me-2"></i>My Availability</h2><p>Set your availability for the next 7 days</p></div>
      <div class="row g-3 mb-4">
        <div class="col" v-for="day in days" :key="day.iso">
          <div class="day-slot" :class="{ 'has-availability': getAvail(day.iso), 'selected': form.date===day.iso && showForm }" @click="selectDay(day)">
            <div class="fw-bold small">{{ day.label }}</div>
            <div class="small mt-1">
              <template v-if="getAvail(day.iso)">
                <span class="text-success"><i class="bi bi-check-circle me-1"></i>Set</span>
                <div class="smaller">{{ getAvail(day.iso).start_time }}–{{ getAvail(day.iso).end_time }}</div>
              </template>
              <span v-else class="text-muted"><i class="bi bi-plus-circle me-1"></i>Add</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showForm" class="hms-card p-4 mb-4">
        <h6 class="fw-bold mb-3"><i class="bi bi-calendar-plus me-2 text-primary"></i>Set Availability for {{ form.date }}</h6>
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label">Start Time</label><input v-model="form.start_time" type="time" class="form-control"/></div>
          <div class="col-md-3"><label class="form-label">End Time</label><input v-model="form.end_time" type="time" class="form-control"/></div>
          <div class="col-md-3"><label class="form-label">Slot Duration (min)</label><select v-model="form.slot_duration" class="form-select"><option value="15">15</option><option value="20">20</option><option value="30">30</option><option value="45">45</option><option value="60">60</option></select></div>
          <div class="col-md-3 d-flex align-items-end"><div class="form-check"><input v-model="form.is_available" class="form-check-input" type="checkbox" id="isAvail"/><label class="form-check-label" for="isAvail">Available</label></div></div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-primary" @click="save" :disabled="saving"><span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Save</button>
          <button class="btn btn-outline-secondary" @click="showForm=false">Cancel</button>
        </div>
      </div>
      <div class="hms-card p-3">
        <h6 class="fw-bold mb-3">Scheduled Availability</h6>
        <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
        <div v-else-if="!availability.length" class="empty-state"><i class="bi bi-clock"></i><p>No availability set for the next 7 days</p></div>
        <div v-else class="table-responsive">
          <table class="table hms-table mb-0">
            <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Slot (min)</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="a in availability" :key="a.id">
                <td>{{ a.date }}</td><td>{{ a.start_time }}</td><td>{{ a.end_time }}</td><td>{{ a.slot_duration }}</td>
                <td><span class="badge" :class="a.is_available ? 'bg-success' : 'bg-secondary'">{{ a.is_available ? 'Available' : 'Unavailable' }}</span></td>
                <td><button class="btn btn-sm btn-outline-danger" @click="remove(a.id)"><i class="bi bi-trash"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};

const DoctorProfile = {
  name: "DoctorProfile",
  props: ["api"],
  data() { return { profile: null, loading: true, saving: false, editMode: false, form: {} }; },
  async mounted() {
    try { this.profile = await this.api.doctorProfile(); this.form = { ...this.profile }; }
    finally { this.loading = false; }
  },
  methods: {
    async save() {
      this.saving = true;
      try { this.profile = await this.api.doctorUpdateProfile(this.form); this.editMode = false; }
      catch(e) { alert(e.error || "Failed"); }
      finally { this.saving = false; }
    },
  },
  template: `
    <div>
      <div class="page-header d-flex justify-content-between align-items-center">
        <div><h2><i class="bi bi-person-circle me-2"></i>My Profile</h2></div>
        <button v-if="!editMode" class="btn btn-light" @click="editMode=true"><i class="bi bi-pencil me-2"></i>Edit</button>
      </div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <div v-else-if="profile" class="hms-card p-4">
        <div class="row g-3">
          <div class="col-12 text-center mb-2">
            <div class="doctor-avatar mx-auto mb-2" style="width:80px;height:80px;font-size:2rem">{{ profile.name[0] }}</div>
            <h4 class="fw-bold">Dr. {{ profile.name }}</h4>
            <p class="text-muted">{{ profile.specialization }}</p>
          </div>
          <template v-if="!editMode">
            <div class="col-md-6"><label class="form-label text-muted">Qualification</label><p class="fw-semibold">{{ profile.qualification || '—' }}</p></div>
            <div class="col-md-6"><label class="form-label text-muted">Experience</label><p class="fw-semibold">{{ profile.experience_years }} years</p></div>
            <div class="col-md-6"><label class="form-label text-muted">Phone</label><p class="fw-semibold">{{ profile.phone || '—' }}</p></div>
            <div class="col-md-6"><label class="form-label text-muted">Consultation Fee</label><p class="fw-semibold">₹{{ profile.fee }}</p></div>
            <div class="col-12"><label class="form-label text-muted">Bio</label><p>{{ profile.bio || '—' }}</p></div>
          </template>
          <template v-else>
            <div class="col-md-6"><label class="form-label">Name</label><input v-model="form.name" type="text" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Specialization</label><input v-model="form.specialization" type="text" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Qualification</label><input v-model="form.qualification" type="text" class="form-control"/></div>
            <div class="col-md-3"><label class="form-label">Experience (yr)</label><input v-model="form.experience_years" type="number" class="form-control"/></div>
            <div class="col-md-3"><label class="form-label">Fee (₹)</label><input v-model="form.fee" type="number" class="form-control"/></div>
            <div class="col-md-6"><label class="form-label">Phone</label><input v-model="form.phone" type="text" class="form-control"/></div>
            <div class="col-12"><label class="form-label">Bio</label><textarea v-model="form.bio" class="form-control" rows="3"></textarea></div>
            <div class="col-12 d-flex gap-2">
              <button class="btn btn-primary" @click="save" :disabled="saving"><span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Save</button>
              <button class="btn btn-outline-secondary" @click="editMode=false">Cancel</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  `,
};
