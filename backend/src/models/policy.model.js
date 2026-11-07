
import mongoose from "mongoose";

const policySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
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

        mimeType: {
            type: String,
            required: true,
            enum: ["application/pdf"],
        },

        fileSize: {
            type: Number,
            required: true,
        },

        status: {
            type: String,
            enum: ["active", "archived"],
            default: "archived",
        },

        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        extractedText: {
            type: String,
            default: "",
        },

        totalPages: {
            type: Number,
            default: 0,
        },

        extractionStatus: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "pending",
        },
        policyVersion: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

const Policy = mongoose.model("Policy", policySchema);

export default Policy;
