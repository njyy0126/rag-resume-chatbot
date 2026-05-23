import multer from "multer";
import { env } from "../config/env";

const maxFileSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeBytes,
  },
});
