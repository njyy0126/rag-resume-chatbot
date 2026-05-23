import { Router } from "express";
import {
  createChatSessionController,
  getSessionMessagesController,
  listChatSessionsController,
  sendMessageController,
} from "../controllers/chatController";

const chatRoutes = Router();

chatRoutes.post("/sessions", createChatSessionController);
chatRoutes.get("/sessions", listChatSessionsController);
chatRoutes.get("/sessions/:sessionId/messages", getSessionMessagesController);
chatRoutes.post("/sessions/:sessionId/messages", sendMessageController);

export default chatRoutes;
