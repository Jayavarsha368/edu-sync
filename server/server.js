const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/goals", require("./routes/goalRoutes"));
app.use("/api/schedule", require("./routes/scheduleRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));

app.get("/", (req, res) => {
  res.send("Edu-Sync Backend Running Successfully");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});