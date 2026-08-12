import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

function ChatWidget({ goalId, onScheduleUpdate }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && goalId) {
      api.get(`/chat/${goalId}`).then((res) => setMessages(res.data)).catch(() => {});
    }
  }, [open, goalId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await api.post(`/chat/${goalId}`, { message: userMsg.content });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      if (res.data.schedule && onScheduleUpdate) {
        onScheduleUpdate(res.data.schedule);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that right now." }]);
    } finally {
      setSending(false);
    }
  };

  if (!goalId) return null;

  return (
    <>
      <button className="es-chat-toggle" onClick={() => setOpen(!open)}>
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="es-chat-panel">
          <div className="es-chat-header">
            <span>Study Assistant</span>
          </div>

          <div className="es-chat-messages">
            {messages.length === 0 && (
              <p style={{ fontSize: 12, color: "#8B8B8B", textAlign: "center", marginTop: 20 }}>
                Ask me to lighten your workload, mark a topic done, or anything else about your plan.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`es-chat-bubble es-chat-bubble--${m.role}`}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="es-chat-bubble es-chat-bubble--assistant">Thinking...</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="es-chat-input-row">
            <input
              className="es-chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={sending}
            />
            <button className="es-chat-send" onClick={sendMessage} disabled={sending}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;