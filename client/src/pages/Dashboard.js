import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [autoRescheduleMsg, setAutoRescheduleMsg] = useState("");

  useEffect(() => {
    api.get("/goals").then((res) => {
      setGoals(res.data);
      if (res.data.length > 0) setSelectedGoalId(res.data[0]._id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedGoalId) return;
    setAutoRescheduleMsg("");
    api.post(`/schedule/${selectedGoalId}/auto-reschedule`)
      .then((res) => {
        if (res.data.rescheduled) {
          setSchedule(res.data.schedule);
          setAutoRescheduleMsg("Some missed topics were automatically moved to upcoming days.");
        } else {
          api.get(`/schedule/${selectedGoalId}`).then((r) => setSchedule(r.data)).catch(() => {});
        }
      })
      .catch(() => {
        api.get(`/schedule/${selectedGoalId}`).then((r) => setSchedule(r.data)).catch(() => {});
      });
  }, [selectedGoalId]);

  const goal = goals.find((g) => g._id === selectedGoalId);

  const toggleTask = async (dayId, taskId, completed) => {
    const res = await api.patch(`/schedule/${selectedGoalId}/task`, { dayId, taskId, completed });
    setSchedule(res.data.schedule);
    const updatedDay = res.data.schedule.days.find((d) => d._id === dayId);
    if (updatedDay) setSelectedDay(updatedDay);
  };

  const daysLeft = goal?.examDate
    ? Math.max(0, Math.ceil((new Date(goal.examDate) - new Date()) / 86400000))
    : null;

  const { totalTasks, doneTasks, subjectData } = useMemo(() => {
    if (!schedule) return { totalTasks: 0, doneTasks: 0, subjectData: [] };
    let total = 0, done = 0;
    const subjMap = {};
    schedule.days.forEach((d) =>
      d.tasks.forEach((t) => {
        if (["Revision", "Buffer", "Rest", "Rescheduled"].includes(t.subject)) return;
        total++;
        if (t.completed) done++;
        if (!subjMap[t.subject]) subjMap[t.subject] = { subject: t.subject, done: 0, total: 0 };
        subjMap[t.subject].total++;
        if (t.completed) subjMap[t.subject].done++;
      })
    );
    return { totalTasks: total, doneTasks: done, subjectData: Object.values(subjMap) };
  }, [schedule]);

  const completionPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const pieData = [
    { name: "Done", value: doneTasks },
    { name: "Remaining", value: Math.max(0, totalTasks - doneTasks) },
  ];
  const PIE_COLORS = ["#2F6F5E", "#E3E6EC"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const scheduleByDate = useMemo(() => {
    const map = {};
    schedule?.days?.forEach((d) => { map[new Date(d.date).toDateString()] = d; });
    return map;
  }, [schedule]);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dowLabels = ["S", "M", "T", "W", "T", "F", "S"];

  if (goals.length === 0) {
    return (
      <div className="es-page" style={{ maxWidth: 520 }}>
        <span className="es-eyebrow">Dashboard</span>
        <h1 className="es-gradient-title" style={{ fontSize: 30, marginBottom: 20 }}>Welcome, {user?.name}</h1>
        <div className="es-card">
          <p className="es-muted">You haven't set up a goal yet.</p>
          <button className="es-btn es-btn--teal" style={{ marginTop: 12 }} onClick={() => navigate("/goalsetup")}>
            Set up your first goal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="es-page" style={{ maxWidth: 900 }}>
      <span className="es-eyebrow">Dashboard</span>
      <h1 className="es-gradient-title" style={{ fontSize: 30, marginBottom: 8 }}>Welcome, {user?.name}</h1>

      {autoRescheduleMsg && (
        <div className="es-alert es-alert--info" style={{ marginBottom: 16 }}>{autoRescheduleMsg}</div>
      )}

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
        <button onClick={() => navigate("/goals")} className="es-btn es-btn--outline"
          style={{ width: "auto", padding: "6px 16px", fontSize: 13 }}>
          Manage goals →
        </button>
      </div>

      <div className="es-stat-row">
        <div className="es-card">
          <span className="es-icon-chip es-icon-chip--coral" style={{ marginBottom: 10 }}>⏳</span>
          <span className="es-eyebrow">Countdown</span>
          <div className="es-stat-value">{daysLeft ?? "—"}</div>
          <p className="es-muted">days until {goal?.examName}</p>
        </div>

        <div className="es-card">
          <span className="es-icon-chip es-icon-chip--teal" style={{ marginBottom: 10 }}>📊</span>
          <span className="es-eyebrow">Overall progress</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 90, height: 90 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={28} outerRadius={40} startAngle={90} endAngle={-270}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="es-stat-value" style={{ fontSize: 24 }}>{completionPct}%</div>
              <p className="es-muted">{doneTasks}/{totalTasks} topics</p>
            </div>
          </div>
        </div>

        <div className="es-card es-clickable" onClick={() => navigate(`/goalsetup?edit=${selectedGoalId}`)}>
          <span className="es-icon-chip es-icon-chip--violet" style={{ marginBottom: 10 }}>🎯</span>
          <span className="es-eyebrow">Plan</span>
          <div className="es-stat-value" style={{ fontSize: 20 }}>Edit goal</div>
          <p className="es-muted">{goal?.subjects?.length || 0} subjects tracked</p>
        </div>
      </div>

      <div className="es-grid" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
        <div className="es-card">
          <div className="es-cal-header">
            <button className="es-cal-nav" onClick={() => setMonthOffset((m) => m - 1)}>‹</button>
            <h2 className="es-h2" style={{ margin: 0 }}>
              {baseDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h2>
            <button className="es-cal-nav" onClick={() => setMonthOffset((m) => m + 1)}>›</button>
          </div>

          <div className="es-cal-grid">
            {dowLabels.map((d, i) => <div key={i} className="es-cal-dow">{d}</div>)}
            {cells.map((dayNum, i) => {
              if (!dayNum) return <div key={i} className="es-cal-cell es-cal-cell--empty"></div>;
              const cellDate = new Date(year, month, dayNum);
              const dayEntry = scheduleByDate[cellDate.toDateString()];
              const isToday = cellDate.getTime() === today.getTime();
              return (
                <div
                  key={i}
                  className={`es-cal-cell ${isToday ? "es-cal-cell--today" : ""}`}
                  onClick={() => dayEntry && setSelectedDay(dayEntry)}
                  style={{ cursor: dayEntry ? "pointer" : "default", opacity: dayEntry ? 1 : 0.4 }}
                >
                  {dayNum}
                  {dayEntry && <span className={`es-cal-dot es-cal-dot--${dayEntry.dayStatus}`}></span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="es-card">
          <span className="es-icon-chip es-icon-chip--amber" style={{ marginBottom: 10 }}>📈</span>
          <span className="es-eyebrow">By subject</span>
          <h2 className="es-h2">Topics completed</h2>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={subjectData}>
                <XAxis dataKey="subject" fontSize={11} stroke="#8B8B8B" />
                <YAxis fontSize={11} stroke="#8B8B8B" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#E3E6EC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="done" fill="#2F6F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {selectedDay && (
        <div className="es-overlay" onClick={() => setSelectedDay(null)}>
          <div className="es-card es-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button className="es-overlay-close" onClick={() => setSelectedDay(null)}>✕</button>
            <span className="es-eyebrow">
              {new Date(selectedDay.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </span>
            <h2 className="es-h2">{selectedDay.isRevisionDay ? "Revision day" : "Today's tasks"}</h2>
            {selectedDay.tasks.map((task) => (
              <label key={task._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--paper-line)" }}>
                <input type="checkbox" checked={task.completed} onChange={(e) => toggleTask(selectedDay._id, task._id, e.target.checked)} />
                <span className="es-tag es-tag--teal">{task.subject}</span>
                <span style={{ textDecoration: task.completed ? "line-through" : "none", opacity: task.completed ? 0.6 : 1 }}>{task.topic}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;