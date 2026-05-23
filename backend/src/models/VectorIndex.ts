import { Schema, model, type InferSchemaType, Types } from "mongoose";

const vectorIndexSchema = new Schema(
  {
    fileId: { type: Types.ObjectId, ref: "IngestedFile", required: true, index: true },
    chunkId: { type: Types.ObjectId, ref: "TextChunk", required: true, unique: true },
    chunkIndex: { type: Number, required: true },
    vectorDb: { type: String, enum: ["qdrant", "mongo"], required: true, default: "qdrant" },
    collectionName: { type: String, required: true },
    pointId: { type: String, required: true, unique: true },
    embeddingProvider: { type: String, required: true, default: "qwen" },
    embeddingModel: { type: String, required: true },
    embeddingDimensions: { type: Number, required: true },
    vectorValues: [{ type: Number }],
    indexedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

vectorIndexSchema.index({ fileId: 1, indexedAt: -1 });

export type VectorIndexDocument = InferSchemaType<typeof vectorIndexSchema>;

export const VectorIndexModel = model("VectorIndex", vectorIndexSchema);
