import { Schema, model, type InferSchemaType } from "mongoose";

const ingestedFileSchema = new Schema(
  {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    extension: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    documentType: { type: String, enum: ["resume", "job_description", "other"], required: true },
    totalChars: { type: Number, required: true },
    chunkCount: { type: Number, required: true },
    chunkSize: { type: Number, required: true },
    overlap: { type: Number, required: true },
    indexedChunkCount: { type: Number, required: true, default: 0 },
    indexingStatus: {
      type: String,
      enum: ["not_started", "partial", "indexed"],
      required: true,
      default: "not_started",
    },
    lastIndexedAt: { type: Date },
  },
  { timestamps: true },
);

export type IngestedFileDocument = InferSchemaType<typeof ingestedFileSchema>;

export const IngestedFileModel = model("IngestedFile", ingestedFileSchema);
