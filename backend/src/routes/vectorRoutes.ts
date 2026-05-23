import { Router } from "express";
import {
  clearVectorIndexesController,
  indexAllController,
  indexFileController,
  indexingStatusController,
  retrievalController,
} from "../controllers/vectorController";

const vectorRoutes = Router();

vectorRoutes.post("/index/file/:fileId", indexFileController);
vectorRoutes.post("/index/all", indexAllController);
vectorRoutes.delete("/index/all", clearVectorIndexesController);
vectorRoutes.get("/index/status", indexingStatusController);
vectorRoutes.post("/retrieve", retrievalController);

export default vectorRoutes;
