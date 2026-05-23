import { NextFunction, Request, Response } from "express";
import { getRecentAnalyses, runMatchAnalysis } from "../services/analysis/matchAnalysisService";

export const runMatchAnalysisController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await runMatchAnalysis({
      resumeFileId: req.body?.resumeFileId,
      jdFileId: req.body?.jdFileId,
      topK: req.body?.topK,
    });
    res.status(200).json({
      message: "Match analysis completed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listAnalysesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resumeFileId = Array.isArray(req.query.resumeFileId)
      ? req.query.resumeFileId[0]
      : req.query.resumeFileId;
    const jdFileId = Array.isArray(req.query.jdFileId) ? req.query.jdFileId[0] : req.query.jdFileId;

    const result = await getRecentAnalyses({
      resumeFileId: typeof resumeFileId === "string" ? resumeFileId : undefined,
      jdFileId: typeof jdFileId === "string" ? jdFileId : undefined,
    });

    res.status(200).json({
      message: "Recent analyses fetched.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
