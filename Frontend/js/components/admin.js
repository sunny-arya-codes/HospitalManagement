// ─── Admin Components ───────────────────────────────────────────────

const AdminDashboard = {
  name: "AdminDashboard",
  props: ["api"],
  emits: ["navigate"],
  data() { return { data: null, loading: true }; },
  async mounted() {
    try { this.data = await this.api.adminDashboard(); }
    catch (e) { console.error(e); }
    finally { this.loading = false; }
  },
  computed: {
    stats() { return this.data?.stats || {}; },
    recent() { return this.data?.recent_appointments || []; },
  },
  methods: { fmt: formatDate, statusCls: statusClass },
  template: `
    <div>
      <div class="page-header">
        <h2><i class="bi bi-speedometer2 me-2"></i>Admin Dashboard</h2>
        <p>Welcome back! Here's an overview of the hospital.</p>
      </div>
      <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
      <template v-else>
        <div class="row g-3 mb-4">
          <div class="col-6 col-lg-3"><div class="stat-card stat-blue"><i class="bi bi-person-badge stat-icon"></i><div><div class="stat-value">{{ stats.total_doctors }}</div><div class="stat-label">Doctors</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card stat-green"><i class="bi bi-people stat-icon"></i><div><div class="stat-value">{{ stats.total_patients }}</div><div class="stat-label">Patients</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card stat-orange"><i class="bi bi-calendar-check stat-icon"></i><div><div class="stat-value">{{ stats.total_appointments }}</div><div class="stat-label">Appointments</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card stat-teal"><i class="bi bi-calendar-day stat-icon"></i><div><div class="stat-value">{{ stats.today_appointments }}</div><div class="stat-label">Today</div></div></div></div>
        </div>
        <div class="row g-3 mb-4">
          <div class="col-4"><div class="hms-card p-3 text-center"><div class="fw-bold text-primary fs-4">{{ stats.booked }}</div><div class="small text-muted">Booked</div></div></div>
          <div class="col-4"><div class="hms-card p-3 text-center"><div class="fw-bold text-success fs-4">{{ stats.completed }}</div><div class="small text-muted">Completed</div></div></div>
          <div class="col-4"><div class="hms-card p-3 text-center"><div class="fw-bold text-danger fs-4">{{ stats.cancelled }}</div><div class="small text-muted">Cancelled</div></div></div>
        </div>
        <div class="hms-card p-3">
          <h6 class="fw-bold mb-3"><i class="bi bi-clock-history me-2 text-primary"></i>Recent Appointments</h6>
          <div class="table-responsive">
            <table class="table hms-table table-hover mb-0">
              <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-if="!recent.length"><td colspan="5" class="text-center text-muted py-3">No recent appointments</td></tr>
                <tr v-for="a in recent" :key="a.id">
                  <td>{{ a.patient_name }}</td>
                  <td>Dr. {{ a.doctor_name }}</td>
                  <td>{{ fmt(a.date) }}</td>
                  <td>{{ a.time }}</td>
                  <td><span class="badge" :class="statusCls(a.status)">{{ a.status }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="row g-3 mt-1">
          <div class="col-md-4"><button class="btn btn-primary w-100" @click="$emit('navigate','admin-doctors')"><i class="bi bi-person-badge me-2"></i>Manage Doctors</button></div>
          <div class="col-md-4"><button class="btn btn-success w-100" @click="$emit('navigate','admin-patients')"><i class="bi bi-people me-2"></i>Manage Patients</button></div>
          <div class="col-md-4"><button class="btn btn-info w-100 text-white" @click="$emit('navigate','admin-appointments')"><i class="bi bi-calendar-check me-2"></i>All Appointments</button></div>
        </div>
      </template>
    </div>
  `,
};

const AdminDoctors = {
  name: "AdminDoctors",
  props: ["api"],
  emits: ["navigate"],
  data() {
    return {
      doctors: [], departments: [], loading: true,
      showModal: false, editMode: false, saving: false,
      form: { username:"", email:"", password:"", name:"", specialization:"", qualification:"", experience_years:0, phone:"", bio:"", fee:500, department_id:"" },
      editId: null, search: "",
    };
  },
  async mounted() {
    await this.load();
  },
  computed: {
    filtered() {
      const q = this.search.toLowerCase();
      return this.doctors.filter(d => !q || d.name.toLowerCase().includes(q) || (d.specialization||"").toLowerCase().includes(q));
    },
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        [this.doctors, this.departments] = await Promise.all([this.api.adminDoctors(), this.api.adminDepartments()]);
      } catch(e) { console.error(e); }
      finally { this.loading = false; }
    },
    openAdd() {
      this.editMode = false; this.editId = null;
      this.form = { username:"", email:"", password:"", name:"", specialization:"", qualification:"", experience_years:0, phone:"", bio:"", fee:500, department_id:"" };
      this.showModal = true;
    },
    openEdit(d) {
      this.editMode = true; this.editId = d.id;
      this.form = { name:d.name, specialization:d.specialization||"", qualification:d.qualification||"", experience_years:d.experience_years||0, phone:d.phone||"", bio:d.bio||"", fee:d.fee||500, department_id:d.department?.id||"", email:d.email||"" };
      this.showModal = true;
    },
    async save() {
      if (!this.form.name) return;
      if (!this.editMode && (!this.form.username || !this.form.email || !this.form.password)) return;
      this.saving = true;
      try {
        if (this.editMode) { await this.api.adminUpdateDoctor(this.editId, this.form); }
        else { await this.api.adminCreateDoctor(this.form); }
        this.showModal = false; await this.load();
      } catch(e) { alert(e.error || "Failed"); }
      finally { this.saving = false; }
    },
    async toggleStatus(d) {
      if (!confirm(`${d.is_active ? 'Blacklist' : 'Activate'} Dr. ${d.name}?`)) return;
      try { await this.api.adminToggleDoctorStatus(d.id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
    async remove(d) {
      if (!confirm(`Permanently remove Dr. ${d.name}?`)) return;
      try { await this.api.adminDeleteDoctor(d.id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
  },
  template: `
    <div>
      <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><h2><i class="bi bi-person-badge me-2"></i>Manage Doctors</h2><p>Add and manage doctor profiles</p></div>
        <button class="btn btn-light fw-bold" @click="openAdd"><i class="bi bi-plus-circle me-2"></i>Add Doctor</button>
      </div>
      <div class="hms-card p-3">
        <div class="row align-items-center mb-3 g-2">
          <div class="col-md-5">
            <div class="position-relative">
              <i class="bi bi-search search-icon"></i>
              <input v-model="search" type="text" class="form-control hms-search" placeholder="Search by name or specialization…"/>
            </div>
          </div>
          <div class="col-auto ms-auto text-muted small">{{ filtered.length }} doctor(s)</div>
        </div>
        <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
        <div v-else class="table-responsive">
          <table class="table hms-table table-hover mb-0">
            <thead><tr><th>#</th><th>Name</th><th>Specialization</th><th>Department</th><th>Experience</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-if="!filtered.length"><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-25"></i>No doctors found</td></tr>
              <tr v-for="d in filtered" :key="d.id">
                <td class="text-muted">{{ d.id }}</td>
                <td><div class="fw-semibold">Dr. {{ d.name }}</div><div class="small text-muted">{{ d.email }}</div></td>
                <td>{{ d.specialization || '—' }}</td>
                <td>{{ d.department?.name || '—' }}</td>
                <td>{{ d.experience_years }} yr(s)</td>
                <td>₹{{ d.fee }}</td>
                <td><span class="badge" :class="d.is_active ? 'bg-success' : 'bg-danger'">{{ d.is_active ? 'Active' : 'Blacklisted' }}</span></td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-1" @click="openEdit(d)" title="Edit"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm me-1" :class="d.is_active ? 'btn-outline-warning' : 'btn-outline-success'" @click="toggleStatus(d)" :title="d.is_active ? 'Blacklist' : 'Activate'"><i :class="d.is_active ? 'bi bi-ban' : 'bi bi-check-circle'"></i></button>
                  <button class="btn btn-sm btn-outline-danger" @click="remove(d)" title="Delete"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal -->
      <div v-if="showModal" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog modal-lg"><div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ editMode ? 'Edit Doctor' : 'Add Doctor' }}</h5>
            <button type="button" class="btn-close" @click="showModal=false"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6" v-if="!editMode"><label class="form-label">Username *</label><input v-model="form.username" type="text" class="form-control" required/></div>
              <div class="col-md-6" v-if="!editMode"><label class="form-label">Password *</label><input v-model="form.password" type="password" class="form-control" required/></div>
              <div class="col-md-6"><label class="form-label">Full Name *</label><input v-model="form.name" type="text" class="form-control" required/></div>
              <div class="col-md-6"><label class="form-label">Email</label><input v-model="form.email" type="email" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Specialization</label><input v-model="form.specialization" type="text" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Department</label>
                <select v-model="form.department_id" class="form-select"><option value="">None</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select>
              </div>
              <div class="col-md-6"><label class="form-label">Qualification</label><input v-model="form.qualification" type="text" class="form-control"/></div>
              <div class="col-md-3"><label class="form-label">Experience (yr)</label><input v-model="form.experience_years" type="number" min="0" class="form-control"/></div>
              <div class="col-md-3"><label class="form-label">Fee (₹)</label><input v-model="form.fee" type="number" min="0" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Phone</label><input v-model="form.phone" type="text" class="form-control"/></div>
              <div class="col-12"><label class="form-label">Bio</label><textarea v-model="form.bio" class="form-control" rows="2"></textarea></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showModal=false">Cancel</button>
            <button class="btn btn-primary" @click="save" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              {{ editMode ? 'Update' : 'Add Doctor' }}
            </button>
          </div>
        </div></div>
      </div>
    </div>
  `,
};

const AdminPatients = {
  name: "AdminPatients",
  props: ["api"],
  data() { return { patients: [], loading: true, search: "", showModal: false, selected: null }; },
  async mounted() { await this.load(); },
  computed: {
    filtered() {
      const q = this.search.toLowerCase();
      return this.patients.filter(p => !q || p.name.toLowerCase().includes(q) || (p.phone||"").includes(q) || (p.email||"").toLowerCase().includes(q));
    },
  },
  methods: {
    async load() {
      this.loading = true;
      try { this.patients = await this.api.adminPatients(); }
      finally { this.loading = false; }
    },
    async toggleStatus(p) {
      if (!confirm(`${p.is_active ? 'Blacklist' : 'Activate'} ${p.name}?`)) return;
      try { await this.api.adminTogglePatientStatus(p.id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
    viewPatient(p) { this.selected = p; this.showModal = true; },
    fmt: formatDate,
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-people me-2"></i>Manage Patients</h2><p>View and manage all registered patients</p></div>
      <div class="hms-card p-3">
        <div class="row mb-3 g-2">
          <div class="col-md-5"><div class="position-relative"><i class="bi bi-search search-icon"></i><input v-model="search" class="form-control hms-search" placeholder="Search by name, email or phone…"/></div></div>
          <div class="col-auto ms-auto text-muted small my-auto">{{ filtered.length }} patient(s)</div>
        </div>
        <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
        <div v-else class="table-responsive">
          <table class="table hms-table table-hover mb-0">
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Blood</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-if="!filtered.length"><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-25"></i>No patients found</td></tr>
              <tr v-for="p in filtered" :key="p.id">
                <td class="text-muted">{{ p.id }}</td>
                <td><div class="fw-semibold">{{ p.name }}</div><div class="small text-muted">@{{ p.username }}</div></td>
                <td>{{ p.email }}</td><td>{{ p.phone || '—' }}</td>
                <td><span class="badge bg-light text-dark border">{{ p.blood_group || '?' }}</span></td>
                <td><span class="badge" :class="p.is_active ? 'bg-success' : 'bg-danger'">{{ p.is_active ? 'Active' : 'Blocked' }}</span></td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-1" @click="viewPatient(p)"><i class="bi bi-eye"></i></button>
                  <button class="btn btn-sm" :class="p.is_active ? 'btn-outline-warning' : 'btn-outline-success'" @click="toggleStatus(p)"><i :class="p.is_active ? 'bi bi-ban' : 'bi bi-check-circle'"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Patient Detail Modal -->
      <div v-if="showModal && selected" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Patient Details</h5><button class="btn-close" @click="showModal=false"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-6"><label class="form-label">Name</label><p class="fw-semibold mb-1">{{ selected.name }}</p></div>
              <div class="col-6"><label class="form-label">Email</label><p class="mb-1">{{ selected.email }}</p></div>
              <div class="col-6"><label class="form-label">Phone</label><p class="mb-1">{{ selected.phone || '—' }}</p></div>
              <div class="col-6"><label class="form-label">Gender</label><p class="mb-1">{{ selected.gender || '—' }}</p></div>
              <div class="col-6"><label class="form-label">DOB</label><p class="mb-1">{{ fmt(selected.date_of_birth) }}</p></div>
              <div class="col-6"><label class="form-label">Blood Group</label><p class="mb-1">{{ selected.blood_group || '—' }}</p></div>
              <div class="col-12"><label class="form-label">Address</label><p class="mb-1">{{ selected.address || '—' }}</p></div>
            </div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" @click="showModal=false">Close</button></div>
        </div></div>
      </div>
    </div>
  `,
};

const AdminAppointments = {
  name: "AdminAppointments",
  props: ["api"],
  data() { return { appointments: [], loading: true, statusFilter: "" }; },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      try { this.appointments = await this.api.adminAppointments(this.statusFilter); }
      finally { this.loading = false; }
    },
    async remove(id) {
      if (!confirm("Delete this appointment?")) return;
      try { await this.api.adminDeleteAppointment(id); await this.load(); }
      catch(e) { alert(e.error || "Failed"); }
    },
    fmt: formatDate, statusCls: statusClass,
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-calendar-check me-2"></i>All Appointments</h2><p>View and manage all hospital appointments</p></div>
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
            <thead><tr><th>#</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-if="!appointments.length"><td colspan="8" class="text-center py-4 text-muted">No appointments</td></tr>
              <tr v-for="a in appointments" :key="a.id">
                <td class="text-muted">{{ a.id }}</td>
                <td>{{ a.patient_name }}</td>
                <td>Dr. {{ a.doctor_name }}</td>
                <td>{{ fmt(a.date) }}</td><td>{{ a.time }}</td>
                <td class="text-muted small">{{ a.reason || '—' }}</td>
                <td><span class="badge" :class="statusCls(a.status)">{{ a.status }}</span></td>
                <td><button class="btn btn-sm btn-outline-danger" @click="remove(a.id)"><i class="bi bi-trash"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};

const AdminSearch = {
  name: "AdminSearch",
  props: ["api"],
  data() { return { query: "", type: "all", results: null, loading: false }; },
  methods: {
    async search() {
      if (!this.query.trim()) return;
      this.loading = true;
      try { this.results = await this.api.adminSearch(this.query, this.type); }
      finally { this.loading = false; }
    },
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-search me-2"></i>Search</h2><p>Search for doctors and patients</p></div>
      <div class="hms-card p-4 mb-4">
        <div class="row g-2">
          <div class="col-md-6"><div class="position-relative"><i class="bi bi-search search-icon"></i><input v-model="query" class="form-control hms-search" placeholder="Search name, specialization, phone…" @keyup.enter="search"/></div></div>
          <div class="col-md-3">
            <select v-model="type" class="form-select"><option value="all">All</option><option value="doctor">Doctors only</option><option value="patient">Patients only</option></select>
          </div>
          <div class="col-auto"><button class="btn btn-primary" @click="search" :disabled="loading"><span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>Search</button></div>
        </div>
      </div>
      <div v-if="results">
        <div v-if="results.doctors && results.doctors.length" class="mb-4">
          <h6 class="fw-bold mb-3"><i class="bi bi-person-badge me-2 text-primary"></i>Doctors ({{ results.doctors.length }})</h6>
          <div class="row g-3">
            <div class="col-md-4" v-for="d in results.doctors" :key="d.id">
              <div class="doctor-card">
                <div class="d-flex align-items-center gap-3 mb-2">
                  <div class="doctor-avatar" style="width:45px;height:45px;font-size:1.1rem">{{ d.name[0] }}</div>
                  <div><div class="fw-bold">Dr. {{ d.name }}</div><div class="small text-muted">{{ d.specialization }}</div></div>
                </div>
                <div class="small text-muted">{{ d.email }} · {{ d.phone || 'N/A' }}</div>
                <span class="badge mt-1" :class="d.is_active ? 'bg-success' : 'bg-danger'">{{ d.is_active ? 'Active' : 'Blacklisted' }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="results.patients && results.patients.length">
          <h6 class="fw-bold mb-3"><i class="bi bi-people me-2 text-success"></i>Patients ({{ results.patients.length }})</h6>
          <div class="row g-3">
            <div class="col-md-4" v-for="p in results.patients" :key="p.id">
              <div class="hms-card p-3">
                <div class="fw-bold">{{ p.name }}</div>
                <div class="small text-muted">{{ p.email }} · {{ p.phone || 'N/A' }}</div>
                <div class="small mt-1"><span class="badge bg-light text-dark border me-1">{{ p.blood_group || 'Unknown' }}</span><span class="badge" :class="p.is_active ? 'bg-success' : 'bg-danger'">{{ p.is_active ? 'Active' : 'Blocked' }}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="(!results.doctors || !results.doctors.length) && (!results.patients || !results.patients.length)" class="empty-state">
          <i class="bi bi-search"></i><p>No results found for "{{ query }}"</p>
        </div>
      </div>
    </div>
  `,
};

const AdminDepartments = {
  name: "AdminDepartments",
  props: ["api"],
  data() {
    return {
      departments: [], loading: true, search: "",
      showModal: false, editMode: false, saving: false,
      form: { name: "", description: "" },
      editId: null
    };
  },
  async mounted() {
    await this.load();
  },
  computed: {
    filtered() {
      const q = this.search.toLowerCase();
      return this.departments.filter(d => !q || d.name.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q));
    }
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        this.departments = await this.api.adminDepartments();
      } catch (e) { console.error(e); }
      finally { this.loading = false; }
    },
    openAdd() {
      this.editMode = false; this.editId = null;
      this.form = { name: "", description: "" };
      this.showModal = true;
    },
    openEdit(d) {
      this.editMode = true; this.editId = d.id;
      this.form = { name: d.name, description: d.description || "" };
      this.showModal = true;
    },
    async save() {
      if (!this.form.name.trim()) return;
      this.saving = true;
      try {
        if (this.editMode) {
          await this.api.adminUpdateDepartment(this.editId, this.form);
        } else {
          await this.api.adminCreateDepartment(this.form);
        }
        this.showModal = false;
        await this.load();
      } catch (e) { alert(e.error || "Failed"); }
      finally { this.saving = false; }
    },
    async remove(d) {
      if (!confirm(`Are you sure you want to delete the ${d.name} department?`)) return;
      try {
        await this.api.adminDeleteDepartment(d.id);
        await this.load();
      } catch (e) { alert(e.error || "Failed"); }
    }
  },
  template: `
    <div>
      <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><h2><i class="bi bi-diagram-3 me-2"></i>Manage Departments</h2><p>Add and configure hospital departments</p></div>
        <button class="btn btn-light fw-bold" @click="openAdd"><i class="bi bi-plus-circle me-2"></i>Add Department</button>
      </div>

      <div class="hms-card p-3">
        <div class="row align-items-center mb-3 g-2">
          <div class="col-md-5">
            <div class="position-relative">
              <i class="bi bi-search search-icon"></i>
              <input v-model="search" type="text" class="form-control hms-search" placeholder="Search departments..."/>
            </div>
          </div>
          <div class="col-auto ms-auto text-muted small my-auto">{{ filtered.length }} department(s)</div>
        </div>

        <div v-if="loading" class="hms-spinner"><div class="spinner-border text-primary"></div></div>
        <div v-else class="table-responsive">
          <table class="table hms-table table-hover mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Description</th>
                <th>Total Doctors</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtered.length">
                <td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-25"></i>No departments found</td>
              </tr>
              <tr v-for="d in filtered" :key="d.id">
                <td class="text-muted">{{ d.id }}</td>
                <td class="fw-semibold">{{ d.name }}</td>
                <td class="text-muted small w-50">{{ d.description || '—' }}</td>
                <td><span class="badge bg-light text-dark border">{{ d.doctors_count }}</span></td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-1" @click="openEdit(d)" title="Edit"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" @click="remove(d)" title="Delete" :disabled="d.doctors_count > 0"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div v-if="showModal" class="modal d-block" style="background:rgba(0,0,0,0.5)">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ editMode ? 'Edit Department' : 'Add Department' }}</h5>
              <button type="button" class="btn-close" @click="showModal=false"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Department Name *</label>
                <input v-model="form.name" type="text" class="form-control" required/>
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea v-model="form.description" class="form-control" rows="3"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="showModal=false">Cancel</button>
              <button class="btn btn-primary" @click="save" :disabled="saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                {{ editMode ? 'Update' : 'Add Department' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
