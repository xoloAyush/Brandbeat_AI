import express from "express";

import {
    uploadPolicy,
    getPolicies,
    getPolicyById,
    activatePolicy,
    deletePolicy,
    deleteAllPolicies,
} from "../controllers/policy.controller.js";

import {
    uploadPolicyMiddleware,
    verifyPdfSignature,
} from "../middleware/upload.middleware.js";

import {
    protect,
    authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Authentication required for every endpoint.
router.use(protect);

// Both Admin and Reviewer can view policies.
router.get("/", getPolicies);
router.get("/:id", getPolicyById);

// Only Admin can manage policies.
router.post(
    "/",
    authorize("admin"),
    uploadPolicyMiddleware.single("policy"),
    verifyPdfSignature,
    uploadPolicy
);

router.patch(
    "/:id/activate",
    authorize("admin"),
    activatePolicy
);

router.delete(
    "/",
    authorize("admin"),
    deleteAllPolicies
);

router.delete(
    "/:id",
    authorize("admin"),
    deletePolicy
);

export default router;