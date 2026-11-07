
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Verify user identity using access token
export const protect = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.accessToken;

    if (!token) {
        throw new ApiError(401, "Authentication required");
    }

    let decoded;

    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET
        );
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }

    // Ensure token contains a user ID
    if (!decoded.sub) {
        throw new ApiError(401, "Invalid access token payload");
    }

    // Fetch the latest user and role from MongoDB
    const user = await User.findById(decoded.sub);

    if (!user || !user.isActive) {
        throw new ApiError(401, "User not found or account disabled");
    }

    // Attach authenticated user to request
    req.user = user;

    next();
});

// Check whether authenticated user has required role
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(
                new ApiError(401, "Authentication required")
            );
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new ApiError(
                    403,
                    "You do not have permission to perform this action"
                )
            );
        }

        next();
    };
};
