import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "../config/env";
import path from "node:path";

let inMemoryServer: MongoMemoryServer | null = null;

export const connectMongo = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  let mongoUri = env.MONGODB_URI;
  if (env.USE_IN_MEMORY_MONGO) {
    // Keep binary cache in project directory to avoid permission issues.
    process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(process.cwd(), ".cache/mongodb-binaries");
    inMemoryServer = await MongoMemoryServer.create({
      binary: { version: "7.0.3" },
    });
    mongoUri = inMemoryServer.getUri("rag-career-assistant");
    console.log("Using in-memory MongoDB for local development.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected.");
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.connection.close();
  if (inMemoryServer) {
    await inMemoryServer.stop();
    inMemoryServer = null;
  }
};
