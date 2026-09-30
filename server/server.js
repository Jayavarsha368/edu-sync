const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

// Connect to MongoDB
connectDB();

const app = express();

// CORS — allow the React dev server and the built app
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  ...(process.env.CLIENT_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean),
  ...(process.env.RENDER_EXTERNAL_HOSTNAME ? [`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin "${origin}" is not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/goals", require("./routes/goalRoutes"));
app.use("/api/schedule", require("./routes/scheduleRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Edu-Sync API is running" });
});

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.resolve(__dirname, "../client/build");
  app.use(express.static(clientBuildPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

// 404 handler — unknown API routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler — catches anything thrown inside route handlers
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Global Error]", err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal server error" });
});

// Unhandled promise rejections — log but don't crash the process in dev
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});