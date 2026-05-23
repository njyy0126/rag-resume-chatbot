import { AppError } from "../utils/AppError";

export type ChunkItem = {
  chunkIndex: number;
  content: string;
  charStart: number;
  charEnd: number;
};

export const chunkText = (
  rawText: string,
  chunkSize: number,
  overlap: number,
): ChunkItem[] => {
  const text = rawText.trim();

  if (!text) {
    throw new AppError("Cannot chunk empty text.", 400);
  }
  if (chunkSize <= 0) {
    throw new AppError("chunkSize must be greater than 0.", 400);
  }
  if (overlap < 0) {
    throw new AppError("overlap cannot be negative.", 400);
  }
  if (overlap >= chunkSize) {
    throw new AppError("overlap must be smaller than chunkSize.", 400);
  }

  const chunks: ChunkItem[] = [];
  const step = chunkSize - overlap;
  let index = 0;
  let chunkIndex = 0;

  while (index < text.length) {
    const end = Math.min(index + chunkSize, text.length);
    const content = text.slice(index, end).trim();

    if (content.length > 0) {
      chunks.push({
        chunkIndex,
        content,
        charStart: index,
        charEnd: end,
      });
      chunkIndex += 1;
    }

    if (end === text.length) {
      break;
    }
    index += step;
  }

  return chunks;
};
