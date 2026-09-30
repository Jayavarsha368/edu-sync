import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 370000, // Allows the local model five minutes, plus one bounded OpenAI attempt
});

// Attach the JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle global response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;