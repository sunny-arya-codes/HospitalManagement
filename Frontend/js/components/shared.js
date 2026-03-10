// ─── Shared Components ───────────────────────────────────────────────

const ChangePassword = {
  name: "ChangePassword",
  props: ["api"],
  data() { return { form: { old_password:"", new_password:"", confirm_password:"" }, saving: false, msg: "", error: "" }; },
  methods: {
    async save() {
      if (this.form.new_password !== this.form.confirm_password) { this.error = "Passwords do not match"; return; }
      if (this.form.new_password.length < 6) { this.error = "Password must be at least 6 characters"; return; }
      this.saving = true; this.error = ""; this.msg = "";
      try {
        await this.api.changePassword({ old_password: this.form.old_password, new_password: this.form.new_password });
        this.msg = "Password updated successfully!";
        this.form = { old_password:"", new_password:"", confirm_password:"" };
      } catch(e) { this.error = e.error || "Failed"; }
      finally { this.saving = false; }
    },
  },
  template: `
    <div>
      <div class="page-header"><h2><i class="bi bi-key me-2"></i>Change Password</h2></div>
      <div class="row justify-content-center">
        <div class="col-md-5">
          <div class="hms-card p-4">
            <div v-if="msg" class="alert alert-success py-2 small mb-3"><i class="bi bi-check-circle me-2"></i>{{ msg }}</div>
            <div v-if="error" class="alert alert-danger py-2 small mb-3"><i class="bi bi-exclamation-triangle me-2"></i>{{ error }}</div>
            <div class="mb-3"><label class="form-label">Current Password</label><input v-model="form.old_password" type="password" class="form-control"/></div>
            <div class="mb-3"><label class="form-label">New Password</label><input v-model="form.new_password" type="password" class="form-control"/></div>
            <div class="mb-4"><label class="form-label">Confirm New Password</label><input v-model="form.confirm_password" type="password" class="form-control"/></div>
            <button class="btn btn-primary w-100" @click="save" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
