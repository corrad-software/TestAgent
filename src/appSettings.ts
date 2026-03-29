import fs from "fs/promises";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "app-settings.json");

export interface AppSettings {
  // AI
  anthropicApiKey: string;
  model: string;
  maxIterations: number;
  // Test defaults
  defaultTestType: string;
  defaultHeadless: boolean;
  defaultTimeout: number;     // ms
  defaultBaseUrl: string;
  // Reports
  reportRetentionDays: number;
  screenshotOnFailOnly: boolean;
  // Budget
  aiBudget: number;           // max spend in USD, 0 = unlimited
  // Notifications
  webhookUrl: string;
  webhookOnPass: boolean;
  webhookOnFail: boolean;
}

const DEFAULTS: AppSettings = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: "claude-sonnet-4-6",
  maxIterations: 20,
  defaultTestType: "smoke",
  defaultHeadless: true,
  defaultTimeout: 30000,
  defaultBaseUrl: "",
  reportRetentionDays: 30,
  screenshotOnFailOnly: false,
  aiBudget: 4.65,
  webhookUrl: "",
  webhookOnPass: false,
  webhookOnFail: true,
};

let cache: AppSettings | null = null;

export async function getAppSettings(): Promise<AppSettings> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache!;
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  cache = { ...current, ...patch };
  const tmp = SETTINGS_PATH + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(cache, null, 2));
  await fs.rename(tmp, SETTINGS_PATH);
  // Reflect API key change into process env for current session
  if (patch.anthropicApiKey !== undefined) {
    process.env.ANTHROPIC_API_KEY = patch.anthropicApiKey;
  }
  return cache;
}

/** Strip the API key before sending to client (mask it) */
export function maskSettings(s: AppSettings): AppSettings & { anthropicApiKeyMasked: string } {
  const key = s.anthropicApiKey;
  const masked = key.length > 8
    ? key.slice(0, 7) + "•".repeat(Math.min(key.length - 11, 20)) + key.slice(-4)
    : key ? "•".repeat(key.length) : "";
  return { ...s, anthropicApiKey: "", anthropicApiKeyMasked: masked };
}
