import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfigPaths, resolveProjectDir } from "./dot-config.js";

const CHANNEL_SCHEMA_VERSION = "1.0.0";

type ChannelRecord = {
  name: string;
  connectedAt: string;
  updatedAt: string;
  enabled: boolean;
  auth: {
    token?: string;
    apiKey?: string;
  };
  metadata?: Record<string, string>;
};

type DotChannelState = {
  schemaVersion: string;
  updatedAt: string;
  channels: Record<string, ChannelRecord>;
};

const nowISO = () => new Date().toISOString();

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  return (error as NodeJS.ErrnoException).code === "ENOENT";
};

const normalizeChannelName = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("Channel name is required");
  return normalized;
};

const buildDefaultChannelState = (): DotChannelState => ({
  schemaVersion: CHANNEL_SCHEMA_VERSION,
  updatedAt: nowISO(),
  channels: {}
});

export const getChannelPaths = (projectDir?: string) => {
  const { projectDir: resolvedProjectDir, dotDir } = getConfigPaths(projectDir);
  const channelsPath = path.join(dotDir, "channels.json");
  return { projectDir: resolvedProjectDir, dotDir, channelsPath };
};

const readChannelState = async (projectDir?: string): Promise<DotChannelState> => {
  const { channelsPath } = getChannelPaths(projectDir);
  try {
    const raw = await readFile(channelsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DotChannelState>;
    const rawChannels = parsed.channels && typeof parsed.channels === "object" ? parsed.channels : {};
    const channels: Record<string, ChannelRecord> = {};

    for (const [key, value] of Object.entries(rawChannels)) {
      if (!value || typeof value !== "object") continue;
      const item = value as Partial<ChannelRecord>;
      const name = typeof item.name === "string" ? normalizeChannelName(item.name) : normalizeChannelName(key);
      channels[name] = {
        name,
        connectedAt: typeof item.connectedAt === "string" ? item.connectedAt : nowISO(),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : nowISO(),
        enabled: item.enabled !== false,
        auth: {
          token: typeof item.auth?.token === "string" ? item.auth.token : undefined,
          apiKey: typeof item.auth?.apiKey === "string" ? item.auth.apiKey : undefined
        },
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? Object.fromEntries(
                Object.entries(item.metadata)
                  .filter((entry): entry is [string, unknown] => entry.length === 2)
                  .map(([metaKey, metaValue]) => [String(metaKey), String(metaValue)])
              )
            : undefined
      };
    }

    return {
      schemaVersion: typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : CHANNEL_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowISO(),
      channels
    };
  } catch (error) {
    if (isNotFoundError(error)) return buildDefaultChannelState();
    throw error;
  }
};

const persistChannelState = async (projectDir: string, state: DotChannelState) => {
  const paths = getChannelPaths(projectDir);
  await mkdir(paths.dotDir, { recursive: true });
  const nextState: DotChannelState = {
    ...state,
    schemaVersion: CHANNEL_SCHEMA_VERSION,
    updatedAt: nowISO()
  };
  await writeFile(paths.channelsPath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  return { ...paths, state: nextState };
};

export const listProjectChannels = async (projectDir?: string) => {
  const resolvedProjectDir = resolveProjectDir(projectDir);
  const state = await readChannelState(resolvedProjectDir);
  return { projectDir: resolvedProjectDir, ...getChannelPaths(resolvedProjectDir), state, items: Object.values(state.channels) };
};

export const getProjectChannel = async ({ projectDir, name }: { projectDir?: string; name: string }) => {
  const resolvedProjectDir = resolveProjectDir(projectDir);
  const state = await readChannelState(resolvedProjectDir);
  const normalizedName = normalizeChannelName(name);
  const channel = state.channels[normalizedName] ?? null;
  return { projectDir: resolvedProjectDir, ...getChannelPaths(resolvedProjectDir), state, channel };
};

export const upsertProjectChannel = async ({
  projectDir,
  name,
  token,
  apiKey,
  metadata
}: {
  projectDir?: string;
  name: string;
  token?: string;
  apiKey?: string;
  metadata?: Record<string, string>;
}) => {
  const resolvedProjectDir = resolveProjectDir(projectDir);
  const state = await readChannelState(resolvedProjectDir);
  const normalizedName = normalizeChannelName(name);
  const existing = state.channels[normalizedName];
  const timestamp = nowISO();

  const next: ChannelRecord = {
    name: normalizedName,
    connectedAt: existing?.connectedAt ?? timestamp,
    updatedAt: timestamp,
    enabled: true,
    auth: {
      token: token ?? existing?.auth.token,
      apiKey: apiKey ?? existing?.auth.apiKey
    },
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(metadata ?? {})
    }
  };

  const nextState: DotChannelState = {
    ...state,
    channels: {
      ...state.channels,
      [normalizedName]: next
    }
  };

  const persisted = await persistChannelState(resolvedProjectDir, nextState);
  return { ...persisted, channel: next };
};

export const removeProjectChannel = async ({ projectDir, name }: { projectDir?: string; name: string }) => {
  const resolvedProjectDir = resolveProjectDir(projectDir);
  const state = await readChannelState(resolvedProjectDir);
  const normalizedName = normalizeChannelName(name);
  const existing = state.channels[normalizedName] ?? null;
  if (!existing) {
    return { projectDir: resolvedProjectDir, ...getChannelPaths(resolvedProjectDir), state, removed: false };
  }

  const nextChannels = { ...state.channels };
  delete nextChannels[normalizedName];

  const persisted = await persistChannelState(resolvedProjectDir, {
    ...state,
    channels: nextChannels
  });

  return { ...persisted, removed: true, channel: existing };
};
