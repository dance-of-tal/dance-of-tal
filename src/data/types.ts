export type Tal = {
  type: string; // URN literal type (e.g. 'tal/system-architect')
  extends?: string; // Inheritance
  slug: string;
  name: string;
  description: string;
  tags: string[];
  featuredScore: number;
  createdAt: string;
  content: string;
};

export type Performer = {
  type?: string;
  slug?: string;
  name?: string;
  description?: string;
  tags?: string[];
  tal?: string;
  dance?: string | string[];
  act?: string;
  model?: string;
  mcp_config?: Record<string, any>;
};

export type ActEdge = {
  from: string;
  to: string; // node ID or '$exit'
  role?: 'branch';
  condition?: 'always' | 'on_success' | 'on_fail';
};

export type ActNodeWorker = {
  type: 'worker';
  performer: string; // performer URN
};

export type ActNodeOrchestrator = {
  type: 'orchestrator';
  performer: string; // performer URN
  maxDelegations?: number;
};

export type ActNodeParallel = {
  type: 'parallel';
  join?: 'all' | 'any';
};

export type ActNode = ActNodeWorker | ActNodeOrchestrator | ActNodeParallel;

export type Act = {
  type: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  entryNode: string;
  nodes: Record<string, ActNode>;
  edges: ActEdge[];
  maxIterations?: number;
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
  type: string; // URN literal type (e.g. 'dance/json-schema')
  extends?: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  content: string;
  schema?: Record<string, any>; // JSON Schema definition for type safety
  exemplarSet?: DanceExemplarSet;
};

