import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Dance, DanceStyleExample, Tal } from "../data/types.js";
import { resolveDanceExamples, resolveDanceRuleText } from "./dance-schema.js";
import { resolveTalThinkingText } from "./tal-schema.js";
import { fetchThreadsRecentTexts } from "./stages/threads.js";

export type SourceKind = "text" | "file" | "url";

export type CustomSource = {
  type: SourceKind;
  value: string;
  label?: string;
};

export type SourceDigestItem = {
  type: SourceKind;
  label: string;
  length: number;
};

export type BuildCustomTalInput = {
  name: string;
  category?: string;
  tags?: string[];
  description?: string;
  goal?: string;
  sources: CustomSource[];
};

export type BuildCustomDanceInput = {
  name: string;
  category?: string;
  tags?: string[];
  description?: string;
  goal?: string;
  sources: CustomSource[];
  stylePolicy?: DanceStylePolicy;
  stage?: "generic" | "gpts" | "mcp" | "openclaw" | "threads" | "my-aws-server";
  examples?: Array<string | { input?: string; output?: string; label?: string; notes?: string }>;
  stageContext?: {
    threadsAccessToken?: string;
    threadsUserId?: string;
    threadsBaseUrl?: string;
    threadsApiVersion?: string;
    threadsFetchLimit?: number;
  };
};

export type DanceStylePolicy = {
  referenceWindow?: {
    mode?: "any" | "historical" | "recent";
    cutoffYear?: number;
  };
  expression?: {
    structure?: "paragraph" | "hybrid" | "list";
    punctuationDiscipline?: "relaxed" | "balanced" | "strict";
    templateStrictness?: "relaxed" | "balanced" | "strict";
  };
  constraints?: {
    prefer?: string[];
    avoid?: string[];
  };
};

export type UnifiedCustomInput = {
  input?: string;
  inputs?: string[];
  sources?: CustomSource[];
};

const DEFAULT_STAGE = "generic" as const;

const normalizeStage = (value?: string): Extract<BuildCustomDanceInput["stage"], string> => {
  const normalized = (value ?? DEFAULT_STAGE).trim().toLowerCase();
  if (normalized === "gpts" || normalized === "mcp" || normalized === "openclaw" || normalized === "threads" || normalized === "my-aws-server") {
    return normalized as Extract<BuildCustomDanceInput["stage"], string>;
  }
  return "generic";
};

const MAX_SOURCE_BYTES = 500_000;
const MAX_MERGED_CHARS = 45_000;
const DEFAULT_EXAMPLE_LIMIT = 20;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "will",
  "your",
  "about",
  "into",
  "their",
  "they",
  "them",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "is",
  "are",
  "be",
  "as",
  "by",
  "at",
  "or",
  "if",
  "not",
  "do",
  "dont",
  "can",
  "just",
  "than",
  "then",
  "also",
  "you",
  "we",
  "it",
  "our",
  "us"
]);

const KEYWORD_TO_CATEGORY: Array<{ category: string; keywords: string[] }> = [
  { category: "Strategy", keywords: ["strategy", "roadmap", "priority", "tradeoff", "risk", "decision"] },
  { category: "Product", keywords: ["product", "feature", "onboarding", "ux", "mvp", "requirements"] },
  { category: "Growth", keywords: ["growth", "funnel", "retention", "activation", "experiment", "acquisition"] },
  { category: "Research", keywords: ["research", "source", "evidence", "insight", "validation", "interview"] },
  { category: "Brand", keywords: ["brand", "positioning", "message", "narrative", "campaign"] },
  { category: "Developer", keywords: ["api", "code", "architecture", "repository", "sdk", "mcp"] },
  { category: "Operations", keywords: ["incident", "operations", "sla", "runbook", "process", "escalation"] },
  { category: "Education", keywords: ["teach", "lesson", "learning", "curriculum", "coach", "exam"] },
  { category: "Creator", keywords: ["content", "script", "creator", "youtube", "audience", "viral"] },
  { category: "Analytics", keywords: ["kpi", "metric", "dashboard", "cohort", "forecast", "attribution"] },
  { category: "Writing", keywords: ["writing", "copy", "headline", "email", "article", "edit"] },
  { category: "Public Case", keywords: ["public", "founder", "ceo", "influencer", "case", "persona"] },
  { category: "Executive", keywords: ["executive", "board", "investor", "brief", "memo"] }
];

const EXT_ALLOWLIST = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".xml",
  ".html",
  ".htm",
  ".log"
]);

const cleanText = (text: string) =>
  text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

const todayISO = () => new Date().toISOString().slice(0, 10);

const extractKeywords = (text: string, topN = 8) => {
  const counts = new Map<string, number>();
  const tokens = text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
};

const inferCategory = (text: string, fallback: string) => {
  const lower = text.toLowerCase();
  let best = { category: fallback, score: 0 };
  for (const item of KEYWORD_TO_CATEGORY) {
    const score = item.keywords.reduce((acc, keyword) => acc + (lower.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) {
      best = { category: item.category, score };
    }
  }
  return best.category;
};

const inferTone = (text: string) => {
  const lower = text.toLowerCase();
  const tone: string[] = [];
  if (/(board|investor|executive|brief|memo)/.test(lower)) tone.push("executive");
  if (/(urgent|asap|immediately|deadline|critical)/.test(lower)) tone.push("high-urgency");
  if (/(data|metric|kpi|analysis|evidence)/.test(lower)) tone.push("evidence-first");
  if (/(simple|clear|plain|easy)/.test(lower)) tone.push("clear");
  if (/(story|emotion|narrative|creative)/.test(lower)) tone.push("story-led");
  if (tone.length === 0) tone.push("practical", "clear");
  return Array.from(new Set(tone)).slice(0, 4);
};

const inferStructure = (text: string) => {
  const lower = text.toLowerCase();
  if (/(experiment|hypothesis|variant|result)/.test(lower)) return ["hypothesis", "test design", "result readout", "next iteration"];
  if (/(research|source|evidence|confidence)/.test(lower)) return ["question", "evidence", "insight", "confidence and limits"];
  if (/(investor|board|executive|decision)/.test(lower)) return ["context", "options", "recommendation", "owner and timeline"];
  if (/(lesson|learning|teach|tutorial)/.test(lower)) return ["objective", "concept", "example", "practice"];
  return ["context", "core point", "action steps", "next checkpoint"];
};

const inferFormatting = (text: string) => {
  const lower = text.toLowerCase();
  const items: string[] = ["short paragraphs", "bullet lists"];
  if (/(table|matrix)/.test(lower)) items.push("tables or matrix when needed");
  if (/(metric|kpi|number|data)/.test(lower)) items.push("highlight key metrics");
  if (/(owner|deadline|timeline)/.test(lower)) items.push("owner + timeline callout");
  return Array.from(new Set(items)).slice(0, 4);
};

const inferForbidden = (text: string) => {
  const lower = text.toLowerCase();
  const items = ["vague claims", "unstructured rambling"];
  if (/(data|metric|evidence)/.test(lower)) items.push("unsupported statements");
  if (/(urgent|critical|deadline)/.test(lower)) items.push("soft commitments without owners");
  return Array.from(new Set(items)).slice(0, 4);
};

const inferRhythm = (text: string) => {
  const lower = text.toLowerCase();
  if (/(urgent|critical|asap|war room)/.test(lower)) return "rapid and decisive";
  if (/(research|evidence|analysis)/.test(lower)) return "methodical and evidence-paced";
  if (/(story|creative|creator)/.test(lower)) return "hook -> insight -> payoff";
  return "clear and steady";
};

const inferStylePolicy = (text: string, goal?: string): DanceStylePolicy => {
  const lower = `${text}\n${goal ?? ""}`.toLowerCase();
  const historicalSignal =
    /(before\s+\d{4}|pre[-\s]?\d{4}|historical|classic|legacy|ai\s*이전|이전\s*자료|archival)/.test(lower) ||
    /(cover letter|job application|resume|personal statement|자기소개서|입사\s*지원)/.test(lower);
  const recentSignal = /(latest|current|trend|up[-\s]?to[-\s]?date|recent\s+years|최신|최근)/.test(lower);
  const paragraphSignal = /(paragraph|문단|letter form|essay style|자연스러운 문장 흐름)/.test(lower);
  const listSignal = /(bullet|list|checklist|outline|표 형태|목록)/.test(lower);
  const punctuationStrictSignal = /(punctuation|dash|hyphen|separator|대시|하이픈|문장부호)/.test(lower);
  const templateStrictSignal = /(human[-\s]?written|natural voice|non[-\s]?ai|avoid ai|authentic|자연스러운 문체|ai스럽지)/.test(lower);

  return {
    referenceWindow: {
      mode: historicalSignal ? "historical" : recentSignal ? "recent" : "any"
    },
    expression: {
      structure: paragraphSignal ? "paragraph" : listSignal ? "list" : "hybrid",
      punctuationDiscipline: punctuationStrictSignal ? "strict" : "balanced",
      templateStrictness: templateStrictSignal ? "strict" : "balanced"
    }
  };
};

const normalizeRuleList = (items?: string[]) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

const mergeStylePolicy = (inferred: DanceStylePolicy, user?: DanceStylePolicy): DanceStylePolicy => {
  const merged: DanceStylePolicy = {
    referenceWindow: {
      mode: user?.referenceWindow?.mode ?? inferred.referenceWindow?.mode ?? "any",
      cutoffYear: user?.referenceWindow?.cutoffYear
    },
    expression: {
      structure: user?.expression?.structure ?? inferred.expression?.structure ?? "hybrid",
      punctuationDiscipline:
        user?.expression?.punctuationDiscipline ?? inferred.expression?.punctuationDiscipline ?? "balanced",
      templateStrictness:
        user?.expression?.templateStrictness ?? inferred.expression?.templateStrictness ?? "balanced"
    },
    constraints: {
      prefer: normalizeRuleList([...(user?.constraints?.prefer ?? [])]),
      avoid: normalizeRuleList([...(user?.constraints?.avoid ?? [])])
    }
  };
  return merged;
};

const normalizeTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isLikelyUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

const isLikelyFilePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("\n")) return false;
  if (isLikelyUrl(trimmed)) return false;

  if (/^(~\/|\/|\.{1,2}\/|[a-zA-Z]:[\\/])/.test(trimmed)) return true;
  if (trimmed.includes("/") || trimmed.includes("\\")) return true;

  const ext = path.extname(trimmed).toLowerCase();
  return Boolean(ext && EXT_ALLOWLIST.has(ext));
};

const sanitizeInputLine = (value: string) => value.replace(/^[-*]\s+/, "").trim();

const explodeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => sanitizeInputLine(line))
    .filter(Boolean);

  if (lines.length < 2) return [trimmed];

  const listLike = lines.every((line) => isLikelyUrl(line) || isLikelyFilePath(line));
  return listLike ? lines : [trimmed];
};

const detectSourceType = async (value: string): Promise<SourceKind> => {
  if (isLikelyUrl(value)) return "url";

  if (isLikelyFilePath(value)) {
    const resolvedPath = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
    try {
      const info = await stat(resolvedPath);
      if (info.isFile()) return "file";
    } catch {
      // Fall through to text when the path cannot be resolved.
    }
  }

  return "text";
};

export const resolveUnifiedSources = async ({ input, inputs, sources }: UnifiedCustomInput) => {
  if (sources && sources.length > 0) {
    return sources;
  }

  const mergedInputs = [...(input ? [input] : []), ...(inputs ?? [])]
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap(explodeInput);

  if (mergedInputs.length === 0) {
    throw new Error("At least one input is required. Provide `input` or `inputs`.");
  }

  const normalized: CustomSource[] = [];
  for (const value of mergedInputs) {
    const type = await detectSourceType(value);
    normalized.push({ type, value });
  }

  return normalized;
};

const parseManualExample = (
  source: string | { input?: string; output?: string; label?: string; notes?: string }
): DanceStyleExample | null => {
  if (typeof source === "object") {
    const input = source.input?.trim() ?? "";
    const output = source.output?.trim() ?? "";
    if (!input || !output) return null;
    return {
      input,
      output,
      label: source.label?.trim() || undefined,
      notes: source.notes?.trim() || undefined
    };
  }

  const raw = source.trim().replace(/\\n/g, "\n");
  if (!raw) return null;

  const arrowIdx = raw.indexOf("=>");
  if (arrowIdx > 0) {
    const left = raw.slice(0, arrowIdx).trim();
    const right = raw.slice(arrowIdx + 2).trim();
    if (left && right) return { input: left, output: right, label: "Manual" };
  }

  const ioMatch = raw.match(/input\s*:\s*([\s\S]*?)\n+\s*output\s*:\s*([\s\S]*)/i);
  if (ioMatch) {
    const input = ioMatch[1]?.trim() ?? "";
    const output = ioMatch[2]?.trim() ?? "";
    if (input && output) return { input, output, label: "Manual" };
  }

  const parts = raw.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      input: parts[0],
      output: parts.slice(1).join("\n\n"),
      label: "Manual"
    };
  }

  return {
    input: "Apply this style to the current task.",
    output: raw,
    label: "Manual output sample"
  };
};

const extractInlineExamplesFromText = (text: string): DanceStyleExample[] => {
  const matches = Array.from(text.matchAll(/input\s*:\s*([\s\S]*?)\n+\s*output\s*:\s*([\s\S]*?)(?=\n+\s*input\s*:|$)/gi));
  if (matches.length === 0) return [];

  return matches
    .map((match) => {
      const input = match[1]?.trim() ?? "";
      const output = match[2]?.trim() ?? "";
      if (!input || !output) return null;
      return {
        input,
        output,
        label: "Auto parsed"
      } satisfies DanceStyleExample;
    })
    .filter((item): item is DanceStyleExample => Boolean(item))
    .slice(0, 4);
};

const extractNumberedPostExamplesFromText = (text: string, goal?: string): DanceStyleExample[] => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const headerRegex = /(?:^|\n)\s*게시글\s*(\d+)[^\n]*\n/gi;
  const headers = Array.from(normalized.matchAll(headerRegex));
  if (headers.length === 0) return [];

  const examples: DanceStyleExample[] = [];
  const subject = goal?.trim() || "제공된 게시글 스타일";

  for (let i = 0; i < headers.length; i += 1) {
    const match = headers[i];
    const number = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < headers.length ? (headers[i + 1].index ?? normalized.length) : normalized.length;
    const block = normalized.slice(start, end).trim();
    if (!block) continue;

    examples.push({
      label: "Numbered post sample",
      input: `${subject} (게시글 ${number})`,
      output: block
    });
  }

  return examples;
};

const applyStageRuleTuning = ({
  stage,
  tone,
  structure,
  formatting,
  forbidden
}: {
  stage: NonNullable<BuildCustomDanceInput["stage"]>;
  tone: string[];
  structure: string[];
  formatting: string[];
  forbidden: string[];
}) => {
  if (stage === "threads") {
    tone.push("conversational", "attention-first");
    structure.push("hook in first line", "single message thread", "one clear CTA");
    formatting.push("short line cadence with deliberate line breaks", "prefer concrete claim + proof + CTA");
    forbidden.push("hashtag spam", "multi-topic dump", "long preamble");
    return "hook -> proof -> CTA";
  }

  if (stage === "gpts") {
    formatting.push("optimize for instruction-following consistency across long chats");
    forbidden.push("style drift across turns");
    return "consistent multi-turn cadence";
  }

  if (stage === "mcp" || stage === "openclaw") {
    formatting.push("keep outputs deterministic and tool-friendly");
    forbidden.push("ambiguous output wrappers that break downstream parsing");
    return "structured and parseable";
  }

  return undefined;
};

const buildGeneratedExamples = ({
  stage,
  goal,
  keywords,
  structure
}: {
  stage: NonNullable<BuildCustomDanceInput["stage"]>;
  goal?: string;
  keywords: string[];
  structure: string[];
}): DanceStyleExample[] => {
  const subject = goal?.trim() || keywords.slice(0, 2).join(" + ") || "the task";

  if (stage === "threads") {
    return [
      {
        label: "Stage auto",
        input: `Write a Threads post about ${subject}.`,
        output: `Most teams ship features. Few ship outcomes.\n\nThis week we cut one bottleneck in ${subject} and recovered real velocity.\n\nIf you're stuck, pick one metric, one owner, one deadline.`,
        notes: "Threads format: hook, proof, CTA."
      },
      {
        label: "Stage auto",
        input: `Announce a progress update for ${subject}.`,
        output: `Quick build log:\n1) Constraint we hit\n2) Fix we shipped\n3) Next checkpoint\n\nSmall loops beat big promises.`,
        notes: "Compact line rhythm."
      }
    ];
  }

  return [
    {
      label: "Auto generated",
      input: `Produce a response for ${subject}.`,
      output: `Context: define the operating constraint.\nCore: present the key move using ${structure[0] ?? "clear structure"}.\nAction: close with one owner and one measurable checkpoint.`
    },
    {
      label: "Auto generated",
      input: "Rewrite this draft in the configured style.",
      output: "Preserve intent, tighten structure, remove vague claims, and end with executable next actions."
    }
  ];
};

const resolveFileText = async (value: string) => {
  const rawPath = value.trim();
  if (!rawPath) throw new Error("Empty file path");
  const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext && !EXT_ALLOWLIST.has(ext)) {
    throw new Error(`Unsupported file extension for text ingestion: ${ext}`);
  }

  const info = await stat(resolvedPath);
  if (info.size > MAX_SOURCE_BYTES) {
    throw new Error(`File is too large (${info.size} bytes). Max allowed is ${MAX_SOURCE_BYTES} bytes.`);
  }
  return readFile(resolvedPath, "utf8");
};

const resolveUrlText = async (value: string) => {
  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(parsed.toString(), { signal: controller.signal, redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status}): ${parsed.toString()}`);
    }
    const text = await response.text();
    return cleanText(text);
  } finally {
    clearTimeout(timeoutId);
  }
};

const mergeSources = async (sources: CustomSource[]) => {
  const merged: string[] = [];
  const digest: SourceDigestItem[] = [];

  for (const source of sources) {
    let content = "";
    if (source.type === "text") {
      content = source.value.trim();
    } else if (source.type === "file") {
      content = await resolveFileText(source.value);
    } else {
      content = await resolveUrlText(source.value);
    }

    const cleaned = cleanText(content);
    if (!cleaned) continue;
    merged.push(cleaned);
    digest.push({
      type: source.type,
      label: source.label?.trim() || source.value.slice(0, 120),
      length: cleaned.length
    });
  }

  const mergedText = merged.join("\n\n").slice(0, MAX_MERGED_CHARS);
  if (!mergedText.trim()) {
    throw new Error("No usable text could be extracted from the provided sources.");
  }
  return { mergedText, digest };
};

export const buildThinkingPromptFromTal = (tal: Tal) =>
  ["Reasoning Rules:", `Profile: ${tal.name}`, resolveTalThinkingText(tal)].join("\n");

export const buildOutputPromptFromDance = (dance: Dance) =>
  (() => {
    const examples = resolveDanceExamples(dance);
    const ruleText = resolveDanceRuleText(dance);
    return [
      "Response Style Rules:",
      `Style Profile: ${dance.name}`,
      ruleText,
      examples.length > 0 ? "Style Examples (reference, do not copy verbatim):" : "",
      ...examples.slice(0, 2).map((example, index) =>
        [`Example ${index + 1}:`, `Input: ${example.input}`, `Output: ${example.output}`].join("\n")
      )
    ]
      .filter(Boolean)
      .join("\n");
  })();

export const buildCustomTal = async (input: BuildCustomTalInput) => {
  const { mergedText, digest } = await mergeSources(input.sources);
  const keywords = extractKeywords(mergedText, 10);
  const sentences = splitSentences(mergedText);
  const category = input.category?.trim() || inferCategory(mergedText, "Strategy");
  const name = input.name.trim();
  const slug = `${slugify(name)}-custom-tal`;
  const goal = input.goal?.trim();
  const thinkingFreeform = [
    goal ? `Primary objective: ${goal}` : "Primary objective: make decisions from explicit constraints and measurable outcomes.",
    keywords[0] ? `Anchor decisions around "${keywords[0]}" as a first-class signal.` : "Anchor decisions around highest-leverage signals first.",
    keywords[1] ? `Use "${keywords[1]}" as a validation checkpoint before finalizing recommendations.` : "Separate assumptions from verified evidence before finalizing recommendations.",
    "Keep tradeoffs visible and state uncertainty directly.",
    "Translate analysis into concrete next actions with owner and timeline.",
    "Avoid vague language, decorative logic chains, and unsupported conclusions."
  ]
    .filter(Boolean)
    .join("\n");

  const tags = Array.from(
    new Set([...(input.tags ?? []).map(normalizeTag).filter(Boolean), ...keywords.slice(0, 4).map(normalizeTag), "custom", "user-derived"])
  ).slice(0, 8);

  const tal: Tal = {
    slug,
    name: name.endsWith("Tal") ? name : `${name} Tal`,
    description: input.description?.trim() || `Custom Tal generated from user-provided sources for ${category.toLowerCase()} acts.`,
    category,
    tags,
    featuredScore: 110,
    createdAt: todayISO(),
    thinking: thinkingFreeform
  };

  return {
    tal,
    thinkingPrompt: buildThinkingPromptFromTal(tal),
    sourceDigest: digest,
    extraction: {
      topKeywords: keywords.slice(0, 8),
      sampleSentences: sentences.slice(0, 3)
    }
  };
};

export const buildCustomDance = async (input: BuildCustomDanceInput) => {
  const { mergedText, digest } = await mergeSources(input.sources);
  const keywords = extractKeywords(mergedText, 10);
  const category = input.category?.trim() || inferCategory(mergedText, "Executive");
  const name = input.name.trim();
  const slug = `${slugify(name)}-custom-dance`;
  const stage = normalizeStage(input.stage);
  const inferredStylePolicy = inferStylePolicy(mergedText, input.goal);
  const stylePolicy = mergeStylePolicy(inferredStylePolicy, input.stylePolicy);
  const tone = inferTone(mergedText);
  const structure = inferStructure(mergedText);
  const formatting = inferFormatting(mergedText);
  const forbidden = inferForbidden(mergedText);
  let rhythm = inferRhythm(mergedText);

  const isHistoricalReference = stylePolicy.referenceWindow?.mode === "historical" || (stylePolicy.referenceWindow?.cutoffYear ?? 9999) <= 2022;
  if (isHistoricalReference) {
    tone.push("grounded", "editorial");
    formatting.push(
      "prefer natural prose flow with varied sentence cadence",
      "use measured transitions instead of formulaic scaffolding"
    );
    forbidden.push(
      "overly synthetic or formulaic transition scaffolding",
      "uniform sentence shells repeated across paragraphs"
    );
    rhythm = "measured editorial cadence";
  }

  const structureMode = stylePolicy.expression?.structure ?? "hybrid";
  if (structureMode === "paragraph") {
    formatting.push("paragraph-first organization; use bullets only for dense facts");
  } else if (structureMode === "list") {
    formatting.push("list-first organization with clear section headers");
  } else {
    formatting.push("hybrid flow: brief context paragraph then structured bullets");
  }

  const punctuationDiscipline = stylePolicy.expression?.punctuationDiscipline ?? "balanced";
  if (punctuationDiscipline === "strict") {
    formatting.push("punctuation discipline: clean separators and minimal rhetorical punctuation");
    forbidden.push("separator-heavy punctuation chains (e.g., repeated dashes or stacked parentheticals)");
  } else if (punctuationDiscipline === "relaxed") {
    formatting.push("allow expressive punctuation when it improves clarity");
  }

  const templateStrictness = stylePolicy.expression?.templateStrictness ?? "balanced";
  if (templateStrictness === "strict") {
    formatting.push("prioritize authentic phrasing over reusable template shells");
    forbidden.push("formulaic framing boilerplate and repetitive transition templates");
    rhythm = structureMode === "paragraph" ? "natural and context-aware" : "precise and low-template";
  } else if (templateStrictness === "relaxed") {
    formatting.push("reuse proven templates when speed is more important than originality");
  }

  if (stylePolicy.referenceWindow?.cutoffYear) {
    formatting.push(`anchor style references to sources up to ${stylePolicy.referenceWindow.cutoffYear}`);
  }

  const stageRhythm = applyStageRuleTuning({
    stage,
    tone,
    structure,
    formatting,
    forbidden
  });
  if (stageRhythm) rhythm = stageRhythm;

  formatting.push(...(stylePolicy.constraints?.prefer ?? []));
  forbidden.push(...(stylePolicy.constraints?.avoid ?? []));

  const normalizedTone = Array.from(new Set(tone)).slice(0, 6);
  const normalizedStructure = Array.from(new Set(structure)).slice(0, 6);
  const normalizedFormatting = Array.from(new Set(formatting)).slice(0, 8);
  const normalizedForbidden = Array.from(new Set(forbidden)).slice(0, 10);
  const ruleFreeform = [
    input.goal?.trim()
      ? `Output objective: ${input.goal.trim()}`
      : "Output objective: deliver actionable and context-grounded responses.",
    normalizedTone.length > 0 ? `Voice and tone guidance: ${normalizedTone.join(", ")}.` : "",
    normalizedStructure.length > 0 ? `Response flow guidance: ${normalizedStructure.join(" -> ")}.` : "",
    normalizedFormatting.length > 0 ? `Formatting preferences: ${normalizedFormatting.join("; ")}.` : "",
    normalizedForbidden.length > 0 ? `Avoid patterns: ${normalizedForbidden.join("; ")}.` : "",
    rhythm ? `Cadence: ${rhythm}.` : "",
    stylePolicy.referenceWindow?.mode === "historical"
      ? "Reference preference: use historical examples and human-written cadence; avoid recent AI-template phrasing."
      : "",
    stylePolicy.referenceWindow?.cutoffYear ? `Reference cutoff: prioritize material published on or before ${stylePolicy.referenceWindow.cutoffYear}.` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const manualExamples = (input.examples ?? [])
    .map((item) => parseManualExample(item))
    .filter((item): item is DanceStyleExample => Boolean(item));
  const inlineExamples = extractInlineExamplesFromText(mergedText);
  const numberedPostExamples = extractNumberedPostExamplesFromText(mergedText, input.goal);
  let stageExamples: DanceStyleExample[] = [];
  const stageWarnings: string[] = [];
  const stageExampleLimit = Math.min(Math.max(input.stageContext?.threadsFetchLimit ?? DEFAULT_EXAMPLE_LIMIT, 1), 20);

  if (stage === "threads") {
    if (input.stageContext?.threadsAccessToken && input.stageContext?.threadsUserId) {
      try {
        const recentTexts = await fetchThreadsRecentTexts({
          accessToken: input.stageContext.threadsAccessToken,
          userId: input.stageContext.threadsUserId,
          baseUrl: input.stageContext.threadsBaseUrl,
          apiVersion: input.stageContext.threadsApiVersion,
          limit: input.stageContext.threadsFetchLimit ?? DEFAULT_EXAMPLE_LIMIT
        });

        stageExamples = recentTexts.slice(0, stageExampleLimit).map((text, index) => ({
          label: "Threads live sample",
          input: input.goal?.trim() || `Create a high-retention Threads post (${index + 1}).`,
          output: text
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stageWarnings.push(`Threads stage auto-sample fetch failed: ${message}`);
        stageExamples = [];
      }
    } else {
      stageWarnings.push("Threads stage selected without access token/user id; using provided or generated examples only.");
    }
  }

  const generatedExamples = buildGeneratedExamples({
    stage,
    goal: input.goal,
    keywords,
    structure: normalizedStructure
  });

  const baseExamples = [...manualExamples, ...inlineExamples, ...numberedPostExamples, ...stageExamples];
  const styleExamples = [...baseExamples];
  if (styleExamples.length === 0) {
    styleExamples.push(...generatedExamples);
  } else if (styleExamples.length < 2) {
    styleExamples.push(...generatedExamples.slice(0, 2 - styleExamples.length));
  }

  const exemplarSet = {
    styleExamples: styleExamples.slice(0, stageExampleLimit),
    antiPatterns: normalizedForbidden.slice(0, 4).map((item) => ({ bad: item }))
  };

  const dance: Dance = {
    slug,
    name,
    description: input.description?.trim() || `Custom Dance generated from user-provided sources for ${category.toLowerCase()} outputs.`,
    category,
    rules: ruleFreeform,
    exemplarSet
  };

  return {
    dance,
    outputPrompt: buildOutputPromptFromDance(dance),
    sourceDigest: digest,
    warnings: stageWarnings,
    extraction: {
      topKeywords: keywords.slice(0, 8),
      appliedStylePolicy: stylePolicy,
      stage,
      exampleCount: exemplarSet.styleExamples.length,
      stageWarnings,
      exampleSources: {
        manual: manualExamples.length,
        inlineParsed: inlineExamples.length,
        numberedPosts: numberedPostExamples.length,
        stageAuto: stageExamples.length
      }
    }
  };
};

export const buildCustomTalDance = async (input: {
  name: string;
  talCategory?: string;
  danceCategory?: string;
  tags?: string[];
  goal?: string;
  sources: CustomSource[];
  stylePolicy?: DanceStylePolicy;
  stage?: BuildCustomDanceInput["stage"];
  examples?: BuildCustomDanceInput["examples"];
  stageContext?: BuildCustomDanceInput["stageContext"];
}) => {
  const [talResult, danceResult] = await Promise.all([
    buildCustomTal({
      name: input.name,
      category: input.talCategory,
      tags: input.tags,
      goal: input.goal,
      sources: input.sources
    }),
    buildCustomDance({
      name: input.name,
      category: input.danceCategory,
      tags: input.tags,
      goal: input.goal,
      sources: input.sources,
      stylePolicy: input.stylePolicy,
      stage: input.stage,
      examples: input.examples,
      stageContext: input.stageContext
    })
  ]);

  return {
    tal: talResult.tal,
    dance: danceResult.dance,
    thinkingPrompt: talResult.thinkingPrompt,
    outputPrompt: danceResult.outputPrompt,
    combinedPrompt: [talResult.thinkingPrompt, danceResult.outputPrompt].join("\n\n"),
    sourceDigest: talResult.sourceDigest
  };
};
