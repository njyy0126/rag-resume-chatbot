import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

const normalizeVector = (vector: number[]): number[] => {
  let squaredSum = 0;
  for (const value of vector) {
    squaredSum += value * value;
  }
  const norm = Math.sqrt(squaredSum);
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
};

const simpleHash = (token: string): number => {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const embedOne = (text: string, dimension: number): number[] => {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new AppError("Text has no valid tokens for local embeddings.", 400);
  }

  const vector = new Array<number>(dimension).fill(0);
  for (const token of tokens) {
    const hashed = simpleHash(token);
    const index = hashed % dimension;
    const sign = hashed % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return normalizeVector(vector);
};

export const embedTextsLocally = async (
  texts: string[],
): Promise<{ vectors: number[][]; dimensions: number }> => {
  if (texts.length === 0) {
    throw new AppError("No text provided for embeddings.", 400);
  }

  const dimensions = env.LOCAL_EMBEDDING_DIM;
  const vectors = texts.map((text) => embedOne(text, dimensions));
  return { vectors, dimensions };
};
