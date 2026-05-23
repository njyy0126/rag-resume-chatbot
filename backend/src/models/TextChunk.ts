import { Schema, model, type InferSchemaType, Types } from "mongoose";

const textChunkSchema = new Schema(
  {
    fileId: { type: Types.ObjectId, ref: "IngestedFile", required: true, index: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    charStart: { type: Number, required: true },
    charEnd: { type: Number, required: true },
  },
  { timestamps: true },
);

textChunkSchema.index({ fileId: 1, chunkIndex: 1 }, { unique: true });

export type TextChunkDocument = InferSchemaType<typeof textChunkSchema>;

export const TextChunkModel = model("TextChunk", textChunkSchema);
