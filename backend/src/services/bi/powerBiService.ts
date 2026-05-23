import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

type PowerBiEmbedConfig = {
  mode: "public" | "secure";
  embedUrl: string;
  reportId?: string;
  tokenType?: "Embed";
  accessToken?: string;
  warning?: string;
};

const getRequired = (value: string | undefined, label: string): string => {
  if (!value || !value.trim()) {
    throw new AppError(`${label} is required for Power BI integration.`, 400);
  }
  return value.trim();
};

const getAadAccessToken = async (): Promise<string> => {
  const tenantId = getRequired(env.POWERBI_TENANT_ID, "POWERBI_TENANT_ID");
  const clientId = getRequired(env.POWERBI_CLIENT_ID, "POWERBI_CLIENT_ID");
  const clientSecret = getRequired(env.POWERBI_CLIENT_SECRET, "POWERBI_CLIENT_SECRET");

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AppError(`Failed to get Azure AD token for Power BI: ${text}`, 502);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new AppError("Azure AD token response missing access_token.", 502);
  }
  return payload.access_token;
};

const generatePowerBiEmbedToken = async (aadToken: string): Promise<string> => {
  const reportId = getRequired(env.POWERBI_REPORT_ID, "POWERBI_REPORT_ID");
  const workspaceId = env.POWERBI_WORKSPACE_ID?.trim();
  const endpoint = workspaceId
    ? `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`
    : `https://api.powerbi.com/v1.0/myorg/reports/${reportId}/GenerateToken`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aadToken}`,
    },
    body: JSON.stringify({
      accessLevel: "View",
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AppError(`Failed to generate Power BI embed token: ${text}`, 502);
  }
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new AppError("Power BI embed token response missing token.", 502);
  }
  return payload.token;
};

export const getPowerBiEmbedConfig = async (): Promise<PowerBiEmbedConfig> => {
  const embedUrl = getRequired(env.POWERBI_EMBED_URL, "POWERBI_EMBED_URL");

  if (env.POWERBI_MODE === "public") {
    return {
      mode: "public",
      embedUrl,
      warning:
        "Public publish-to-web mode is enabled. This mode is convenient for demos but not suitable for production confidential data.",
    };
  }

  const reportId = getRequired(env.POWERBI_REPORT_ID, "POWERBI_REPORT_ID");
  const aadToken = await getAadAccessToken();
  const embedToken = await generatePowerBiEmbedToken(aadToken);

  return {
    mode: "secure",
    embedUrl,
    reportId,
    tokenType: "Embed",
    accessToken: embedToken,
  };
};
