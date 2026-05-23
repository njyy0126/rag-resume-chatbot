import { Router } from "express";
import {
  dashboardMatchTrendController,
  dashboardSkillGapsController,
  dashboardSummaryController,
} from "../controllers/dashboardController";

const dashboardRoutes = Router();

dashboardRoutes.get("/summary", dashboardSummaryController);
dashboardRoutes.get("/match-trend", dashboardMatchTrendController);
dashboardRoutes.get("/skill-gaps", dashboardSkillGapsController);

export default dashboardRoutes;
