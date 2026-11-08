/**
 * Estado do usuário no navegador (fase atual + checklist), por build e patch.
 * Tudo em localStorage com try/catch: em aba anônima/storage bloqueado o site funciona igual, só não lembra.
 */
export interface UserState {
  phase?: string;
  checks: Record<string, true>;
}

const key = (build: string) => `plan-poe:${build}`;

export function loadState(build: string): UserState {
  try {
    const raw = localStorage.getItem(key(build));
    if (!raw) return { checks: {} };
    const parsed = JSON.parse(raw) as Partial<UserState>;
    return { phase: parsed.phase, checks: parsed.checks ?? {} };
  } catch {
    return { checks: {} };
  }
}

export function saveState(build: string, state: UserState): void {
  try {
    localStorage.setItem(key(build), JSON.stringify(state));
  } catch {
    /* sem storage: ignora */
  }
}

export function update(build: string, fn: (s: UserState) => void): UserState {
  const s = loadState(build);
  fn(s);
  saveState(build, s);
  window.dispatchEvent(new CustomEvent('plan-poe:state', { detail: { build, state: s } }));
  return s;
}

/** Liga todos os checkboxes [data-check] da página ao storage e mantém contadores [data-check-count]. */
export function bindChecklists(build: string, root: ParentNode = document): void {
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input[data-check]')];
  const refresh = () => {
    const s = loadState(build);
    for (const b of boxes) b.checked = Boolean(s.checks[b.dataset.check!]);
    for (const counter of root.querySelectorAll<HTMLElement>('[data-check-count]')) {
      const group = counter.dataset.checkCount!;
      const inGroup = boxes.filter((b) => b.dataset.group === group);
      const done = inGroup.filter((b) => b.checked).length;
      counter.textContent = `${done}/${inGroup.length}`;
      counter.classList.toggle('done', done === inGroup.length && inGroup.length > 0);
    }
  };
  for (const b of boxes) {
    b.addEventListener('change', () => {
      update(build, (s) => {
        if (b.checked) s.checks[b.dataset.check!] = true;
        else delete s.checks[b.dataset.check!];
      });
      refresh();
    });
  }
  window.addEventListener('plan-poe:state', refresh);
  window.addEventListener('storage', refresh);
  refresh();
}
