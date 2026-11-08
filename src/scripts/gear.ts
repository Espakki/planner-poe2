/**
 * Inventário da fase (UI-03): clicar/tocar num slot, numa linha do resumo ou num item da faixa
 * "Pra conseguir" mostra o detalhe.
 *  - painel largo: o detalhe fica na coluna ao lado (troca a seção visível)
 *  - painel estreito: a seção é movida pro bottom sheet (<dialog>) e volta pro lugar ao fechar
 * O modo é decidido pelo CSS (container query): se a coluna do detalhe está visível, é painel largo.
 */
export function bindGear(root: ParentNode = document): void {
  for (const panel of root.querySelectorAll<HTMLElement>('[data-gear]')) {
    if (!panel.dataset.gearReady) setup(panel);
  }
}

function setup(panel: HTMLElement): void {
  const col = panel.querySelector<HTMLElement>('[data-gear-col]');
  const sheet = panel.querySelector<HTMLDialogElement>('dialog[data-gear-sheet]');
  const body = sheet?.querySelector<HTMLElement>('[data-gear-sheet-body]');
  const title = sheet?.querySelector<HTMLElement>('[data-gear-sheet-title]');
  if (!col || !sheet || !body) return;

  const sections = new Map(
    [...col.querySelectorAll<HTMLElement>('[data-gear-detail]')].map((s) => [s.dataset.gearDetail!, s] as const),
  );
  const triggers = [...panel.querySelectorAll<HTMLElement>('[data-gear-open]')];
  let current = [...sections.values()].find((s) => !s.hidden)?.dataset.gearDetail ?? null;
  let inSheet: HTMLElement | null = null;

  panel.dataset.gearReady = '1'; // a partir daqui o CSS esconde a coluna no modo estreito
  const inline = () => getComputedStyle(col).display !== 'none';

  const mark = (key: string | null) => {
    for (const t of triggers) {
      if (key && t.dataset.gearOpen === key) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    }
  };

  // detalhe de arma ↔ weapon set mostrado no boneco andam juntos
  const wsRadio = (n: 1 | 2) => panel.querySelector<HTMLInputElement>(`input[data-ws="${n}"]`);
  for (const n of [1, 2] as const) {
    wsRadio(n)?.addEventListener('change', () => {
      const key = `ws${n}`;
      if (inline() && (current === 'ws1' || current === 'ws2') && sections.has(key)) open(key);
    });
  }

  const open = (key: string) => {
    const sec = sections.get(key);
    if (!sec) return;
    if (key === 'ws1' || key === 'ws2') {
      const r = wsRadio(key === 'ws2' ? 2 : 1);
      if (r) r.checked = true;
    }
    if (inline()) {
      for (const [k, s] of sections) s.hidden = k !== key;
      current = key;
      mark(key);
      col.scrollTop = 0;
      const r = col.getBoundingClientRect();
      if (r.bottom < 80 || r.top > window.innerHeight - 80) col.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    sec.hidden = false;
    body.replaceChildren(sec);
    inSheet = sec;
    if (title) title.textContent = sec.dataset.gearTitle ?? 'Equipamento';
    mark(key);
    sheet.showModal();
    body.scrollTop = 0;
  };

  sheet.addEventListener('close', () => {
    if (inSheet) {
      inSheet.hidden = inSheet.dataset.gearDetail !== current;
      col.append(inSheet);
      inSheet = null;
    }
    mark(inline() ? current : null);
  });
  // toque fora do sheet (no backdrop) fecha
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });

  panel.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-gear-open]');
    if (t && panel.contains(t)) open(t.dataset.gearOpen!);
  });

  // marca o slot do detalhe visível só quando o painel é largo (muda ao girar o celular / redimensionar)
  let wasInline: boolean | null = null;
  const sync = () => {
    const now = inline();
    if (now === wasInline) return;
    wasInline = now;
    if (now && sheet.open) sheet.close();
    mark(now ? current : null);
  };
  new ResizeObserver(sync).observe(panel);
}
