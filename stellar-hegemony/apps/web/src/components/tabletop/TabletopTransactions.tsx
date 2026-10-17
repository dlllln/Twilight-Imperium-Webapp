import { type GameState } from '@stellar/domain';
import { Coins, Globe2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useGameStore, useViewer } from '../../game-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { useLanguage } from '../../use-translation.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import { itemLabel, moveLabel } from './tabletop-copy.ts';
import { tabletopMovements, type TabletopMove } from './tabletop-model.ts';

interface Activity {
  readonly serial: number;
  readonly moves: readonly TabletopMove[];
}
const EMPTY: Activity = { serial: 0, moves: [] };

/** Events are acknowledged once, including with animations off; reconnects never replay old moves. */
function useTableActivity(game: GameState): Activity {
  const last = useGameStore((state) => state.lastEvents);
  const viewer = useViewer();
  const seen = useRef(last?.serial ?? 0);
  const [activity, setActivity] = useState<Activity>(EMPTY);
  useEffect(() => {
    if (last === null || last.serial <= seen.current) return;
    seen.current = last.serial;
    setActivity({ serial: last.serial, moves: tabletopMovements(last.events, { game, viewer }) });
  }, [game, last, viewer]);
  useEffect(() => {
    if (activity.moves.length === 0) return;
    const timer = window.setTimeout(() => setActivity(EMPTY), 2400);
    return () => window.clearTimeout(timer);
  }, [activity]);
  return activity;
}

function MovingComponent({ move }: { readonly move: TabletopMove }) {
  if (move.item === 'goods') return <Coins size={24} aria-hidden="true" />;
  if (move.item === 'planet') return <Globe2 size={24} aria-hidden="true" />;
  if (move.item === 'leader' && move.artwork === undefined)
    return <UserRound size={24} aria-hidden="true" />;
  const back = move.item === 'secret' ? 'objective-secret' : move.item;
  const artwork = move.artwork ?? {
    path: `/ti4/cards/${back}-back.jpg`,
    columns: 1,
    rows: 1,
    index: 0,
  };
  return <CompleteCardArtwork artwork={artwork} />;
}

function Movement({ game, move }: { readonly game: GameState; readonly move: TabletopMove }) {
  const language = useLanguage();
  const owner = game.players.find((player) => player.id === move.player)?.name ?? '';
  return (
    <li className="tabletop-transaction" data-movement={move.kind}>
      <span className="tabletop-moving-component" aria-hidden="true">
        <MovingComponent move={move} />
      </span>
      <span>
        <strong>{owner}</strong> {moveLabel(move.kind, language)} <b>{move.count}</b>{' '}
        {itemLabel(move.item, language)}
      </span>
    </li>
  );
}

/** Brief component movements stay in their tray, with an equally readable still fallback. */
export function TabletopTransactions({ game }: { readonly game: GameState }) {
  const activity = useTableActivity(game);
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedMotion();
  return (
    <ol
      className="tabletop-transactions"
      data-motion={animations && !reduced}
      aria-live="polite"
      aria-atomic="true"
    >
      {activity.moves.map((move, index) => (
        <Movement key={`${activity.serial}-${String(index)}`} game={game} move={move} />
      ))}
    </ol>
  );
}
