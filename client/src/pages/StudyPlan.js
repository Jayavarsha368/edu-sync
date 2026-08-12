import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import ChatWidget from "../components/ChatWidget";

function StudyPlan() {
  const navigate = useNavigate();
  const { goalId } = useParams();
  const [schedule, setSchedule] = useState(null);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebrateDayId, setCelebrateDayId] = useState(null);
  const [reallocatingDayId, setReallocatingDayId] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [confirmDay, setConfirmDay] = useState(null);
  const [completingDayId, setCompletingDayId] = useState(null);

  const loadSchedule = () => {
    setLoading(true);
    api.get(`/schedule/${goalId}`).then((res) => setSchedule(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    setSelectedSubject(null);
    loadSchedule();
    api.get(`/goals/${goalId}`).then((res) => setGoal(res.data)).catch(() => {});
  }, [goalId]);

  const toggleTask = async (dayId, taskId, completed) => {
    const res = await api.patch(`/schedule/${goalId}/task`, { dayId, taskId, completed });
    setSchedule(res.data.schedule);
  };

  const handleReallocate = async (dayId) => {
    setReallocatingDayId(dayId);
    try {
      const res = await api.post(`/schedule/${goalId}/reallocate`, { dayId });
      setSchedule(res.data.schedule);
    } finally {
      setReallocatingDayId(null);
    }
  };

  const handleMarkDayClick = (day, visibleTasks) => {
    const pending = visibleTasks.filter((t) => !t.completed);
    if (pending.length === 0) {
      confirmCompleteDay(day._id, []);
    } else {
      setConfirmDay({ ...day, _pendingScoped: pending });
    }
  };

  const confirmCompleteDay = async (dayId, taskIdsToMove) => {
    setCompletingDayId(dayId);
    try {
      const res = await api.post(`/schedule/${goalId}/complete-day`, {
        dayId,
        taskIds: taskIdsToMove && taskIdsToMove.length ? taskIdsToMove : undefined,
      });
      setSchedule(res.data.schedule);
      if (res.data.movedCount === 0) {
        setCelebrateDayId(dayId);
        setTimeout(() => setCelebrateDayId(null), 2200);
      }
    } finally {
      setCompletingDayId(null);
      setConfirmDay(null);
    }
  };

  const handleDeleteSubject = async (subject, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Remove this subject from this plan?`);
    if (!confirmed) return;

    setDeletingSubject(subject);
    try {
      const res = await api.delete(`/goals/${goalId}/subject`, { data: { subject } });
      setSchedule(res.data.schedule);
    } finally {
      setDeletingSubject(null);
    }
  };

  const handleEditSubject = (e) => {
    e.stopPropagation();
    navigate(`/goalsetup?edit=${goalId}`);
  };

  const tagColors = ["amber", "coral", "teal", "violet"];

  const displayNameFor = (rawSubject) => {
    if (!rawSubject) return "General";
    const trimmed = rawSubject.trim();
    if (trimmed.length <= 28) return trimmed;
    return goal?.course ? `${goal.course} Syllabus` : trimmed.slice(0, 25) + "...";
  };

  const subjectStats = useMemo(() => {
    if (!schedule) return [];
    const map = {};
    schedule.days.forEach((d) =>
      d.tasks.forEach((t) => {
        if (["Revision", "Buffer", "Rest", "Rescheduled"].includes(t.subject)) return;
        if (!map[t.subject]) map[t.subject] = { total: 0, done: 0 };
        map[t.subject].total++;
        if (t.completed) map[t.subject].done++;
      })
    );
    return Object.entries(map).map(([subject, stats], i) => ({
      subject, displayName: displayNameFor(subject), ...stats, color: tagColors[i % 4],
    }));
  }, [schedule, goal]);

  if (loading) return <div className="es-page">Loading your plan...</div>;

  if (!schedule || !schedule.days?.length) {
    return (
      <div className="es-page" style={{ maxWidth: 520 }}>
        <button onClick={() => navigate("/goals")} className="es-btn es-btn--outline"
          style={{ width: "auto", padding: "6px 14px", fontSize: 13, marginBottom: 20 }}>
          ← My Goals
        </button>
        <span className="es-eyebrow">Study plan</span>
        <h1 className="es-gradient-title" style={{ fontSize: 28, marginBottom: 20 }}>No plan found</h1>
        <div className="es-card"><p className="es-muted">This goal doesn't have a plan yet.</p></div>
      </div>
    );
  }

  if (!selectedSubject) {
    return (
      <div className="es-page" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button onClick={() => navigate("/goals")} className="es-btn es-btn--outline"
            style={{ width: "auto", padding: "6px 14px", fontSize: 13 }}>
            ← My Goals
          </button>
          <button onClick={() => navigate(`/practice/${goalId}`)} className="es-btn es-btn--outline"
            style={{ width: "auto", padding: "6px 14px", fontSize: 13 }}>
            📝 Practice Questions
          </button>
        </div>

        <span className="es-eyebrow">Your plan</span>
        <h1 className="es-gradient-title" style={{ fontSize: 28, marginBottom: 8 }}>Which subject?</h1>
        <p className="es-muted" style={{ marginBottom: 28 }}>
          Pick a subject to see its day-by-day plan, edit it, or remove it.
        </p>

        <div className="es-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="es-card es-clickable" onClick={() => setSelectedSubject("All")}>
            <span className="es-icon-chip es-icon-chip--violet" style={{ marginBottom: 10 }}>📋</span>
            <span className="es-eyebrow">Everything</span>
            <h2 className="es-h2" style={{ marginBottom: 4 }}>All subjects</h2>
            <p className="es-muted">See the full combined timetable.</p>
          </div>

          {subjectStats.map((s) => (
            <div
              key={s.subject}
              className="es-card es-clickable"
              onClick={() => setSelectedSubject(s.subject)}
              style={{ opacity: deletingSubject === s.subject ? 0.5 : 1 }}
            >
              <span className={`es-icon-chip es-icon-chip--${s.color}`} style={{ marginBottom: 10 }}>📖</span>
              <span className={`es-tag es-tag--${s.color}`}>{s.displayName}</span>
              <h2 className="es-h2" style={{ margin: "8px 0 4px" }}>{s.done}/{s.total} done</h2>
              <p className="es-muted" style={{ marginBottom: 14 }}>View {s.displayName}'s plan →</p>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleEditSubject} className="es-btn es-btn--outline"
                  style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}>Edit</button>
                <button
                  onClick={(e) => handleDeleteSubject(s.subject, e)}
                  disabled={deletingSubject === s.subject}
                  className="es-btn"
                  style={{ width: "auto", padding: "5px 12px", fontSize: 12, background: "transparent", border: "1.5px solid var(--coral)", color: "var(--coral)" }}
                >
                  {deletingSubject === s.subject ? "Removing..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const subjectColor = {};
  let colorIdx = 0;
  schedule.days.forEach((d) =>
    d.tasks.forEach((t) => {
      if (!subjectColor[t.subject]) { subjectColor[t.subject] = tagColors[colorIdx % 4]; colorIdx++; }
    })
  );

  const visibleDays = schedule.days
    .map((day) => {
      if (selectedSubject === "All") return { ...day, _visibleTasks: day.tasks };
      const filteredTasks = day.tasks.filter(
        (t) => t.subject === selectedSubject || (day.isRevisionDay && t.subject === "Revision")
      );
      return { ...day, _visibleTasks: filteredTasks };
    })
    .filter((day) => day._visibleTasks.length > 0);

  return (
    <div className="es-page" style={{ maxWidth: 720 }}>
      <button onClick={() => setSelectedSubject(null)} className="es-btn es-btn--outline"
        style={{ width: "auto", padding: "6px 14px", fontSize: 13, marginBottom: 20 }}>
        ← Choose a different subject
      </button>

      <span className="es-eyebrow">Your plan</span>
      <h1 className="es-gradient-title" style={{ fontSize: 28, marginBottom: 28 }}>
        {selectedSubject === "All" ? "All subjects" : displayNameFor(selectedSubject)}
      </h1>

      {visibleDays.length === 0 && (
        <div className="es-card"><p className="es-muted">No tasks for this subject.</p></div>
      )}

      {visibleDays.map((day) => {
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);
        const isToday = dayDate.getTime() === today.getTime();
        const visibleTasks = day._visibleTasks;
        const allDone = visibleTasks.every((t) => t.completed);

        return (
          <div key={day._id} className="es-card"
            style={{ marginBottom: 20, border: isToday ? "2px solid var(--teal)" : undefined }}>
            {celebrateDayId === day._id && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center",
                justifyContent: "center", background: "rgba(255,255,255,0.97)", zIndex: 5,
                borderRadius: 14, flexDirection: "column",
              }}>
                <span style={{ fontSize: 40 }}>🎉</span>
                <h2 className="es-h2" style={{ color: "var(--teal)" }}>Completed Successfully!</h2>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span className="es-eyebrow">{day.isRevisionDay ? "Revision day" : isToday ? "Today" : ""}</span>
                <h2 className="es-h2" style={{ margin: 0 }}>
                  {dayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </h2>
              </div>
              {allDone && <span style={{ color: "var(--teal)", fontWeight: 600 }}>✓ Done</span>}
            </div>

            <div>
              {visibleTasks.map((task) => (
                <label key={task._id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  borderBottom: "1px solid var(--paper-line)", cursor: "pointer",
                }}>
                  <input type="checkbox" checked={task.completed}
                    onChange={(e) => toggleTask(day._id, task._id, e.target.checked)} />
                  <span className={`es-tag es-tag--${subjectColor[task.subject] || "teal"}`}>
                    {displayNameFor(task.subject)}
                  </span>
                  <span style={{ textDecoration: task.completed ? "line-through" : "none", opacity: task.completed ? 0.6 : 1 }}>
                    {task.topic}
                  </span>
                </label>
              ))}
            </div>

            {!day.isRevisionDay && !allDone && (
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="es-btn es-btn--teal" style={{ width: "auto", padding: "8px 16px" }}
                  disabled={completingDayId === day._id} onClick={() => handleMarkDayClick(day, visibleTasks)}>
                  {completingDayId === day._id ? "Saving..." : "Mark day as done for today"}
                </button>

                {selectedSubject === "All" && (
                  <button className="es-btn es-btn--outline" style={{ width: "auto", padding: "8px 16px" }}
                    disabled={reallocatingDayId === day._id} onClick={() => handleReallocate(day._id)}>
                    {reallocatingDayId === day._id ? "Rescheduling..." : "Spread pending topics across future days"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {confirmDay && (
        <div className="es-overlay" onClick={() => setConfirmDay(null)}>
          <div className="es-card es-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button className="es-overlay-close" onClick={() => setConfirmDay(null)}>✕</button>
            <span className="es-eyebrow">Confirm</span>
            <h2 className="es-h2">Not everything is checked off</h2>
            <p className="es-muted" style={{ marginBottom: 16 }}>
              These topics are still unfinished for{" "}
              {new Date(confirmDay.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}:
            </p>
            <div style={{ marginBottom: 20 }}>
              {confirmDay._pendingScoped?.map((t) => (
                <div key={t._id} className="es-icon-row">
                  <span className="es-icon-chip es-icon-chip--coral">📖</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{displayNameFor(t.subject)}</div>
                    <div className="es-muted" style={{ fontSize: 13 }}>{t.topic}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="es-muted" style={{ marginBottom: 16, fontSize: 13 }}>
              These will be moved to the next study day.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="es-btn es-btn--teal" disabled={completingDayId === confirmDay._id}
                onClick={() => confirmCompleteDay(confirmDay._id, confirmDay._pendingScoped.map((t) => t._id))}>
                {completingDayId === confirmDay._id ? "Moving..." : "Yes, move to tomorrow"}
              </button>
              <button className="es-btn es-btn--outline" onClick={() => setConfirmDay(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <ChatWidget goalId={goalId} onScheduleUpdate={setSchedule} />
    </div>
  );
}

export default StudyPlan;