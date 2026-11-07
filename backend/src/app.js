import cors from "cors";
import express from "express";

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

const allowedOrigins = [
    "http://localhost:5173",
    "https://frontend-six-pied-92.vercel.app",
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
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
