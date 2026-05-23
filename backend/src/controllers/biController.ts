import { NextFunction, Request, Response } from "express";
import {
  getBiDataset,
  getBiExportCsv,
  getBiExportRows,
} from "../services/bi/biDatasetService";
import { getPowerBiEmbedConfig } from "../services/bi/powerBiService";

const readQuery = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
};

export const biDatasetController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getBiDataset({
      days: readQuery(req.query.days),
      fileType: readQuery(req.query.fileType),
      skillGapLimit: readQuery(req.query.skillGapLimit),
    });
    res.status(200).json({
      message: "BI dataset fetched.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const biExportJsonController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getBiExportRows({
      days: readQuery(req.query.days),
      fileType: readQuery(req.query.fileType),
      skillGapLimit: readQuery(req.query.skillGapLimit),
    });
    res.status(200).json({
      message: "BI JSON export generated.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const biExportCsvController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = await getBiExportCsv({
      days: readQuery(req.query.days),
      fileType: readQuery(req.query.fileType),
      skillGapLimit: readQuery(req.query.skillGapLimit),
    });
    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="rag-career-assistant-bi-export.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const powerBiEmbedConfigController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getPowerBiEmbedConfig();
    res.status(200).json({
      message: "Power BI embed config fetched.",
      data,
    });
  } catch (error) {
    next(error);
  }
};
