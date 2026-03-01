import dancesJson from "./dances.json";
import recommendedCombosJson from "./recommended-combos.json";
import talsJson from "./tals.json";
import {
  ComboSummary,
  Dance,
  DanceSummary,
  DataSummary,
  GptsBootstrap,
  GptsDanceBrief,
  GptsRecoMap,
  GptsTalBrief,
  RecommendedCombos,
  Tal,
  TalSummary
} from "./types.js";
import { summarizeDanceRule } from "../lib/dance-schema.js";

type NeedHintRule = {
  id: string;
  keywords: string[];
  talCategories: string[];
  danceCategories: string[];
};

const NEED_HINT_RULES: NeedHintRule[] = [
  {
    id: "strategy",
    keywords: ["strategy", "decision", "roadmap", "priority", "risk", "전략", "의사결정", "로드맵", "우선순위", "리스크"],
    talCategories: ["Strategy"],
    danceCategories: ["Executive", "Product"]
  },
  {
    id: "product",
    keywords: ["product", "mvp", "ux", "flow", "onboarding", "제품", "기획", "온보딩", "사용자 흐름"],
    talCategories: ["Product"],
    danceCategories: ["Product"]
  },
  {
    id: "growth",
    keywords: ["growth", "funnel", "retention", "experiment", "ab-test", "그로스", "퍼널", "리텐션", "실험"],
    talCategories: ["Growth"],
    danceCategories: ["Growth", "Analytics"]
  },
  {
    id: "research",
    keywords: ["research", "evidence", "sources", "validation", "리서치", "근거", "검증", "출처"],
    talCategories: ["Research"],
    danceCategories: ["Research"]
  },
  {
    id: "dev",
    keywords: ["developer", "docs", "api", "code", "dx", "개발", "문서", "코드", "mcp"],
    talCategories: ["Developer"],
    danceCategories: ["Developer", "Executive"]
  },
  {
    id: "ops",
    keywords: ["incident", "ops", "runbook", "outage", "운영", "장애", "런북"],
    talCategories: ["Operations"],
    danceCategories: ["Operations", "Executive"]
  },
  {
    id: "education",
    keywords: ["learn", "teaching", "tutor", "교육", "학습", "코칭"],
    talCategories: ["Education"],
    danceCategories: ["Education"]
  },
  {
    id: "creator",
    keywords: ["creator", "content", "script", "campaign", "brand", "크리에이터", "콘텐츠", "스크립트", "브랜딩"],
    talCategories: ["Creator", "Brand"],
    danceCategories: ["Creator", "Brand"]
  },
  {
    id: "analytics",
    keywords: ["analytics", "kpi", "metrics", "dashboard", "데이터", "지표", "분석", "대시보드"],
    talCategories: ["Analytics"],
    danceCategories: ["Analytics", "Executive"]
  },
  {
    id: "writing",
    keywords: ["writing", "copy", "summary", "message", "글쓰기", "카피", "요약", "메시지"],
    talCategories: ["Writing"],
    danceCategories: ["Writing", "Brand"]
  },
  {
    id: "public_case",
    keywords: ["public", "celebrity", "famous", "influencer", "persona", "유명인", "인플루언서", "페르소나"],
    talCategories: ["Public Case"],
    danceCategories: ["Public Case"]
  }
];

const uniq = <T>(items: T[]) => Array.from(new Set(items));

export const tals: Tal[] = talsJson as unknown as Tal[];
export const dances: Dance[] = dancesJson as unknown as Dance[];
export const recommendedCombos: RecommendedCombos = recommendedCombosJson as unknown as RecommendedCombos;

const talToDance = recommendedCombos.talToDance ?? {};
const talBySlug = new Map(tals.map((tal) => [tal.slug, tal]));
const danceBySlug = new Map(dances.map((dance) => [dance.slug, dance]));
const talCategories = uniq(tals.map((tal) => tal.category));
const danceCategories = uniq(dances.map((dance) => dance.category));

const talSummaries: TalSummary[] = tals.map((tal) => {
  const relation = talToDance[tal.slug] ?? { recommendedDanceCategories: [], recommendedDanceSlugs: [] };
  return {
    slug: tal.slug,
    name: tal.name,
    category: tal.category,
    tags: tal.tags,
    description: tal.description,
    featuredScore: tal.featuredScore,
    createdAt: tal.createdAt,
    recommendedDanceCategories: relation.recommendedDanceCategories,
    recommendedDanceSlugs: relation.recommendedDanceSlugs
  };
});

const danceSummaries: DanceSummary[] = dances.map((dance) => {
  const summary = summarizeDanceRule(dance);
  return {
    slug: dance.slug,
    name: dance.name,
    category: dance.category,
    description: dance.description,
    tone: summary.tone,
    structure: summary.structure,
    rhythm: summary.rhythm
  };
});

const comboSummaries: ComboSummary[] = Object.entries(talToDance).flatMap(([talSlug, relation]) => {
  const tal = talBySlug.get(talSlug);
  return (relation.recommendedDanceSlugs ?? []).map((danceSlug, index) => {
    const dance = danceBySlug.get(danceSlug);
    return {
      talSlug,
      talName: tal?.name ?? talSlug,
      danceSlug,
      danceName: dance?.name ?? danceSlug,
      danceCategory: dance?.category ?? null,
      rank: index + 1
    };
  });
});

export const dataSummary: DataSummary = {
  schemaVersion: recommendedCombos.schemaVersion ?? "1.0.0",
  updatedAt: recommendedCombos.updatedAt,
  counts: {
    tals: tals.length,
    dances: dances.length,
    combos: comboSummaries.length
  },
  talSummaries,
  danceSummaries,
  comboSummaries
};

export const gptsTalBriefs: GptsTalBrief[] = tals
  .slice()
  .sort((a, b) => b.featuredScore - a.featuredScore)
  .map((tal) => ({
    s: tal.slug,
    n: tal.name,
    c: tal.category,
    t: tal.tags.slice(0, 3),
    d: tal.description,
    f: tal.featuredScore
  }));

export const gptsDanceBriefs: GptsDanceBrief[] = dances.map((dance) => {
  const summary = summarizeDanceRule(dance);
  return {
    s: dance.slug,
    n: dance.name,
    c: dance.category,
    t: summary.tone.slice(0, 2),
    st: summary.structure.slice(0, 2),
    d: dance.description
  };
});

export const gptsReco: GptsRecoMap = Object.fromEntries(
  Object.entries(talToDance).map(([slug, relation]) => [
    slug,
    {
      dc: relation.recommendedDanceCategories ?? [],
      ds: relation.recommendedDanceSlugs ?? []
    }
  ])
);

const categoryToTopTalSlugs = Object.fromEntries(
  talCategories.map((category) => [
    category,
    tals
      .filter((tal) => tal.category === category)
      .sort((a, b) => b.featuredScore - a.featuredScore)
      .slice(0, 5)
      .map((tal) => tal.slug)
  ])
);

const categoryToTopDanceSlugs = Object.fromEntries(
  danceCategories.map((category) => [category, dances.filter((dance) => dance.category === category).slice(0, 5).map((dance) => dance.slug)])
);

const needHints = NEED_HINT_RULES.map((rule) => {
  const talSlugs = rule.talCategories.flatMap((category) => categoryToTopTalSlugs[category] ?? []);
  const danceSlugs = rule.danceCategories.flatMap((category) => categoryToTopDanceSlugs[category] ?? []);
  return {
    id: rule.id,
    kw: rule.keywords,
    tc: rule.talCategories,
    dc: rule.danceCategories,
    ts: uniq(talSlugs).slice(0, 6),
    ds: uniq(danceSlugs).slice(0, 8)
  };
});

export const gptsBootstrap: GptsBootstrap = {
  v: recommendedCombos.schemaVersion ?? "1.0.0",
  u: recommendedCombos.updatedAt,
  c: { t: tals.length, d: dances.length },
  cat: { t: talCategories, d: danceCategories },
  top: {
    t: gptsTalBriefs.slice(0, 8).map((tal) => tal.s),
    d: gptsDanceBriefs.slice(0, 8).map((dance) => dance.s)
  },
  h: needHints
};
