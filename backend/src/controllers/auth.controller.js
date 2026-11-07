import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    setAuthCookies,
    clearAuthCookies,
} from "../utils/token.js";

// REGISTER
export const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        throw new ApiError(400, "Name, email and password are required");
    }

    if (password.length < 8) {
        throw new ApiError(400, "Password must contain at least 8 characters");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
        email: normalizedEmail,
    });

    if (existingUser) {
        throw new ApiError(409, "Email is already registered");
    }

    // Public registration always creates a reviewer.
    const user = await User.create({
        name,
        email: normalizedEmail,
        password,
        role: "reviewer",
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
        success: true,
        message: "Account created successfully",
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        },
    });
});

// LOGIN
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({
        email: email.trim().toLowerCase(),
    }).select("+password +refreshTokenHash");

    if (!user) {
        throw new ApiError(401, "Invalid email or password");
    }

    if (!user.isActive) {
        throw new ApiError(403, "Your account has been disabled");
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid email or password");
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        },
    });
});

// LOGOUT
export const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
        try {
            const decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET
            );

            await User.findByIdAndUpdate(decoded.sub, {
                $unset: { refreshTokenHash: 1 },
            });
        } catch {
            // Even an expired or invalid token should be cleared from the browser.
        }
    }

    clearAuthCookies(res);

    res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
});

// REFRESH ACCESS TOKEN
export const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        throw new ApiError(401, "Refresh token is required");
    }

    let decoded;

    try {
        decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );
    } catch {
        clearAuthCookies(res);
        throw new ApiError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(decoded.sub)
        .select("+refreshTokenHash");

    if (
        !user ||
        !user.isActive ||
        user.refreshTokenHash !== hashToken(refreshToken)
    ) {
        clearAuthCookies(res);
        throw new ApiError(401, "Refresh token is no longer valid");
    }

    // Rotate refresh token on every successful refresh.
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
    });
});

// CURRENT USER
export const getCurrentUser = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
            },
        },
    });
});
