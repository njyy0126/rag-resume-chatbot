import { NextFunction, Request, Response } from "express";
import {
  getDashboardSummary,
  getMatchTrend,
  getTopSkillGaps,
} from "../services/dashboard/dashboardService";

export const dashboardSummaryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const days = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const fileType = Array.isArray(req.query.fileType) ? req.query.fileType[0] : req.query.fileType;

    const data = await getDashboardSummary({
      days: typeof days === "string" ? days : undefined,
      fileType: typeof fileType === "string" ? fileType : undefined,
    });
    console.log(`[dashboard] summary days=${days ?? "default"} fileType=${fileType ?? "all"}`);
    res.status(200).json({
      message: "Dashboard summary fetched.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const dashboardMatchTrendController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const days = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const data = await getMatchTrend({
      days: typeof days === "string" ? days : undefined,
    });
    res.status(200).json({
      message: "Match trend fetched.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const dashboardSkillGapsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const data = await getTopSkillGaps({
      limit: typeof limit === "string" ? limit : undefined,
    });
    res.status(200).json({
      message: "Top skill gaps fetched.",
      data,
    });
  } catch (error) {
    next(error);
  }
};
