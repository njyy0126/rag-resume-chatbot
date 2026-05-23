import { Router } from "express";
import {
  createChatSessionController,
  deleteChatSessionController,
  getSessionMessagesController,
  listChatSessionsController,
  sendMessageController,
} from "../controllers/chatController";

const chatRoutes = Router();

chatRoutes.post("/sessions", createChatSessionController);
chatRoutes.get("/sessions", listChatSessionsController);
chatRoutes.delete("/sessions/:sessionId", deleteChatSessionController);
chatRoutes.get("/sessions/:sessionId/messages", getSessionMessagesController);
chatRoutes.post("/sessions/:sessionId/messages", sendMessageController);

export default chatRoutes;
