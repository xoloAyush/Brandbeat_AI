
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export const generateAccessToken = (userId) => {
    return jwt.sign(
        { sub: userId.toString() },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: "15m" }
    );
};

export const generateRefreshToken = (userId) => {
    return jwt.sign(
        { sub: userId.toString() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );
};

export const hashToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
    const isProduction = process.env.NODE_ENV === "production";

    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
    };

    res.cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

export const clearAuthCookies = (res) => {
    const isProduction = process.env.NODE_ENV === "production";

    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
    };

    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
};
