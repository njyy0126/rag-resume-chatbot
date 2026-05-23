import { Router } from "express";
import { listAnalysesController, runMatchAnalysisController } from "../controllers/analysisController";

const analysisRoutes = Router();

analysisRoutes.post("/match", runMatchAnalysisController);
analysisRoutes.get("/", listAnalysesController);

export default analysisRoutes;
