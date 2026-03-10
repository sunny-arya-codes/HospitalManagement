const { createApp, ref, computed, onMounted } = Vue;

const App = {
  components: {
    LoginPage, RegisterPage,
    AdminDashboard, AdminDoctors, AdminPatients, AdminAppointments, AdminSearch,
    DoctorDashboard, DoctorAppointments, DoctorPatients, DoctorAvailability, DoctorProfile,
    PatientDashboard, PatientDoctors, PatientAppointments, PatientHistory, PatientProfile,
    ChangePassword,
  },
  setup() {
    const user = ref(null);
    const profile = ref(null);
    const currentPage = ref("login");
    const toasts = ref([]);
    let toastId = 0;

    // ── Token management ──────────────────────────────────
    const getToken = () => localStorage.getItem("hms_token");
    const api = createApi(getToken);

    // ── Computed ───────────────────────────────────────────
    const isLoggedIn = computed(() => !!user.value);
    const userInitial = computed(() => getInitial(user.value?.username || "?"));

    // ── Toast notifications ───────────────────────────────
    const showToast = (message, type = "success") => {
      const icons = { success: "bi-check-circle-fill", danger: "bi-exclamation-triangle-fill", info: "bi-info-circle-fill", warning: "bi-exclamation-circle-fill" };
      const id = ++toastId;
      toasts.value.push({ id, message, type, icon: "bi " + (icons[type] || icons.success) });
      setTimeout(() => removeToast(id), 4000);
    };
    const removeToast = (id) => { toasts.value = toasts.value.filter(t => t.id !== id); };

    // ── Navigation ────────────────────────────────────────
    const navigate = (page) => { currentPage.value = page; window.scrollTo(0, 0); };

    // ── Auth ──────────────────────────────────────────────
    const onLogin = (res) => {
      user.value = res.user;
      profile.value = res.profile;
      const defaultPages = { admin: "admin-dashboard", doctor: "doctor-dashboard", patient: "patient-dashboard" };
      navigate(defaultPages[res.user.role] || "login");
      showToast(`Welcome back, ${res.user.username}!`);
    };

    const logout = () => {
      localStorage.removeItem("hms_token");
      localStorage.removeItem("hms_user");
      localStorage.removeItem("hms_profile");
      user.value = null;
      profile.value = null;
      navigate("login");
      showToast("Logged out successfully", "info");
    };

    // ── Restore session ───────────────────────────────────
    onMounted(async () => {
      const token = getToken();
      const savedUser = localStorage.getItem("hms_user");
      if (token && savedUser) {
        try {
          user.value = JSON.parse(savedUser);
          profile.value = JSON.parse(localStorage.getItem("hms_profile") || "null");
          // Verify token with server
          const res = await api.me();
          user.value = res.user;
          profile.value = res.profile;
          const defaultPages = { admin: "admin-dashboard", doctor: "doctor-dashboard", patient: "patient-dashboard" };
          navigate(defaultPages[user.value.role] || "login");
        } catch (e) {
          // Token expired or invalid
          logout();
        }
      }
    });

    return { user, profile, currentPage, isLoggedIn, userInitial, toasts, removeToast, navigate, onLogin, logout, api };
  },
};

createApp(App).mount("#app");
