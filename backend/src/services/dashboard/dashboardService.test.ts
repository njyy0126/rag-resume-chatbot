import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSkillGapsFromAnalyses } from "./dashboardService";

test("aggregateSkillGapsFromAnalyses counts and sorts missing skills", () => {
  const result = aggregateSkillGapsFromAnalyses([
    {
      missingSkills: [{ skill: "NodeJS" }, { skill: "Docker" }],
    },
    {
      missingSkills: [{ skill: "nodejs" }, { skill: "TypeScript" }],
    },
    {
      missingSkills: [{ skill: "docker" }],
    },
  ]);

  assert.deepEqual(result, [
    { skill: "docker", frequency: 2 },
    { skill: "nodejs", frequency: 2 },
    { skill: "typescript", frequency: 1 },
  ]);
});
