/**
 * The real game's front door — the menu `npm run dev:game` opens before any world exists. It is the
 * "which world do you want?" question from Phase 0's unifying insight, narrowed to the two the real
 * game offers: **New Game** (seed a fresh cold-open) and **Continue** (hydrate the save). The
 * sandbox has no menu — `dev:sandbox` boots straight into the test world — so this lives only on the
 * real-game path.
 *
 * It builds its own full-screen overlay (rather than baking markup into `index.html`) so the front
 * door is one self-contained concern; on a choice it tears the overlay down and hands control back to
 * the dispatcher, which seeds the chosen world and starts the engine.
 */
export interface MenuChoice {
  kind: 'new' | 'continue';
}

export function showMenu(opts: { canContinue: boolean; onChoose: (choice: MenuChoice) => void }): void {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '28px',
    background: '#1a1a1a',
    color: '#e8e4da',
    fontFamily: 'system-ui, sans-serif',
    zIndex: '1000',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  const title = document.createElement('div');
  title.textContent = 'RIGRUNNER';
  Object.assign(title.style, {
    fontSize: '64px',
    fontWeight: '800',
    letterSpacing: '0.18em',
  } satisfies Partial<CSSStyleDeclaration>);

  const buttons = document.createElement('div');
  Object.assign(buttons.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '260px',
  } satisfies Partial<CSSStyleDeclaration>);

  const choose = (kind: MenuChoice['kind']): void => {
    window.removeEventListener('keydown', onKey);
    root.remove();
    opts.onChoose({ kind });
  };

  // Continue is the primary action when a save exists (you most often want to pick up where you left
  // off); otherwise New Game is. Enter triggers whichever is primary.
  const continueBtn = makeButton('Continue', opts.canContinue, () => choose('continue'));
  const newBtn = makeButton('New Game', true, () => choose('new'));

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') choose(opts.canContinue ? 'continue' : 'new');
  }
  window.addEventListener('keydown', onKey);

  buttons.append(continueBtn, newBtn);
  root.append(title, buttons);
  document.body.append(root);
}

/** A menu button — full-width, dark-theme; a disabled one (no save → Continue) reads dimmed and inert. */
function makeButton(label: string, enabled: boolean, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.disabled = !enabled;
  Object.assign(btn.style, {
    padding: '14px 20px',
    fontSize: '20px',
    fontFamily: 'inherit',
    fontWeight: '600',
    letterSpacing: '0.04em',
    color: enabled ? '#e8e4da' : '#6b6660',
    background: enabled ? '#2c2a26' : '#222',
    border: `1px solid ${enabled ? '#4a463f' : '#333'}`,
    borderRadius: '6px',
    cursor: enabled ? 'pointer' : 'not-allowed',
  } satisfies Partial<CSSStyleDeclaration>);
  if (enabled) {
    btn.addEventListener('mouseenter', () => { btn.style.background = '#39362f'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#2c2a26'; });
    btn.addEventListener('click', onClick);
  }
  return btn;
}
