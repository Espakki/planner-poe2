/**
 * Detalhe das gemas na caixa Skills (GemGroup + GemDetail + GemInfo).
 * Cada gema (skill ou suporte) é um <button data-gem-btn="id" aria-controls="gd-…" aria-expanded>. Todos os botões
 * de um grupo apontam pro MESMO painel [data-gem-detail]; tocar numa gema mostra o detalhe dela ali (o texto vem do
 * <template data-gem-tpl="id"> da página, um por gema). Tocar de novo na mesma gema, no × ou Esc fecha.
 * Delegação no document: vale pra todas as fases (página da build e modo jogando) sem init por elemento.
 */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function panelOf(btn: HTMLElement): HTMLElement | null {
  const id = btn.getAttribute('aria-controls');
  return id ? document.getElementById(id) : null;
}

function triggersOf(panel: HTMLElement): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(`[data-gem-btn][aria-controls="${CSS.escape(panel.id)}"]`)];
}

/** Põe no painel o detalhe da gema `id` (clona o template) — só refaz se trocou de gema. */
function fill(panel: HTMLElement, id: string) {
  if (panel.dataset.shown === id) return;
  const slot = panel.querySelector<HTMLElement>('[data-gem-slot]');
  const tpl = document.querySelector<HTMLTemplateElement>(`template[data-gem-tpl="${CSS.escape(id)}"]`);
  if (!slot || !tpl) return;
  panel.querySelector(':scope > [data-gem-links]')?.remove();
  slot.replaceChildren(tpl.content.cloneNode(true));
  // links da wiki ficam no fim, depois do que é da fase
  const links = slot.querySelector('[data-gem-links]');
  if (links) panel.append(links);
  panel.dataset.shown = id;
}

function close(panel: HTMLElement, returnFocus = false) {
  panel.hidden = true;
  let active: HTMLButtonElement | undefined;
  for (const b of triggersOf(panel)) {
    if (b.getAttribute('aria-expanded') === 'true') active = b;
    b.setAttribute('aria-expanded', 'false');
  }
  if (returnFocus) active?.focus();
}

function open(btn: HTMLButtonElement) {
  const panel = panelOf(btn);
  const id = btn.dataset.gemBtn;
  if (!panel || !id) return;
  for (const b of triggersOf(panel)) b.setAttribute('aria-expanded', String(b === btn));
  fill(panel, id);
  // "Nesta fase" / "A verificar" do grupo: só no detalhe da gema principal
  const isMain = btn.hasAttribute('data-gem-main');
  for (const el of panel.querySelectorAll<HTMLElement>('[data-main-only]')) el.hidden = !isMain;
  const name = btn.querySelector('.game-name')?.textContent?.trim();
  if (name) panel.setAttribute('aria-label', `Detalhe: ${name}`);
  panel.hidden = false;
  // no celular o detalhe pode abrir fora da tela: rola só o necessário
  const r = panel.getBoundingClientRect();
  if (r.bottom > window.innerHeight || r.top < 0) {
    panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

document.addEventListener('click', (e) => {
  const t = e.target as Element | null;
  if (!t?.closest) return;
  const btn = t.closest<HTMLButtonElement>('[data-gem-btn]');
  if (btn) {
    const panel = panelOf(btn);
    if (panel && !panel.hidden && btn.getAttribute('aria-expanded') === 'true') close(panel);
    else open(btn);
    return;
  }
  const x = t.closest<HTMLElement>('[data-gem-close]');
  if (x) {
    const panel = x.closest<HTMLElement>('[data-gem-detail]');
    if (panel) close(panel, true);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const group = (e.target as Element | null)?.closest?.('[data-gem-group]');
  const panel = group?.querySelector<HTMLElement>('[data-gem-detail]:not([hidden])');
  if (panel) {
    e.preventDefault();
    close(panel, true);
  }
});
