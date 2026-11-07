
import "dotenv/config";

import dns from "node:dns";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";

const PORT = process.env.PORT || 5000;

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Brandbeat AI server running on port ${PORT}`);

            console.log("AI Configuration:", {
                urlConfigured: !!process.env.AI_SERVICE_URL,
                tokenConfigured: !!process.env.AI_SERVICE_TOKEN,
            });
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
