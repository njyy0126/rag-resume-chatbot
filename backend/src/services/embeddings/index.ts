import { env } from "../../config/env";
import { embedTextsLocally } from "./localHashEmbeddingService";
import { embedTextsWithQwen } from "./qwenEmbeddingService";

export type EmbeddingResponse = {
  vectors: number[][];
  dimensions: number;
  provider: "qwen" | "local";
  model: string;
};

export const embedTexts = async (texts: string[]): Promise<EmbeddingResponse> => {
  if (env.EMBEDDING_PROVIDER === "local") {
    const { vectors, dimensions } = await embedTextsLocally(texts);
    return {
      vectors,
      dimensions,
      provider: "local",
      model: `local-hash-${dimensions}`,
    };
  }

  const { vectors, dimensions } = await embedTextsWithQwen(texts);
  return {
    vectors,
    dimensions,
    provider: "qwen",
    model: env.QWEN_EMBEDDING_MODEL,
  };
};
