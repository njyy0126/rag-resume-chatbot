import { Request, Response, NextFunction } from "express";
import {
  deleteAllUploadedFiles,
  ingestDocument,
  listIngestedFiles,
} from "../services/ingestionService";

export const ingestController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ingestDocument(req.file, req.body);
    res.status(201).json({
      message: "Document ingested successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listIngestedFilesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const documentType = Array.isArray(req.query.documentType)
      ? req.query.documentType[0]
      : req.query.documentType;
    const indexedOnly = Array.isArray(req.query.indexedOnly)
      ? req.query.indexedOnly[0]
      : req.query.indexedOnly;

    const result = await listIngestedFiles({
      documentType: typeof documentType === "string" ? documentType : undefined,
      indexedOnly: typeof indexedOnly === "string" ? indexedOnly : undefined,
    });

    res.status(200).json({
      message: "Ingested files fetched.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteIngestedFilesController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteAllUploadedFiles();
    res.status(200).json({
      message: "All uploaded files deleted.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
