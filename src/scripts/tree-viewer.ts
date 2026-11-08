/**
 * Visualizador da árvore de passivas (canvas 2D, sem dependências).
 *  - árvore inteira apagada, nodes alocados acesos
 *  - nodes NOVOS da fase em verde (comparado com a fase anterior), desalocados (respec) com anel vermelho
 *  - Weapon Set 1 / 2 com anel próprio
 *  - zoom (roda / pinça) e pan (arrastar), tooltip (hover / toque), busca por nome ou stat
 *
 * Carregamento do JSON (uma vez por viewer):
 *  - 'visible' (padrão): quando o viewer chega perto da tela. Dentro de <details> fechado não carrega;
 *    ao abrir a caixa, checa de novo e centraliza nos nodes da fase.
 *  - 'idle': começa o download assim que a página termina de carregar (sem esperar rolar até a árvore).
 */
import type { CompactTree, TreeNode } from '../lib/tree-types.ts';

export interface ViewerPhase {
  phaseId: string;
  label: string;
  levels: [number, number];
  nodes: number[];
  ws1: number[];
  ws2: number[];
  added: number[];
  removed: number[];
  mainPoints: number;
  wsPoints: number;
  ascPoints: number;
}

export interface ViewerOptions {
  treeUrl: string;
  ascendancy: string;
  className: string;
  phases: ViewerPhase[];
  initialPhase?: string;
  onPhaseChange?: (id: string) => void;
  /** Quando baixar a árvore: 'visible' (perto da tela, padrão) ou 'idle' (logo após o load da página). */
  loadOn?: 'visible' | 'idle';
}

type Status = 'off' | 'on' | 'new' | 'removed';

const COLORS = {
  bg: '#0a0907',
  edgeOff: 'rgba(132, 114, 88, 0.22)',
  edgeOn: '#c9a463',
  edgeNew: '#5fd38a',
  edgeRemoved: 'rgba(239, 107, 107, 0.55)',
  nodeOff: '#2b241b',
  nodeOffStroke: '#5c4b35',
  nodeOn: '#d2ad6b',
  nodeNew: '#5fd38a',
  removed: '#ef6b6b',
  ws1: '#e4685a',
  ws2: '#58b6e8',
  search: '#ffe066',
  text: '#e8dfcf',
  ascBg: 'rgba(163, 130, 79, 0.06)',
};

/** Raio do node em unidades da árvore e mínimo em px na tela. */
const SIZE: Record<string, [number, number]> = {
  n: [26, 1.6],
  a: [26, 1.6],
  M: [32, 2],
  N: [44, 3.2],
  J: [40, 3],
  K: [62, 4.5],
  S: [80, 5],
  A: [52, 3.5],
};

export function mountTreeViewer(root: HTMLElement, opts: ViewerOptions) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const tip = root.querySelector<HTMLElement>('[data-tip]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const counters = root.querySelector<HTMLElement>('[data-counters]');
  const search = root.querySelector<HTMLInputElement>('[data-search]');
  const searchCount = root.querySelector<HTMLElement>('[data-search-count]');
  const fallback = root.querySelector<HTMLElement>('[data-fallback]');
  const ctx = canvas.getContext('2d')!;
  /** Caixa <details> em volta do viewer (modo jogando), se houver. */
  const box = root.parentElement?.closest('details') ?? null;
  /** Viewer está sendo renderizado (caixa aberta, sem display:none em volta)? */
  const shown = () => (!box || box.open) && root.getClientRects().length > 0;

  let tree: CompactTree | null = null;
  let nodes: TreeNode[] = [];
  const byId = new Map<number, TreeNode>();
  let edges: CompactTree['edges'] = [];
  const grid = new Map<string, TreeNode[]>();
  const CELL = 400;

  let phaseIdx = Math.max(0, opts.phases.findIndex((p) => p.phaseId === opts.initialPhase));
  let alloc = new Set<number>();
  let added = new Set<number>();
  let removed = new Set<number>();
  let ws1 = new Set<number>();
  let ws2 = new Set<number>();
  let matches: TreeNode[] = [];
  let matchCursor = -1;
  let hover: TreeNode | null = null;
  let pinned: TreeNode | null = null;

  // transformação: tela = árvore * scale + (tx, ty)
  let scale = 0.02;
  let tx = 0;
  let ty = 0;
  let minScale = 0.005;
  const maxScale = 0.9;
  let dpr = 1;
  let raf = 0;
  /** Centralizar assim que o palco tiver tamanho (ex.: fase trocada com a caixa fechada). */
  let needsFit = true;
  /** O palco estava sem tamanho (caixa fechada/escondida) na última medição. */
  let wasHidden = true;
  let loading: Promise<void> | null = null;

  const statusOf = (id: number): Status =>
    added.has(id) ? 'new' : alloc.has(id) ? 'on' : removed.has(id) ? 'removed' : 'off';

  function setStatus(msg: string) {
    status.textContent = msg;
    status.hidden = !msg;
  }

  /** Baixa e prepara a árvore uma única vez (chamadas repetidas reaproveitam a mesma promessa). */
  function load() {
    return (loading ??= doLoad());
  }

  async function doLoad() {
    setStatus('Carregando árvore…');
    try {
      const res = await fetch(opts.treeUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      tree = (await res.json()) as CompactTree;
    } catch (e) {
      setStatus('');
      root.classList.add('failed');
      if (fallback) fallback.hidden = false;
      console.error('Árvore não carregou', e);
      return;
    }
    nodes = tree.nodes.filter((n) => !n.asc || n.asc === opts.ascendancy);
    for (const n of nodes) {
      byId.set(n.id, n);
      const k = `${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`;
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(n);
    }
    edges = tree.edges.filter((e) => byId.has(e[0]) && byId.has(e[1]));
    setStatus('');
    resize();
    applyPhase(phaseIdx, true);
  }

  function applyPhase(i: number, fit = false) {
    phaseIdx = i;
    const p = opts.phases[i];
    alloc = new Set(p.nodes);
    added = new Set(i === 0 ? [] : p.added);
    removed = new Set(p.removed);
    ws1 = new Set(p.ws1);
    ws2 = new Set(p.ws2);
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-phase]')) {
      b.setAttribute('aria-pressed', String(b.dataset.phase === p.phaseId));
    }
    if (counters) {
      const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
      // nome da fase: só aparece quando não há botões de fase à vista (CSS, ex.: tela cheia no modo jogando)
      const parts = [`<span class="cur">${esc(p.label.split(' · ')[0])}</span><b>${p.mainPoints}</b> pontos`];
      if (p.wsPoints) parts.push(`<b>${p.wsPoints}</b> weapon set`);
      if (p.ascPoints) parts.push(`<b>${p.ascPoints}</b> ascendência`);
      if (i > 0) parts.push(`<b class="n">+${p.added.length}</b> novos`);
      if (p.removed.length) parts.push(`<b class="r">−${p.removed.length}</b> respec`);
      counters.innerHTML = parts.join(' · ');
    }
    pinned = null;
    hideTip();
    if (fit) fitTo([...alloc]);
    draw();
    opts.onPhaseChange?.(p.phaseId);
  }

  /* ------------------------------------------------------------- view */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !shown()) {
      // caixa fechada / escondida: mantém o canvas como está e centraliza quando voltar a aparecer
      wasHidden = true;
      return;
    }
    if (wasHidden) {
      wasHidden = false;
      needsFit = true;
    }
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    if (tree) {
      const [x0, y0, x1, y1] = tree.bounds;
      minScale = Math.min(r.width / (x1 - x0), r.height / (y1 - y0)) * 0.7;
    }
    if (tree && needsFit) fitTo([...alloc]);
    else draw();
  }

  function fitTo(ids: number[]) {
    const r = stage.getBoundingClientRect();
    if (!tree || r.width < 1 || r.height < 1 || !shown()) {
      // sem árvore ou sem palco visível: centraliza depois (load / abertura da caixa)
      needsFit = true;
      return;
    }
    needsFit = false;
    const pts = ids.map((id) => byId.get(id)).filter((n): n is TreeNode => !!n && !n.asc);
    let x0: number, y0: number, x1: number, y1: number;
    if (pts.length < 3 && tree) [x0, y0, x1, y1] = tree.bounds;
    else {
      x0 = Math.min(...pts.map((n) => n.x));
      y0 = Math.min(...pts.map((n) => n.y));
      x1 = Math.max(...pts.map((n) => n.x));
      y1 = Math.max(...pts.map((n) => n.y));
      // inclui o centro (ascendência) pra dar contexto
      x0 = Math.min(x0, -1600);
      y0 = Math.min(y0, -1600);
      x1 = Math.max(x1, 1600);
      y1 = Math.max(y1, 1600);
    }
    const pad = 1.15;
    scale = clamp(Math.min(r.width / ((x1 - x0) * pad), r.height / ((y1 - y0) * pad)), minScale, maxScale);
    tx = r.width / 2 - ((x0 + x1) / 2) * scale;
    ty = r.height / 2 - ((y0 + y1) / 2) * scale;
    draw();
  }

  function centerOn(n: TreeNode, targetScale = Math.max(scale, 0.12)) {
    const r = stage.getBoundingClientRect();
    scale = clamp(targetScale, minScale, maxScale);
    tx = r.width / 2 - n.x * scale;
    ty = r.height / 2 - n.y * scale;
    draw();
  }

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  function zoomAt(factor: number, sx: number, sy: number) {
    const ns = clamp(scale * factor, minScale, maxScale);
    const k = ns / scale;
    tx = sx - (sx - tx) * k;
    ty = sy - (sy - ty) * k;
    scale = ns;
    draw();
  }

  /* ------------------------------------------------------------- draw */
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  }

  function render() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    if (!tree) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vw = w / dpr;
    const vh = h / dpr;
    const sx = (x: number) => x * scale + tx;
    const sy = (y: number) => y * scale + ty;
    // limites visíveis em coordenadas da árvore (culling)
    const vx0 = -tx / scale - 200;
    const vy0 = -ty / scale - 200;
    const vx1 = (vw - tx) / scale + 200;
    const vy1 = (vh - ty) / scale + 200;
    const visible = (n: TreeNode) => n.x >= vx0 && n.x <= vx1 && n.y >= vy0 && n.y <= vy1;

    // fundo da ascendência no centro
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 1450 * scale, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ascBg;
    ctx.fill();

    // arestas agrupadas por estilo
    const groups: Record<string, CompactTree['edges']> = { off: [], on: [], new: [], removed: [] };
    for (const e of edges) {
      const a = byId.get(e[0])!;
      const b = byId.get(e[1])!;
      if (!visible(a) && !visible(b)) continue;
      const sa = statusOf(a.id);
      const sb = statusOf(b.id);
      let g = 'off';
      if ((sa === 'on' || sa === 'new') && (sb === 'on' || sb === 'new')) g = sa === 'new' || sb === 'new' ? 'new' : 'on';
      else if ((sa === 'removed' || sb === 'removed') && sa !== 'off' && sb !== 'off') g = 'removed';
      groups[g].push(e);
    }
    const strokeEdges = (list: CompactTree['edges'], color: string, width: number) => {
      if (!list.length) return;
      ctx.beginPath();
      for (const e of list) {
        const a = byId.get(e[0])!;
        const b = byId.get(e[1])!;
        if (e.length === 5) {
          const [, , cx, cy, r] = e;
          const a1 = Math.atan2(a.y - cy, a.x - cx);
          const a2 = Math.atan2(b.y - cy, b.x - cx);
          let d = a2 - a1;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d <= -Math.PI) d += Math.PI * 2;
          ctx.moveTo(sx(a.x), sy(a.y));
          ctx.arc(sx(cx), sy(cy), r * scale, a1, a1 + d, d < 0);
        } else {
          ctx.moveTo(sx(a.x), sy(a.y));
          ctx.lineTo(sx(b.x), sy(b.y));
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    const lw = clamp(scale * 14, 0.8, 5);
    strokeEdges(groups.off, COLORS.edgeOff, lw * 0.7);
    strokeEdges(groups.removed, COLORS.edgeRemoved, lw);
    strokeEdges(groups.on, COLORS.edgeOn, lw * 1.25);
    strokeEdges(groups.new, COLORS.edgeNew, lw * 1.5);

    // nodes
    const matchSet = new Set(matches.map((m) => m.id));
    const labels: TreeNode[] = [];
    for (const n of nodes) {
      if (!visible(n)) continue;
      const st = statusOf(n.id);
      const [rt, rmin] = SIZE[n.k] ?? SIZE.n;
      const r = Math.max(rt * scale, rmin);
      const x = sx(n.x);
      const y = sy(n.y);
      ctx.beginPath();
      if (n.k === 'J') {
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
      } else ctx.arc(x, y, r, 0, Math.PI * 2);

      if (st === 'new') {
        ctx.fillStyle = COLORS.nodeNew;
        ctx.shadowColor = COLORS.nodeNew;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (st === 'on') {
        ctx.fillStyle = COLORS.nodeOn;
        ctx.fill();
      } else {
        ctx.fillStyle = n.k === 'S' || n.k === 'A' ? '#3a3024' : COLORS.nodeOff;
        ctx.fill();
        if (r > 2.2 || n.k === 'N' || n.k === 'K') {
          ctx.strokeStyle = st === 'removed' ? COLORS.removed : COLORS.nodeOffStroke;
          ctx.lineWidth = st === 'removed' ? 2 : 1;
          ctx.stroke();
        } else if (st === 'removed') {
          ctx.strokeStyle = COLORS.removed;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      if (ws1.has(n.id) || ws2.has(n.id)) {
        ctx.beginPath();
        ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = ws1.has(n.id) ? COLORS.ws1 : COLORS.ws2;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (matchSet.has(n.id)) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.search;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if ((n.k === 'N' || n.k === 'K') && (st !== 'off' || matchSet.has(n.id))) labels.push(n);
    }

    // rótulos dos notáveis alocados quando há zoom suficiente
    if (scale > 0.05) {
      ctx.font = `600 ${clamp(scale * 120, 10, 14)}px Inter Variable, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // prioridade: novos > keystones > alocados; pula rótulo que colide com outro já desenhado
      const prio = (n: TreeNode) => (statusOf(n.id) === 'new' ? 0 : n.k === 'K' ? 1 : statusOf(n.id) === 'removed' ? 3 : 2);
      labels.sort((a, b) => prio(a) - prio(b));
      const placed: [number, number, number, number][] = [];
      const fontPx = clamp(scale * 120, 10, 14);
      for (const n of labels) {
        const st = statusOf(n.id);
        const [rt, rmin] = SIZE[n.k];
        const r = Math.max(rt * scale, rmin);
        const x = sx(n.x);
        const y = sy(n.y) + r + 3;
        const w = ctx.measureText(n.n).width;
        const box: [number, number, number, number] = [x - w / 2 - 2, y - 1, x + w / 2 + 2, y + fontPx + 1];
        if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
        placed.push(box);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10,9,7,0.9)';
        ctx.strokeText(n.n, x, y);
        ctx.fillStyle = st === 'new' ? COLORS.nodeNew : st === 'removed' ? COLORS.removed : COLORS.text;
        ctx.fillText(n.n, x, y);
      }
    }

    const focus = pinned ?? hover;
    if (focus) {
      const [rt, rmin] = SIZE[focus.k] ?? SIZE.n;
      const r = Math.max(rt * scale, rmin);
      ctx.beginPath();
      ctx.arc(sx(focus.x), sy(focus.y), r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------- hit test e tooltip */
  function hitTest(px: number, py: number, radiusPx = 12): TreeNode | null {
    const x = (px - tx) / scale;
    const y = (py - ty) / scale;
    const rad = radiusPx / scale;
    const c0 = Math.floor((x - rad) / CELL);
    const c1 = Math.floor((x + rad) / CELL);
    const r0 = Math.floor((y - rad) / CELL);
    const r1 = Math.floor((y + rad) / CELL);
    let best: TreeNode | null = null;
    let bd = Infinity;
    for (let cx = c0; cx <= c1; cx++)
      for (let cy = r0; cy <= r1; cy++)
        for (const n of grid.get(`${cx},${cy}`) ?? []) {
          const [rt] = SIZE[n.k] ?? SIZE.n;
          const d = Math.hypot(n.x - x, n.y - y) - rt;
          if (d < rad && d < bd) {
            bd = d;
            best = n;
          }
        }
    return best;
  }

  const KIND: Record<string, string> = {
    n: 'Passiva',
    a: 'Atributo (+5, à escolha)',
    M: 'Escolha múltipla',
    N: 'Notável',
    K: 'Keystone',
    J: 'Encaixe de joia',
    S: 'Início de classe',
    A: 'Início da ascendência',
  };
  const STATUS: Record<Status, string> = { off: '', on: 'Alocado', new: 'Novo nesta fase', removed: 'Sai no respec' };

  function showTip(n: TreeNode, px: number, py: number) {
    const st = statusOf(n.id);
    const ws = ws1.has(n.id) ? 'Weapon Set 1' : ws2.has(n.id) ? 'Weapon Set 2' : '';
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    tip.innerHTML = `
      <div class="t-name k-${n.k}">${esc(n.n || KIND[n.k])}</div>
      <div class="t-kind">${n.asc ? `Ascendência · ${esc(n.asc)}` : KIND[n.k]}${st !== 'off' ? ` · <span class="st-${st}">${STATUS[st]}</span>` : ''}${ws ? ` · <span class="ws">${ws}</span>` : ''}</div>
      ${n.s?.length ? `<ul>${n.s.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}`;
    tip.hidden = false;
    const r = stage.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = px + 16;
    let top = py + 16;
    if (left + tw > r.width - 8) left = Math.max(8, px - tw - 16);
    if (top + th > r.height - 8) top = Math.max(8, py - th - 16);
    tip.style.transform = `translate(${left}px, ${top}px)`;
  }
  function hideTip() {
    tip.hidden = true;
  }

  /* ------------------------------------------------------------- input */
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt = { x: 0, y: 0, t: 0 };
  let moved = false;
  let pinchStart: { d: number; scale: number; mx: number; my: number; tx: number; ty: number } | null = null;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      downAt = { ...p, t: performance.now() };
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), scale, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx, ty };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !pinned) {
        const n = hitTest(p.x, p.y, 10);
        if (n !== hover) {
          hover = n;
          draw();
        }
        if (n) showTip(n, p.x, p.y);
        else hideTip();
        canvas.style.cursor = n ? 'pointer' : 'grab';
      }
      return;
    }
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 4) moved = true;
      if (moved) {
        tx += p.x - prev.x;
        ty += p.y - prev.y;
        hideTip();
        draw();
      }
    } else if (pointers.size === 2 && pinchStart) {
      moved = true;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ns = clamp(pinchStart.scale * (d / pinchStart.d), minScale, maxScale);
      const k = ns / pinchStart.scale;
      tx = mx - (pinchStart.mx - pinchStart.tx) * k;
      ty = my - (pinchStart.my - pinchStart.ty) * k;
      scale = ns;
      hideTip();
      draw();
    }
  });

  const end = (e: PointerEvent) => {
    const p = local(e);
    const wasTap = pointers.size === 1 && !moved && performance.now() - downAt.t < 500;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (wasTap) {
      const n = hitTest(p.x, p.y, e.pointerType === 'mouse' ? 10 : 18);
      pinned = n && n !== pinned ? n : null;
      if (pinned) showTip(pinned, p.x, p.y);
      else hideTip();
      draw();
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    pinchStart = null;
  });
  canvas.addEventListener('pointerleave', () => {
    if (!pinned) {
      hover = null;
      hideTip();
      draw();
    }
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(Math.exp(-e.deltaY * 0.0016), p.x, p.y);
      if (!pinned) hideTip();
    },
    { passive: false },
  );

  root.querySelector('[data-zoom-in]')?.addEventListener('click', () => {
    const r = stage.getBoundingClientRect();
    zoomAt(1.5, r.width / 2, r.height / 2);
  });
  root.querySelector('[data-zoom-out]')?.addEventListener('click', () => {
    const r = stage.getBoundingClientRect();
    zoomAt(1 / 1.5, r.width / 2, r.height / 2);
  });
  root.querySelector('[data-fit]')?.addEventListener('click', () => fitTo([...alloc]));
  root.querySelector('[data-fullscreen]')?.addEventListener('click', () => toggleFull());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-full')) toggleFull(false);
  });

  function toggleFull(force?: boolean) {
    const on = force ?? !root.classList.contains('is-full');
    root.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('tree-full', on);
    const btn = root.querySelector<HTMLButtonElement>('[data-fullscreen]');
    if (btn) btn.setAttribute('aria-pressed', String(on));
    if (on) void load();
    requestAnimationFrame(() => {
      resize();
      fitTo([...alloc]);
    });
  }

  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-phase]')) {
    b.addEventListener('click', () => {
      const i = opts.phases.findIndex((p) => p.phaseId === b.dataset.phase);
      if (i >= 0) applyPhase(i, true);
    });
  }

  if (search) {
    const run = () => {
      const q = search.value.trim().toLowerCase();
      matches = q.length < 2 ? [] : nodes.filter((n) => n.n.toLowerCase().includes(q) || n.s?.some((s) => s.toLowerCase().includes(q)));
      // notáveis primeiro
      matches.sort((a, b) => Number(b.k === 'N' || b.k === 'K') - Number(a.k === 'N' || a.k === 'K'));
      matchCursor = -1;
      if (searchCount) searchCount.textContent = q.length < 2 ? '' : `${matches.length}`;
      draw();
    };
    search.addEventListener('input', run);
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !matches.length) return;
      e.preventDefault();
      matchCursor = (matchCursor + 1) % matches.length;
      const n = matches[matchCursor];
      centerOn(n, 0.14);
      pinned = n;
      const r = stage.getBoundingClientRect();
      showTip(n, r.width / 2, r.height / 2);
    });
  }

  new ResizeObserver(() => resize()).observe(stage);

  // contador da fase inicial já aparece antes da árvore carregar
  applyPhase(phaseIdx);

  // carrega quando a árvore chega perto da tela (e a caixa em volta está aberta)
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && shown()) {
        io.disconnect();
        void load();
      }
    },
    { rootMargin: '400px' },
  );
  io.observe(root);

  // caixa <details> abriu: checa de novo se dá pra carregar e centraliza nos nodes da fase
  box?.addEventListener('toggle', () => {
    if (!box.open) return;
    needsFit = true;
    if (!loading) {
      io.unobserve(root);
      io.observe(root); // observe() sempre entrega o estado atual → carrega se já estiver na tela
    }
    requestAnimationFrame(() => resize());
  });

  // TREE-02: começa o download logo depois do load da página, sem esperar rolar até a árvore
  if (opts.loadOn === 'idle') {
    const start = () => {
      const kick = () => void load();
      if ('requestIdleCallback' in window) window.requestIdleCallback(kick, { timeout: 2000 });
      else setTimeout(kick, 300);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }

  return {
    selectPhase(id: string, opts2: { scroll?: boolean } = {}) {
      const i = opts.phases.findIndex((p) => p.phaseId === id);
      if (i < 0) return;
      // sem árvore (ainda) ou caixa fechada: guarda a fase, atualiza o contador e centraliza quando aparecer
      applyPhase(i, true);
      if (opts2.scroll) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    fullscreen: toggleFull,
    load,
  };
}
