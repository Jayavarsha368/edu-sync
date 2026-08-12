import { useEffect, useState } from "react";
import api from "../api/axios";

function Progress() {
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/goals").then((res) => {
      setGoals(res.data);
      if (res.data.length > 0) setSelectedGoalId(res.data[0]._id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGoalId) return;
    api.get(`/schedule/${selectedGoalId}`).then((res) => setSchedule(res.data)).catch(() => {});
  }, [selectedGoalId]);

  const goal = goals.find((g) => g._id === selectedGoalId);
  const tagColors = ["amber", "coral", "teal", "violet"];

  if (loading) return <div className="es-page">Loading...</div>;

  if (goals.length === 0) {
    return (
      <div className="es-page" style={{ maxWidth: 520 }}>
        <span className="es-eyebrow">Progress</span>
        <h1 className="es-gradient-title" style={{ fontSize: 28, marginBottom: 20 }}>Nothing to show yet</h1>
        <div className="es-card">
          <p className="es-muted">Set up a goal first, then your subject progress will appear here.</p>
        </div>
      </div>
    );
  }

  const daysLeft = goal
    ? Math.max(0, Math.ceil((new Date(goal.examDate) - new Date()) / 86400000))
    : null;

  return (
    <div className="es-page" style={{ maxWidth: 600 }}>
      <span className="es-eyebrow">Progress</span>
      <h1 className="es-gradient-title" style={{ fontSize: 28, marginBottom: 16 }}>
        {goal?.examName || "Progress"}
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {goals.map((g) => (
          <button
            key={g._id}
            onClick={() => setSelectedGoalId(g._id)}
            className="es-btn"
            style={{
              width: "auto", padding: "6px 16px", fontSize: 13,
              background: selectedGoalId === g._id ? "var(--ink-soft)" : "transparent",
              color: selectedGoalId === g._id ? "#fff" : "var(--ink-soft)",
              border: `1.5px solid ${selectedGoalId === g._id ? "var(--ink-soft)" : "var(--paper-line)"}`,
            }}
          >
            {g.examName}
          </button>
        ))}
      </div>

      <div className="es-card">
        <div className="es-icon-row">
          <span className="es-icon-chip es-icon-chip--coral">⏳</span>
          <div>
            <div style={{ fontSize: 12, color: "#8B8B8B" }}>Days remaining</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{daysLeft} days</div>
          </div>
        </div>

        <div className="es-icon-row">
          <span className="es-icon-chip es-icon-chip--amber">📅</span>
          <div>
            <div style={{ fontSize: 12, color: "#8B8B8B" }}>Exam date</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {goal ? new Date(goal.examDate).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="es-field-label-row">
            <span className="es-icon-chip es-icon-chip--violet" style={{ width: 24, height: 24, fontSize: 12 }}>📚</span>
            <span className="es-label" style={{ margin: 0 }}>Subjects</span>
          </div>
          {goal?.subjects?.length
            ? goal.subjects.map((s, i) => (
                <span key={s} className={`es-tag es-tag--${tagColors[i % 4]}`}>{s}</span>
              ))
            : <p className="es-muted">No subjects added yet.</p>}
        </div>

        <p className="es-muted" style={{ marginTop: 20, fontSize: 13 }}>
          Topic-by-topic completion is tracked live on the{" "}
          <a href={`/studyplan/${selectedGoalId}`} className="es-link">Study Plan</a> and Dashboard.
        </p>
      </div>
    </div>
  );
}

export default Progress;