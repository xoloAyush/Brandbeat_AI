
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import mongoose from "mongoose";

import Review from "../models/review.model.js";
import Policy from "../models/policy.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generatePdfReport } from "../utils/generatePdfReport.js";

const getAIConfig = () => ({
    url: process.env.AI_SERVICE_URL?.trim().replace(/\/$/, ""),
    token: process.env.AI_SERVICE_TOKEN?.trim(),
});


// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

// Delete uploaded file if review creation fails.
const cleanupUploadedFile = async (filePath) => {
    if (!filePath) return;

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Review file cleanup failed:", error);
        }
    }
};


// Build review access filter.
//
// Admin: can access all company reviews.
// Reviewer: can access only their own reviews.
const getReviewAccessFilter = (user, reviewId) => {
    const filter = {
        _id: reviewId,
    };

    if (user.role !== "admin") {
        filter.user = user._id;
    }

    return filter;
};

// Search multiple possible local filesystem paths for review PDF.
const findLocalPdf = async (review) => {
    const candidates = [];

    if (review.filePath) {
        candidates.push(
            review.filePath,
            path.resolve(review.filePath),
            path.resolve(process.cwd(), review.filePath),
            path.resolve(process.cwd(), "backend", review.filePath)
        );
        const base = path.basename(review.filePath);
        candidates.push(
            path.resolve(process.cwd(), "backend/uploads/reviews", base),
            path.resolve(process.cwd(), "uploads/reviews", base)
        );
    }

    if (review.fileName) {
        candidates.push(
            path.resolve(process.cwd(), "backend/uploads/reviews", review.fileName),
            path.resolve(process.cwd(), "uploads/reviews", review.fileName),
            path.resolve(process.cwd(), "../backend/uploads/reviews", review.fileName)
        );
    }

    if (review.aiReviewId) {
        const aiDir = path.resolve(process.cwd(), "brandbeat-ai-service/storage/reviews");
        const aiDirParent = path.resolve(process.cwd(), "../brandbeat-ai-service/storage/reviews");
        for (const dir of [aiDir, aiDirParent]) {
            candidates.push(path.resolve(dir, `${review.aiReviewId}.pdf`));
            try {
                const files = await fs.readdir(dir);
                for (const f of files) {
                    if (f.startsWith(review.aiReviewId) && f.endsWith(".pdf")) {
                        candidates.push(path.resolve(dir, f));
                    }
                }
            } catch {
                // directory not found
            }
        }
    }

    for (const p of candidates) {
        if (!p) continue;
        try {
            await fs.access(p);
            return p;
        } catch {
            // continue checking
        }
    }

    return null;
};


// --------------------------------------------------
// AI SERVICE INTEGRATION
// --------------------------------------------------



const callAIReview = async (file, userName) => {
    const { url, token } = getAIConfig();

    if (!url || !token) {
        throw new ApiError(
            503,
            "AI service configuration is missing."
        );
    }

    // 1. Read uploaded PDF
    const fileBuffer = await fs.readFile(file.path);

    // 2. Create multipart form data
    const formData = new FormData();

    formData.append(
        "file",
        new Blob([fileBuffer], {
            type: "application/pdf",
        }),
        file.originalname
    );

    formData.append("user_name", userName);

    // 3. Send request to FastAPI
    console.time("AI REVIEW REQUEST");

    try {
        const response = await fetch(
            `${url}/api/v1/reviews`,
            {
                method: "POST",
                headers: {
                    "X-Service-Token": token,
                },
                body: formData,
                signal: AbortSignal.timeout(300000),
            }
        );

        console.timeEnd("AI REVIEW REQUEST");

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new ApiError(
                response.status,
                result.detail || "AI compliance review failed."
            );
        }

        return result;

    } catch (error) {
        console.error("AI service request failed:", error);
        throw error;
    }
};




// --------------------------------------------------
// CREATE REVIEW
// POST /api/v1/reviews
// --------------------------------------------------

export const createReview = asyncHandler(async (req, res) => {
    let savedReview;

    try {
        if (!req.file) {
            throw new ApiError(
                400,
                "Please upload a PDF document."
            );
        }

        const { policyId } = req.body;

        if (
            !policyId ||
            !mongoose.Types.ObjectId.isValid(policyId)
        ) {
            throw new ApiError(
                400,
                "A valid policy ID is required."
            );
        }

        const policy = await Policy.findOne({
            _id: policyId,
            status: "active",
        });

        if (!policy) {
            throw new ApiError(
                404,
                "Selected active policy was not found."
            );
        }

        const userName =
            req.user.name ||
            req.user.email ||
            "staff";

        // Send uploaded PDF to FastAPI.
        const aiResult = await callAIReview(
            req.file,
            userName
        );

        if (!aiResult.review_id || !aiResult.summary) {
            throw new ApiError(
                502,
                "AI service returned an incomplete review response."
            );
        }

        // Verify MongoDB policy version against AI service version.
        if (
            policy.policyVersion &&
            policy.policyVersion !== aiResult.policy_version
        ) {
            throw new ApiError(
                409,
                "Active policy version does not match the AI engine. Please reactivate the policy."
            );
        }

        // Save review in MongoDB.
        savedReview = await Review.create({
            user: req.user._id,

            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,

            policy: policy._id,
            policyName: aiResult.policy || policy.title,
            policyVersion: aiResult.policy_version,
            aiReviewId: aiResult.review_id || "",

            pages: aiResult.pages || 0,
            reused: aiResult.reused || 0,
            newlyJudged: aiResult.newly_judged || 0,
            notChecked: aiResult.not_checked || 0,
            docCheckFailed: aiResult.doc_check_failed || false,

            summary: aiResult.summary,

            findings: (aiResult.findings || []).map((finding) => ({
                key: finding.key,
                page: finding.page,
                text: finding.text,
                phrase: finding.phrase,
                status: finding.status,
                category: finding.category,
                findingType: finding.finding_type,
                severity: finding.severity,
                reference: finding.reference,
                why: finding.why,
                suggestedFix: finding.suggested_fix,
                highlighted: finding.highlighted || false,
            })),

            downloads: {
                reviewedPdf:
                    aiResult.downloads?.reviewed_pdf ||
                    (aiResult.review_id
                        ? `/api/v1/reviews/${aiResult.review_id}/download/reviewed_pdf`
                        : null),
                json:
                    aiResult.downloads?.json ||
                    (aiResult.review_id
                        ? `/api/v1/reviews/${aiResult.review_id}/download/json`
                        : null),
                markdown:
                    aiResult.downloads?.markdown ||
                    (aiResult.review_id
                        ? `/api/v1/reviews/${aiResult.review_id}/download/markdown`
                        : null),
            },

            status: "completed",
        });

        return res.status(201).json({
            success: true,
            message: "Compliance review completed successfully.",
            data: {
                reviewId: savedReview._id,
                review: savedReview,
            },
        });

    } catch (error) {
        // Remove uploaded file if MongoDB review was not saved.
        if (!savedReview) {
            await cleanupUploadedFile(req.file?.path);
        }

        throw error;
    }
});


// --------------------------------------------------
// GET ALL REVIEWS
// GET /api/v1/reviews
// --------------------------------------------------

export const getReviews = asyncHandler(async (req, res) => {

    // Admin sees all company reviews.
    // Reviewer sees only their own reviews.
    const filter =
        req.user.role === "admin"
            ? {}
            : { user: req.user._id };

    const reviews = await Review.find(filter)
        .select("-findings")
        .populate("policy", "title status")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: reviews.length,
        data: {
            reviews,
        },
    });
});


// --------------------------------------------------
// GET REVIEW BY ID
// GET /api/v1/reviews/:id
// --------------------------------------------------

export const getReviewById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
            400,
            "Invalid review ID."
        );
    }

    // Admin can access all reviews.
    // Reviewer can access only their own reviews.
    const review = await Review.findOne(
        getReviewAccessFilter(req.user, id)
    )
        .populate("policy", "title status")
        .populate("findings.reviewer", "name email")
        .populate(
            "findings.decisionHistory.reviewer",
            "name email"
        );

    if (!review) {
        throw new ApiError(
            404,
            "Review not found."
        );
    }

    res.status(200).json({
        success: true,
        data: {
            review,
        },
    });
});


// --------------------------------------------------
// UPDATE FINDING DECISION
// PATCH /api/v1/reviews/:id/findings/:findingKey/decision
// --------------------------------------------------

export const updateFindingDecision = asyncHandler(
    async (req, res) => {

        const { id, findingKey } = req.params;
        const { decision, comment = "" } = req.body;

        // Validate review ID.
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(
                400,
                "Invalid review ID."
            );
        }

        // Validate decision.
        const allowedDecisions = [
            "pending",
            "approved",
            "rejected",
            "needs_changes",
        ];

        if (!allowedDecisions.includes(decision)) {
            throw new ApiError(
                400,
                "Invalid review decision."
            );
        }

        // Validate comment.
        if (typeof comment !== "string") {
            throw new ApiError(
                400,
                "Comment must be a string."
            );
        }

        if (comment.length > 2000) {
            throw new ApiError(
                400,
                "Comment cannot exceed 2000 characters."
            );
        }

        if (
            decision === "needs_changes" &&
            !comment.trim()
        ) {
            throw new ApiError(
                400,
                "A comment is required when requesting changes."
            );
        }

        // Admin can update any company review.
        // Reviewer can update only their own review.
        const review = await Review.findOne(
            getReviewAccessFilter(req.user, id)
        );

        if (!review) {
            throw new ApiError(
                404,
                "Review not found."
            );
        }

        // Find the specific AI finding using its stable key.
        const finding = review.findings.find(
            (item) => item.key === findingKey
        );

        if (!finding) {
            throw new ApiError(
                404,
                "Finding not found."
            );
        }

        const previousDecision =
            finding.reviewDecision || "pending";

        const normalizedComment = comment.trim();

        // Record decision history.
        finding.decisionHistory.push({
            previousDecision,
            decision,
            comment: normalizedComment,
            reviewer: req.user._id,
            reviewedAt: new Date(),
        });

        // Update current human review state.
        finding.reviewDecision = decision;
        finding.reviewer = req.user._id;
        finding.reviewerComment = normalizedComment;

        await review.save();

        // Populate reviewer information for response.
        await review.populate([
            {
                path: "findings.reviewer",
                select: "name email",
            },
            {
                path: "findings.decisionHistory.reviewer",
                select: "name email",
            },
        ]);

        const updatedFinding = review.findings.find(
            (item) => item.key === findingKey
        );

        return res.status(200).json({
            success: true,
            message: "Finding decision updated successfully.",
            data: {
                reviewId: review._id,
                finding: updatedFinding,
            },
        });
    }
);


// --------------------------------------------------
// DOWNLOAD REVIEW ARTIFACT
// GET /api/v1/reviews/:id/download/:artifact
// --------------------------------------------------

export const downloadReviewArtifact = asyncHandler(
    async (req, res) => {
        const { id, artifact } = req.params;

        const artifactFields = {
            reviewed_pdf: "reviewedPdf",
            json: "json",
            markdown: "markdown",
        };

        const field = artifactFields[artifact];

        if (!field) {
            throw new ApiError(
                400,
                "Unsupported download artifact."
            );
        }

        // Support matching either MongoDB ObjectId or 32-hex AI review ID
        let queryFilter;
        if (mongoose.Types.ObjectId.isValid(id)) {
            queryFilter = { _id: id };
        } else if (typeof id === "string" && /^[a-f0-9]{32}$/i.test(id)) {
            queryFilter = {
                $or: [
                    { aiReviewId: id },
                    { "downloads.json": { $regex: id } },
                    { "downloads.reviewedPdf": { $regex: id } },
                    { "downloads.markdown": { $regex: id } },
                ],
            };
        } else {
            throw new ApiError(
                400,
                "Invalid review ID."
            );
        }

        if (req.user.role !== "admin") {
            queryFilter.user = req.user._id;
        }

        const review = await Review.findOne(queryFilter);

        if (!review) {
            throw new ApiError(
                404,
                "Review not found."
            );
        }

        const extensions = {
            reviewed_pdf: "pdf",
            json: "json",
            markdown: "md",
        };

        const contentTypes = {
            reviewed_pdf: "application/pdf",
            json: "application/json",
            markdown: "text/markdown; charset=utf-8",
        };

        const safeBaseName = path
            .parse(review.originalName || "compliance_review")
            .name
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        const filename = `${safeBaseName}_review.${extensions[artifact]}`;

        // 1. Try to fetch from AI service if artifactPath and AI service are configured
        const { url, token } = getAIConfig();
        const artifactPath =
            review.downloads?.[field] ||
            (review.aiReviewId
                ? `/api/v1/reviews/${review.aiReviewId}/download/${artifact}`
                : null);

        if (url && token && artifactPath) {
            try {
                const response = await fetch(`${url}${artifactPath}`, {
                    headers: {
                        "X-Service-Token": token,
                    },
                    signal: AbortSignal.timeout(15000),
                });

                if (response.ok && response.body) {
                    res.setHeader("Content-Type", contentTypes[artifact]);
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"`
                    );
                    await pipeline(Readable.fromWeb(response.body), res);
                    return;
                }
            } catch (err) {
                console.warn(
                    `AI service download failed (${artifactPath}): ${err.message}. Using fallback generator.`
                );
            }
        }

        // 2. Reliable fallbacks when AI service artifact is unavailable (404, missing file, or network issue)
        if (artifact === "json") {
            const reportData = {
                reviewId: review._id,
                aiReviewId: review.aiReviewId || null,
                originalName: review.originalName,
                policy: review.policyName,
                policyVersion: review.policyVersion,
                pages: review.pages || 0,
                statements: review.summary?.total_statements || 0,
                reused: review.reused || 0,
                newly_judged: review.newlyJudged || 0,
                not_checked: review.notChecked || 0,
                doc_check_failed: review.docCheckFailed || false,
                summary: review.summary,
                findings: review.findings || [],
                finalReviewStatus: review.finalReviewStatus,
                finalReviewComment: review.finalReviewComment,
                finalReviewedAt: review.finalReviewedAt,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
            };

            res.setHeader("Content-Type", "application/json");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );
            return res.status(200).send(JSON.stringify(reportData, null, 2));
        }

        if (artifact === "markdown") {
            let md = `# Compliance Report: ${review.originalName}\n\n`;
            md += `Policy: \`${review.policyName}\` (version ${review.policyVersion || "unknown"})\n`;
            md += `Pages: ${review.pages || 0}\n`;
            md += `Overall Status: ${review.summary?.overall_status || "UNKNOWN"}\n`;
            md += `Total Findings: ${review.summary?.total_findings || review.findings?.length || 0}\n`;
            md += `Violations: ${review.summary?.violations || 0}\n`;
            md += `Unverified: ${review.summary?.unverified || 0}\n`;
            md += `Needs Human Review: ${review.summary?.needs_human_review || 0}\n\n`;

            if (review.finalReviewStatus && review.finalReviewStatus !== "pending") {
                md += `## Final Document Decision: ${review.finalReviewStatus.toUpperCase()}\n`;
                if (review.finalReviewComment) {
                    md += `Comment: ${review.finalReviewComment}\n`;
                }
                md += `\n`;
            }

            md += `## Findings\n\n`;
            (review.findings || []).forEach((f, idx) => {
                const pageStr =
                    f.page !== null && f.page !== undefined
                        ? `page ${f.page + 1}`
                        : "whole document";
                md += `### ${idx + 1}. [${(f.severity || "medium").toUpperCase()}] ${f.status || "FLAGGED"} - ${f.category || "General"} (${pageStr})\n`;
                md += `- **Flagged:** ${f.text || ""}\n`;
                md += `- **Policy:** ${f.reference || "N/A"}\n`;
                md += `- **Why:** ${f.why || ""}\n`;
                md += `- **Fix:** ${f.suggestedFix || ""}\n`;
                if (f.reviewDecision && f.reviewDecision !== "pending") {
                    md += `- **Human Review Decision:** ${f.reviewDecision.toUpperCase()}${f.reviewerComment ? ` (${f.reviewerComment})` : ""}\n`;
                }
                md += `\n`;
            });

            res.setHeader("Content-Type", "text/markdown; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );
            return res.status(200).send(md);
        }

        if (artifact === "reviewed_pdf") {
            const localPdfPath = await findLocalPdf(review);

            if (localPdfPath) {
                try {
                    const pdfBuffer = await fs.readFile(localPdfPath);
                    res.setHeader("Content-Type", "application/pdf");
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"`
                    );
                    return res.status(200).send(pdfBuffer);
                } catch (err) {
                    console.warn(
                        `Reading local PDF failed (${localPdfPath}):`,
                        err.message
                    );
                }
            }

            // Fallback: Generate full PDF compliance report dynamically
            const generatedPdfBuffer = generatePdfReport(review);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );
            return res.status(200).send(generatedPdfBuffer);
        }
    }
);

// --------------------------------------------------
// UPDATE FINAL REVIEW DECISION
// PATCH /api/v1/reviews/:id/final-decision
// --------------------------------------------------

export const updateFinalReviewDecision = asyncHandler(
    async (req, res) => {
        const { id } = req.params;
        const { decision, comment = "" } = req.body;

        // 1. Only admins can make final decisions.
        if (req.user.role !== "admin") {
            throw new ApiError(
                403,
                "Only admins can make the final review decision."
            );
        }

        // 2. Validate review ID.
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, "Invalid review ID.");
        }

        // 3. Validate decision.
        const allowedDecisions = [
            "approved",
            "rejected",
            "changes_requested",
        ];

        if (!allowedDecisions.includes(decision)) {
            throw new ApiError(400, "Invalid final review decision.");
        }

        // 4. Validate comment.
        if (typeof comment !== "string" || comment.length > 2000) {
            throw new ApiError(
                400,
                "Comment must be a string of at most 2000 characters."
            );
        }

        const normalizedComment = comment.trim();

        if (
            ["rejected", "changes_requested"].includes(decision) &&
            !normalizedComment
        ) {
            throw new ApiError(
                400,
                "A comment is required when rejecting a document or requesting changes."
            );
        }

        // 5. Find the review.
        const review = await Review.findById(id);

        if (!review) {
            throw new ApiError(404, "Review not found.");
        }

        if (review.status !== "completed") {
            throw new ApiError(
                400,
                "Only completed reviews can receive a final decision."
            );
        }

        // 6. Before approval, ensure every finding has been reviewed.
        if (decision === "approved") {
            const pendingFindings = review.findings.filter(
                (finding) =>
                    finding.reviewDecision === "pending" ||
                    finding.reviewDecision === "needs_changes"
            );

            if (pendingFindings.length > 0) {
                throw new ApiError(
                    400,
                    `Cannot approve this document. ${pendingFindings.length} finding(s) are still pending or require changes.`
                );
            }
        }

        // 7. Save the final decision.
        review.finalReviewStatus = decision;
        review.finalReviewer = req.user._id;
        review.finalReviewComment = normalizedComment;
        review.finalReviewedAt = new Date();

        await review.save();

        // 8. Populate admin information.
        await review.populate(
            "finalReviewer",
            "name email"
        );

        return res.status(200).json({
            success: true,
            message: "Final review decision saved successfully.",
            data: {
                reviewId: review._id,
                finalReviewStatus: review.finalReviewStatus,
                finalReviewComment: review.finalReviewComment,
                finalReviewer: review.finalReviewer,
                finalReviewedAt: review.finalReviewedAt,
            },
        });
    }
);
