/**
 * Leitura do formato "Build Planner" do próprio PoE2 (arquivo .build / exportToGame da Mobalytics).
 * As passivas vêm por `stringId` (ex.: "attack_speed25") e, quando são de weapon set, com `weapon_set`.
 * A lista vem na ORDEM de alocação, o que dá a ordem pra pegar os pontos.
 */
export interface PlannerFile {
  name: string;
  ascendancy?: string;
  passives: { id: string; weapon_set?: number }[];
  skills: { id: string; level_interval?: [number, number]; support_skills?: { id: string; level_interval?: [number, number] }[] }[];
  inventory_slots: {
    inventory_id: string;
    unique_name?: string;
    additional_text?: string;
    level_interval?: [number, number];
  }[];
}

export interface ResolvedPlanner {
  name: string;
  /** Ordem de alocação (sem repetições). */
  nodes: number[];
  ws1: number[];
  ws2: number[];
  missing: string[];
}

export function resolvePlanner(file: PlannerFile, stringIdToNode: Map<string, number>): ResolvedPlanner {
  const nodes: number[] = [];
  const ws1: number[] = [];
  const ws2: number[] = [];
  const missing: string[] = [];
  const seen = new Set<number>();
  for (const p of file.passives) {
    const id = stringIdToNode.get(p.id);
    if (id == null) {
      missing.push(p.id);
      continue;
    }
    if (p.weapon_set === 1) ws1.push(id);
    else if (p.weapon_set === 2) ws2.push(id);
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push(id);
    }
  }
  return { name: file.name.trim(), nodes, ws1, ws2, missing };
}
