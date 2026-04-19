/**
 * Minimum-cost assignment: assign `numAgents` agents to distinct tasks
 * chosen from `numTasks` candidates, minimising total cost.
 *
 * Uses DFS with branch-and-bound (efficient for small N, e.g. SATB = 4).
 *
 * @param numAgents - number of agents to assign
 * @param numTasks  - total number of available task indices
 * @param cost      - cost(agentIdx, taskIdx) → non-negative number
 * @returns assignment where result[i] is the task index for agent i,
 *          or an empty array when numTasks < numAgents
 */
export const minCostAssign = (
  numAgents: number,
  numTasks: number,
  cost: (agentIdx: number, taskIdx: number) => number,
): readonly number[] => {
  if (numTasks < numAgents) return [];

  let bestCost = Infinity;
  let bestAssignment: number[] = [];

  const chosen: number[] = [];
  const usedTasks = new Set<number>();

  const dfs = (agentIdx: number, accumulated: number): void => {
    if (accumulated >= bestCost) return; // prune
    if (agentIdx === numAgents) {
      bestCost = accumulated;
      bestAssignment = [...chosen];
      return;
    }
    for (let t = 0; t < numTasks; t++) {
      if (usedTasks.has(t)) continue;
      usedTasks.add(t);
      chosen.push(t);
      dfs(agentIdx + 1, accumulated + cost(agentIdx, t));
      chosen.pop();
      usedTasks.delete(t);
    }
  };

  dfs(0, 0);
  return bestAssignment;
};
