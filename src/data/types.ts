export type Tal = {
  type: string; // V2: URN literal type (e.g. 'tal/system-architect')
  extends?: string; // V2: Inheritance
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  featuredScore: number;
  createdAt: string;
  thinking: string;
};

export type ActNode = {
  tal: string;
  dance: string;
};

export type ActEdge = {
  from: string;
  to: string | string[];
  condition?: string; // Optional conditional logic
};

export type Act = {
  type: string; // V2 URN (e.g. 'act/linear-review')
  slug: string;
  name: string;
  description: string;
  master?: {
    tal: string;
    dance: string;
  };
  steps?: string[];
  nodes?: Record<string, ActNode>; // V2: DAG nodes
  edges?: ActEdge[]; // V2: DAG edges
};

export type DanceStyleExample = {
  input: string;
  output: string;
  label?: string;
  notes?: string;
};

export type DanceExemplarSet = {
  styleExamples: DanceStyleExample[];
  antiPatterns?: Array<{
    bad: string;
    better?: string;
    reason?: string;
  }>;
};

export type Dance = {
  type: string; // V2: URN literal type (e.g. 'dance/json-schema')
  extends?: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  rules: string;
  schema?: Record<string, any>; // V2: JSON Schema definition for type safety
  exemplarSet?: DanceExemplarSet;
};

export type TalDanceRelation = {
  recommendedDanceCategories: string[];
  recommendedDanceSlugs: string[];
};

export type RecommendedCombos = {
  schemaVersion: string;
  updatedAt: string;
  talToDance: Record<string, TalDanceRelation>;
};

export type TalSummary = {
  slug: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  featuredScore: number;
  createdAt: string;
  recommendedDanceCategories: string[];
  recommendedDanceSlugs: string[];
};

export type DanceSummary = {
  slug: string;
  name: string;
  category: string;
  description: string;
  tone: string[];
  structure: string[];
  rhythm: string | null;
};

export type ComboSummary = {
  talSlug: string;
  talName: string;
  danceSlug: string;
  danceName: string;
  danceCategory: string | null;
  rank: number;
};

export type DataSummary = {
  schemaVersion: string;
  updatedAt: string;
  counts: {
    tals: number;
    dances: number;
    combos: number;
  };
  talSummaries: TalSummary[];
  danceSummaries: DanceSummary[];
  comboSummaries: ComboSummary[];
};

export type GptsTalBrief = {
  s: string;
  n: string;
  c: string;
  t: string[];
  d: string;
  f: number;
};

export type GptsDanceBrief = {
  s: string;
  n: string;
  c: string;
  t: string[];
  st: string[];
  d: string;
};

export type GptsNeedHint = {
  id: string;
  kw: string[];
  tc: string[];
  dc: string[];
  ts: string[];
  ds: string[];
};

export type GptsBootstrap = {
  v: string;
  u: string;
  c: { t: number; d: number };
  cat: { t: string[]; d: string[] };
  top: { t: string[]; d: string[] };
  h: GptsNeedHint[];
};

export type GptsRecoMap = Record<
  string,
  {
    dc: string[];
    ds: string[];
  }
>;
