import type { GameState } from '@stellar/domain';
import { AlertTriangle, Bell, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import type { HistoryEntry } from '../../history/turn-history.ts';
import { errorText } from '../../i18n.ts';
import { freshEntries, NOTICE_MS, withFresh } from '../../notices/fresh-notices.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { TurnPanel, useTurnPanelKey } from '../game/TurnPanel.tsx';
import { HistoryText } from '../history/HistoryPanel.tsx';
import { TablePrompt } from '../table/TablePrompt.tsx';

/** Hereingleiten von rechts, wie eine Benachrichtigung; Verschwinden nach rechts. */
const POP = {
  layout: true,
  initial: { opacity: 0, x: 60, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 60, transition: { duration: 0.18 } },
  transition: { type: 'spring', stiffness: 420, damping: 32 },
} as const;

/** Ohne Animationen erscheinen und verschwinden Meldungen sofort. */
function usePop() {
  return useSettingsStore((state) => state.animations) ? POP : STILL;
}

const STILL = { initial: false } as const;

/** Meldungen über die Züge der anderen, die nach kurzer Zeit von selbst verschwinden. */
function useFreshNotices() {
  const history = useGameStore((state) => state.history);
  const me = useGameStore((state) => state.me);
  const seen = useRef(history.at(-1)?.id ?? 0);
  const [shown, setShown] = useState<readonly HistoryEntry[]>([]);
  useEffect(() => {
    const fresh = freshEntries(history, seen.current, me);
    seen.current = history.at(-1)?.id ?? seen.current;
    if (fresh.length > 0) setShown((before) => withFresh(before, fresh));
  }, [history, me]);
  const dismiss = useCallback(
    (id: number) => setShown((before) => before.filter((entry) => entry.id !== id)),
    [],
  );
  return { shown, dismiss };
}

function InfoNotice(props: {
  readonly entry: HistoryEntry;
  readonly game: GameState;
  readonly onDismiss: (id: number) => void;
}): ReactElement {
  const t = useT();
  const pop = usePop();
  const { entry, onDismiss } = props;
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(entry.id), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [entry.id, onDismiss]);
  return (
    <motion.div {...pop} className="notice info" role="status">
      <Bell size={15} aria-hidden="true" className="notice-icon" />
      <p>
        <HistoryText line={entry.line} game={props.game} />
      </p>
      <button
        type="button"
        className="notice-close"
        aria-label={t('dismissNotice')}
        onClick={() => onDismiss(entry.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/** Ein abgelehnter Befehl: rot, bis man ihn wegklickt oder der nächste Befehl gelingt. */
function ErrorNotice(): ReactElement | null {
  const t = useT();
  const pop = usePop();
  const language = useLanguage();
  const error = useGameStore((state) => state.error);
  const clear = useGameStore((state) => state.setError);
  if (error === null) return null;
  return (
    <motion.div {...pop} key={`error-${error.code}`} className="notice error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" className="notice-icon" />
      <p>
        {t('ruleError')}: {errorText(language, error.code)}
      </p>
      <button
        type="button"
        className="notice-close"
        aria-label={t('dismissNotice')}
        onClick={() => clear(null)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/**
 * Unten rechts, über der Phasenanzeige: kurze Meldungen, was die anderen gerade getan haben.
 * In der klassischen Ansicht ploppt dort auch die offene Entscheidung wie eine Benachrichtigung
 * auf; in der Tischansicht steht sie stattdessen als Ansage über dem Pult, außerhalb der Liste.
 */
export function NoticeStack({ game }: { readonly game: GameState }): ReactElement {
  const decision = useTurnPanelKey(game);
  const table = useSettingsStore((state) => state.tableView);
  const pop = usePop();
  const { shown, dismiss } = useFreshNotices();
  return (
    <>
      <div className="notice-stack" aria-live="polite">
        <AnimatePresence initial={false}>
          {shown.map((entry) => (
            <InfoNotice key={entry.id} entry={entry} game={game} onDismiss={dismiss} />
          ))}
          <ErrorNotice key="error" />
        </AnimatePresence>
        {/* Die alte Entscheidung verschwindet sofort, damit nie zwei Formulare gleichzeitig offen sind. */}
        {!table && decision !== null && (
          <motion.div {...pop} key={decision} className="notice decision">
            <TurnPanel game={game} />
          </motion.div>
        )}
      </div>
      {table && decision !== null && <TablePrompt key={decision} game={game} />}
    </>
  );
}
