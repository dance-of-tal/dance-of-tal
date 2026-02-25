export type ThreadsReplyControl = "everyone" | "accounts_you_follow" | "mentioned_only";

export const THREADS_TEXT_MAX_CHARS = 500;

export type PublishThreadsTextInput = {
  accessToken: string;
  userId: string;
  text: string;
  replyControl?: ThreadsReplyControl;
  replyToId?: string;
  baseUrl?: string;
  apiVersion?: string;
};

export type PublishThreadsTextResult = {
  containerId: string;
  publishedId: string;
  text: string;
  replyToId?: string;
  raw: {
    create: unknown;
    publish: unknown;
  };
};

export type PublishThreadsTextChainResult = {
  rootPostId: string;
  lastPostId: string;
  items: Array<{
    index: number;
    text: string;
    replyToId: string | null;
    containerId: string;
    publishedId: string;
  }>;
};

export type FetchThreadsRecentTextsInput = {
  accessToken: string;
  userId: string;
  limit?: number;
  baseUrl?: string;
  apiVersion?: string;
};

const normalizeBaseUrl = (value?: string) => {
  const base = (value ?? "https://graph.threads.net").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(`Invalid Threads base URL: ${base}`);
  }
  return base;
};

const normalizeApiVersion = (value?: string) => {
  const normalized = (value ?? "v1.0").trim().replace(/^\/+/, "");
  if (!/^v\d+\.\d+$/i.test(normalized)) {
    throw new Error(`Invalid Threads API version: ${normalized}`);
  }
  return normalized;
};

const buildApiUrl = ({
  baseUrl,
  apiVersion,
  userId,
  action
}: {
  baseUrl?: string;
  apiVersion?: string;
  userId: string;
  action: "threads" | "threads_publish";
}) => {
  const base = normalizeBaseUrl(baseUrl);
  const version = normalizeApiVersion(apiVersion);
  return `${base}/${version}/${encodeURIComponent(userId)}/${action}`;
};

const assertOk = async (response: Response) => {
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  throw new Error(`Threads API request failed (${response.status}): ${text || response.statusText}`);
};

const extractContainerId = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Threads create container response is invalid.");
  }
  const maybeId = (payload as { id?: unknown }).id;
  if (typeof maybeId !== "string" || maybeId.trim().length === 0) {
    throw new Error("Threads create container response did not include an id.");
  }
  return maybeId;
};

const extractPublishedId = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Threads publish response is invalid.");
  }
  const maybeId = (payload as { id?: unknown }).id;
  if (typeof maybeId !== "string" || maybeId.trim().length === 0) {
    throw new Error("Threads publish response did not include an id.");
  }
  return maybeId;
};

const findSplitIndex = (text: string, maxChars: number) => {
  const preferredStart = Math.max(Math.floor(maxChars * 0.55), 1);
  const candidate = text.slice(0, maxChars);
  const priorityTokens = ["\n\n", "\n", ". ", "! ", "? ", "; ", ": ", ", ", " "];

  for (const token of priorityTokens) {
    const idx = candidate.lastIndexOf(token);
    if (idx >= preferredStart) {
      return idx + token.length;
    }
  }
  return maxChars;
};

export const splitThreadsText = (rawText: string, maxChars = THREADS_TEXT_MAX_CHARS) => {
  const normalized = rawText.trim();
  if (!normalized) return [];
  if (maxChars < 50) throw new Error("maxChars is too small. Use 50 or greater.");

  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    const splitAt = findSplitIndex(remaining, maxChars);
    const head = remaining.slice(0, splitAt).trimEnd();
    if (!head) {
      chunks.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars).trimStart();
      continue;
    }

    chunks.push(head);
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
};

export const publishThreadsText = async (input: PublishThreadsTextInput): Promise<PublishThreadsTextResult> => {
  const accessToken = input.accessToken.trim();
  const userId = input.userId.trim();
  const text = input.text.trim();
  const replyToId = input.replyToId?.trim();

  if (!accessToken) throw new Error("Threads access token is required.");
  if (!userId) throw new Error("Threads user id is required.");
  if (!text) throw new Error("Threads text is required.");
  if (text.length > THREADS_TEXT_MAX_CHARS) {
    throw new Error(`Threads text is too long. Keep it within ${THREADS_TEXT_MAX_CHARS} characters.`);
  }

  const createUrl = buildApiUrl({
    baseUrl: input.baseUrl,
    apiVersion: input.apiVersion,
    userId,
    action: "threads"
  });

  const createBody = new URLSearchParams();
  createBody.set("media_type", "TEXT");
  createBody.set("text", text);
  createBody.set("access_token", accessToken);
  if (input.replyControl) {
    createBody.set("reply_control", input.replyControl);
  }
  if (replyToId) {
    createBody.set("reply_to_id", replyToId);
  }

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody.toString()
  });
  await assertOk(createResponse);
  const createPayload = (await createResponse.json()) as unknown;
  const containerId = extractContainerId(createPayload);

  const publishUrl = buildApiUrl({
    baseUrl: input.baseUrl,
    apiVersion: input.apiVersion,
    userId,
    action: "threads_publish"
  });

  const publishBody = new URLSearchParams();
  publishBody.set("creation_id", containerId);
  publishBody.set("access_token", accessToken);

  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody.toString()
  });
  await assertOk(publishResponse);
  const publishPayload = (await publishResponse.json()) as unknown;
  const publishedId = extractPublishedId(publishPayload);

  return {
    containerId,
    publishedId,
    text,
    ...(replyToId ? { replyToId } : {}),
    raw: {
      create: createPayload,
      publish: publishPayload
    }
  };
};

export const publishThreadsTextChain = async (input: PublishThreadsTextInput): Promise<PublishThreadsTextChainResult> => {
  const chunks = splitThreadsText(input.text, THREADS_TEXT_MAX_CHARS);
  if (chunks.length === 0) throw new Error("Threads text is required.");

  let replyToId = input.replyToId?.trim() || null;
  const items: PublishThreadsTextChainResult["items"] = [];

  for (const [index, chunk] of chunks.entries()) {
    const published = await publishThreadsText({
      ...input,
      text: chunk,
      ...(replyToId ? { replyToId } : {})
    });

    items.push({
      index: index + 1,
      text: chunk,
      replyToId,
      containerId: published.containerId,
      publishedId: published.publishedId
    });
    replyToId = published.publishedId;
  }

  return {
    rootPostId: items[0].publishedId,
    lastPostId: items[items.length - 1].publishedId,
    items
  };
};

export const fetchThreadsRecentTexts = async (input: FetchThreadsRecentTextsInput): Promise<string[]> => {
  const accessToken = input.accessToken.trim();
  const userId = input.userId.trim();
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);

  if (!accessToken) throw new Error("Threads access token is required.");
  if (!userId) throw new Error("Threads user id is required.");

  const base = normalizeBaseUrl(input.baseUrl);
  const version = normalizeApiVersion(input.apiVersion);
  const url = new URL(`${base}/${version}/${encodeURIComponent(userId)}/threads`);
  url.searchParams.set("fields", "text");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { method: "GET" });
  await assertOk(response);
  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => (item && typeof item === "object" ? ((item as { text?: unknown }).text ?? "") : ""))
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
};
