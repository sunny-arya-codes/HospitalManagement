// ─── Auth Components ───────────────────────────────────────────────

const LoginPage = {
  name: "LoginPage",
  emits: ["login", "go-register"],
  data() {
    return {
      form: { username: "", password: "" },
      loading: false,
      error: "",
      showPassword: false,
    };
  },
  methods: {
    async submit() {
      if (!this.form.username || !this.form.password) {
        this.error = "Please fill in all fields";
        return;
      }
      this.loading = true;
      this.error = "";
      try {
        const api = createApi(() => null);
        const res = await api.login(this.form);
        localStorage.setItem("hms_token", res.token);
        localStorage.setItem("hms_user", JSON.stringify(res.user));
        localStorage.setItem("hms_profile", JSON.stringify(res.profile));
        this.$emit("login", res);
      } catch (e) {
        this.error = e.error || "Login failed. Check credentials.";
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
    <div class="auth-wrapper">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-12 col-sm-10 col-md-7 col-lg-5">
            <div class="auth-card">
              <div class="text-center mb-4">
                <div class="auth-logo">🏥</div>
                <h2 class="mt-2">Hospital Management</h2>
                <p class="text-muted">Sign in to your account</p>
              </div>
              <div v-if="error" class="alert alert-danger py-2 small"><i class="bi bi-exclamation-triangle me-2"></i>{{ error }}</div>
              <div class="mb-3">
                <label class="form-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-person"></i></span>
                  <input v-model="form.username" type="text" class="form-control" placeholder="Enter username"
                    @keyup.enter="submit" required/>
                </div>
              </div>
              <div class="mb-4">
                <label class="form-label">Password</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-lock"></i></span>
                  <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="form-control"
                    placeholder="Enter password" @keyup.enter="submit" required/>
                  <button class="btn btn-outline-secondary" type="button" @click="showPassword=!showPassword">
                    <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                  </button>
                </div>
              </div>
              <button class="btn btn-primary w-100 py-2 mb-3" @click="submit" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-box-arrow-in-right me-2"></i>
                {{ loading ? 'Signing in…' : 'Sign In' }}
              </button>
              <div class="text-center auth-divider">
                New patient?
                <a href="#" class="text-primary fw-bold" @click.prevent="$emit('go-register')">Create an account</a>
              </div>
              <hr class="my-3">
              <div class="small text-muted text-center">
                <b>Demo:</b> admin / Admin@123
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

const RegisterPage = {
  name: "RegisterPage",
  emits: ["login", "go-login"],
  data() {
    return {
      form: {
        username: "", email: "", password: "", name: "",
        gender: "", phone: "", blood_group: "", date_of_birth: "",
      },
      loading: false,
      error: "",
      step: 1,
    };
  },
  methods: {
    async submit() {
      if (!this.form.username || !this.form.email || !this.form.password || !this.form.name) {
        this.error = "Please fill in all required fields";
        return;
      }
      if (this.form.password.length < 6) {
        this.error = "Password must be at least 6 characters";
        return;
      }
      this.loading = true;
      this.error = "";
      try {
        const api = createApi(() => null);
        const res = await api.register(this.form);
        localStorage.setItem("hms_token", res.token);
        localStorage.setItem("hms_user", JSON.stringify(res.user));
        localStorage.setItem("hms_profile", JSON.stringify(res.profile));
        this.$emit("login", res);
      } catch (e) {
        this.error = e.error || "Registration failed";
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
    <div class="auth-wrapper">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-12 col-sm-11 col-md-8 col-lg-6">
            <div class="auth-card">
              <div class="text-center mb-4">
                <div class="auth-logo">🏥</div>
                <h2 class="mt-2">Create Account</h2>
                <p class="text-muted">Register as a patient</p>
              </div>
              <div v-if="error" class="alert alert-danger py-2 small"><i class="bi bi-exclamation-triangle me-2"></i>{{ error }}</div>
              <div class="row g-3">
                <div class="col-12">
                  <label class="form-label">Full Name <span class="text-danger">*</span></label>
                  <input v-model="form.name" type="text" class="form-control" placeholder="Your full name" required/>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Username <span class="text-danger">*</span></label>
                  <input v-model="form.username" type="text" class="form-control" placeholder="Choose username" required/>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Email <span class="text-danger">*</span></label>
                  <input v-model="form.email" type="email" class="form-control" placeholder="Your email" required/>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Password <span class="text-danger">*</span></label>
                  <input v-model="form.password" type="password" class="form-control" placeholder="Min 6 chars" required/>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Phone</label>
                  <input v-model="form.phone" type="tel" class="form-control" placeholder="Phone number"/>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Gender</label>
                  <select v-model="form.gender" class="form-select">
                    <option value="">Select</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Date of Birth</label>
                  <input v-model="form.date_of_birth" type="date" class="form-control"/>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Blood Group</label>
                  <select v-model="form.blood_group" class="form-select">
                    <option value="">Select</option>
                    <option v-for="bg in ['A+','A-','B+','B-','O+','O-','AB+','AB-']" :key="bg">{{ bg }}</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-primary w-100 py-2 mt-4 mb-3" @click="submit" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Registering…' : 'Create Account' }}
              </button>
              <div class="text-center auth-divider">
                Already have an account?
                <a href="#" class="text-primary fw-bold" @click.prevent="$emit('go-login')">Sign in</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
