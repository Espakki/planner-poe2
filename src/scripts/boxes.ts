/**
 * Lembra quais caixas (<details class="box" data-box="skills">) o usuário deixou abertas/fechadas.
 * A preferência é por TIPO de caixa (fechar "Como jogar" fecha em todas as fases), salva no navegador.
 */
const KEY = 'plan-poe:boxes';

function load(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function save(v: Record<string, boolean>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* sem storage */
  }
}

export function bindBoxes(root: ParentNode = document): void {
  const boxes = [...root.querySelectorAll<HTMLDetailsElement>('details.box[data-box]')];
  const pref = load();
  for (const b of boxes) {
    const t = b.dataset.box!;
    if (t in pref) b.open = pref[t];
  }
  let syncing = false;
  for (const b of boxes) {
    b.addEventListener('toggle', () => {
      if (syncing) return;
      const t = b.dataset.box!;
      const p = load();
      p[t] = b.open;
      save(p);
      // aplica no mesmo tipo das outras fases
      syncing = true;
      for (const o of boxes) if (o !== b && o.dataset.box === t && o.open !== b.open) o.open = b.open;
      queueMicrotask(() => (syncing = false));
    });
  }
}
