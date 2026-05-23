import { Router } from "express";
import {
  deleteIngestedFilesController,
  ingestController,
  listIngestedFilesController,
} from "../controllers/ingestController";
import { upload } from "../middlewares/upload";

const ingestRoutes = Router();

ingestRoutes.get("/files", listIngestedFilesController);
ingestRoutes.post("/", upload.single("file"), ingestController);
ingestRoutes.delete("/files", deleteIngestedFilesController);

export default ingestRoutes;
