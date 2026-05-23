import { Types } from "mongoose";
import { z } from "zod";
import { env } from "../../config/env";
import { IngestedFileModel } from "../../models/IngestedFile";
import { TextChunkModel } from "../../models/TextChunk";
import { MatchAnalysisModel } from "../../models/MatchAnalysis";
import { AppError } from "../../utils/AppError";
import { retrieveSimilarChunks, type RetrievedChunk } from "../retrievalService";
import {
  extractRequiredSkillsFromJd,
  extractSkillEvidence,
  type EvidenceRef,
} from "./skillExtractor";
import { buildRecommendations } from "./recommendationService";
import { scoreMatch } from "./matchScorer";

const requestSchema = z.object({
  resumeFileId: z.string().trim().min(1),
  jdFileId: z.string().trim().min(1),
  topK: z.coerce.number().int().positive().max(20).optional(),
});

const dedupeChunks = (chunks: RetrievedChunk[]): RetrievedChunk[] => {
  const map = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const existing = map.get(chunk.chunkId);
    if (!existing || chunk.score > existing.score) {
      map.set(chunk.chunkId, chunk);
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
};

const buildFileScopedEvidence = async (
  fileId: string,
  queries: string[],
  topK: number,
): Promise<RetrievedChunk[]> => {
  const [file, chunks, retrievalResponses] = await Promise.all([
    IngestedFileModel.findById(fileId).select("_id originalName"),
    TextChunkModel.find({ fileId: new Types.ObjectId(fileId) }).sort({ chunkIndex: 1 }),
    Promise.all(
      queries.map((query) =>
        retrieveSimilarChunks({
          query,
          fileId,
          topK,
        }),
      ),
    ),
  ]);

  if (!file) {
    throw new AppError("File not found while building analysis evidence.", 404);
  }

  const retrievalScoreMap = new Map<string, number>();
  for (const response of retrievalResponses) {
    for (const item of response.results) {
      const previous = retrievalScoreMap.get(item.chunkId) ?? 0;
      if (item.score > previous) {
        retrievalScoreMap.set(item.chunkId, item.score);
      }
    }
  }

  // Use all chunks from the selected file for deterministic analysis completeness.
  return chunks.map((chunk) => ({
    fileId: file._id.toString(),
    fileName: file.originalName,
    chunkId: chunk._id.toString(),
    chunkIndex: chunk.chunkIndex,
    textPreview: chunk.content.slice(0, 500),
    score: retrievalScoreMap.get(chunk._id.toString()) ?? 0.12,
  }));
};

const buildSkillItems = (
  skills: string[],
  evidenceLookup: Map<string, { evidence: EvidenceRef[] }>,
): Array<{ skill: string; evidence: EvidenceRef[] }> => {
  return skills.map((skill) => ({
    skill,
    evidence: evidenceLookup.get(skill)?.evidence ?? [],
  }));
};

const ensureFileExists = async (fileId: string, label: string) => {
  if (!Types.ObjectId.isValid(fileId)) {
    throw new AppError(`Invalid ${label} format.`, 400);
  }
  const file = await IngestedFileModel.findById(fileId);
  if (!file) {
    throw new AppError(`${label} not found.`, 404);
  }
};

const JD_QUERIES = [
  "required skills and technologies",
  "must have qualifications responsibilities",
  "experience level seniority requirement",
];
const RESUME_QUERIES = [
  "skills technologies tools used",
  "project implementation achievements built developed",
  "experience years responsibilities ownership",
];

export const runMatchAnalysis = async (input: z.input<typeof requestSchema>) => {
  const parsed = requestSchema.parse(input);
  const topK = parsed.topK ?? env.M5_ANALYSIS_DEFAULT_TOPK;

  await Promise.all([
    ensureFileExists(parsed.resumeFileId, "resumeFileId"),
    ensureFileExists(parsed.jdFileId, "jdFileId"),
  ]);

  const [resumeChunks, jdChunks] = await Promise.all([
    buildFileScopedEvidence(parsed.resumeFileId, RESUME_QUERIES, topK),
    buildFileScopedEvidence(parsed.jdFileId, JD_QUERIES, topK),
  ]);

  if (resumeChunks.length === 0 || jdChunks.length === 0) {
    throw new AppError(
      "Not enough indexed evidence to run analysis. Please index both resume and JD files first.",
      400,
    );
  }

  const jdSkillEvidence = extractSkillEvidence(jdChunks);
  const resumeSkillEvidence = extractSkillEvidence(resumeChunks);
  const requiredSkills = extractRequiredSkillsFromJd(jdChunks);
  const resumeSkills = new Set(resumeSkillEvidence.keys());

  const matchedSkills = new Set(
    [...requiredSkills].filter((skill) => {
      return resumeSkills.has(skill);
    }),
  );
  const missingSkills = [...requiredSkills].filter((skill) => !resumeSkills.has(skill));
  const weakSkills = [...matchedSkills].filter((skill) => {
    const evidence = resumeSkillEvidence.get(skill);
    if (!evidence) return false;
    return evidence.mentions <= 1 || evidence.maxScore < 0.3;
  });

  const scoreResult = scoreMatch({
    requiredSkills,
    matchedSkills,
    resumeSkillEvidence,
    resumeChunks,
    jdChunks,
    weakSkills: new Set(weakSkills),
  });

  const recommendations = buildRecommendations({
    missingSkills,
    weakSkills,
    experienceScore: scoreResult.breakdown.experienceAlignment,
    toolDepthScore: scoreResult.breakdown.toolDepth,
  });

  const matchedItems = buildSkillItems([...matchedSkills].sort(), resumeSkillEvidence);
  const missingItems = buildSkillItems(missingSkills.sort(), jdSkillEvidence);
  const weakItems = buildSkillItems(weakSkills.sort(), resumeSkillEvidence);
  const evidenceSummary = [...resumeChunks, ...jdChunks]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((chunk) => ({
      fileId: chunk.fileId,
      fileName: chunk.fileName,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    }));

  const analysis = await MatchAnalysisModel.create({
    resumeFileId: new Types.ObjectId(parsed.resumeFileId),
    jdFileId: new Types.ObjectId(parsed.jdFileId),
    overallMatchScore: scoreResult.overallMatchScore,
    confidence: scoreResult.confidence,
    breakdown: scoreResult.breakdown,
    matchedSkills: matchedItems,
    missingSkills: missingItems,
    weakSkills: weakItems,
    recommendations,
    evidenceSummary,
    scoringMeta: scoreResult.scoringMeta,
  });

  return {
    analysisId: analysis._id.toString(),
    resumeFileId: parsed.resumeFileId,
    jdFileId: parsed.jdFileId,
    overallMatchScore: analysis.overallMatchScore,
    confidence: analysis.confidence,
    breakdown: analysis.breakdown,
    matchedSkills: analysis.matchedSkills,
    missingSkills: analysis.missingSkills,
    weakSkills: analysis.weakSkills,
    recommendations: analysis.recommendations,
    evidenceSummary: analysis.evidenceSummary,
    scoringMeta: analysis.scoringMeta,
    createdAt: analysis.createdAt,
  };
};

export const getRecentAnalyses = async (input: {
  resumeFileId?: string;
  jdFileId?: string;
}) => {
  const filter: { resumeFileId?: Types.ObjectId; jdFileId?: Types.ObjectId } = {};

  if (input.resumeFileId) {
    if (!Types.ObjectId.isValid(input.resumeFileId)) {
      throw new AppError("Invalid resumeFileId format.", 400);
    }
    filter.resumeFileId = new Types.ObjectId(input.resumeFileId);
  }
  if (input.jdFileId) {
    if (!Types.ObjectId.isValid(input.jdFileId)) {
      throw new AppError("Invalid jdFileId format.", 400);
    }
    filter.jdFileId = new Types.ObjectId(input.jdFileId);
  }

  const analyses = await MatchAnalysisModel.find(filter).sort({ createdAt: -1 }).limit(20);
  return analyses.map((item) => ({
    analysisId: item._id.toString(),
    resumeFileId: item.resumeFileId.toString(),
    jdFileId: item.jdFileId.toString(),
    overallMatchScore: item.overallMatchScore,
    confidence: item.confidence,
    createdAt: item.createdAt,
  }));
};
