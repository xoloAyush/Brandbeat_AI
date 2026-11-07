
import mongoose from "mongoose";

const decisionHistorySchema = new mongoose.Schema(
    {
        previousDecision: {
            type: String,
            enum: ["pending", "approved", "rejected", "needs_changes"],
            required: true,
        },

        decision: {
            type: String,
            enum: ["pending", "approved", "rejected", "needs_changes"],
            required: true,
        },

        comment: {
            type: String,
            default: "",
        },

        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        reviewedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

const findingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
        },

        page: {
            type: Number,
            default: null,
        },

        text: {
            type: String,
            required: true,
        },

        phrase: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: [
                "COMPLIANT",
                "VIOLATION",
                "UNVERIFIED",
                "NEEDS_HUMAN_REVIEW",
            ],
            required: true,
        },

        category: {
            type: String,
            required: true,
        },

        findingType: {
            type: String,
            enum: ["statement", "document_requirement"],
            default: "statement",
        },

        severity: {
            type: String,
            enum: ["high", "medium", "low"],
            required: true,
        },

        reference: {
            type: String,
            default: "not specified",
        },

        why: {
            type: String,
            default: "",
        },

        suggestedFix: {
            type: String,
            default: "",
        },

        highlighted: {
            type: Boolean,
            default: false,
        },

        // Human review workflow
        reviewDecision: {
            type: String,
            enum: ["pending", "approved", "rejected", "needs_changes"],
            default: "pending",
        },

        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewerComment: {
            type: String,
            default: "",
        },

        decisionHistory: {
            type: [decisionHistorySchema],
            default: [],
        },
    },
    { _id: false }
);

const summarySchema = new mongoose.Schema(
    {
        overall_status: {
            type: String,
            enum: [
                "COMPLIANT",
                "NON_COMPLIANT",
                "NEEDS_REVIEW",
                "REVIEW_INCOMPLETE",
            ],
            required: true,
        },

        total_statements: {
            type: Number,
            default: 0,
        },

        total_findings: {
            type: Number,
            default: 0,
        },

        violations: {
            type: Number,
            default: 0,
        },

        unverified: {
            type: Number,
            default: 0,
        },

        needs_human_review: {
            type: Number,
            default: 0,
        },

        not_checked: {
            type: Number,
            default: 0,
        },
    },
    { _id: false }
);

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        originalName: {
            type: String,
            required: true,
        },

        fileName: {
            type: String,
            required: true,
        },

        filePath: {
            type: String,
            required: true,
        },

        fileSize: {
            type: Number,
            required: true,
        },

        policy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Policy",
            required: true,
        },

        policyName: {
            type: String,
            required: true,
        },

        policyVersion: {
            type: String,
            default: "",
        },

        pages: {
            type: Number,
            default: 0,
        },

        reused: {
            type: Number,
            default: 0,
        },

        newlyJudged: {
            type: Number,
            default: 0,
        },

        notChecked: {
            type: Number,
            default: 0,
        },

        docCheckFailed: {
            type: Boolean,
            default: false,
        },

        summary: {
            type: summarySchema,
            required: true,
        },

        findings: {
            type: [findingSchema],
            default: [],
        },

        downloads: {
            reviewedPdf: { type: String, default: null },
            json: { type: String, default: null },
            markdown: { type: String, default: null },
        },

        status: {
            type: String,
            enum: ["processing", "completed", "failed"],
            default: "processing",
        },
        finalReviewStatus: {
            type: String,
            enum: [
                "pending",
                "in_review",
                "changes_requested",
                "approved",
                "rejected"
            ],
            default: "pending"
        },

        finalReviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        finalReviewComment: {
            type: String,
            default: ""
        },

        finalReviewedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

reviewSchema.index({ user: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
