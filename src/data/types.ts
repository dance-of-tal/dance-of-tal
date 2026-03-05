export type Tal = {
  type: string; // V2: URN literal type (e.g. 'tal/system-architect')
  extends?: string; // V2: Inheritance
  slug: string;
  name: string;
  description: string;
  tags: string[];
  featuredScore: number;
  createdAt: string;
  content: string;
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
  tags: string[];
  content: string;
  schema?: Record<string, any>; // V2: JSON Schema definition for type safety
  exemplarSet?: DanceExemplarSet;
};


