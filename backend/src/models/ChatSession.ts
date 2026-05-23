import { Schema, model, type InferSchemaType } from "mongoose";

const chatSessionSchema = new Schema(
  {
    title: { type: String, required: true },
  },
  { timestamps: true },
);

export type ChatSessionDocument = InferSchemaType<typeof chatSessionSchema>;

export const ChatSessionModel = model("ChatSession", chatSessionSchema);
