import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

/**
 * Render the assistant's reply with basic markdown-like formatting.
 * Supports: **bold**, bullet lists (- or •), and line breaks.
 */
function formatAIReply(text) {
  const lines = text.split("\n");
  const elements = [];
  let keyIdx = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<br key={keyIdx++} />);
      return;
    }

    // Bullet line
    if (/^[-•*]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s/, "");
      elements.push(
        <div key={keyIdx++} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
          <span style={{ color: "var(--teal)", flexShrink: 0 }}>•</span>
          <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
        </div>
      );
    } else {
      elements.push(
        <p key={keyIdx++} style={{ margin: "2px 0" }}
          dangerouslySetInnerHTML={{ __html: boldify(trimmed) }}
        />
      );
    }
  });

  return elements;
}

function boldify(text) {
  // Replace **text** with <strong>text</strong>
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function ChatWidget({ goalId, onScheduleUpdate }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && goalId) {
      api.get(`/chat/${goalId}`)
        .then((res) => setMessages(res.data))
        .catch(() => {});
    }
  }, [open, goalId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Focus the input when the chat opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userContent = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userContent }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const res = await api.post(`/chat/${goalId}`, { message: userContent });
      const reply = typeof res.data?.reply === "string" ? res.data.reply.trim() : "";
      if (!reply) throw new Error("The assistant returned an empty reply.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (res.data.schedule && onScheduleUpdate) {
        onScheduleUpdate(res.data.schedule);
      }
    } catch (err) {
      const serverMessage = err.response?.data?.message;
      const errorText = serverMessage || "Sorry, I couldn't process that right now. Please try again.";
      setError(errorText);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorText, isError: true },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!goalId) return null;

  return (
    <>
      <button
        className="es-chat-toggle"
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close assistant" : "Open study assistant"}
        aria-label={open ? "Close assistant" : "Open study assistant"}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="es-chat-panel" role="dialog" aria-label="Study Assistant">
          <div className="es-chat-header">
            <span>🤖 Study Assistant</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="es-chat-messages">
            {messages.length === 0 && (
              <div style={{ fontSize: 12, color: "#8B8B8B", textAlign: "center", marginTop: 20, padding: "0 10px" }}>
                <p style={{ marginBottom: 8 }}>Hi! I'm your study assistant. Ask me to:</p>
                <p>📚 <strong>Explain a topic</strong> from your syllabus</p>
                <p>⚡ <strong>Lighten your workload</strong> ("I'm overwhelmed")</p>
                <p>✅ <strong>Mark a topic done</strong> ("I finished Arrays")</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`es-chat-bubble es-chat-bubble--${m.role}`}
                style={m.isError ? { background: "rgba(230,59,122,0.1)", color: "#A8225A" } : {}}
              >
                {m.role === "assistant" ? formatAIReply(m.content) : m.content}
              </div>
            ))}

            {sending && (
              <div className="es-chat-bubble es-chat-bubble--assistant">
                <span style={{ opacity: 0.6 }}>Thinking</span>
                <span style={{ opacity: 0.6, animation: "none" }}>...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="es-chat-input-row">
            <input
              ref={inputRef}
              className="es-chat-input"
              placeholder="Ask a question or type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              aria-label="Chat input"
            />
            <button
              className="es-chat-send"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;