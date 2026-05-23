import { Request, Response, NextFunction } from "express";
import {
  clearAllVectorIndexes,
  getIndexingStatusSummary,
  indexAllUnindexedFiles,
  indexFileVectors,
} from "../services/vectorIndexingService";
import { retrieveSimilarChunks } from "../services/retrievalService";

export const indexFileController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileIdRaw = req.params.fileId;
    const fileId = Array.isArray(fileIdRaw) ? fileIdRaw[0] : fileIdRaw;
    const result = await indexFileVectors({ fileId: fileId ?? "" });
    res.status(200).json({
      message: "File indexing completed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const indexAllController = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await indexAllUnindexedFiles();
    res.status(200).json({
      message: "Batch indexing completed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const indexingStatusController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getIndexingStatusSummary();
    res.status(200).json({
      message: "Indexing status fetched.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const retrievalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await retrieveSimilarChunks(req.body);
    res.status(200).json({
      message: "Retrieval completed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const clearVectorIndexesController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await clearAllVectorIndexes();
    res.status(200).json({
      message: "All vector indexes cleared.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
