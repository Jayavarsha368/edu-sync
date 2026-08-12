import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import api from "../api/axios";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function GoalSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [formData, setFormData] = useState({
    examName: "", course: "", semester: "", startDate: "", examDate: "", dailyStudyHours: "",
    targetScore: "", subjects: "", syllabusText: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [fileLoading, setFileLoading] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (editId) {
      api.get(`/goals/${editId}`).then((res) => {
        setFormData({
          examName: res.data.examName || "",
          course: res.data.course || "",
          semester: res.data.semester || "",
          startDate: res.data.startDate?.slice(0, 10) || "",
          examDate: res.data.examDate?.slice(0, 10) || "",
          dailyStudyHours: res.data.dailyStudyHours || "",
          targetScore: res.data.targetScore || "",
          subjects: res.data.subjects?.join(", ") || "",
          syllabusText: res.data.syllabusText || "",
        });
      }).catch(() => setMessage("Couldn't load that goal for editing."));
    }
  }, [editId]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const extractFromImage = async (file) => {
    const result = await Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") setFileProgress(Math.round(m.progress * 100));
      },
    });
    return result.data.text;
  };

  const extractFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      setFileProgress(Math.round((i / pdf.numPages) * 100));
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((item) => item.str).join(" ") + "\n";
    }
    return fullText;
  };

  const extractFromText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setFileLoading(true);
    setFileProgress(0);
    setMessage("");

    try {
      let extractedText = "";
      if (file.type.startsWith("image/")) extractedText = await extractFromImage(file);
      else if (file.type === "application/pdf") extractedText = await extractFromPDF(file);
      else if (file.type === "text/plain") extractedText = await extractFromText(file);
      else {
        setMessage("Unsupported file type. Please upload an image, PDF, or .txt file.");
        setFileLoading(false);
        return;
      }

      setFormData((prev) => ({ ...prev, syllabusText: extractedText.trim() }));
      setMessage("Text extracted. Please format it as 'Subject (Weak/Medium/Strong): topic, topic' below before saving.");
    } catch (err) {
      setMessage("Couldn't read that file. Try a clearer image or a different file.");
    } finally {
      setFileLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        ...formData,
        subjects: formData.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      };

      if (editId) {
        await api.put(`/goals/${editId}`, payload);
        setMessage("Goal updated. Your study plan has been regenerated!");
        setTimeout(() => navigate(`/studyplan/${editId}`), 1200);
      } else {
        const res = await api.post("/goals", payload);
        setMessage("Goal saved. Your study plan has been generated!");
        setTimeout(() => navigate(`/studyplan/${res.data.goal._id}`), 1200);
      }
    } catch (err) {
      setMessage("Failed to save goal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="es-page" style={{ maxWidth: 560 }}>
      <span className="es-eyebrow">{editId ? "Edit goal" : "Plan it out"}</span>
      <h1 className="es-gradient-title" style={{ fontSize: 30, marginBottom: 24 }}>
        {editId ? "Edit your goal" : "New goal"}
      </h1>

      <div className="es-card">
        {message && <div className="es-alert es-alert--info">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="es-field">
            <div className="es-field-label-row">
              <span className="es-icon-chip es-icon-chip--violet" style={{ width: 24, height: 24, fontSize: 12 }}>🎯</span>
              <label className="es-label" style={{ margin: 0 }}>Exam name</label>
            </div>
            <input name="examName" className="es-input" placeholder="IAT 1 / IAT 2 / Semester Exam"
              value={formData.examName} onChange={handleChange} required />
          </div>

          <div className="es-row">
            <div className="es-field">
              <div className="es-field-label-row">
                <span className="es-icon-chip es-icon-chip--amber" style={{ width: 24, height: 24, fontSize: 12 }}>🎓</span>
                <label className="es-label" style={{ margin: 0 }}>Course</label>
              </div>
              <input name="course" className="es-input" placeholder="MCA"
                value={formData.course} onChange={handleChange} />
            </div>
            <div className="es-field">
              <div className="es-field-label-row">
                <span className="es-icon-chip es-icon-chip--teal" style={{ width: 24, height: 24, fontSize: 12 }}>📚</span>
                <label className="es-label" style={{ margin: 0 }}>Semester</label>
              </div>
              <input name="semester" className="es-input" placeholder="III"
                value={formData.semester} onChange={handleChange} />
            </div>
          </div>

          <div className="es-row">
            <div className="es-field">
              <div className="es-field-label-row">
                <span className="es-icon-chip es-icon-chip--coral" style={{ width: 24, height: 24, fontSize: 12 }}>📅</span>
                <label className="es-label" style={{ margin: 0 }}>Start date</label>
              </div>
              <input name="startDate" type="date" className="es-input"
                value={formData.startDate} onChange={handleChange} required />
            </div>
            <div className="es-field">
              <div className="es-field-label-row">
                <span className="es-icon-chip es-icon-chip--coral" style={{ width: 24, height: 24, fontSize: 12 }}>⏰</span>
                <label className="es-label" style={{ margin: 0 }}>Exam date</label>
              </div>
              <input name="examDate" type="date" className="es-input"
                value={formData.examDate} onChange={handleChange} required />
            </div>
          </div>

          <div className="es-row">
            <div className="es-field">
              <div className="es-field-label-row">
                <span className="es-icon-chip es-icon-chip--violet" style={{ width: 24, height: 24, fontSize: 12 }}>⏱️</span>
                <label className="es-label" style={{ margin: 0 }}>Daily study hours</label>
              </div>
              <input name="dailyStudyHours" type="number" className="es-input"
                value={formData.dailyStudyHours} onChange={handleChange} required />
            </div>
            <div className="es-field">
              <div className="es-field-label-row">
                <span className="es-icon-chip es-icon-chip--amber" style={{ width: 24, height: 24, fontSize: 12 }}>🏆</span>
                <label className="es-label" style={{ margin: 0 }}>Target score (%)</label>
              </div>
              <input name="targetScore" type="number" className="es-input"
                value={formData.targetScore} onChange={handleChange} />
            </div>
          </div>

          <div className="es-field">
            <div className="es-field-label-row">
              <span className="es-icon-chip es-icon-chip--teal" style={{ width: 24, height: 24, fontSize: 12 }}>📖</span>
              <label className="es-label" style={{ margin: 0 }}>Subjects (comma separated)</label>
            </div>
            <input name="subjects" className="es-input" placeholder="DSA, DBMS, OS, Java"
              value={formData.subjects} onChange={handleChange} />
          </div>

          <div className="es-field">
            <div className="es-field-label-row">
              <span className="es-icon-chip es-icon-chip--violet" style={{ width: 24, height: 24, fontSize: 12 }}>📤</span>
              <label className="es-label" style={{ margin: 0 }}>Upload syllabus (photo, PDF, or .txt)</label>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf,text/plain"
              onChange={handleFileUpload}
              className="es-input"
              style={{ padding: 8 }}
            />
            {fileName && <p className="es-muted" style={{ fontSize: 12, marginTop: 4 }}>{fileName}</p>}
            {fileLoading && (
              <p className="es-muted" style={{ fontSize: 12, color: "var(--teal)" }}>
                Reading file... {fileProgress}%
              </p>
            )}
          </div>

          <div className="es-field">
            <div className="es-field-label-row">
              <span className="es-icon-chip es-icon-chip--coral" style={{ width: 24, height: 24, fontSize: 12 }}>✍️</span>
              <label className="es-label" style={{ margin: 0 }}>Syllabus text (edit after upload if needed)</label>
            </div>
            <textarea
              name="syllabusText"
              className="es-input"
              rows={7}
              style={{ fontFamily: "var(--font-mono)", fontSize: 13, resize: "vertical" }}
              placeholder={"DSA (Weak): Arrays, Linked List, Stacks, Queues\nDBMS (Medium): ER Model, Normalization, SQL\nJava (Strong): OOP, Collections"}
              value={formData.syllabusText}
              onChange={handleChange}
            />
            <p className="es-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Format: <code>Subject (Weak/Medium/Strong): topic, topic</code> — one line per subject. This matters for how topics are scheduled.
            </p>
          </div>

          <button className="es-btn es-btn--teal" disabled={loading || fileLoading}>
            {loading ? "Saving..." : editId ? "Update goal & regenerate plan" : "Save goal & generate plan"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default GoalSetup;