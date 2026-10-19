import { type GameState, type PendingPlay, type PlayerId, reactionActor } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import type { MessageKey } from '../../i18n.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { CardFace } from './CardItem.tsx';
import { PlayableCards } from './PlayableCards.tsx';

const WINDOW_TEXT = {
  afterActivation: 'window.afterActivation',
  combatRound: 'window.combatRound',
  invasion: 'window.invasion',
} as const satisfies Record<string, MessageKey>;

/** RR 3.8: die gespielte Karte, die der Spieler jetzt verhindern dürfte. */
export function PendingCard({
  game,
  pending,
}: {
  readonly game: GameState;
  readonly pending: PendingPlay;
}) {
  const t = useT();
  return (
    <div className="pending-card">
      <p>
        <PlayerTag game={game} id={pending.player} /> {t('cardPlayedBy')}:
      </p>
      <div className="action-card">
        <CardFace id={pending.card} count={1} />
      </div>
    </div>
  );
}

/** Die offene Karte oder der Anlass des Zeitfensters; auch die Ansage am Pult zeigt sie. */
export function PromptText({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const kind = game.reactionWindow?.kind;
  if (game.pendingPlay !== null) return <PendingCard game={game} pending={game.pendingPlay} />;
  return kind === undefined ? null : <p className="hint">{t(WINDOW_TEXT[kind])}</p>;
}

interface PromptProps {
  readonly game: GameState;
  /** Spielbare Karten gleich hier anbieten (Kampfansicht); sonst stehen sie in der Hand. */
  readonly withCards?: boolean;
}

/** Offenes Zeitfenster oder offene Karte: spielen oder weitergeben (RR 3.10). */
export function ReactionPrompt({ game, withCards = false }: PromptProps): ReactElement | null {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const player: PlayerId | null = reactionActor(game);
  if (player === null) return null;
  const pending = game.pendingPlay;
  const pass = () => send({ type: 'PassReaction', issuedBy: player });
  return (
    <div className="turn-block reaction-prompt" role="group" aria-label={t('reaction')}>
      <h3>
        {t('reaction')}: <PlayerTag game={game} id={player} />
      </h3>
      <PromptText game={game} />
      {withCards && <PlayableCards game={game} player={player} />}
      <button type="button" onClick={pass}>
        {t(pending === null ? 'passReaction' : 'allowCard')}
      </button>
    </div>
  );
}
