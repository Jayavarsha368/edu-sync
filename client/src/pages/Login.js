import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Login() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(formData);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="es-auth-page">
      <div className="es-card es-auth-card es-card--tilt-l">
        <div className="es-pin"></div>
        <span className="es-eyebrow">Welcome back</span>
        <h1 className="es-h1">Sign in</h1>
        <p className="es-muted" style={{ marginBottom: 20 }}>
          Pick up your study plan where you left off.
        </p>

        {error && <div className="es-alert es-alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="es-field">
            <label className="es-label">Email</label>
            <input name="email" type="email" className="es-input"
              placeholder="you@college.edu" onChange={handleChange} required />
          </div>
          <div className="es-field">
            <label className="es-label">Password</label>
            <input name="password" type="password" className="es-input"
              placeholder="••••••••" onChange={handleChange} required />
          </div>
          <button className="es-btn es-btn--primary">Sign in</button>
        </form>

        <p className="es-muted" style={{ marginTop: 18, textAlign: "center" }}>
          New here? <Link to="/register" className="es-link">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;