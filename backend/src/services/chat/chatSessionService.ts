import { Types } from "mongoose";
import { z } from "zod";
import { ChatSessionModel } from "../../models/ChatSession";
import { ChatMessageModel } from "../../models/ChatMessage";
import { AppError } from "../../utils/AppError";

const createSessionSchema = z.object({
  title: z.string().trim().max(120).optional(),
});

const sessionIdSchema = z.object({
  sessionId: z.string().trim().min(1),
});

const toObjectId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid sessionId format.", 400);
  }
  return new Types.ObjectId(id);
};

export const createChatSession = async (input: { title?: string }) => {
  const parsed = createSessionSchema.parse(input);
  const session = await ChatSessionModel.create({
    title: parsed.title || "New Chat Session",
  });

  return {
    sessionId: session._id.toString(),
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
};

export const listChatSessions = async () => {
  const sessions = await ChatSessionModel.find().sort({ updatedAt: -1 }).limit(50);
  return sessions.map((session) => ({
    sessionId: session._id.toString(),
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
};

export const getSessionMessages = async (input: { sessionId: string }) => {
  const parsed = sessionIdSchema.parse(input);
  const sessionObjectId = toObjectId(parsed.sessionId);
  const session = await ChatSessionModel.findById(sessionObjectId);
  if (!session) {
    throw new AppError("Chat session not found.", 404);
  }

  const messages = await ChatMessageModel.find({ sessionId: sessionObjectId }).sort({
    createdAt: 1,
  });

  return {
    session: {
      sessionId: session._id.toString(),
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages: messages.map((message) => ({
      messageId: message._id.toString(),
      role: message.role,
      content: message.content,
      citations: message.citations,
      retrievedChunks: message.retrievedChunks,
      createdAt: message.createdAt,
    })),
  };
};

export const touchSessionUpdatedAt = async (sessionId: string): Promise<void> => {
  const sessionObjectId = toObjectId(sessionId);
  await ChatSessionModel.findByIdAndUpdate(sessionObjectId, { updatedAt: new Date() });
};

export const updateSessionTitleIfDefault = async (
  sessionId: string,
  titleCandidate: string,
): Promise<void> => {
  const sessionObjectId = toObjectId(sessionId);
  const session = await ChatSessionModel.findById(sessionObjectId);
  if (!session) {
    return;
  }

  if (session.title === "New Chat Session") {
    session.title = titleCandidate.slice(0, 60);
    await session.save();
  }
};

export const deleteChatSession = async (input: { sessionId: string }) => {
  const parsed = sessionIdSchema.parse(input);
  const sessionObjectId = toObjectId(parsed.sessionId);
  const session = await ChatSessionModel.findById(sessionObjectId);
  if (!session) {
    throw new AppError("Chat session not found.", 404);
  }

  const deletedMessages = await ChatMessageModel.deleteMany({ sessionId: sessionObjectId });
  await ChatSessionModel.deleteOne({ _id: sessionObjectId });

  return {
    sessionId: parsed.sessionId,
    deletedMessageCount: deletedMessages.deletedCount ?? 0,
  };
};
