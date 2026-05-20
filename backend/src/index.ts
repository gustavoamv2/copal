import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { startWorker } from "./workers/publication.worker";
import "./workers/social-publish.job";

import authRoutes from "./routes/auth.routes";
import oauthRoutes from "./routes/oauth.routes";
import postsRoutes from "./routes/posts.routes";
import mediaRoutes from "./routes/media.routes";
import publicationsRoutes from "./routes/publications.routes";
import accountsRoutes from "./routes/accounts.routes";
import settingsRoutes from "./routes/settings.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import socialRoutes from "./routes/social.routes";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

app.use(
  "/api/auth",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
);

app.use("/api/auth", authRoutes);
app.use("/api/oauth", oauthRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/publications", publicationsRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/social", socialRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  console.log(`[Server] Running on port ${config.PORT} (${config.NODE_ENV})`);
});

const worker = startWorker();
console.log("[Worker] BullMQ publication worker started");

const shutdown = async () => {
  console.log("[Shutdown] Gracefully shutting down...");
  await worker.close();
  server.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
