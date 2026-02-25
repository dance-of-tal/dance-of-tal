import { Dance, DanceExemplarSet, DanceStyleExample } from "../data/types.js";

const extractRuleTokens = (text: string) =>
  text
    .split(/\n+/g)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/[,:;|/]+/g).map((part) => part.trim()).filter(Boolean))
    .slice(0, 40);

const normalizeExample = (value: { input?: string; output?: string; label?: string; notes?: string }): DanceStyleExample | null => {
  const input = value.input?.trim() ?? "";
  const output = value.output?.trim() ?? "";
  if (!input || !output) return null;
  return {
    input,
    output,
    label: value.label?.trim() || undefined,
    notes: value.notes?.trim() || undefined
  };
};

export const resolveDanceExemplarSet = (dance: Dance): DanceExemplarSet => {
  const styleExamples = (dance.exemplarSet?.styleExamples ?? [])
    .map((example) => normalizeExample(example))
    .filter((example): example is DanceStyleExample => Boolean(example));

  return {
    styleExamples: styleExamples.slice(0, 4),
    antiPatterns: dance.exemplarSet?.antiPatterns?.slice(0, 4)
  };
};

export const resolveDanceExamples = (dance: Dance) => resolveDanceExemplarSet(dance).styleExamples;

export const collectDanceRuleTokens = (dance: Dance) => {
  return extractRuleTokens(dance.rules ?? "");
};

const findSection = (text: string, label: "tone" | "structure") => {
  const lines = text.split(/\n+/g);
  const idx = lines.findIndex((line) => line.toLowerCase().startsWith(`${label}:`));
  if (idx === -1) return [];
  const collected: string[] = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    if (/^[a-z][a-z\s]+:/i.test(raw)) break;
    collected.push(raw.replace(/^[-*]\s+/, ""));
  }
  return collected.slice(0, 6);
};

export const resolveDanceRuleText = (dance: Dance) => dance.rules.trim();

export const summarizeDanceRule = (dance: Dance) => {
  const text = resolveDanceRuleText(dance);
  const tone = findSection(text, "tone");
  const structure = findSection(text, "structure");
  return {
    tone: tone.length > 0 ? tone : extractRuleTokens(text).slice(0, 3),
    structure: structure.length > 0 ? structure : extractRuleTokens(text).slice(3, 6),
    rhythm: null as string | null
  };
};
