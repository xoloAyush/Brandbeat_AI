
import fs from "node:fs/promises";
import { readFile } from "node:fs/promises";

import Policy from "../models/policy.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { unlink } from "node:fs/promises";

const extractPdfText = async (file) => {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
    const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN;

    if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
        throw new ApiError(
            503,
            "AI service URL or authentication token is not configured."
        );
    }

    const fileBuffer = await readFile(file.path);

    const formData = new FormData();

    formData.append(
        "file",
        new Blob([fileBuffer], {
            type: "application/pdf",
        }),
        file.originalname
    );

    console.log("AI URL:", AI_SERVICE_URL);
    console.log("Sending PDF to FastAPI...");

    let response;

    try {
        response = await fetch(
            `${AI_SERVICE_URL}/api/v1/documents/extract`,
            {
                method: "POST",
                headers: {
                    "X-Service-Token": AI_SERVICE_TOKEN,
                },
                body: formData,
                signal: AbortSignal.timeout(60000),
            }
        );
    } catch (error) {
        console.error("AI Service connection failed:", {
            message: error.message,
            cause: error.cause,
            url: `${AI_SERVICE_URL}/api/v1/documents/extract`,
        });

        throw new ApiError(
            503,
            "Could not connect to the AI service. Check whether FastAPI is running."
        );
    }

    console.log("FastAPI status:", response.status);

    const responseText = await response.text();

    console.log("FastAPI response:", responseText);

    let result = {};

    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new ApiError(
            502,
            "AI service returned an invalid response."
        );
    }

    if (!response.ok) {
        throw new ApiError(
            response.status,
            result.detail || "PDF extraction failed."
        );
    }

    return result;
};

const cleanupUploadedFile = async (filePath) => {
    if (!filePath) return;

    try {
        await unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("File cleanup failed:", error);
        }
    }
};

// UPLOAD POLICY
export const uploadPolicy = asyncHandler(async (req, res) => {
    try {
        console.log("\n========== POLICY UPLOAD STARTED ==========");

        console.log("User:", req.user?._id);
        console.log("Role:", req.user?.role);
        console.log("File:", req.file?.originalname);
        console.log("File path:", req.file?.path);

        const { title, description } = req.body;

        if (!title?.trim()) {
            throw new ApiError(400, "Policy title is required");
        }

        if (!description?.trim()) {
            throw new ApiError(400, "Policy description is required");
        }

        if (!req.file) {
            throw new ApiError(400, "Policy PDF file is required");
        }

        // STEP 1: Extract PDF text
        console.log("STEP 1: Extracting PDF text...");

        const extraction = await extractPdfText(req.file);

        console.log("Extraction successful");
        console.log("Pages:", extraction.totalPages);
        console.log("Extracted text length:", extraction.text?.length);

        // STEP 2: Save policy to MongoDB
        console.log("STEP 2: Saving policy to MongoDB...");

        const policy = await Policy.create({
            title: title.trim(),
            description: description.trim(),

            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,

            extractedText: extraction.text,
            totalPages: extraction.totalPages,
            extractionStatus: "completed",

            status: "archived",
            uploadedBy: req.user._id,
        });

        console.log("STEP 3: Policy saved successfully");
        console.log("Policy ID:", policy._id);

        return res.status(201).json({
            success: true,
            message: "Policy uploaded successfully",
            data: policy,
        });

    } catch (error) {
        console.error("\n========== POLICY UPLOAD ERROR ==========");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);

        await cleanupUploadedFile(req.file?.path);

        throw error;
    }
});

// GET ALL POLICIES
export const getPolicies = asyncHandler(async (req, res) => {
    const filter =
        req.user.role === "admin"
            ? {}
            : { status: "active" };

    const policies = await Policy.find(filter)
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        count: policies.length,
        data: {
            policies,
        },
    });
});

// GET SINGLE POLICY
export const getPolicyById = asyncHandler(async (req, res) => {
    const filter = {
        _id: req.params.id,
    };

    if (req.user.role !== "admin") {
        filter.status = "active";
    }

    const policy = await Policy.findOne(filter)
        .populate("uploadedBy", "name email");

    if (!policy) {
        throw new ApiError(404, "Policy not found.");
    }

    return res.status(200).json({
        success: true,
        data: { policy },
    });
});

// ACTIVATE POLICY

export const activatePolicy = asyncHandler(async (req, res) => {
    const policy = await Policy.findById(req.params.id);

    if (!policy) {
        throw new ApiError(404, "Policy not found.");
    }

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
    const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN;

    if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
        throw new ApiError(503, "AI service configuration is missing.");
    }

    // 1. Read the stored policy PDF.
    const fileBuffer = await fs.readFile(policy.filePath);

    // 2. Prepare multipart request.
    const formData = new FormData();

    formData.append(
        "file",
        new Blob([fileBuffer], { type: "application/pdf" }),
        policy.originalName
    );

    formData.append("policy_name", policy.title);

    // 3. Index the selected policy in Qdrant.
    let response;

    try {
        response = await fetch(
            `${AI_SERVICE_URL}/api/v1/policies/index`,
            {
                method: "POST",
                headers: {
                    "X-Service-Token": AI_SERVICE_TOKEN,
                },
                body: formData,
                signal: AbortSignal.timeout(300000),
            }
        );
    } catch (error) {
        throw new ApiError(
            503,
            `Could not connect to AI service: ${error.message}`
        );
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new ApiError(
            response.status,
            result.detail || "Policy indexing failed."
        );
    }

    // 4. Update MongoDB only after successful indexing.
    await Policy.updateMany(
        { status: "active" },
        { $set: { status: "archived" } }
    );

    policy.status = "active";
    policy.policyVersion = result.policy_version;
    await policy.save();

    return res.status(200).json({
        success: true,
        message: "Policy indexed and activated successfully.",
        data: {
            policy,
            indexing: result,
        },
    });
});

// DELETE SINGLE POLICY
export const deletePolicy = asyncHandler(async (req, res) => {
    const policy = await Policy.findById(req.params.id);

    if (!policy) {
        throw new ApiError(404, "Policy not found");
    }

    if (policy.status === "active") {
        throw new ApiError(
            409,
            "Deactivate or replace the active policy before deleting it."
        );
    }

    // Active policies can also be deleted.
    await fs.unlink(policy.filePath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
    });

    await policy.deleteOne();

    res.status(200).json({
        success: true,
        message: "Policy deleted successfully",
    });
});

// DELETE ALL POLICIES
export const deleteAllPolicies = asyncHandler(async (req, res) => {
    const policies = await Policy.find();

    if (policies.length === 0) {
        return res.status(200).json({
            success: true,
            message: "No policies found to delete",
            deletedCount: 0,
        });
    }

    // Delete associated PDF files.
    for (const policy of policies) {
        await fs.unlink(policy.filePath).catch((error) => {
            if (error.code !== "ENOENT") throw error;
        });
    }

    // Delete all policy records from MongoDB.
    const result = await Policy.deleteMany({});

    res.status(200).json({
        success: true,
        message: "All policies deleted successfully",
        deletedCount: result.deletedCount,
    });
});
