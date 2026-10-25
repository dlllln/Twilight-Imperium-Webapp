import { type ReactElement, useEffect } from 'react';
import { useSidebarStore } from '../game/sidebar-store.ts';
import { TUTORIAL_STEPS, type TutorialStep } from '../../tutorial/tutorial-steps.ts';
import { useTutorialStore } from '../../tutorial/tutorial-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';

const FOCUS = 'tutorial-focus';

const anchored = (anchor: string): Element | null =>
  document.querySelector(`[data-tutorial="${anchor}"]`);

/** Das Element des Schritts: am Tisch sein Tischelement, sonst der Anker (Seitenleiste öffnen). */
function spotlightOf(step: TutorialStep | undefined): Element | null {
  const table = step?.table === undefined ? null : anchored(step.table);
  if (table !== null || step?.anchor == null) return table;
  useSidebarStore.getState().reveal(step.anchor);
  return anchored(step.anchor);
}

/** Hebt das Element des Schritts hervor, solange er offen ist; fehlt es, bleibt nur der Text. */
function useSpotlight(step: TutorialStep | undefined): void {
  useEffect(() => {
    const target = spotlightOf(step);
    if (target === null) return;
    target.classList.add(FOCUS);
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return () => target.classList.remove(FOCUS);
  }, [step]);
}

/** Zurück, Weiter und Schließen; im letzten Schritt schließt der Hauptknopf. */
function TutorialActions(): ReactElement {
  const t = useT();
  const { step, next, previous, close } = useTutorialStore();
  const last = step === TUTORIAL_STEPS.length - 1;
  return (
    <div className="tutorial-actions">
      <button type="button" onClick={previous} disabled={step === 0}>
        {t('guideBack')}
      </button>
      <button type="button" className="primary" onClick={last ? close : next}>
        {t(last ? 'guideClose' : 'guideNext')}
      </button>
      {!last && (
        <button type="button" onClick={close}>
          {t('guideClose')}
        </button>
      )}
    </div>
  );
}

/** Die Anleitung: ein Schritt nach dem anderen, das passende Bedienelement leuchtet auf. */
export function TutorialDialog(): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const { open, step } = useTutorialStore();
  const current = open ? TUTORIAL_STEPS[step] : undefined;
  useSpotlight(current);
  if (current === undefined) return null;
  return (
    <section className="tutorial glass" role="dialog" aria-label={t('guide')} aria-live="polite">
      <p className="tutorial-count">
        {t('guideStep')} {step + 1} / {TUTORIAL_STEPS.length}
      </p>
      <h2>{current.title[language]}</h2>
      <p>{current.text[language]}</p>
      <TutorialActions />
    </section>
  );
}
