import app from "./app";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./db/connectMongo";

const startServer = async () => {
  await connectMongo();
  app.listen(env.PORT, () => {
    console.log(`Backend server listening on http://localhost:${env.PORT}`);
  });
};

void startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

const shutdown = async () => {
  await disconnectMongo();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
