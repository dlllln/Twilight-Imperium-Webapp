import type {
  GameState,
  StrategyCardDefinition,
  StrategyCardId,
  StrategyChoice,
} from '@stellar/domain';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useHandStore } from '../../hand/hand-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { content } from '../../store.ts';
import type { DecisionKind, DecisionRoute } from '../../table/decision-route.ts';
import { useDecisionRoute } from '../../table/use-decision-route.ts';
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
import { CombatPending, TacticalTurn } from './TacticalPanel.tsx';
import { TransactionForm, TransactionReply } from './TransactionForm.tsx';
import type { TurnProps } from './turn-props.ts';

const definitionOf = (id: StrategyCardId | null | undefined): StrategyCardDefinition | undefined =>
  content.strategyCards.find((card) => card.id === id);

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

/** Die aus der Hand gespielte strategische Aktion; ohne bekannte Karte gibt es nichts zu zeigen. */
function ChosenPrimary(
  props: TurnProps & { readonly card: StrategyCardId | null },
): ReactElement | null {
  const clear = useHandStore((state) => state.clear);
  const card = definitionOf(props.card);
  if (card === undefined) return null;
  return <PrimaryAction game={props.game} player={props.player} card={card} onBack={clear} />;
}

/** Gezogen wird mit den Karten der Hand; hier stehen nur der Hinweis und der Handel. */
function IdleTurn({ game, player }: TurnProps): ReactElement {
  const t = useT();
  return (
    <div className="turn-block">
      <p className="hint hand-hint">{t('handHint')}</p>
      <TransactionForm game={game} player={player} />
    </div>
  );
}

/** Der Verteidiger entscheidet nur im Kampf: kein Tausch, kein Ende der Aktion des Angreifers. */
function CombatTurn(): ReactElement {
  const t = useT();
  return (
    <div className="turn-block">
      <p className="hint">{t('combatWaiting')}</p>
      <CombatPending />
    </div>
  );
}

interface BodyProps extends TurnProps {
  readonly route: DecisionRoute;
}

type Body = (props: BodyProps) => ReactElement | null;

const statusBody: Body = ({ game, player }) => <StatusTurn game={game} player={player} />;
const agendaBody: Body = ({ game, player }) => <AgendaTurn game={game} player={player} />;

/** Je Art der Entscheidung ein kleines Formular; die Schlüssel trennen die Plätze am Hot-Seat. */
const BODIES: Readonly<Record<Exclude<DecisionKind, 'gameOver'>, Body>> = {
  waiting: ({ game, player }) => <WaitingLine game={game} player={player} />,
  secretChoice: ({ game, player }) => <SecretChoiceForm key={player} game={game} player={player} />,
  reaction: ({ game }) => <ReactionPrompt game={game} />,
  discard: ({ game, player }) => <DiscardForm key={player} game={game} player={player} />,
  scoring: statusBody,
  tokens: statusBody,
  vote: agendaBody,
  tieBreak: agendaBody,
  secondary: ({ game, player }) => <SecondaryPrompt game={game} player={player} />,
  transactionReply: ({ game, player }) => <TransactionReply game={game} player={player} />,
  primary: ({ game, player, route }) => (
    <ChosenPrimary key={player} game={game} player={player} card={route.card} />
  ),
  tactical: ({ game, player }) => <TacticalTurn key={player} game={game} player={player} />,
  combat: () => <CombatTurn />,
  idle: ({ game, player }) => <IdleTurn key={player} game={game} player={player} />,
};

/** Der Inhalt der offenen Entscheidung, ohne Rahmen: für das Panel und die Ansage am Pult. */
export function TurnPanelBody(props: {
  readonly game: GameState;
  readonly route: DecisionRoute;
}): ReactElement | null {
  const { game, route } = props;
  if (route.kind === 'gameOver') return <GameOverNotice game={game} />;
  if (route.actor === null) return null;
  return BODIES[route.kind]({ game, player: route.actor, route });
}

export const PHASE_TITLE = {
  strategy: 'phase.strategy',
  action: 'phase.action',
  status: 'phase.status',
  agenda: 'phase.agenda',
  setup: 'phase.strategy',
  gameOver: 'phase.status',
} as const satisfies Record<GameState['phase'], string>;

/** Wer gerade zieht, während man selbst nichts zu entscheiden hat. */
export function WaitingLine({ game, player }: TurnProps): ReactElement {
  const t = useT();
  const bot = useGameStore((state) => state.bots.includes(player));
  return (
    <p className="waiting-line">
      <PlayerTag game={game} id={player} /> {t(bot ? 'botThinking' : 'otherThinking')}
    </p>
  );
}

/** Während die KI oder ein Mitspieler zieht, gibt es hier nichts zu entscheiden, nur einen Hinweis. */
function BotNotice({ game, player }: TurnProps): ReactElement {
  return (
    <section className="game-section bot-turn" aria-live="polite" data-tutorial="turn">
      <WaitingLine game={game} player={player} />
    </section>
  );
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
  const route = useDecisionRoute(game);
  if (route === null) return null;
  if (route.kind === 'gameOver') return <GameOverNotice game={game} />;
  if (route.kind === 'waiting' && route.actor !== null)
    return <BotNotice game={game} player={route.actor} />;
  // Geheime Aufträge liegen privat auf dem zentralen Kartentisch, nicht im Zugfeld.
  if (route.kind === 'secretChoice' && route.actor !== null)
    return <SecretChoiceForm game={game} player={route.actor} />;
  return (
    <section className="game-section your-turn" data-tutorial="turn">
      <h2>{t(PHASE_TITLE[game.phase])}</h2>
      <PhaseTip game={game} />
      <TurnPanelBody game={game} route={route} />
    </section>
  );
}
