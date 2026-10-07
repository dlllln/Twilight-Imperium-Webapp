import {
  findPlayer,
  type GameState,
  type PlayerId,
  type StrategyCardDefinition,
  type StrategyCardId,
  type StrategyChoice,
  strategyCardsOf,
  strategyEffectFor,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { currentActor } from '../../local-game.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { GameOverNotice, StatusTurn } from '../objectives/StatusTurn.tsx';
import { SecretChoiceForm } from '../objectives/SecretChoiceForm.tsx';
import { cardText } from './card-text.ts';
import { ChoiceForm } from './ChoiceForm.tsx';
import { ActivationBlock, TacticalTurn } from './TacticalPanel.tsx';
import { TransactionForm, TransactionReply } from './TransactionForm.tsx';

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
      <ChoiceForm
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
      </ChoiceForm>
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
  const perform = (choice: StrategyChoice) =>
    send({ type: 'PerformStrategicAction', issuedBy: player, card: card.id, choice });
  return (
    <div className="turn-block">
      <h3>{cardText(card.id).name[language]}</h3>
      <p className="hint">{cardText(card.id).primary[language]}</p>
      <ChoiceForm game={game} player={player} card={card} ability="primary" onSubmit={perform}>
        <button type="button" onClick={onBack}>
          {t('cancel')}
        </button>
      </ChoiceForm>
    </div>
  );
}

function ActiveTurn({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const [chosen, setChosen] = useState<StrategyCardDefinition | null>(null);
  if (game.actionPhase?.tactical != null) return <TacticalTurn game={game} player={player} />;
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
      <ActivationBlock game={game} player={player} />
      <TransactionForm game={game} player={player} />
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

/** Offene Sekundärfähigkeit, dann ein Tauschangebot, sonst der normale Zug. */
function TurnContent({ game, player }: TurnProps): ReactElement {
  if (game.actionPhase?.secondary != null) return <SecondaryPrompt game={game} player={player} />;
  if (game.actionPhase?.transaction != null)
    return <TransactionReply game={game} player={player} />;
  return <ActiveTurn key={player} game={game} player={player} />;
}

/** Offene Geheimauftrags-Wahl zuerst, dann der Zug der jeweiligen Phase. */
function PhaseContent({ game, player }: TurnProps): ReactElement | null {
  if (findPlayer(game, player)?.secretChoice != null)
    return <SecretChoiceForm key={player} game={game} player={player} />;
  if (game.phase === 'status') return <StatusTurn game={game} player={player} />;
  return game.phase === 'action' ? <TurnContent game={game} player={player} /> : null;
}

const PHASE_TITLE = {
  strategy: 'phase.strategy',
  action: 'phase.action',
  status: 'phase.status',
  agenda: 'phase.agenda',
  setup: 'phase.strategy',
  gameOver: 'phase.status',
} as const satisfies Record<GameState['phase'], string>;

/** Die Strategiephase wählt in der Kartenauslage; hier erscheint sie nur für Geheimaufträge. */
const hasTurnPanel = (game: GameState, actor: PlayerId): boolean =>
  game.phase === 'action' ||
  game.phase === 'status' ||
  findPlayer(game, actor)?.secretChoice != null;

/** Was der Spieler am Bildschirm gerade tun kann; nach dem Sieg nur noch das Ergebnis. */
export function TurnPanel({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const actor = currentActor(game);
  if (game.phase === 'gameOver') return <GameOverNotice game={game} />;
  if (actor === null || !hasTurnPanel(game, actor)) return null;
  return (
    <section className="game-section">
      <h2>{t(PHASE_TITLE[game.phase])}</h2>
      <PhaseContent game={game} player={actor} />
    </section>
  );
}
