import type { RetrievedChunk } from "../retrievalService";

export const INSUFFICIENT_EVIDENCE_TEXT =
  "I do not have sufficient evidence in the indexed documents to answer this confidently. Please upload more relevant resume/JD content or widen the file filter.";

export const hasSufficientEvidence = (
  chunks: RetrievedChunk[],
  minRelevanceScore: number,
): boolean => {
  if (chunks.length === 0) {
    return false;
  }
  return chunks.some((chunk) => chunk.score >= minRelevanceScore);
};

export const isInsufficientEvidenceContent = (content: string): boolean => {
  return content.trim().startsWith("I do not have sufficient evidence");
};
