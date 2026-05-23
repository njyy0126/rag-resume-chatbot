import test from "node:test";
import assert from "node:assert/strict";
import { buildQdrantFileFilter, normalizeTargetFileIds } from "./retrievalService";

test("normalizeTargetFileIds prefers fileIds array and deduplicates", () => {
  const result = normalizeTargetFileIds({
    fileId: "single",
    fileIds: ["file-a", " file-b ", "file-a", ""],
  });
  assert.deepEqual(result, ["file-a", "file-b"]);
});

test("normalizeTargetFileIds falls back to single fileId", () => {
  const result = normalizeTargetFileIds({
    fileId: "  file-one  ",
  });
  assert.deepEqual(result, ["file-one"]);
});

test("buildQdrantFileFilter returns undefined for no file filters", () => {
  assert.equal(buildQdrantFileFilter([]), undefined);
});

test("buildQdrantFileFilter builds single-file must filter", () => {
  assert.deepEqual(buildQdrantFileFilter(["file-1"]), {
    must: [{ key: "fileId", match: { value: "file-1" } }],
  });
});

test("buildQdrantFileFilter builds multi-file should filter", () => {
  assert.deepEqual(buildQdrantFileFilter(["file-1", "file-2"]), {
    should: [
      { key: "fileId", match: { value: "file-1" } },
      { key: "fileId", match: { value: "file-2" } },
    ],
  });
});
