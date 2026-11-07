
import multer from "multer";

const errorMiddleware = (err, req, res, next) => {

    // Handle Multer errors first
    if (err instanceof multer.MulterError) {
        const multerMessages = {
            LIMIT_FILE_SIZE: "PDF file cannot exceed 20 MB.",
            LIMIT_FILE_COUNT: "Only one PDF file can be uploaded.",
            LIMIT_UNEXPECTED_FILE:
                "Unexpected file field. Use the field name 'policy'.",
        };

        return res.status(400).json({
            success: false,
            message: multerMessages[err.code] || err.message,
        });
    }

    // Handle other application errors
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
        ...(process.env.NODE_ENV === "development" && {
            stack: err.stack,
        }),
    });
};

export default errorMiddleware;
