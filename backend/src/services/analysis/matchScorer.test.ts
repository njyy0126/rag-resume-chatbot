import test from "node:test";
import assert from "node:assert/strict";
import { scoreMatch } from "./matchScorer";
import type { RetrievedChunk } from "../retrievalService";
import type { SkillEvidence } from "./skillExtractor";

const sampleResumeChunks: RetrievedChunk[] = [
  {
    score: 0.52,
    fileId: "resume-file",
    fileName: "resume.txt",
    chunkId: "resume-1",
    chunkIndex: 0,
    textPreview: "Implemented Node.js and MongoDB services, built REST APIs and optimized performance.",
  },
  {
    score: 0.39,
    fileId: "resume-file",
    fileName: "resume.txt",
    chunkId: "resume-2",
    chunkIndex: 1,
    textPreview: "2 years experience as backend intern working with TypeScript and Docker.",
  },
];

const sampleJdChunks: RetrievedChunk[] = [
  {
    score: 0.61,
    fileId: "jd-file",
    fileName: "jd.txt",
    chunkId: "jd-1",
    chunkIndex: 0,
    textPreview: "Required: Node.js, MongoDB, Docker, and TypeScript with 2+ years backend experience.",
  },
];

const resumeSkillEvidence = new Map<string, SkillEvidence>([
  [
    "nodejs",
    { skill: "nodejs", mentions: 2, maxScore: 0.52, evidence: [] },
  ],
  [
    "mongodb",
    { skill: "mongodb", mentions: 2, maxScore: 0.52, evidence: [] },
  ],
  [
    "typescript",
    { skill: "typescript", mentions: 1, maxScore: 0.39, evidence: [] },
  ],
]);

test("scoreMatch returns deterministic weighted overall score", () => {
  const result = scoreMatch({
    requiredSkills: new Set(["nodejs", "mongodb", "docker", "typescript"]),
    matchedSkills: new Set(["nodejs", "mongodb", "typescript"]),
    resumeSkillEvidence,
    resumeChunks: sampleResumeChunks,
    jdChunks: sampleJdChunks,
    weakSkills: new Set(["typescript"]),
  });

  assert.equal(typeof result.overallMatchScore, "number");
  assert.equal(result.overallMatchScore >= 0 && result.overallMatchScore <= 100, true);
  assert.equal(result.breakdown.skillCoverage, 75);
});
