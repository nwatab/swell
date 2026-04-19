import { minCostAssign } from './minCostAssign';

// Helper: build a cost function from a 2-D matrix (rows=agents, cols=tasks)
const matrix = (m: number[][]) => (a: number, t: number) => m[a][t];

// Helper: compute total cost of an assignment
const totalCost = (assignment: readonly number[], m: number[][]) =>
  assignment.reduce((sum, t, a) => sum + m[a][t], 0);

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('minCostAssign — edge cases', () => {
  it('returns empty when tasks < agents', () => {
    expect(minCostAssign(3, 2, () => 1)).toEqual([]);
  });

  it('returns empty for 0 agents', () => {
    expect(minCostAssign(0, 5, () => 0)).toEqual([]);
  });

  it('1 agent 1 task: assigns task 0', () => {
    expect(minCostAssign(1, 1, () => 42)).toEqual([0]);
  });

  it('1 agent 3 tasks: picks the cheapest task', () => {
    // tasks: costs [9, 2, 7] → task 1 is cheapest
    const result = minCostAssign(1, 3, (_, t) => [9, 2, 7][t]);
    expect(result).toEqual([1]);
  });
});

// ── 2 × 2 ────────────────────────────────────────────────────────────────────

describe('minCostAssign — 2 × 2', () => {
  it('identity: each agent prefers its own task', () => {
    //      t0  t1
    // a0 [  1   9 ]
    // a1 [  9   2 ]
    // Optimal: [0, 1] = 1 + 2 = 3
    const m = [[1, 9], [9, 2]];
    expect(minCostAssign(2, 2, matrix(m))).toEqual([0, 1]);
  });

  it('anti-diagonal: crossing needed for the optimum', () => {
    //      t0  t1
    // a0 [  9   1 ]
    // a1 [  2   9 ]
    // Optimal: [1, 0] = 1 + 2 = 3
    const m = [[9, 1], [2, 9]];
    expect(minCostAssign(2, 2, matrix(m))).toEqual([1, 0]);
  });
});

// ── 3 × 3: greedy is suboptimal ───────────────────────────────────────────────

describe('minCostAssign — 3 × 3', () => {
  it('finds global optimum when greedy gives a worse result', () => {
    //      t0  t1  t2
    // a0 [  3   1   4 ]   ← greedy: picks t1 (cost 1)
    // a1 [  5   6   2 ]   ← greedy: t2 still free, picks t2 (cost 2)
    // a2 [  8   2   7 ]   ← greedy: only t0 left (cost 8)  → greedy total = 11
    //
    // Optimal: a0→t0(3), a1→t2(2), a2→t1(2) = 7
    const m = [
      [3, 1, 4],
      [5, 6, 2],
      [8, 2, 7],
    ];
    const result = minCostAssign(3, 3, matrix(m));
    expect(totalCost(result, m)).toBe(7);
    expect(new Set(result).size).toBe(3); // all distinct
  });
});

// ── 4 × 4 ────────────────────────────────────────────────────────────────────

describe('minCostAssign — 4 × 4', () => {
  it('resolves conflict when two agents prefer the same task', () => {
    //      t0  t1  t2  t3
    // a0 [  1   5   5   5 ]   wants t0
    // a1 [  5   1   5   5 ]   wants t1
    // a2 [  5   5   1   5 ]   wants t2
    // a3 [  5   2   5   5 ]   also wants t1 → must be displaced to t3
    //
    // Optimal: [0,1,2,3] = 1+1+1+5 = 8
    const m = [
      [1, 5, 5, 5],
      [5, 1, 5, 5],
      [5, 5, 1, 5],
      [5, 2, 5, 5],
    ];
    const result = minCostAssign(4, 4, matrix(m));
    expect(totalCost(result, m)).toBe(8);
    expect(new Set(result).size).toBe(4);
  });

  it('finds the uniquely optimal assignment across all 24 permutations', () => {
    //      t0  t1  t2  t3
    // a0 [  2   3   7   8 ]
    // a1 [  6   2   1   5 ]
    // a2 [  7   8   2   3 ]
    // a3 [  3   7   5   2 ]
    //
    // Diagonal [0,1,2,3] = 2+2+2+2 = 8 (uniquely optimal)
    const m = [
      [2, 3, 7, 8],
      [6, 2, 1, 5],
      [7, 8, 2, 3],
      [3, 7, 5, 2],
    ];
    const result = minCostAssign(4, 4, matrix(m));
    expect(result).toEqual([0, 1, 2, 3]);
    expect(totalCost(result, m)).toBe(8);
  });
});

// ── Large penalty steers assignment ──────────────────────────────────────────

describe('minCostAssign — penalty costs', () => {
  it('avoids a penalised task even when it has low base cost', () => {
    const PENALTY = 1000;
    //      t0              t1
    // a0 [  1 + PENALTY    3  ]   t0 is close but penalised → should pick t1
    // a1 [  2              9  ]   t0 is cheapest for a1
    //
    // Without penalty: [0,1] = 1+9=10 vs [1,0] = 3+2=5 → optimal [1,0]
    // With penalty:    [0,1] = 1001+9=1010  [1,0] = 3+2=5 → still [1,0]
    const m = [
      [1 + PENALTY, 3],
      [2,           9],
    ];
    const result = minCostAssign(2, 2, matrix(m));
    expect(result[0]).toBe(1); // a0 avoids penalised task 0
    expect(result[1]).toBe(0);
  });
});

// ── More tasks than agents ────────────────────────────────────────────────────

describe('minCostAssign — more tasks than agents', () => {
  it('selects the globally optimal subset of tasks', () => {
    //      t0  t1  t2  t3
    // a0 [  9   1   9   9 ]   wants t1
    // a1 [  9   9   9   2 ]   wants t3
    const m = [
      [9, 1, 9, 9],
      [9, 9, 9, 2],
    ];
    expect(minCostAssign(2, 4, matrix(m))).toEqual([1, 3]);
  });

  it('never assigns the same task index to two agents', () => {
    // All tasks cost 1 except the diagonal (cost 2) → algorithm will use off-diagonal
    // but must still keep task indices distinct
    const m = [
      [2, 1, 1, 1],
      [1, 2, 1, 1],
      [1, 1, 2, 1],
    ];
    const result = minCostAssign(3, 4, matrix(m));
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
  });
});
