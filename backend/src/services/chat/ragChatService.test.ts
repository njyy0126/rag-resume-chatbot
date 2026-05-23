import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChatTargetFileIds } from "./ragChatService";

test("normalizeChatTargetFileIds uses fileIds and deduplicates", () => {
  const result = normalizeChatTargetFileIds({
    fileId: "single",
    fileIds: ["a", "b", "a", " "],
  });
  assert.deepEqual(result, ["a", "b"]);
});

test("normalizeChatTargetFileIds falls back to fileId", () => {
  const result = normalizeChatTargetFileIds({
    fileId: " one ",
  });
  assert.deepEqual(result, ["one"]);
});

test("normalizeChatTargetFileIds returns empty array when none provided", () => {
  assert.deepEqual(normalizeChatTargetFileIds({}), []);
});
