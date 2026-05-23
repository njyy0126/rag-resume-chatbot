import test from "node:test";
import assert from "node:assert/strict";
import {
  hasSufficientEvidence,
  INSUFFICIENT_EVIDENCE_TEXT,
  isInsufficientEvidenceContent,
} from "./chatQuality";
import type { RetrievedChunk } from "../retrievalService";

const sampleChunks: RetrievedChunk[] = [
  {
    score: 0.21,
    fileId: "file-a",
    fileName: "a.txt",
    chunkId: "chunk-a",
    chunkIndex: 0,
    textPreview: "alpha",
  },
  {
    score: 0.42,
    fileId: "file-b",
    fileName: "b.txt",
    chunkId: "chunk-b",
    chunkIndex: 1,
    textPreview: "beta",
  },
];

test("hasSufficientEvidence returns true when any score passes threshold", () => {
  assert.equal(hasSufficientEvidence(sampleChunks, 0.25), true);
});

test("hasSufficientEvidence returns false when all scores below threshold", () => {
  assert.equal(hasSufficientEvidence(sampleChunks, 0.5), false);
});

test("isInsufficientEvidenceContent detects fixed response", () => {
  assert.equal(isInsufficientEvidenceContent(INSUFFICIENT_EVIDENCE_TEXT), true);
  assert.equal(isInsufficientEvidenceContent("Normal answer"), false);
});
