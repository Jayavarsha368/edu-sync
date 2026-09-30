import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

function Profile() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [goal, setGoal] = useState(null);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadProfile = () => {
    api.get("/auth/profile")
      .then((res) => {
        setProfile(res.data);
        setName(res.data.name);
      })
      .catch(() => setError("Failed to load profile"));
  };

  useEffect(() => {
    loadProfile();
    api.get("/goals").then((res) => {
      // /goals returns an array sorted by examDate; pick the first one for display
      if (Array.isArray(res.data) && res.data.length > 0) {
        setGoal(res.data[0]);
      }
    }).catch(() => {});
  }, []);

  const startEditing = () => {
    setName(profile.name);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFormError("");
    setSuccessMsg("");
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");

    if (newPassword && newPassword !== confirmPassword) {
      setFormError("New passwords don't match.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setFormError("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await api.put("/auth/profile", payload);

      const updatedUser = { ...user, name: res.data.user.name };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      if (setUser) setUser(updatedUser);

      setProfile((prev) => ({ ...prev, name: res.data.user.name }));
      setSuccessMsg("Profile updated successfully.");
      setEditing(false);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="es-page"><div className="es-alert es-alert--error">{error}</div></div>;
  if (!profile) return <div className="es-page">Loading...</div>;

  const rows = [
    { label: "Full name", value: profile.name, icon: "👤", color: "violet" },
    { label: "Email", value: profile.email, icon: "✉️", color: "violet", valueClass: "es-profile-value--email" },
    { label: "Course", value: goal?.course || "Not set yet", icon: "🎓", color: "amber", dim: !goal?.course },
    { label: "Semester", value: goal?.semester || "Not set yet", icon: "📚", color: "teal", dim: !goal?.semester },
    { label: "Joined", value: new Date(profile.createdAt).toLocaleDateString(), icon: "📅", color: "coral", valueClass: "es-profile-value--date" },
  ];

  return (
    <div className="es-page" style={{ maxWidth: 520 }}>
      <span className="es-eyebrow">Student profile</span>
      <h1 className="es-profile-name">{profile.name}</h1>

      {successMsg && !editing && <div className="es-alert es-alert--info">{successMsg}</div>}

      {!editing ? (
        <div className="es-card">
          {rows.map((row) => (
            <div key={row.label} className="es-profile-row">
              <span className="es-profile-label">
                <span className={`es-profile-icon es-profile-icon--${row.color}`}>{row.icon}</span>
                {row.label}
              </span>
              <span className={`es-profile-value ${row.dim ? "es-profile-value--dim" : row.valueClass || ""}`}>
                {row.value}
              </span>
            </div>
          ))}

          <button className="es-btn es-btn--outline" style={{ marginTop: 20 }} onClick={startEditing}>
            Edit profile
          </button>
        </div>
      ) : (
        <div className="es-card">
          <h2 className="es-h2">Edit profile</h2>

          {formError && <div className="es-alert es-alert--error">{formError}</div>}

          <form onSubmit={handleSave}>
            <div className="es-field">
              <label className="es-label">Full name</label>
              <input className="es-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="es-field">
              <label className="es-label">Email</label>
              <input className="es-input" value={profile.email} disabled style={{ background: "#EFEBDD", color: "#8A8368" }} />
              <p className="es-muted" style={{ fontSize: 12, marginTop: 4 }}>Email can't be changed.</p>
            </div>

            <p className="es-label" style={{ marginTop: 20, marginBottom: 10 }}>Change password (optional)</p>

            <div className="es-field">
              <label className="es-label">Current password</label>
              <input type="password" className="es-input" placeholder="Required only if setting a new password"
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>

            <div className="es-row">
              <div className="es-field">
                <label className="es-label">New password</label>
                <input type="password" className="es-input" placeholder="Leave blank to keep current"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="es-field">
                <label className="es-label">Confirm new password</label>
                <input type="password" className="es-input"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className="es-btn es-btn--teal" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                className="es-btn es-btn--outline"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Profile;