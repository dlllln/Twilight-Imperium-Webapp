import { type ReactElement, useEffect } from 'react';
import { useSidebarStore } from '../game/sidebar-store.ts';
import { TUTORIAL_STEPS } from '../../tutorial/tutorial-steps.ts';
import { useTutorialStore } from '../../tutorial/tutorial-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';

const FOCUS = 'tutorial-focus';

/** Hebt das genannte Element hervor, solange der Schritt offen ist; fehlt es, bleibt nur der Text. */
function useSpotlight(anchor: string | null): void {
  useEffect(() => {
    if (anchor === null) return;
    useSidebarStore.getState().reveal(anchor);
    const target = document.querySelector(`[data-tutorial="${anchor}"]`);
    if (target === null) return;
    target.classList.add(FOCUS);
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return () => target.classList.remove(FOCUS);
  }, [anchor]);
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
  useSpotlight(current?.anchor ?? null);
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
