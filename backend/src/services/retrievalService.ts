import { z } from "zod";
import { Types } from "mongoose";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { embedTexts } from "./embeddings";
import { getQdrantClient, getQdrantCollectionName } from "./vector/qdrantClient";
import { VectorIndexModel } from "../models/VectorIndex";
import { TextChunkModel } from "../models/TextChunk";
import { IngestedFileModel } from "../models/IngestedFile";

const retrievalSchema = z.object({
  query: z.string().trim().min(2, "query must be at least 2 characters."),
  topK: z.coerce.number().int().positive().max(20).default(5),
  fileId: z.string().trim().optional(),
  fileIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export type RetrievalInput = z.input<typeof retrievalSchema>;
export type RetrievedChunk = {
  score: number;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
};

export const normalizeTargetFileIds = (input: {
  fileId?: string;
  fileIds?: string[];
}): string[] => {
  const fromArray = (input.fileIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  if (input.fileId?.trim()) {
    return [input.fileId.trim()];
  }
  return [];
};

export const buildQdrantFileFilter = (targetFileIds: string[]) => {
  if (targetFileIds.length === 1) {
    return {
      must: [{ key: "fileId", match: { value: targetFileIds[0] } }],
    };
  }
  if (targetFileIds.length > 1) {
    return {
      should: targetFileIds.map((id) => ({
        key: "fileId",
        match: { value: id },
      })),
    };
  }
  return undefined;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const retrieveFromMongoVectors = async (parsed: z.infer<typeof retrievalSchema>, query: number[]) => {
  const targetFileIds = normalizeTargetFileIds(parsed);

  const filter: { fileId?: Types.ObjectId | { $in: Types.ObjectId[] } } = {};
  if (targetFileIds.length === 1) {
    filter.fileId = new Types.ObjectId(targetFileIds[0]);
  } else if (targetFileIds.length > 1) {
    filter.fileId = { $in: targetFileIds.map((id) => new Types.ObjectId(id)) };
  }

  const records = await VectorIndexModel.find({
    ...filter,
    vectorDb: "mongo",
  }).select("fileId chunkId chunkIndex vectorValues");

  if (records.length === 0) {
    return [];
  }

  const scored = records
    .map((record) => ({
      record,
      score: cosineSimilarity(record.vectorValues ?? [], query),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, parsed.topK);

  const chunkIds = scored.map((item) => item.record.chunkId);
  const fileIds = scored.map((item) => item.record.fileId);

  const [chunks, files] = await Promise.all([
    TextChunkModel.find({ _id: { $in: chunkIds } }).select("_id content"),
    IngestedFileModel.find({ _id: { $in: fileIds } }).select("_id originalName"),
  ]);

  const chunkMap = new Map(chunks.map((chunk) => [chunk._id.toString(), chunk]));
  const fileMap = new Map(files.map((file) => [file._id.toString(), file]));

  return scored.map((item) => {
    const chunk = chunkMap.get(item.record.chunkId.toString());
    const file = fileMap.get(item.record.fileId.toString());
    return {
      score: item.score,
      fileId: item.record.fileId.toString(),
      fileName: file?.originalName ?? "",
      chunkId: item.record.chunkId.toString(),
      chunkIndex: item.record.chunkIndex,
      textPreview: chunk?.content.slice(0, 500) ?? "",
    };
  });
};

export const retrieveSimilarChunks = async (input: RetrievalInput) => {
  const parsed = retrievalSchema.parse(input);
  const targetFileIds = normalizeTargetFileIds(parsed);
  const invalidFileId = targetFileIds.find((id) => !Types.ObjectId.isValid(id));
  if (invalidFileId) {
    throw new AppError("Invalid fileId format.", 400);
  }

  const { vectors } = await embedTexts([parsed.query]);
  const queryVector = vectors[0];
  let results: RetrievedChunk[] | undefined;

  if (env.VECTOR_DB_MODE === "mongo") {
    results = await retrieveFromMongoVectors(parsed, queryVector);
  } else {
    const qdrant = getQdrantClient();
    const collectionName = getQdrantCollectionName();

    let response: Awaited<ReturnType<typeof qdrant.search>> = [];
    try {
      response = await qdrant.search(collectionName, {
        vector: queryVector,
        limit: parsed.topK,
        with_payload: true,
        filter: buildQdrantFileFilter(targetFileIds),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("not found") || message.includes("doesn't exist")) {
        response = [];
      } else {
        throw error;
      }
    }

    results = response.map((item) => ({
      score: item.score,
      fileId: String(item.payload?.fileId ?? ""),
      fileName: String(item.payload?.fileName ?? ""),
      chunkId: String(item.payload?.chunkId ?? ""),
      chunkIndex: Number(item.payload?.chunkIndex ?? -1),
      textPreview: String(item.payload?.textPreview ?? ""),
    }));
  }

  return {
    query: parsed.query,
    topK: parsed.topK,
    fileId: targetFileIds.length === 1 ? targetFileIds[0] : null,
    fileIds: targetFileIds,
    results,
  };
};
