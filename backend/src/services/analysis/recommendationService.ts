type Recommendation = {
  title: string;
  detail: string;
  relatedSkills: string[];
};

export const buildRecommendations = (input: {
  missingSkills: string[];
  weakSkills: string[];
  experienceScore: number;
  toolDepthScore: number;
}): Recommendation[] => {
  const items: Recommendation[] = [];

  if (input.missingSkills.length > 0) {
    items.push({
      title: "Prioritize missing required skills",
      detail: `Focus on learning and showcasing these JD-required skills first: ${input.missingSkills.slice(0, 6).join(", ")}.`,
      relatedSkills: input.missingSkills.slice(0, 8),
    });
  }

  if (input.weakSkills.length > 0) {
    items.push({
      title: "Strengthen weakly evidenced skills",
      detail: `Add concrete project bullets with outcomes for: ${input.weakSkills.slice(0, 6).join(", ")}.`,
      relatedSkills: input.weakSkills.slice(0, 8),
    });
  }

  if (input.experienceScore < 60) {
    items.push({
      title: "Improve experience alignment",
      detail:
        "Highlight role-relevant project scope (team size, ownership, complexity) and include time duration to align with JD seniority expectations.",
      relatedSkills: [],
    });
  }

  if (input.toolDepthScore < 60) {
    items.push({
      title: "Increase tool depth signals",
      detail:
        "For each core tool/tech, add implementation verbs and measurable impact (e.g. implemented, optimized, reduced latency by X%).",
      relatedSkills: [],
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Maintain strengths and tailor resume",
      detail:
        "You already align well. Tailor resume bullets to this JD and keep evidence-backed achievements near matching skills.",
      relatedSkills: [],
    });
  }

  return items;
};
