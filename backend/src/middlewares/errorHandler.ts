import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found." });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed.",
      issues: error.issues,
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large.",
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }

  console.error("Unhandled error:", error);
  return res.status(500).json({ message: "Internal server error." });
};
