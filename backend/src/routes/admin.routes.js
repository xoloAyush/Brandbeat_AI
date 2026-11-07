
import express from "express";
import {
    protect,
    authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
    "/dashboard",
    protect,
    authorize("admin"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Welcome to the Brandbeat AI admin dashboard",
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
            },
        });
    }
);

export default router;
