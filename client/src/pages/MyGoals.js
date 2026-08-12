import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function MyGoals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadGoals = () => {
    api.get("/goals").then((res) => setGoals(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadGoals(); }, []);

  const handleDelete = async (id, examName, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete "${examName}"? This removes its goal and study plan entirely.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await api.delete(`/goals/${id}`);
      setGoals((prev) => prev.filter((g) => g._id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="es-page">Loading your goals...</div>;

  return (
    <div className="es-page" style={{ maxWidth: 800 }}>
      <span className="es-eyebrow">Your exams</span>
      <h1 className="es-gradient-title" style={{ fontSize: 30, marginBottom: 24 }}>My Goals</h1>

      <div className="es-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="es-card es-clickable" onClick={() => navigate("/goalsetup")}>
          <span className="es-icon-chip es-icon-chip--teal" style={{ marginBottom: 10 }}>➕</span>
          <h2 className="es-h2" style={{ marginBottom: 4 }}>Add a new goal</h2>
          <p className="es-muted">Set up a plan for another exam.</p>
        </div>

        {goals.map((goal) => {
          const daysLeft = Math.max(0, Math.ceil((new Date(goal.examDate) - new Date()) / 86400000));
          return (
            <div
              key={goal._id}
              className="es-card es-clickable"
              style={{ opacity: deletingId === goal._id ? 0.5 : 1 }}
              onClick={() => navigate(`/studyplan/${goal._id}`)}
            >
              <span className="es-icon-chip es-icon-chip--violet" style={{ marginBottom: 10 }}>🎯</span>
              <h2 className="es-h2" style={{ marginBottom: 4 }}>{goal.examName}</h2>
              <p className="es-muted">{daysLeft} days left · {goal.subjects?.length || 0} subjects</p>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  className="es-btn es-btn--outline"
                  style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/goalsetup?edit=${goal._id}`); }}
                >
                  Edit
                </button>
                <button
                  className="es-btn"
                  style={{ width: "auto", padding: "5px 12px", fontSize: 12, background: "transparent", border: "1.5px solid var(--coral)", color: "var(--coral)" }}
                  disabled={deletingId === goal._id}
                  onClick={(e) => handleDelete(goal._id, goal.examName, e)}
                >
                  {deletingId === goal._id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <p className="es-muted" style={{ marginTop: 20 }}>
          No goals yet — click "Add a new goal" to create your first study plan.
        </p>
      )}
    </div>
  );
}

export default MyGoals;