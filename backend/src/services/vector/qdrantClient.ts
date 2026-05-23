import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../config/env";

let client: QdrantClient | null = null;
let cachedVectorSize: number | null = null;

const getClient = (): QdrantClient => {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    });
  }
  return client;
};

export const getQdrantCollectionName = (): string => env.QDRANT_COLLECTION;

export const ensureQdrantCollection = async (vectorSize: number): Promise<void> => {
  const qdrant = getClient();
  const collectionName = getQdrantCollectionName();

  if (cachedVectorSize && cachedVectorSize === vectorSize) {
    return;
  }

  try {
    const collection = await qdrant.getCollection(collectionName);
    const config = collection.config?.params?.vectors;
    if (!config || typeof config === "string") {
      throw new Error("Unsupported Qdrant vector config format.");
    }
    const currentSize = config.size;
    if (currentSize !== vectorSize) {
      throw new Error(
        `Qdrant collection dimension mismatch. Existing=${currentSize}, required=${vectorSize}.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("mismatch")) {
      throw error;
    }
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
  }

  cachedVectorSize = vectorSize;
};

export const getQdrantClient = (): QdrantClient => getClient();

export const resetQdrantCollectionCache = (): void => {
  cachedVectorSize = null;
};
