import { Tal } from "../data/types.js";

const collectTextTokens = (text: string) =>
  (text.match(/[A-Za-z0-9][A-Za-z0-9\-_/]{2,}/g) ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

export const resolveTalThinkingText = (tal: Tal) => tal.thinking.trim();

export const collectTalThinkingTokens = (tal: Tal) => {
  return Array.from(new Set(collectTextTokens(tal.thinking)));
};
