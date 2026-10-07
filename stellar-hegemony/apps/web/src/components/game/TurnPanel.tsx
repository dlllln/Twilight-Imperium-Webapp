import {
  type CommandTokensChoice,
  type GameState,
  type PlayerId,
  type StrategyCardDefinition,
  type StrategyCardId,
  strategyCardsOf,
  strategyEffectFor,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { currentActor } from '../../local-game.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from './card-text.ts';
import { TokenForm } from './TokenForm.tsx';

const definitionOf = (id: StrategyCardId | undefined): StrategyCardDefinition | undefined =>
  content.strategyCards.find((card) => card.id === id);

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

function SecondaryPrompt({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const card = definitionOf(game.actionPhase?.secondary?.card);
  if (card === undefined) return null;
  const decline = () => send({ type: 'DeclineSecondary', issuedBy: player });
  return (
    <div className="turn-block">
      <h3>
        {t('secondaryPrompt')}: {cardText(card.id).name[language]}
      </h3>
      <p className="hint">{cardText(card.id).secondary[language]}</p>
      <TokenForm
        key={player}
        game={game}
        player={player}
        card={card}
        ability="secondary"
        onSubmit={(choice) => send({ type: 'ResolveSecondary', issuedBy: player, choice })}
      >
        <button type="button" onClick={decline}>
          {t('decline')}
        </button>
      </TokenForm>
    </div>
  );
}

function CardChoice({
  card,
  onChoose,
}: {
  readonly card: StrategyCardDefinition;
  readonly onChoose: () => void;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const playable = strategyEffectFor(card.mechanic) !== undefined;
  return (
    <li>
      <button type="button" disabled={!playable} onClick={onChoose}>
        {t('strategicAction')}: {cardText(card.id).name[language]}
      </button>
      {!playable && <p className="hint">{t('laterIteration')}</p>}
    </li>
  );
}

interface PrimaryProps extends TurnProps {
  readonly card: StrategyCardDefinition;
  readonly onBack: () => void;
}

function PrimaryAction({ game, player, card, onBack }: PrimaryProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const perform = (choice: CommandTokensChoice) =>
    send({ type: 'PerformStrategicAction', issuedBy: player, card: card.id, choice });
  return (
    <div className="turn-block">
      <h3>{cardText(card.id).name[language]}</h3>
      <p className="hint">{cardText(card.id).primary[language]}</p>
      <TokenForm game={game} player={player} card={card} ability="primary" onSubmit={perform}>
        <button type="button" onClick={onBack}>
          {t('cancel')}
        </button>
      </TokenForm>
    </div>
  );
}

function ActiveTurn({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const [chosen, setChosen] = useState<StrategyCardDefinition | null>(null);
  if (chosen !== null)
    return (
      <PrimaryAction game={game} player={player} card={chosen} onBack={() => setChosen(null)} />
    );
  const unused = strategyCardsOf(game, player).filter((card) => !card.exhausted);
  const cards = unused.flatMap((card) => definitionOf(card.id) ?? []);
  return (
    <div className="turn-block">
      <ul className="choices">
        {cards.map((card) => (
          <CardChoice key={card.id} card={card} onChoose={() => setChosen(card)} />
        ))}
      </ul>
      <button
        type="button"
        disabled={unused.length > 0}
        onClick={() => send({ type: 'Pass', issuedBy: player })}
      >
        {t('pass')}
      </button>
    </div>
  );
}

/** Was der Spieler am Zug in der Aktionsphase tun kann. */
export function TurnPanel({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const actor = currentActor(game);
  if (game.phase === 'status') return <p className="notice">{t('statusReached')}</p>;
  if (game.phase !== 'action' || actor === null) return null;
  return (
    <section className="game-section">
      <h2>{t('phase.action')}</h2>
      {game.actionPhase?.secondary == null ? (
        <ActiveTurn key={actor} game={game} player={actor} />
      ) : (
        <SecondaryPrompt game={game} player={actor} />
      )}
    </section>
  );
}
