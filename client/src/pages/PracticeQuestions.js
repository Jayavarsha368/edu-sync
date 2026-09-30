import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

const MARK_TYPES = [
  { key: "mcq", label: "MCQ" },
  { key: "1", label: "1 Mark" },
  { key: "2", label: "2 Marks" },
  { key: "7", label: "7 Marks" },
  { key: "14", label: "14 Marks" },
];

function PracticeQuestions() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [subject, setSubject] = useState("All");
  const [markType, setMarkType] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [pastSets, setPastSets] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [revealedAnswers, setRevealedAnswers] = useState({});

  useEffect(() => {
    api.get(`/goals/${goalId}`).then((res) => setGoal(res.data)).catch(() => {});
    loadPastSets();
  }, [goalId]);

  const loadPastSets = () => {
    api.get(`/questions/${goalId}`).then((res) => setPastSets(res.data)).catch(() => {});
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setActiveSet(null);
    setRevealedAnswers({});
    try {
      const res = await api.post(`/questions/${goalId}`, { subject, markType });
      setActiveSet(res.data.questionSet);
      loadPastSets();
    } catch (err) {
      const timedOut = err.code === "ECONNABORTED" || err.code === "ETIMEDOUT";
      setError(err.response?.data?.message || (timedOut
        ? "Question generation took too long. Check that Ollama is running and the configured model is available, then try again."
        : "Failed to generate questions."));
    } finally {
      setGenerating(false);
    }
  };

  const toggleAnswer = (idx) => {
    setRevealedAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleDeleteSet = async (setId) => {
    const confirmed = window.confirm("Delete this question set?");
    if (!confirmed) return;
    await api.delete(`/questions/${goalId}/${setId}`);
    if (activeSet?._id === setId) setActiveSet(null);
    loadPastSets();
  };

  const markLabel = (key) => MARK_TYPES.find((m) => m.key === key)?.label || key;

  return (
    <div className="es-page" style={{ maxWidth: 720 }}>
      <button onClick={() => navigate(`/studyplan/${goalId}`)} className="es-btn es-btn--outline"
        style={{ width: "auto", padding: "6px 14px", fontSize: 13, marginBottom: 20 }}>
        ← Back to Study Plan
      </button>

      <span className="es-eyebrow">Practice</span>
      <h1 className="es-gradient-title" style={{ fontSize: 28, marginBottom: 8 }}>
        {goal?.examName ? `Practice for ${goal.examName}` : "Practice Questions"}
      </h1>
      <p className="es-muted" style={{ marginBottom: 28 }}>
        Pick a question type — the AI generates questions and answers straight from your syllabus.
      </p>

      <div className="es-card" style={{ marginBottom: 24 }}>
        <div className="es-field">
          <label className="es-label">Subject</label>
          <select className="es-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="All">All subjects</option>
            {goal?.subjects?.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="es-field">
          <label className="es-label">Question type</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MARK_TYPES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMarkType(m.key)}
                className="es-btn"
                style={{
                  width: "auto", padding: "8px 16px", fontSize: 13,
                  background: markType === m.key ? "var(--ink-soft)" : "transparent",
                  color: markType === m.key ? "#fff" : "var(--ink-soft)",
                  border: `1.5px solid ${markType === m.key ? "var(--ink-soft)" : "var(--paper-line)"}`,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="es-alert es-alert--error">{error}</div>}

        <button className="es-btn es-btn--teal" disabled={generating} onClick={handleGenerate}>
          {generating ? "Generating with AI..." : `Generate ${markLabel(markType)} questions`}
        </button>
      </div>

      {activeSet && (
        <div className="es-card" style={{ marginBottom: 24 }}>
          <span className="es-eyebrow">{markLabel(activeSet.markType)} · {activeSet.subject}</span>
          <h2 className="es-h2" style={{ marginBottom: 16 }}>Generated Questions</h2>

          {activeSet.questions.map((q, idx) => (
            <div key={idx} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--paper-line)" }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{idx + 1}. {q.question}</p>

              {q.options && q.options.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {q.options.map((opt, i) => (
                    <p key={i} className="es-muted" style={{ margin: "4px 0" }}>
                      {String.fromCharCode(65 + i)}. {opt}
                    </p>
                  ))}
                </div>
              )}

              {revealedAnswers[idx] ? (
                <div style={{ background: "#F1EFE8", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
                  <strong>Answer:</strong> {q.answer}
                </div>
              ) : (
                <button
                  className="es-btn es-btn--outline"
                  style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
                  onClick={() => toggleAnswer(idx)}
                >
                  Show answer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pastSets.length > 0 && (
        <div>
          <span className="es-eyebrow">History</span>
          <h2 className="es-h2" style={{ marginBottom: 16 }}>Previously generated sets</h2>
          <div className="es-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {pastSets.map((set) => (
              <div key={set._id} className="es-card es-clickable" onClick={() => { setActiveSet(set); setRevealedAnswers({}); }}>
                <span className="es-icon-chip es-icon-chip--violet" style={{ marginBottom: 10 }}>📝</span>
                <span className="es-tag es-tag--teal">{markLabel(set.markType)}</span>
                <h2 className="es-h2" style={{ margin: "8px 0 4px" }}>{set.subject}</h2>
                <p className="es-muted" style={{ marginBottom: 10 }}>{set.questions.length} questions</p>
                <button
                  className="es-btn"
                  style={{ width: "auto", padding: "5px 12px", fontSize: 12, background: "transparent", border: "1.5px solid var(--coral)", color: "var(--coral)" }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteSet(set._id); }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticeQuestions;