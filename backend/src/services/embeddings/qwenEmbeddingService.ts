import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

type QwenEmbeddingResponse = {
  data?: Array<{
    embedding: number[];
    index: number;
  }>;
  usage?: {
    total_tokens?: number;
  };
};

const EMBEDDING_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings";

const ensureApiKey = (): string => {
  if (!env.DASHSCOPE_API_KEY) {
    throw new AppError("Missing DASHSCOPE_API_KEY for embedding generation.", 500);
  }
  return env.DASHSCOPE_API_KEY;
};

export const embedTextsWithQwen = async (
  texts: string[],
): Promise<{ vectors: number[][]; dimensions: number }> => {
  if (texts.length === 0) {
    throw new AppError("No text provided for embeddings.", 400);
  }

  const apiKey = ensureApiKey();
  const response = await fetch(EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.QWEN_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError(`Qwen embedding request failed: ${errorText}`, 502);
  }

  const payload = (await response.json()) as QwenEmbeddingResponse;
  const vectors = payload.data?.map((item) => item.embedding) ?? [];

  if (vectors.length !== texts.length) {
    throw new AppError("Embedding provider returned incomplete vectors.", 502);
  }

  const dimensions = vectors[0]?.length ?? 0;
  if (dimensions === 0) {
    throw new AppError("Embedding provider returned empty vectors.", 502);
  }

  return { vectors, dimensions };
};
