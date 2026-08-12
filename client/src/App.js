import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import PracticeQuestions from "./pages/PracticeQuestions";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import GoalSetup from "./pages/GoalSetup";
import Progress from "./pages/Progress";
import StudyPlan from "./pages/StudyPlan";
import MyGoals from "./pages/MyGoals";

function Shell() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/" || location.pathname === "/register";

  return (
    <div className={isAuthPage ? "" : "es-shell"}>
      {!isAuthPage && <Sidebar />}
      <div className={isAuthPage ? "" : "es-main"}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/goals" element={<ProtectedRoute><MyGoals /></ProtectedRoute>} />
          <Route path="/goalsetup" element={<ProtectedRoute><GoalSetup /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/studyplan/:goalId" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
          <Route path="/practice/:goalId" element={<ProtectedRoute><PracticeQuestions /></ProtectedRoute>} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;