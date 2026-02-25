import { gptsBootstrap, gptsDanceBriefs, gptsReco, gptsTalBriefs } from "../data/catalog.js";

const normalize = (value: string) => value.toLowerCase().trim();

export const getGptsBootstrap = () => gptsBootstrap;

export const listGptsTalBriefs = ({ q, category, tag, limit }: { q?: string; category?: string; tag?: string; limit?: number }) => {
  const query = normalize(q ?? "");
  const categoryQuery = (category ?? "").trim();
  const tagQuery = normalize(tag ?? "");

  const items = gptsTalBriefs.filter((tal) => {
    const matchQuery = query.length === 0 || [tal.s, tal.n, tal.c, tal.d, ...tal.t].join(" ").toLowerCase().includes(query);
    const matchCategory = !categoryQuery || categoryQuery === "All" || tal.c === categoryQuery;
    const matchTag = !tagQuery || tal.t.map((item) => item.toLowerCase()).includes(tagQuery);
    return matchQuery && matchCategory && matchTag;
  });

  return limit && limit > 0 ? items.slice(0, limit) : items;
};

export const listGptsDanceBriefs = ({ q, category, tag, limit }: { q?: string; category?: string; tag?: string; limit?: number }) => {
  const query = normalize(q ?? "");
  const categoryQuery = (category ?? "").trim();
  const tagQuery = normalize(tag ?? "");

  const items = gptsDanceBriefs.filter((dance) => {
    const matchQuery = query.length === 0 || [dance.s, dance.n, dance.c, dance.d, ...dance.t, ...dance.st].join(" ").toLowerCase().includes(query);
    const matchCategory = !categoryQuery || categoryQuery === "All" || dance.c === categoryQuery;
    const matchTag = !tagQuery || [...dance.t, ...dance.st].map((item) => item.toLowerCase()).includes(tagQuery);
    return matchQuery && matchCategory && matchTag;
  });

  return limit && limit > 0 ? items.slice(0, limit) : items;
};

export const recommendGptsByNeed = (need: string, limitTal = 6, limitDance = 8) => {
  const normalizedNeed = normalize(need);

  const rankedHints = gptsBootstrap.h
    .map((hint) => {
      const score = hint.kw.filter((keyword) => normalizedNeed.includes(keyword.toLowerCase())).length;
      return { hint, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const pickedHints = rankedHints.length > 0 ? rankedHints.slice(0, 3).map((item) => item.hint) : [];
  const fallbackHint = gptsBootstrap.h.find((hint) => hint.id === "strategy");
  const hints = pickedHints.length > 0 ? pickedHints : fallbackHint ? [fallbackHint] : [];

  const talSlugs = Array.from(new Set(hints.flatMap((hint) => hint.ts)));
  const danceSlugs = Array.from(new Set(hints.flatMap((hint) => hint.ds)));
  const danceCategories = Array.from(new Set(hints.flatMap((hint) => hint.dc)));
  const talCategories = Array.from(new Set(hints.flatMap((hint) => hint.tc)));

  const recommendedTals = talSlugs
    .map((slug) => gptsTalBriefs.find((tal) => tal.s === slug))
    .filter((item): item is (typeof gptsTalBriefs)[number] => Boolean(item))
    .slice(0, limitTal);

  const recommendedDances = danceSlugs
    .map((slug) => gptsDanceBriefs.find((dance) => dance.s === slug))
    .filter((item): item is (typeof gptsDanceBriefs)[number] => Boolean(item))
    .slice(0, limitDance);

  return {
    need,
    matchedHintIds: hints.map((hint) => hint.id),
    talCategories,
    danceCategories,
    recommendedTals,
    recommendedDances
  };
};

export const recommendGptsByTalSlug = (talSlug: string) => {
  const relation = gptsReco[talSlug];
  if (!relation) return null;

  const tal = gptsTalBriefs.find((item) => item.s === talSlug) ?? null;
  const recommendedDances = relation.ds
    .map((slug) => gptsDanceBriefs.find((dance) => dance.s === slug))
    .filter((item): item is (typeof gptsDanceBriefs)[number] => Boolean(item));

  return {
    tal,
    recommendedDanceCategories: relation.dc,
    recommendedDances
  };
};
