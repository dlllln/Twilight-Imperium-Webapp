import { type ActionTarget, type GameState, type HandCard, type PlayerId } from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { actionCardEffect, actionCardLabel, actionCardTiming } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions } from '../game/FormParts.tsx';
import { hasTargets, initialTarget, targetComplete, TargetFields } from './TargetFields.tsx';

interface CardProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: HandCard;
}

/** Name, Zeitpunkt und Wirkung einer Karte in eigenen Worten. */
export function CardFace({ id, count }: { readonly id: string; readonly count: number }) {
  const language = useLanguage();
  return (
    <>
      <header>
        <strong>{actionCardLabel(id, language)}</strong>
        {count > 1 && <span className="badge">×{count}</span>}
      </header>
      <p className="card-timing">{actionCardTiming(id, language)}</p>
      <p className="hint">{actionCardEffect(id, language)}</p>
    </>
  );
}

/** Ziele wählen und ausspielen; ohne Ziele genügt der Knopf. */
export function PlayControls({ game, player, card }: CardProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const [target, setTarget] = useState<ActionTarget>(() => initialTarget(card.targets));
  const play = () =>
    send({ type: 'PlayActionCard', issuedBy: player, card: card.definition.id, target });
  return (
    <>
      {hasTargets(card.targets) && (
        <TargetFields game={game} options={card.targets} value={target} onChange={setTarget} />
      )}
      <Actions label={t('play')} disabled={!targetComplete(card.targets, target)} onClick={play} />
    </>
  );
}

/** Eine Handkarte; nur jetzt spielbare Karten bekommen Ziele und den Knopf. */
export function CardItem(props: CardProps): ReactElement {
  const { card } = props;
  return (
    <li
      className={`action-card ${card.playable ? 'playable' : 'idle'}`}
      data-testid={`card-${card.definition.id}`}
    >
      <CardFace id={card.definition.id} count={card.count} />
      {card.playable && <PlayControls {...props} />}
    </li>
  );
}
