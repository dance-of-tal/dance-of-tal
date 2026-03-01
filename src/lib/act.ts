import { Act, ActNode, ActEdge } from "../data/types.js";
import { Combo } from "./registry.js";
import { initRun, startRunContext, getRunState, saveRunState } from "./runs.js";

/**
 * Executes a single DAG Node
 * In V2, each node execution represents an isolated run context setup.
 */
export async function executeActNode(
  cwd: string,
  runId: string,
  nodeId: string,
  node: ActNode,
  taskContext: string
): Promise<void> {
  const comboName = `act_${nodeId}_combo`;

  // We temporarily create a runtime Combo from the node's Tal & Dance.
  // In a full implementation, these would be strictly checked against the registry.
  const runtimeCombo: Combo = {
    tal: node.tal,
    dance: node.dance
  };

  // We save the combo in the current run's domain or global registry
  // For now, we simulate initializing the run directly for this node
  const nodeRunId = `${runId}_${nodeId}`;

  await initRun(cwd, nodeRunId, comboName);

  // Start the context execution for this specific node
  // Note: in a real LLM environment, `startRunContext` would also invoke the LLM here using `compiled`
  // and then publish the result to the Message Broker (Stage).
  try {
    await startRunContext(cwd, nodeRunId, taskContext);
  } catch (e: any) {
    console.error(`Error executing node ${nodeId}: ${e.message}`);
  }
}

/**
 * Very basic DAG workflow traversal simulation
 * V2 handles concurrent edges by launching promises together.
 */
export async function executeActGraph(
  cwd: string,
  runId: string,
  act: Act,
  initialTaskContext: string
): Promise<void> {

  const nodes = act.nodes ?? {};
  const edges = act.edges ?? [];

  // Find start nodes (nodes with no incoming edges)
  const incomingEdgeCounts: Record<string, number> = {};
  Object.keys(nodes).forEach(n => incomingEdgeCounts[n] = 0);

  edges.forEach(edge => {
    const toNodes = Array.isArray(edge.to) ? edge.to : [edge.to];
    toNodes.forEach(t => incomingEdgeCounts[t] = (incomingEdgeCounts[t] || 0) + 1);
  });

  const startNodes = Object.keys(nodes).filter(n => incomingEdgeCounts[n] === 0);

  if (startNodes.length === 0) {
    throw new Error("Invalid Act DAG: No starting nodes found (Possible cyclic graph).");
  }

  console.log(`[Act Graph Execution] Starting run ${runId} with nodes: ${startNodes.join(', ')}`);

  // Breadth-First-like traversal supporting parallel edge execution
  // In a real robust system, we would wait for all incoming edges to a node to complete,
  // pass the output of previous nodes as the input of the next, etc.

  for (const nodeId of startNodes) {
    await executeActNode(cwd, runId, nodeId, nodes[nodeId] as ActNode, initialTaskContext);

    // Process outgoing edges
    const outgoingEdges = edges.filter(e => e.from === nodeId);

    // Concurrently trigger next nodes
    for (const edge of outgoingEdges) {
      const toNodes = Array.isArray(edge.to) ? edge.to : [edge.to];
      await Promise.all(toNodes.map(async (nextNodeId) => {
        // Simulate passing context via a Message Broker (Stage)
        const nextContext = `Result from ${nodeId}`;
        await executeActNode(cwd, runId, nextNodeId, nodes[nextNodeId] as ActNode, nextContext);
      }));
    }
  }

  console.log(`[Act Graph Execution] Run ${runId} completed.`);
}
