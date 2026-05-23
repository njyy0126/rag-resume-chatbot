import { NextFunction, Request, Response } from "express";
import {
  createChatSession,
  getSessionMessages,
  listChatSessions,
} from "../services/chat/chatSessionService";
import { sendRagMessage } from "../services/chat/ragChatService";

export const createChatSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await createChatSession(req.body ?? {});
    res.status(201).json({
      message: "Chat session created.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listChatSessionsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await listChatSessions();
    res.status(200).json({
      message: "Chat sessions fetched.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionMessagesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    const result = await getSessionMessages({ sessionId: sessionId ?? "" });
    res.status(200).json({
      message: "Session messages fetched.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessageController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    const result = await sendRagMessage({
      sessionId: sessionId ?? "",
      question: req.body?.question,
      fileId: req.body?.fileId,
      fileIds: req.body?.fileIds,
      topK: req.body?.topK,
    });

    res.status(200).json({
      message: "RAG chat response generated.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
