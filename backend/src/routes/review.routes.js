
import express from "express";

import {
    createReview,
    getReviews,
    getReviewById,
    downloadReviewArtifact,
    updateFindingDecision,
    updateFinalReviewDecision,
} from "../controllers/review.controller.js";

import {
    uploadReviewMiddleware,
    verifyPdfSignature,
} from "../middleware/upload.middleware.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// All review routes require authentication.
router.use(protect);

router.post(
    "/",
    uploadReviewMiddleware.single("file"),
    verifyPdfSignature,
    createReview
);

router.get("/", getReviews);

router.get(
    "/:id/download/:artifact",
    downloadReviewArtifact
);

router.patch(
    "/:id/findings/:findingKey/decision",
    updateFindingDecision
);

router.patch(
    "/:id/final-decision",
    updateFinalReviewDecision
);

router.get("/:id", getReviewById);

export default router;
