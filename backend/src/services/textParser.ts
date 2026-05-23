import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import path from "node:path";
import { AppError } from "../utils/AppError";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".docx"]);

export const isSupportedFile = (file: Express.Multer.File): boolean => {
  const extension = path.extname(file.originalname).toLowerCase();
  return ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(extension);
};

export const getFileExtension = (filename: string): string => {
  return path.extname(filename).toLowerCase();
};

export const parseFileText = async (
  file: Express.Multer.File,
): Promise<{ text: string; extension: string }> => {
  const extension = getFileExtension(file.originalname);
  let text = "";

  if (file.mimetype === "text/plain" || extension === ".txt") {
    text = file.buffer.toString("utf8");
  } else if (file.mimetype === "application/pdf" || extension === ".pdf") {
    const parsed = await pdfParse(file.buffer);
    text = parsed.text || "";
  } else if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    text = parsed.value || "";
  } else {
    throw new AppError("Unsupported file type. Allowed: PDF, TXT, DOCX.", 400);
  }

  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) {
    throw new AppError("Uploaded file contains no readable text.", 400);
  }

  return { text: normalized, extension };
};
