
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import User from "../src/models/user.model.js";
import dns from 'dns'

dns.setServers([
    '8.8.8.8',
    '1.1.1.1'
]);

const createAdmin = async () => {
    try {
        await connectDB();

        const name = process.env.ADMIN_NAME;
        const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
        const password = process.env.ADMIN_PASSWORD;

        if (!name || !email || !password) {
            throw new Error("ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required");
        }

        if (password.length < 12) {
            throw new Error("Admin password must be at least 12 characters");
        }

        const existingAdmin = await User.findOne({ email });

        if (existingAdmin) {
            if (existingAdmin.role === "admin") {
                console.log("Admin account already exists.");
                return;
            }

            throw new Error(
                "This email belongs to a non-admin user. Use a different email."
            );
        }

        const admin = await User.create({
            name,
            email,
            password,
            role: "admin",
            isActive: true,
        });

        console.log("Admin account created successfully.");
        console.log(`Admin email: ${admin.email}`);
    } catch (error) {
        console.error("Admin creation failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

createAdmin();
