import crypto from "node:crypto";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { open, unlink } from "node:fs/promises";

const uploadDirectory = path.resolve("uploads/policies");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomUUID()}.pdf`;
        cb(null, uniqueName);
    },
});

const fileFilter = (req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExtension =
        path.extname(file.originalname).toLowerCase() === ".pdf";

    if (!isPdfMime || !isPdfExtension) {
        const error = new Error("Only PDF files are allowed");
        error.statusCode = 400;
        return cb(error);
    }

    cb(null, true);
};

const uploadPolicy = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 1,
    },
});



export const uploadPolicyMiddleware = uploadPolicy;


const reviewUploadDirectory = path.resolve("uploads/reviews");

fs.mkdirSync(reviewUploadDirectory, { recursive: true });

const reviewStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, reviewUploadDirectory);
    },

    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomUUID()}.pdf`;
        cb(null, uniqueName);
    },
});

const uploadReview = multer({
    storage: reviewStorage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 1,
    },
});

export const uploadReviewMiddleware = uploadReview;

export const verifyPdfSignature = async (req, res, next) => {
    if (!req.file) {
        return next();
    }

    let fileHandle;

    try {
        // Open the uploaded file
        fileHandle = await open(req.file.path, "r");

        // Read only the first 5 bytes
        const signature = Buffer.alloc(5);

        const { bytesRead } = await fileHandle.read(
            signature,
            0,
            5,
            0
        );

        await fileHandle.close();
        fileHandle = null;

        // Verify actual PDF signature
        if (
            bytesRead !== 5 ||
            signature.toString("ascii") !== "%PDF-"
        ) {
            await unlink(req.file.path).catch(() => { });

            const error = new Error(
                "Invalid PDF file. Please upload a genuine PDF."
            );

            error.status = 400;
            error.statusCode = 400;

            return next(error);
        }

        next();

    } catch (error) {
        if (fileHandle) {
            await fileHandle.close().catch(() => { });
        }

        if (req.file?.path) {
            await unlink(req.file.path).catch(() => { });
        }

        next(error);
    }
};