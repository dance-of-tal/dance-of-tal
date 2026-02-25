import { recommendedCombos } from "../data/catalog.js";
import { Dance, Tal } from "../data/types.js";

export const getDanceCategory = (dance: Dance) => dance.category ?? "General";

export const getDanceCategories = (items: Dance[]) => {
  return Array.from(new Set(items.map((dance) => getDanceCategory(dance))));
};

export const getTalDanceRelation = (talSlug: string) => {
  return recommendedCombos.talToDance[talSlug];
};

export const recommendDanceCategoriesForTal = (tal: Tal, dances: Dance[]) => {
  const relation = getTalDanceRelation(tal.slug);
  if (relation?.recommendedDanceCategories?.length) {
    return relation.recommendedDanceCategories;
  }

  const available = new Set(getDanceCategories(dances));
  if (available.has(tal.category)) {
    return [tal.category];
  }
  return available.has("Public Case") ? ["Public Case"] : [Array.from(available)[0] ?? "General"];
};
