/**
 * Formato compacto da árvore servido pro navegador (public/tree/<versão>.json).
 * Gerado por `npm run update-tree` a partir do tree.json do Path of Building (PoE2).
 */

/** n = normal, N = notável, K = keystone, J = encaixe de joia, S = início de classe,
 *  A = início de ascendência, a = atributo (+5 escolhível), M = escolha múltipla */
export type NodeKind = 'n' | 'N' | 'K' | 'J' | 'S' | 'A' | 'a' | 'M';

export interface TreeNode {
  id: number;
  x: number;
  y: number;
  k: NodeKind;
  n: string;
  /** Stats no texto original (inglês). */
  s?: string[];
  /** Nome da ascendência, se o node for de ascendência. */
  asc?: string;
}

/** [a, b] = reta; [a, b, cx, cy, r] = arco (menor caminho) com centro e raio. */
export type TreeEdge = [number, number] | [number, number, number, number, number];

export interface CompactTree {
  version: string;
  source: {
    repo: string;
    path: string;
    commit: string;
    commitDate: string;
    fetchedAt: string;
  };
  bounds: [number, number, number, number];
  nodes: TreeNode[];
  edges: TreeEdge[];
  classes: { name: string; ascendancies: string[]; startNode?: number }[];
}

/** Dados de uma fase entregues ao componente da árvore. */
export interface PhaseTree {
  phaseId: string;
  label: string;
  levels: [number, number];
  nodes: number[];
  /** Nodes do Weapon Set 1 / 2 (pontos de weapon set das quests). */
  ws1: number[];
  ws2: number[];
  /** Origem legível (ex.: "PoB Scorpius · spec Early Endgame"). */
  originPt: string;
  pobUrl?: string;
}
