import { acts } from "../data/acts.js";
import { dances } from "../data/dances.js";
import { tals } from "../data/tals.js";
import { Act, Dance, Tal } from "../data/types.js";
import { dataSummary, recommendedCombos } from "../data/catalog.js";
import { getDanceCategories, getDanceCategory, recommendDanceCategoriesForTal } from "./danceCategory.js";
import { collectDanceRuleTokens, resolveDanceExamples, resolveDanceExemplarSet, resolveDanceRuleText, summarizeDanceRule } from "./dance-schema.js";
import { collectTalThinkingTokens, resolveTalThinkingText } from "./tal-schema.js";

export type ListInput = {
  query?: string;
  category?: string;
  tags?: string[];
};

export type BuildMode = "thinking" | "output" | "combined";
export type OpenClawProfileInput = {
  talSlug: string;
  danceSlug: string;
  assistantName?: string;
  personaGoal?: string;
  userContext?: string;
  includeTaskStarter?: boolean;
};

export const buildSystemInstructionHeader = () =>
  [
    "System Instruction:",
    "You are an AI assistant.",
    "Follow the reasoning rules first, execute process steps, and then produce output using the response style rules.",
    "Keep reasoning disciplined and produce outputs and behavior that match the required tone, format, and operating constraints."
  ].join("\n");

export const findTal = (slug: string): Tal | undefined => tals.find((tal) => tal.slug === slug);
const normalizeDance = (dance: Dance): Dance => ({
  ...dance,
  exemplarSet: resolveDanceExemplarSet(dance)
});
export const findDance = (slug: string): Dance | undefined => {
  const dance = dances.find((item) => item.slug === slug);
  return dance ? normalizeDance(dance) : undefined;
};
export const findAct = (slug: string): Act | undefined => acts.find((act) => act.slug === slug);

export const listTals = ({ query, category, tags }: ListInput) => {
  const normalizedQuery = query?.toLowerCase().trim() ?? "";
  const normalizedTags = (tags ?? []).map((tag) => tag.toLowerCase());

  return tals
    .filter((tal) => {
      const matchQuery =
        normalizedQuery.length === 0 ||
        [tal.name, tal.description, tal.category, ...tal.tags, ...collectTalThinkingTokens(tal)].join(" ").toLowerCase().includes(normalizedQuery);
      const matchCategory = !category || tal.category === category;
      const matchTags = normalizedTags.length === 0 || normalizedTags.every((tag) => tal.tags.map((t) => t.toLowerCase()).includes(tag));
      return matchQuery && matchCategory && matchTags;
    })
    .map((tal) => ({ slug: tal.slug, name: tal.name, description: tal.description, category: tal.category, tags: tal.tags }));
};

export const listActs = () => {
  return acts.map((act) => ({
    slug: act.slug,
    name: act.name,
    description: act.description
  }));
};

export const listDances = ({ query, category, tags }: ListInput) => {
  const normalizedQuery = query?.toLowerCase().trim() ?? "";
  const normalizedTags = (tags ?? []).map((tag) => tag.toLowerCase());

  return dances
    .filter((dance) => {
      const danceCategory = getDanceCategory(dance);
      const ruleTokens = collectDanceRuleTokens(dance);
      const matchQuery =
        normalizedQuery.length === 0 ||
        [dance.name, dance.description, danceCategory, ...ruleTokens].join(" ").toLowerCase().includes(normalizedQuery);
      const summary = summarizeDanceRule(dance);
      const tagSource = [...summary.tone, ...summary.structure, ...ruleTokens].map((item) => item.toLowerCase());
      const matchTags = normalizedTags.length === 0 || normalizedTags.every((tag) => tagSource.includes(tag));
      const matchCategory = !category || danceCategory === category;
      return matchQuery && matchTags && matchCategory;
    })
    .map((dance) => ({
      slug: dance.slug,
      name: dance.name,
      description: dance.description,
      category: getDanceCategory(dance),
      tone: summarizeDanceRule(dance).tone,
      structure: summarizeDanceRule(dance).structure
    }));
};

export const listDanceCategories = () => getDanceCategories(dances);

export const recommendDanceCategories = (talSlug: string) => {
  const tal = findTal(talSlug);
  if (!tal) return null;
  return recommendDanceCategoriesForTal(tal, dances);
};

export const getDataSummary = (type: "all" | "tals" | "dances" | "combos" = "all", limit?: number) => {
  if (type === "tals") {
    const items = limit ? dataSummary.talSummaries.slice(0, limit) : dataSummary.talSummaries;
    return { counts: dataSummary.counts, items };
  }
  if (type === "dances") {
    const items = limit ? dataSummary.danceSummaries.slice(0, limit) : dataSummary.danceSummaries;
    return { counts: dataSummary.counts, items };
  }
  if (type === "combos") {
    const items = limit ? dataSummary.comboSummaries.slice(0, limit) : dataSummary.comboSummaries;
    return { counts: dataSummary.counts, items };
  }
  return dataSummary;
};

export const getRecommendedCombos = ({ talSlug, danceSlug, limit }: { talSlug?: string; danceSlug?: string; limit?: number }) => {
  if (talSlug) {
    const relation = recommendedCombos.talToDance[talSlug] ?? null;
    if (!relation) return null;
    const tal = findTal(talSlug);
    const recommendedDances = relation.recommendedDanceSlugs
      .map((slug) => findDance(slug))
      .filter((item): item is Dance => Boolean(item))
      .map((dance) => ({ slug: dance.slug, name: dance.name, category: dance.category }));

    return {
      tal: tal ? { slug: tal.slug, name: tal.name, category: tal.category } : { slug: talSlug },
      recommendedDanceCategories: relation.recommendedDanceCategories,
      recommendedDances: limit ? recommendedDances.slice(0, limit) : recommendedDances
    };
  }

  if (danceSlug) {
    const talMatches = Object.entries(recommendedCombos.talToDance)
      .filter(([, relation]) => relation.recommendedDanceSlugs.includes(danceSlug))
      .map(([slug, relation]) => {
        const tal = findTal(slug);
        return {
          talSlug: slug,
          talName: tal?.name ?? slug,
          talCategory: tal?.category ?? null,
          rank: relation.recommendedDanceSlugs.indexOf(danceSlug) + 1
        };
      });
    return { danceSlug, items: limit ? talMatches.slice(0, limit) : talMatches };
  }

  const combos = Object.entries(recommendedCombos.talToDance).flatMap(([currentTalSlug, relation]) =>
    relation.recommendedDanceSlugs.map((currentDanceSlug, index) => ({
      talSlug: currentTalSlug,
      danceSlug: currentDanceSlug,
      rank: index + 1
    }))
  );

  return { items: limit ? combos.slice(0, limit) : combos };
};

export const buildThinkingPrompt = (tal: Tal) => {
  return [
    "Reasoning Rules:",
    `Profile: ${tal.name}`,
    resolveTalThinkingText(tal)
  ].join("\n");
};

export const buildOutputPrompt = (dance: Dance) => {
  const ruleText = resolveDanceRuleText(dance);
  const examples = resolveDanceExamples(dance);

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
};

export const buildActPrompt = (act: Act) => {
  return [
    "Process Sequence Rules:",
    `Act Profile: ${act.name}`,
    `Description: ${act.description}`,
    "Required Steps:",
    ...(act.steps || []).map((step: any, index: any) => `${index + 1}. ${step}`)
  ].join("\n");
};

export const buildPrompt = ({
  talSlug,
  danceSlug,
  actSlug,
}: {
  talSlug?: string | null;
  danceSlug?: string | null;
  actSlug?: string | null;
}) => {
  const tal = talSlug ? findTal(talSlug) : undefined;
  const dance = danceSlug ? findDance(danceSlug) : undefined;
  const act = actSlug ? findAct(actSlug) : undefined;

  if (!tal && !dance && !act) {
    return null;
  }

  const thinkingPrompt = tal ? buildThinkingPrompt(tal) : null;
  const outputPrompt = dance ? buildOutputPrompt(dance) : null;
  const actPrompt = act ? buildActPrompt(act) : null;

  const combinedPrompt = [
    buildSystemInstructionHeader(),
    thinkingPrompt,
    actPrompt,
    outputPrompt
  ].filter(Boolean).join("\n\n");

  return { tal, dance, act, thinkingPrompt, outputPrompt, actPrompt, combinedPrompt };
};

export const quickApply = ({ talSlug, danceSlug, actSlug, task }: { talSlug?: string | null; danceSlug?: string | null; actSlug?: string | null; task: string }) => {
  const prompts = buildPrompt({ talSlug, danceSlug, actSlug });
  if (!prompts) return null;

  return [
    "SYSTEM:",
    buildSystemInstructionHeader(),
    "",
    prompts.thinkingPrompt ?? "",
    prompts.actPrompt ? `\n${prompts.actPrompt}\n` : "",
    prompts.outputPrompt ?? "",
    "",
    "USER:",
    task
  ].filter(Boolean).join("\n");
};

export const buildOpenClawProfile = ({
  talSlug,
  danceSlug,
  assistantName,
  personaGoal,
  userContext,
  includeTaskStarter = true
}: OpenClawProfileInput) => {
  const tal = findTal(talSlug);
  const dance = findDance(danceSlug);
  const prompts = buildPrompt({ talSlug, danceSlug });

  if (!tal || !dance || !prompts) {
    return null;
  }

  const profileName = assistantName?.trim() || `${tal.name} x ${dance.name} Personal Assistant`;
  const profileId = `${tal.slug}__${dance.slug}`;
  const goalLine = personaGoal?.trim() ? `Primary Goal: ${personaGoal.trim()}` : "";
  const contextBlock = userContext?.trim() ? `User Context:\n${userContext.trim()}` : "";

  const systemPrompt = [
    `Assistant Profile: ${profileName}`,
    goalLine,
    prompts.combinedPrompt,
    contextBlock,
    "Behavior: Keep this persona active across conversations unless the user asks to change or reset it."
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    profile: {
      id: profileId,
      name: profileName,
      source: "dance-of-tal",
      tal: { slug: tal.slug, name: tal.name, category: tal.category },
      dance: { slug: dance.slug, name: dance.name, category: dance.category },
      systemPrompt,
      generatedAt: new Date().toISOString()
    },
    usage: {
      host: "OpenClaw",
      target: "Personal AI Assistant",
      steps: [
        "Create or edit your OpenClaw assistant profile.",
        "Paste `profile.systemPrompt` into the assistant system/persona instructions field.",
        "Save and run your assistant in your preferred channels.",
        "Re-run this tool with different Tal/Dance slugs whenever you want to switch behavior."
      ]
    },
    starterPackage: includeTaskStarter
      ? {
        userTaskTemplate: "Replace with your real task.",
        quickApply: quickApply({
          talSlug,
          danceSlug,
          task: "Replace with your real task."
        })
      }
      : null
  };
};
