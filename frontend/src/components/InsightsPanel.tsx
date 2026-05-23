import { useEffect, useRef, useState } from "react";

type PowerBiConfig = {
  mode: "public" | "secure";
  embedUrl: string;
  reportId?: string;
  tokenType?: "Embed";
  accessToken?: string;
  warning?: string;
};

type BiDataset = {
  generatedAt: string;
  params: {
    days: number;
    fileType?: "resume" | "job_description" | "other";
    skillGapLimit: number;
  };
  summary: {
    kpis: {
      totalFiles: number;
      totalChatSessions: number;
      totalMatchAnalyses: number;
      averageMatchScore: number;
    };
  };
  trend: {
    points: Array<{ day: string; analysisCount: number; averageScore: number }>;
  };
  skillGaps: {
    items: Array<{ skill: string; frequency: number }>;
  };
};

declare global {
  interface Window {
    powerbi: {
      embed: (element: HTMLElement, config: Record<string, unknown>) => unknown;
      reset: (element: HTMLElement) => void;
    };
    "powerbi-client": {
      models: {
        TokenType: {
          Embed: number;
        };
      };
    };
  }
}

const toFriendlyError = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function InsightsPanel() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [fileType, setFileType] = useState<"" | "resume" | "job_description" | "other">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [powerBiConfig, setPowerBiConfig] = useState<PowerBiConfig | null>(null);
  const [dataset, setDataset] = useState<BiDataset | null>(null);

  const embedContainerRef = useRef<HTMLDivElement | null>(null);

  const ensurePowerBiScript = async (): Promise<void> => {
    if (window.powerbi && window["powerbi-client"]) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-powerbi-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Power BI SDK.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/powerbi-client/dist/powerbi.js";
      script.async = true;
      script.dataset.powerbiSdk = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Power BI SDK."));
      document.head.appendChild(script);
    });
  };

  const loadInsightsData = async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(days),
        skillGapLimit: "10",
      });
      if (fileType) {
        params.set("fileType", fileType);
      }

      const [cfgRes, dataRes] = await Promise.all([
        fetch("/api/bi/powerbi/embed-config"),
        fetch(`/api/bi/dataset?${params.toString()}`),
      ]);

      const [cfgPayload, dataPayload] = (await Promise.all([cfgRes.json(), dataRes.json()])) as Array<{
        message?: string;
        data?: unknown;
      }>;

      if (!cfgRes.ok || !cfgPayload.data) {
        throw new Error(cfgPayload.message || "Failed to fetch Power BI embed config.");
      }
      if (!dataRes.ok || !dataPayload.data) {
        throw new Error(dataPayload.message || "Failed to fetch BI dataset.");
      }

      setPowerBiConfig(cfgPayload.data as PowerBiConfig);
      setDataset(dataPayload.data as BiDataset);
    } catch (err) {
      setError(toFriendlyError(err, "Could not load Insights data."));
      setPowerBiConfig(null);
      setDataset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInsightsData();
  }, [days, fileType]);

  useEffect(() => {
    if (!powerBiConfig || powerBiConfig.mode !== "secure") {
      return;
    }
    if (!embedContainerRef.current) {
      return;
    }
    if (!powerBiConfig.accessToken || !powerBiConfig.reportId) {
      return;
    }

    let cancelled = false;
    const mountSecureEmbed = async () => {
      try {
        await ensurePowerBiScript();
        if (cancelled || !embedContainerRef.current) return;

        window.powerbi.reset(embedContainerRef.current);
        window.powerbi.embed(embedContainerRef.current, {
          type: "report",
          id: powerBiConfig.reportId,
          embedUrl: powerBiConfig.embedUrl,
          accessToken: powerBiConfig.accessToken,
          tokenType: window["powerbi-client"].models.TokenType.Embed,
          settings: {
            panes: {
              filters: { visible: true },
              pageNavigation: { visible: true },
            },
          },
        });
      } catch (err) {
        if (!cancelled) {
          setError(toFriendlyError(err, "Failed to initialize secure Power BI embed."));
        }
      }
    };
    void mountSecureEmbed();

    return () => {
      cancelled = true;
      if (embedContainerRef.current && window.powerbi) {
        window.powerbi.reset(embedContainerRef.current);
      }
    };
  }, [powerBiConfig]);

  return (
    <section className="card">
      <h2>Insights (Power BI)</h2>
      <div className="dashboard-filters">
        <label>
          Time range
          <select value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
        <label>
          File type
          <select
            value={fileType}
            onChange={(event) =>
              setFileType(event.target.value as "" | "resume" | "job_description" | "other")
            }
          >
            <option value="">All</option>
            <option value="resume">Resume</option>
            <option value="job_description">Job Description</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button type="button" onClick={() => void loadInsightsData()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!powerBiConfig ? (
        <p className="meta">{loading ? "Loading Power BI config..." : "Power BI config unavailable."}</p>
      ) : (
        <>
          {powerBiConfig.warning && <p className="evidence-warning">{powerBiConfig.warning}</p>}

          <div className="analysis-block">
            <h4>Visual Legend</h4>
            <ul>
              <li>KPI cards: files, chats, analyses, and average match score.</li>
              <li>Trend visual: daily analysis volume and daily average score.</li>
              <li>Skill gap visual: most frequent missing skills across analyses.</li>
            </ul>
          </div>

          {powerBiConfig.mode === "public" ? (
            <div className="insights-embed-frame">
              <iframe
                title="Power BI Insights Report"
                src={powerBiConfig.embedUrl}
                loading="lazy"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="insights-embed-frame">
              <div ref={embedContainerRef} className="insights-secure-container" />
            </div>
          )}
        </>
      )}

      {dataset && (
        <div className="analysis-block">
          <h4>Connected BI Dataset Snapshot</h4>
          <p>
            Generated: {new Date(dataset.generatedAt).toLocaleString()} | Files:{" "}
            {dataset.summary.kpis.totalFiles} | Sessions: {dataset.summary.kpis.totalChatSessions} |
            Analyses: {dataset.summary.kpis.totalMatchAnalyses} | Avg score:{" "}
            {dataset.summary.kpis.averageMatchScore}
          </p>
          <p className="meta">
            Trend points: {dataset.trend.points.length} | Top skill gaps: {dataset.skillGaps.items.length}
          </p>
        </div>
      )}
    </section>
  );
}
