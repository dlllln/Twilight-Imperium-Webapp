import {
  excessActionCards,
  findPlayer,
  type GameState,
  type PlayerId,
  reactionActor,
  type StrategyCardDefinition,
  type StrategyCardId,
  type StrategyChoice,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { useOthersTurn, useGameStore, useHumanActor } from '../../game-store.ts';
import { useHandStore } from '../../hand/hand-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { content } from '../../store.ts';
import { PHASE_TIPS } from '../../tutorial/tutorial-steps.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { GameOverNotice, StatusTurn } from '../objectives/StatusTurn.tsx';
import { SecretChoiceForm } from '../objectives/SecretChoiceForm.tsx';
import { AgendaTurn } from '../agenda/AgendaTurn.tsx';
import { DiscardForm } from '../cards/DiscardForm.tsx';
import { ReactionPrompt } from '../cards/ReactionPrompt.tsx';
import { cardText } from './card-text.ts';
import { ChoiceForm } from './ChoiceForm.tsx';
import { PlayerTag } from './PlayerTag.tsx';
import { TacticalTurn } from './TacticalPanel.tsx';
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

interface PrimaryProps extends TurnProps {
  readonly card: StrategyCardDefinition;
  readonly onBack: () => void;
}

function PrimaryAction({ game, player, card, onBack }: PrimaryProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const send = useGameStore((state) => state.send);
  const perform = (choice: StrategyChoice) => {
    if (send({ type: 'PerformStrategicAction', issuedBy: player, card: card.id, choice })) onBack();
  };
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

/** Die aus der Hand gespielte strategische Aktion dieses Spielers, falls eine offen ist. */
function useChosenCard(player: PlayerId): StrategyCardDefinition | undefined {
  const chosen = useHandStore((state) => state.chosen);
  return chosen?.player === player ? definitionOf(chosen.card) : undefined;
}

/** Gezogen wird mit den Karten der Hand; hier stehen nur Formulare und der Handel. */
function ActiveTurn({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const chosen = useChosenCard(player);
  const clear = useHandStore((state) => state.clear);
  if (game.actionPhase?.tactical != null) return <TacticalTurn game={game} player={player} />;
  if (chosen !== undefined)
    return <PrimaryAction game={game} player={player} card={chosen} onBack={clear} />;
  return (
    <div className="turn-block">
      <p className="hint hand-hint">{t('handHint')}</p>
      <TransactionForm game={game} player={player} />
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

/** Welche Unterbrechung ansteht, als Name (für den Schlüssel der Benachrichtigung). */
function interruptionKind(game: GameState, player: PlayerId): string {
  if (findPlayer(game, player)?.secretChoice != null) return 'secret';
  if (reactionActor(game) === player) return 'reaction';
  return excessActionCards(game, player) > 0 ? 'discard' : '';
}

/** Was jede Phase unterbricht: Geheimauftrags-Wahl, Reaktion, Ablegen über dem Limit. */
function interruption(game: GameState, player: PlayerId): ReactElement | null {
  if (findPlayer(game, player)?.secretChoice != null)
    return <SecretChoiceForm key={player} game={game} player={player} />;
  if (reactionActor(game) === player) return <ReactionPrompt game={game} />;
  if (excessActionCards(game, player) > 0)
    return <DiscardForm key={player} game={game} player={player} />;
  return null;
}

/** Erst die Unterbrechung, dann der Zug der jeweiligen Phase. */
function PhaseContent({ game, player }: TurnProps): ReactElement | null {
  const interrupting = interruption(game, player);
  if (interrupting !== null) return interrupting;
  if (game.phase === 'status') return <StatusTurn game={game} player={player} />;
  if (game.phase === 'agenda') return <AgendaTurn game={game} player={player} />;
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

/** Die Strategiephase wählt in der Kartenauslage; hier erscheint sie nur bei Unterbrechungen. */
const hasTurnPanel = (game: GameState, actor: PlayerId): boolean =>
  game.phase !== 'strategy' || interruption(game, actor) !== null;

/** Während die KI oder ein Mitspieler zieht, gibt es hier nichts zu entscheiden, nur einen Hinweis. */
function BotNotice({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const bot = useGameStore((state) => state.bots.includes(player));
  return (
    <section className="game-section bot-turn" aria-live="polite" data-tutorial="turn">
      <p>
        <PlayerTag game={game} id={player} /> {t(bot ? 'botThinking' : 'otherThinking')}
      </p>
    </section>
  );
}

/**
 * Schlüssel der offenen Entscheidung: Ändert er sich, ploppt die Benachrichtigung neu auf;
 * `null`, wenn es nichts zu zeigen gibt.
 */
export function useTurnPanelKey(game: GameState): string | null {
  const actor = useHumanActor(game);
  const bot = useOthersTurn(game);
  const chosen = useHandStore((state) => state.chosen?.card ?? '');
  if (game.phase === 'gameOver') return 'gameOver';
  if (bot !== null) return `wait-${bot}`;
  if (actor === null || !hasTurnPanel(game, actor)) return null;
  const { secondary, tactical, transaction } = game.actionPhase ?? {};
  const parts = [game.phase, game.round, interruptionKind(game, actor), secondary?.card];
  return [...parts, tactical != null, transaction != null, chosen].join('|');
}

/** Ein kurzer Satz zur Phase, solange Tipps eingeschaltet sind. */
function PhaseTip({ game }: { readonly game: GameState }): ReactElement | null {
  const language = useLanguage();
  const tips = useSettingsStore((state) => state.tips);
  if (!tips) return null;
  return <p className="hint phase-tip">{PHASE_TIPS[game.phase][language]}</p>;
}

/** Was der Spieler am Bildschirm gerade tun kann; nach dem Sieg nur noch das Ergebnis. */
export function TurnPanel({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const actor = useHumanActor(game);
  const bot = useOthersTurn(game);
  if (game.phase === 'gameOver') return <GameOverNotice game={game} />;
  if (bot !== null) return <BotNotice game={game} player={bot} />;
  if (actor === null || !hasTurnPanel(game, actor)) return null;
  return (
    <section className="game-section your-turn" data-tutorial="turn">
      <h2>{t(PHASE_TITLE[game.phase])}</h2>
      <PhaseTip game={game} />
      <PhaseContent game={game} player={actor} />
    </section>
  );
}
