
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";

import errorMiddleware from "./middleware/error.middleware.js";
import notFoundMiddleware from "./middleware/notFound.middleware.js";
import adminRoutes from "./routes/admin.routes.js";
import policyRoutes from "./routes/policy.routes.js";
import reviewRoutes from "./routes/review.routes.js";


const app = express();

app.use(helmet());

app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(morgan("dev"));

// Health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Brandbeat AI API is running",
    });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/policies", policyRoutes);
app.use("/api/v1/reviews", reviewRoutes);

app.get("/test-ai-service", async (req, res) => {
    try {
        const response = await fetch(
            `${process.env.AI_SERVICE_URL}/api/v1/health`
        );

        const data = await response.json();

        res.status(200).json({
            success: true,
            aiService: data,
        });

    } catch (error) {
        console.error("AI connection error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
            cause: error.cause?.message,
        });
    }
});

// Error handlers (keep these last)
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
