import { Types } from "mongoose";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { retrieveSimilarChunks, type RetrievedChunk } from "../retrievalService";
import { generateQwenChatAnswer } from "./qwenChatService";
import { ChatSessionModel } from "../../models/ChatSession";
import { ChatMessageModel } from "../../models/ChatMessage";
import { touchSessionUpdatedAt, updateSessionTitleIfDefault } from "./chatSessionService";
import { hasSufficientEvidence, INSUFFICIENT_EVIDENCE_TEXT } from "./chatQuality";

const sendMessageSchema = z.object({
  sessionId: z.string().trim().min(1),
  question: z.string().trim().min(2, "Question must be at least 2 characters."),
  topK: z.coerce.number().int().positive().max(20).optional(),
  fileId: z.string().trim().optional(),
  fileIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

const isValidObjectId = (value: string): boolean => Types.ObjectId.isValid(value);

export const normalizeChatTargetFileIds = (input: {
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

const buildContextBlocks = (chunks: RetrievedChunk[]): string[] => {
  return chunks.slice(0, env.CHAT_MAX_CONTEXT_CHUNKS).map((chunk) => {
    return [
      `source_file: ${chunk.fileName}`,
      `chunk_index: ${chunk.chunkIndex}`,
      `chunk_id: ${chunk.chunkId}`,
      `similarity_score: ${chunk.score.toFixed(4)}`,
      `content:`,
      chunk.textPreview,
    ].join("\n");
  });
};

const buildCitations = (chunks: RetrievedChunk[]) => {
  return chunks.map((chunk) => ({
    fileId: chunk.fileId,
    fileName: chunk.fileName,
    chunkId: chunk.chunkId,
    chunkIndex: chunk.chunkIndex,
    score: chunk.score,
  }));
};
type CitationItem = ReturnType<typeof buildCitations>[number];

const buildExtractiveFallbackAnswer = (chunks: RetrievedChunk[]): string => {
  const summaryLines = chunks.slice(0, 3).map((chunk, index) => {
    return `- Evidence ${index + 1} (${chunk.fileName}, chunk ${chunk.chunkIndex}): ${chunk.textPreview}`;
  });

  return [
    "I cannot reach the chat model right now, so here is an extractive answer from retrieved evidence:",
    ...summaryLines,
  ].join("\n");
};

export const sendRagMessage = async (input: z.input<typeof sendMessageSchema>) => {
  const parsed = sendMessageSchema.parse(input);
  const targetFileIds = normalizeChatTargetFileIds(parsed);
  if (!isValidObjectId(parsed.sessionId)) {
    throw new AppError("Invalid sessionId format.", 400);
  }
  if (targetFileIds.some((id) => !isValidObjectId(id))) {
    throw new AppError("Invalid fileId format.", 400);
  }

  const session = await ChatSessionModel.findById(parsed.sessionId);
  if (!session) {
    throw new AppError("Chat session not found.", 404);
  }

  const userMessage = await ChatMessageModel.create({
    sessionId: session._id,
    role: "user",
    content: parsed.question,
    citations: [],
    retrievedChunks: [],
  });

  const retrieval = await retrieveSimilarChunks({
    query: parsed.question,
    topK: parsed.topK ?? env.CHAT_MAX_CONTEXT_CHUNKS,
    fileIds: targetFileIds.length > 0 ? targetFileIds : undefined,
  });

  const retrievedChunks = retrieval.results.slice(0, env.CHAT_MAX_CONTEXT_CHUNKS);
  console.log(
    `[chat] session=${parsed.sessionId} retrieved=${retrievedChunks.length} topScore=${retrievedChunks[0]?.score ?? 0}`,
  );

  let assistantContent = INSUFFICIENT_EVIDENCE_TEXT;
  let citations: CitationItem[] = [];
  const enoughEvidence = hasSufficientEvidence(retrievedChunks, env.CHAT_MIN_RELEVANCE_SCORE);
  if (enoughEvidence) {
    const contextBlocks = buildContextBlocks(retrievedChunks);
    try {
      const llmResult = await generateQwenChatAnswer(parsed.question, contextBlocks);
      assistantContent = llmResult.answer;
      if (llmResult.usage) {
        console.log(
          `[chat] token_usage prompt=${llmResult.usage.prompt_tokens ?? 0} completion=${llmResult.usage.completion_tokens ?? 0} total=${llmResult.usage.total_tokens ?? 0}`,
        );
      }
    } catch (error) {
      if (!env.CHAT_FALLBACK_TO_EXTRACTIVE) {
        throw error;
      }
      console.warn(
        `[chat] Qwen unavailable, using extractive fallback. reason=${error instanceof Error ? error.message : "unknown"}`,
      );
      assistantContent = buildExtractiveFallbackAnswer(retrievedChunks);
    }

    citations = buildCitations(retrievedChunks);
  }

  const assistantMessage = await ChatMessageModel.create({
    sessionId: session._id,
    role: "assistant",
    content: assistantContent,
    citations,
    retrievedChunks,
  });

  await touchSessionUpdatedAt(parsed.sessionId);
  await updateSessionTitleIfDefault(parsed.sessionId, parsed.question);

  return {
    sessionId: parsed.sessionId,
    userMessage: {
      messageId: userMessage._id.toString(),
      role: userMessage.role,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    assistantMessage: {
      messageId: assistantMessage._id.toString(),
      role: assistantMessage.role,
      content: assistantMessage.content,
      citations: assistantMessage.citations,
      retrievedChunks: assistantMessage.retrievedChunks,
      createdAt: assistantMessage.createdAt,
    },
    retrievalSummary: {
      count: retrievedChunks.length,
      topScore: retrievedChunks[0]?.score ?? null,
      usedEvidence: enoughEvidence,
    },
  };
};
