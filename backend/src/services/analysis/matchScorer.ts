import type { RetrievedChunk } from "../retrievalService";
import type { SkillEvidence } from "./skillExtractor";

export type MatchScoreBreakdown = {
  skillCoverage: number;
  experienceAlignment: number;
  toolDepth: number;
  domainSimilarity: number;
};

export type ConfidenceLevel = "low" | "medium" | "high";

type ScoreInput = {
  requiredSkills: Set<string>;
  matchedSkills: Set<string>;
  resumeSkillEvidence: Map<string, SkillEvidence>;
  resumeChunks: RetrievedChunk[];
  jdChunks: RetrievedChunk[];
  weakSkills: Set<string>;
};

const ACTION_VERBS = [
  "built",
  "implemented",
  "designed",
  "developed",
  "optimized",
  "deployed",
  "integrated",
  "maintained",
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "are",
  "this",
  "that",
  "from",
  "have",
  "has",
  "will",
  "can",
  "our",
  "your",
  "their",
  "job",
  "role",
  "candidate",
  "experience",
]);

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

const extractMaxYears = (chunks: RetrievedChunk[]): number => {
  let maxYears = 0;
  const regex = /(\d+)\+?\s*(?:years|year|yrs|yr)/gi;
  for (const chunk of chunks) {
    const matches = chunk.textPreview.matchAll(regex);
    for (const match of matches) {
      const years = Number(match[1]);
      if (!Number.isNaN(years)) {
        maxYears = Math.max(maxYears, years);
      }
    }
  }
  return maxYears;
};

const getSeniorityLevel = (chunks: RetrievedChunk[]): number => {
  const text = chunks.map((chunk) => chunk.textPreview.toLowerCase()).join(" ");
  if (text.includes("principal") || text.includes("staff")) return 5;
  if (text.includes("lead") || text.includes("manager")) return 4;
  if (text.includes("senior")) return 3;
  if (text.includes("mid")) return 2;
  if (text.includes("junior")) return 1;
  if (text.includes("intern")) return 0;
  return 2;
};

const keywordSet = (chunks: RetrievedChunk[]): Set<string> => {
  const words = chunks
    .flatMap((chunk) => chunk.textPreview.toLowerCase().split(/[^a-z0-9]+/))
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  return new Set(words);
};

const getAverageScore = (chunks: RetrievedChunk[]): number => {
  if (chunks.length === 0) return 0;
  return chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;
};

export const scoreMatch = (input: ScoreInput) => {
  const { requiredSkills, matchedSkills, resumeSkillEvidence, resumeChunks, jdChunks, weakSkills } = input;

  const requiredCount = requiredSkills.size;
  const matchedCount = matchedSkills.size;
  const skillCoverageScore = requiredCount === 0 ? 0 : (matchedCount / requiredCount) * 100;

  const jdYears = extractMaxYears(jdChunks);
  const resumeYears = extractMaxYears(resumeChunks);
  const yearGap = Math.max(jdYears - resumeYears, 0);
  let yearsScore = jdYears === 0 ? 65 : clamp(100 - yearGap * 20);
  if (resumeYears >= jdYears && jdYears > 0) yearsScore = 100;
  const jdSeniority = getSeniorityLevel(jdChunks);
  const resumeSeniority = getSeniorityLevel(resumeChunks);
  const seniorityGap = Math.max(jdSeniority - resumeSeniority, 0);
  const seniorityScore = clamp(100 - seniorityGap * 20);
  const experienceAlignmentScore = clamp(Math.round(0.6 * yearsScore + 0.4 * seniorityScore));

  const matchedRequiredSkills = [...matchedSkills].filter((skill) => requiredSkills.has(skill));
  const depthVerbCount = matchedRequiredSkills.reduce((count, skill) => {
    const evidence = resumeSkillEvidence.get(skill);
    if (!evidence) return count;
    const hasAction = evidence.evidence.some((item) => {
      const source = resumeChunks.find((chunk) => chunk.chunkId === item.chunkId)?.textPreview.toLowerCase() ?? "";
      return ACTION_VERBS.some((verb) => source.includes(verb));
    });
    return count + (hasAction ? 1 : 0);
  }, 0);
  const stackCoverage = requiredCount === 0 ? 0 : matchedRequiredSkills.length / requiredCount;
  const actionSupport = matchedRequiredSkills.length === 0 ? 0 : depthVerbCount / matchedRequiredSkills.length;
  const weakPenalty = matchedRequiredSkills.length === 0 ? 0 : weakSkills.size / matchedRequiredSkills.length;
  const toolDepthScore = clamp(Math.round((0.65 * stackCoverage + 0.35 * actionSupport) * 100 - weakPenalty * 20));

  const jdKeywords = keywordSet(jdChunks);
  const resumeKeywords = keywordSet(resumeChunks);
  const overlaps = [...jdKeywords].filter((word) => resumeKeywords.has(word));
  const domainSimilarityScore =
    jdKeywords.size === 0 ? 0 : clamp(Math.round((overlaps.length / jdKeywords.size) * 100));

  const breakdown: MatchScoreBreakdown = {
    skillCoverage: Math.round(skillCoverageScore),
    experienceAlignment: experienceAlignmentScore,
    toolDepth: toolDepthScore,
    domainSimilarity: domainSimilarityScore,
  };

  const overall = Math.round(
    0.5 * breakdown.skillCoverage +
      0.2 * breakdown.experienceAlignment +
      0.2 * breakdown.toolDepth +
      0.1 * breakdown.domainSimilarity,
  );

  const totalEvidenceCount = resumeChunks.length + jdChunks.length;
  const avgEvidenceScore = (getAverageScore(resumeChunks) + getAverageScore(jdChunks)) / 2;
  let confidence: ConfidenceLevel = "low";
  if (totalEvidenceCount >= 12 && avgEvidenceScore >= 0.35) {
    confidence = "high";
  } else if (totalEvidenceCount >= 6 && avgEvidenceScore >= 0.2) {
    confidence = "medium";
  }

  return {
    overallMatchScore: clamp(overall),
    breakdown,
    confidence,
    scoringMeta: {
      requiredSkillCount: requiredCount,
      matchedSkillCount: matchedCount,
      resumeEvidenceCount: resumeChunks.length,
      jdEvidenceCount: jdChunks.length,
      averageEvidenceScore: Number(avgEvidenceScore.toFixed(4)),
    },
  };
};
