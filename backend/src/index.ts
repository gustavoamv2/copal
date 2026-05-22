import "dotenv/config";
import app from "./app";
import { config } from "./config";
import { startDbScheduler } from "./workers/db-scheduler";

const server = app.listen(config.PORT, () => {
  console.log(`[Server] Running on port ${config.PORT} (${config.NODE_ENV})`);
});

const schedulerInterval = startDbScheduler();

const shutdown = () => {
  console.log("[Shutdown] Gracefully shutting down...");
  clearInterval(schedulerInterval);
  server.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
