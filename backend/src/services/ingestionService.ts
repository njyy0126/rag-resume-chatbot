import { z } from "zod";
import { env } from "../config/env";
import { IngestedFileModel } from "../models/IngestedFile";
import { TextChunkModel } from "../models/TextChunk";
import { VectorIndexModel } from "../models/VectorIndex";
import { chunkText } from "./chunker";
import { isSupportedFile, parseFileText } from "./textParser";
import { AppError } from "../utils/AppError";
import {
  getQdrantClient,
  getQdrantCollectionName,
  resetQdrantCollectionCache,
} from "./vector/qdrantClient";

const ingestInputSchema = z.object({
  documentType: z.enum(["resume", "job_description", "other"]).default("other"),
  chunkSize: z.coerce.number().int().positive().optional(),
  overlap: z.coerce.number().int().min(0).optional(),
});

export type IngestRequestInput = z.input<typeof ingestInputSchema>;
const listFilesSchema = z.object({
  documentType: z.enum(["resume", "job_description", "other"]).optional(),
  indexedOnly: z.coerce.boolean().optional(),
});

type IngestionResult = {
  fileId: string;
  chunkCount: number;
  preview: string[];
  file: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    totalChars: number;
    documentType: "resume" | "job_description" | "other";
    chunkSize: number;
    overlap: number;
  };
};

export const ingestDocument = async (
  file: Express.Multer.File | undefined,
  input: IngestRequestInput,
): Promise<IngestionResult> => {
  if (!file) {
    throw new AppError("No file uploaded. Use multipart field name `file`.", 400);
  }

  if (!isSupportedFile(file)) {
    throw new AppError("Unsupported file type. Allowed: PDF, TXT, DOCX.", 400);
  }

  const parsedInput = ingestInputSchema.parse(input);
  const chunkSize = parsedInput.chunkSize ?? env.DEFAULT_CHUNK_SIZE;
  const overlap = parsedInput.overlap ?? env.DEFAULT_CHUNK_OVERLAP;

  const { text, extension } = await parseFileText(file);
  const chunks = chunkText(text, chunkSize, overlap);

  if (chunks.length === 0) {
    throw new AppError("No chunks were generated from uploaded text.", 400);
  }

  const ingestedFile = await IngestedFileModel.create({
    originalName: file.originalname,
    mimeType: file.mimetype,
    extension,
    sizeBytes: file.size,
    documentType: parsedInput.documentType,
    totalChars: text.length,
    chunkCount: chunks.length,
    chunkSize,
    overlap,
  });

  await TextChunkModel.insertMany(
    chunks.map((chunk) => ({
      fileId: ingestedFile._id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
    })),
  );

  const preview = chunks.slice(0, 3).map((chunk) => chunk.content.slice(0, 160));

  return {
    fileId: ingestedFile._id.toString(),
    chunkCount: chunks.length,
    preview,
    file: {
      originalName: ingestedFile.originalName,
      mimeType: ingestedFile.mimeType,
      sizeBytes: ingestedFile.sizeBytes,
      totalChars: ingestedFile.totalChars,
      documentType: ingestedFile.documentType,
      chunkSize: ingestedFile.chunkSize,
      overlap: ingestedFile.overlap,
    },
  };
};

export const listIngestedFiles = async (input: { documentType?: string; indexedOnly?: string }) => {
  const parsed = listFilesSchema.parse(input);
  const filter: {
    documentType?: "resume" | "job_description" | "other";
    indexingStatus?: "indexed";
  } = {};

  if (parsed.documentType) {
    filter.documentType = parsed.documentType;
  }
  if (parsed.indexedOnly) {
    filter.indexingStatus = "indexed";
  }

  const files = await IngestedFileModel.find(filter).sort({ createdAt: -1 }).limit(100);
  return files.map((file) => ({
    fileId: file._id.toString(),
    originalName: file.originalName,
    documentType: file.documentType,
    indexingStatus: file.indexingStatus,
    chunkCount: file.chunkCount,
    indexedChunkCount: file.indexedChunkCount,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  }));
};

export const deleteAllUploadedFiles = async () => {
  const [fileCount, chunkCount, vectorCount] = await Promise.all([
    IngestedFileModel.countDocuments(),
    TextChunkModel.countDocuments(),
    VectorIndexModel.countDocuments(),
  ]);

  if (env.VECTOR_DB_MODE === "qdrant") {
    const qdrant = getQdrantClient();
    const collectionName = getQdrantCollectionName();
    try {
      await qdrant.deleteCollection(collectionName);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("not found")) {
        throw error;
      }
    }
    resetQdrantCollectionCache();
  }

  await Promise.all([
    VectorIndexModel.deleteMany({}),
    TextChunkModel.deleteMany({}),
    IngestedFileModel.deleteMany({}),
  ]);

  return {
    deletedFiles: fileCount,
    deletedChunks: chunkCount,
    deletedVectorIndexes: vectorCount,
  };
};
