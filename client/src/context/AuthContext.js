import { createContext, useState, useContext, useEffect } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // true until we verify the stored token
  const navigate = useNavigate();

  // On first mount: restore the user from localStorage and verify the token is still valid
  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (stored && token) {
      setUser(JSON.parse(stored));
      // Silently verify the token against the server
      api.get("/auth/profile")
        .then((res) => {
          // Keep the user in sync with what the server says
          const fresh = {
            id: res.data._id,
            name: res.data.name,
            email: res.data.email,
            course: res.data.course,
            semester: res.data.semester,
          };
          setUser(fresh);
          localStorage.setItem("user", JSON.stringify(fresh));
        })
        .catch(() => {
          // Token is invalid/expired — the axios interceptor already cleared storage
          setUser(null);
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  const register = async (formData) => {
    const res = await api.post("/auth/register", formData);
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    navigate("/dashboard");
  };

  const login = async (formData) => {
    const res = await api.post("/auth/login", formData);
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    navigate("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, register, login, logout, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}