import { z } from "zod";
import { getDashboardSummary, getMatchTrend, getTopSkillGaps } from "../dashboard/dashboardService";

const datasetQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
  fileType: z.enum(["resume", "job_description", "other"]).optional(),
  skillGapLimit: z.coerce.number().int().positive().max(50).default(10),
});

const rowsToCsv = (
  headers: string[],
  rows: Array<Record<string, string | number | null | undefined>>,
): string => {
  const escape = (value: string | number | null | undefined): string => {
    const raw = value == null ? "" : String(value);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerLine = headers.map((header) => escape(header)).join(",");
  const dataLines = rows.map((row) => headers.map((header) => escape(row[header])).join(","));
  return [headerLine, ...dataLines].join("\n");
};

export const getBiDataset = async (input: {
  days?: string;
  fileType?: string;
  skillGapLimit?: string;
}) => {
  const parsed = datasetQuerySchema.parse(input);

  const [summary, trend, skillGaps] = await Promise.all([
    getDashboardSummary({
      days: String(parsed.days),
      fileType: parsed.fileType,
    }),
    getMatchTrend({
      days: String(parsed.days),
    }),
    getTopSkillGaps({
      limit: String(parsed.skillGapLimit),
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    params: parsed,
    summary,
    trend,
    skillGaps,
  };
};

export const getBiExportRows = async (input: {
  days?: string;
  fileType?: string;
  skillGapLimit?: string;
}) => {
  const dataset = await getBiDataset(input);

  const kpiRows = [
    { metric: "total_files", value: dataset.summary.kpis.totalFiles },
    { metric: "files_resume", value: dataset.summary.kpis.filesByType.resume },
    {
      metric: "files_job_description",
      value: dataset.summary.kpis.filesByType.job_description,
    },
    { metric: "files_other", value: dataset.summary.kpis.filesByType.other },
    { metric: "indexing_indexed", value: dataset.summary.kpis.indexingStatus.indexed },
    { metric: "indexing_partial", value: dataset.summary.kpis.indexingStatus.partial },
    { metric: "indexing_not_started", value: dataset.summary.kpis.indexingStatus.not_started },
    { metric: "chat_sessions_total", value: dataset.summary.kpis.totalChatSessions },
    { metric: "chat_messages_total", value: dataset.summary.kpis.totalChatMessages },
    { metric: "match_analyses_total", value: dataset.summary.kpis.totalMatchAnalyses },
    { metric: "match_score_average", value: dataset.summary.kpis.averageMatchScore },
  ];

  const trendRows = dataset.trend.points.map((point) => ({
    day: point.day,
    analysis_count: point.analysisCount,
    average_score: point.averageScore,
  }));

  const skillGapRows = dataset.skillGaps.items.map((item, index) => ({
    rank: index + 1,
    skill: item.skill,
    frequency: item.frequency,
  }));

  const activityRows = [
    ...dataset.summary.recentActivity.files.map((item) => ({
      event_type: "file",
      stable_key: `file_${item.fileId}`,
      occurred_at: item.createdAt.toISOString(),
      entity_id: item.fileId,
      label: item.fileName,
      meta_1: item.documentType,
      meta_2: item.indexingStatus,
    })),
    ...dataset.summary.recentActivity.chats.map((item) => ({
      event_type: "chat_session",
      stable_key: `chat_${item.sessionId}`,
      occurred_at: item.updatedAt.toISOString(),
      entity_id: item.sessionId,
      label: item.title,
      meta_1: "",
      meta_2: "",
    })),
    ...dataset.summary.recentActivity.analyses.map((item) => ({
      event_type: "analysis",
      stable_key: `analysis_${item.analysisId}`,
      occurred_at: item.createdAt.toISOString(),
      entity_id: item.analysisId,
      label: `score_${item.overallMatchScore}`,
      meta_1: item.confidence,
      meta_2: `${item.resumeFileId}|${item.jdFileId}`,
    })),
  ];

  return {
    generatedAt: dataset.generatedAt,
    params: dataset.params,
    tables: {
      kpis: kpiRows,
      trend: trendRows,
      skillGaps: skillGapRows,
      recentActivity: activityRows,
    },
  };
};

export const getBiExportCsv = async (input: {
  days?: string;
  fileType?: string;
  skillGapLimit?: string;
}) => {
  const rows = await getBiExportRows(input);
  const csvSections = [
    {
      name: "kpis",
      content: rowsToCsv(["metric", "value"], rows.tables.kpis),
    },
    {
      name: "trend",
      content: rowsToCsv(["day", "analysis_count", "average_score"], rows.tables.trend),
    },
    {
      name: "skill_gaps",
      content: rowsToCsv(["rank", "skill", "frequency"], rows.tables.skillGaps),
    },
    {
      name: "recent_activity",
      content: rowsToCsv(
        ["event_type", "stable_key", "occurred_at", "entity_id", "label", "meta_1", "meta_2"],
        rows.tables.recentActivity,
      ),
    },
  ];

  return [
    `# generated_at=${rows.generatedAt}`,
    `# days=${rows.params.days}`,
    `# fileType=${rows.params.fileType ?? "all"}`,
    `# skillGapLimit=${rows.params.skillGapLimit}`,
    ...csvSections.flatMap((section) => [`\n## ${section.name}`, section.content]),
  ].join("\n");
};
