
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
    register,
    login,
    getCurrentUser,
    logout,
} from "../../services/authService";

// Register
export const registerUser = createAsyncThunk(
    "auth/register",
    async (userData, thunkAPI) => {
        try {
            return await register(userData);
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Registration failed"
            );
        }
    }
);

// Login
export const loginUser = createAsyncThunk(
    "auth/login",
    async (credentials, thunkAPI) => {
        try {
            return await login(credentials);
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Login failed"
            );
        }
    }
);

// Restore session after page refresh
export const fetchCurrentUser = createAsyncThunk(
    "auth/me",
    async (_, thunkAPI) => {
        try {
            return await getCurrentUser();
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Session expired"
            );
        }
    }
);

// Logout
export const logoutUser = createAsyncThunk(
    "auth/logout",
    async (_, thunkAPI) => {
        try {
            await logout();
            return true;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Logout failed"
            );
        }
    }
);

const initialState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,

    reducers: {
        clearAuthError: (state) => {
            state.error = null;
        },
        clearAuth: (state) => {
            state.user = null;
            state.isAuthenticated = false;
        },
    },

    extraReducers: (builder) => {
        builder
            // Registration
            .addCase(registerUser.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })

            // Login
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })

            // Restore session
            .addCase(fetchCurrentUser.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchCurrentUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isInitialized = true;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(fetchCurrentUser.rejected, (state) => {
                state.isLoading = false;
                state.isInitialized = true;
                state.user = null;
                state.isAuthenticated = false;
            })

            // Logout
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.error = null;
            })
            .addCase(logoutUser.rejected, (state, action) => {
                // Clear local state even if the server request fails.
                state.user = null;
                state.isAuthenticated = false;
                state.error = action.payload;
            });
    },
});

export const { clearAuthError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
