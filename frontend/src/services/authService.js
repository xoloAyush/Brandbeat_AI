import api from "./api";

// Register
export const register = async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data.data.user;
};

// Login
export const login = async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data.data.user;
};

// Get current user
export const getCurrentUser = async () => {
    const response = await api.get("/auth/me");
    return response.data.data.user;
};

// Logout
export const logout = async () => {
    const response = await api.post("/auth/logout");
    return response.data;
};