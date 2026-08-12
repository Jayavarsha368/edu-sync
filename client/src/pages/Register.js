import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Register() {
  const { register } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(formData);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="es-auth-page">
      <div className="es-card es-auth-card es-card--tilt-r">
        <div className="es-pin"></div>
        <span className="es-eyebrow">Start your plan</span>
        <h1 className="es-h1">Create account</h1>
        <p className="es-muted" style={{ marginBottom: 20 }}>
          Tell us a little about you first.
        </p>

        {error && <div className="es-alert es-alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="es-field">
            <label className="es-label">Full name</label>
            <input name="name" className="es-input" placeholder="Jayavarsha"
              onChange={handleChange} required />
          </div>
          <div className="es-field">
            <label className="es-label">Email</label>
            <input name="email" type="email" className="es-input"
              placeholder="you@college.edu" onChange={handleChange} required />
          </div>
          <div className="es-field">
            <label className="es-label">Password</label>
            <input name="password" type="password" className="es-input"
              placeholder="At least 6 characters" onChange={handleChange} required minLength={6} />
          </div>
          <button className="es-btn es-btn--primary">Create account</button>
        </form>

        <p className="es-muted" style={{ marginTop: 18, textAlign: "center" }}>
          Already registered? <Link to="/" className="es-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;