import {
  findPlayer,
  strategyCardsOf,
  type GameState,
  type PlayerState,
  type StrategyCardState,
} from '@stellar/domain';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { playerRail, type RailEntry } from '../../hud/hud-model.ts';
import { seatColor } from '../../seat-colors.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { SPEAKER_PIECE } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { strategyFrame } from '../../artwork/cards.ts';
import { factionLabel } from '../../labels.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import { useSidebarStore } from '../game/sidebar-store.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';
import { SpeakerFace } from '../table/SpeakerFace.tsx';
import '../table/table-people.css';
import {
  type PortraitButton,
  type PortraitTable,
  radioIds,
  usePortraitTable,
  usePortraitTarget,
} from './use-portrait-target.ts';

function HeldStrategies({ cards }: { readonly cards: readonly StrategyCardState[] }) {
  return (
    <span className="portrait-tabletop-strategies" aria-hidden="true">
      {cards.map((card) => (
        <span key={card.id} className="portrait-tabletop-strategy" data-exhausted={card.exhausted}>
          <CompleteCardArtwork artwork={strategyFrame(card.mechanic)} />
        </span>
      ))}
    </span>
  );
}

/** Opponent hands show only the public count and identical backs, never card identities. */
function MatMaterials({
  game,
  player,
}: {
  readonly game: GameState;
  readonly player: PlayerState;
}) {
  const language = useLanguage();
  const cards = strategyCardsOf(game, player.id);
  const label = `${String(player.actionCards.length)} ${language === 'de' ? 'Handkarten' : 'cards in hand'}`;
  return (
    <>
      <span className="portrait-tabletop-hand" aria-label={label}>
        {player.actionCards.length > 0 && (
          <span className="portrait-tabletop-backs" aria-hidden="true" />
        )}
        {player.actionCards.length}
      </span>
      <HeldStrategies cards={cards} />
    </>
  );
}

function MatInitiatives({ game, entry }: { readonly game: GameState; readonly entry: RailEntry }) {
  const held = strategyCardsOf(game, entry.id);
  return (
    <>
      {entry.initiatives.map((initiative) => (
        <span
          key={initiative}
          className="portrait-initiative"
          data-exhausted={held.some((card) => card.initiative === initiative && card.exhausted)}
        >
          {initiative}
        </span>
      ))}
    </>
  );
}

function PortraitContents({
  game,
  player,
  entry,
}: {
  readonly game: GameState;
  readonly player: PlayerState;
  readonly entry: RailEntry;
}) {
  const t = useT();
  return (
    <>
      <FactionEmblem id={player.faction} size={44} />
      <span className="portrait-vp" title={t('victoryPoints')}>
        {player.victoryPoints}
      </span>
      <MatInitiatives game={game} entry={entry} />
      <NameBand name={player.name} entry={entry} />
      <MatMaterials game={game} player={player} />
    </>
  );
}

/** Wechselt der Sprecher, gleitet der Marker zum neuen Porträt; ohne Animationen springt er. */
function useTokenFlight() {
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedMotion() === true;
  if (!animations || reduced) return {};
  return {
    layoutId: 'speaker-token',
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  } as const;
}

/** Politik: der Marker ist ein Stück, das sich auf das Porträt des neuen Sprechers legen lässt. */
function SpeakerPiece(props: {
  readonly decision: TableDecision;
  readonly router: PortraitTable['router'];
}): ReactElement {
  const t = useT();
  const { decision, router } = props;
  const drag = useDragSource(SPEAKER_PIECE, () => decision.legalFor(SPEAKER_PIECE), router);
  return (
    <button
      type="button"
      className="speaker-piece"
      aria-label={`${t('pickUpToken')}: ${t('speakerToken')}`}
      {...drag}
    >
      <SpeakerFace />
    </button>
  );
}

/** Der Sprechermarker auf dem Porträt des Sprechers. */
function SpeakerToken({ table }: { readonly table: PortraitTable }): ReactElement {
  const t = useT();
  const flight = useTokenFlight();
  if (table.mode === 'politics' && table.decision !== null)
    return (
      <motion.span className="speaker-token" data-carryable="true" {...flight}>
        <SpeakerPiece decision={table.decision} router={table.router} />
      </motion.span>
    );
  return (
    <motion.span className="speaker-token" role="img" aria-label={t('speaker')} {...flight}>
      <SpeakerFace />
    </motion.span>
  );
}

/** Politik: der Geist des Markers auf dem gewählten Porträt; Handel: das Band des Freibriefs. */
function ChoiceMark({ button }: { readonly button: PortraitButton }): ReactElement | null {
  const t = useT();
  if (!button.chosen) return null;
  if (button.mode === 'politics')
    return (
      <span className="speaker-ghost" aria-hidden="true">
        <SpeakerFace />
      </span>
    );
  return (
    <span className="portrait-free-letter" aria-hidden="true">
      {t('freeLetter')}
    </span>
  );
}

/** Name im Band der Platzfarbe, dazu KI und gepasst. */
function NameBand({ name, entry }: { readonly name: string; readonly entry: RailEntry }) {
  const t = useT();
  const bot = useGameStore((state) => state.bots.includes(entry.id));
  return (
    <span className="portrait-name">
      {name}
      {bot && <small>{t('botBadge')}</small>}
      {entry.passed && <small>{t('passed')}</small>}
    </span>
  );
}

interface PortraitProps {
  readonly game: GameState;
  readonly entry: RailEntry;
  readonly table: PortraitTable;
}

/**
 * Ein Porträt: öffnet sonst die Übersicht; bei Politik und Handel wählt bzw. schaltet es, und
 * getragene Stücke lassen sich darauf ablegen. Der Sprechermarker liegt neben dem Knopf, damit
 * er als eigenes Stück aufgenommen werden kann.
 */
function Portrait({ game, entry, table }: PortraitProps) {
  const language = useLanguage();
  const me = useGameStore((state) => state.me);
  const player = findPlayer(game, entry.id);
  const reveal = useSidebarStore((state) => state.reveal);
  const button = usePortraitTarget(table, entry.id, () => reveal('players'));
  if (player === undefined) return null;
  const status = [entry.active && 'active', entry.passed && 'passed'].filter(Boolean).join(' ');
  return (
    <li
      className={`hud-portrait ${status}`}
      data-own-mat={entry.id === me}
      style={{ '--seat': seatColor(player.seat + 1) } as CSSProperties}
    >
      <button
        type="button"
        aria-label={player.name}
        title={factionLabel(player.faction, language)}
        {...button.props}
      >
        <PortraitContents game={game} player={player} entry={entry} />
        <ChoiceMark button={button} />
      </button>
      {entry.speaker && <SpeakerToken table={table} />}
    </li>
  );
}

/**
 * Die Radiogruppe „Neuer Sprecher“ der Politik. Sie besitzt per `aria-owns` nur die Porträts der
 * Kandidaten; das Porträt des jetzigen Sprechers und der Sprechermarker bleiben außerhalb, obwohl
 * sie in derselben Leiste liegen.
 */
function SpeakerGroup({ table }: { readonly table: PortraitTable }): ReactElement | null {
  const t = useT();
  const owned = radioIds(table);
  if (owned === '') return null;
  return (
    <div role="radiogroup" className="sr-only" aria-label={t('chooseSpeaker')} aria-owns={owned} />
  );
}

/**
 * Porträts aller Spieler links oben: Wappen, Siegpunkte, Strategiekarten, wer am Zug ist. Bei
 * der Politik sind die Kandidaten die Radiogruppe „Neuer Sprecher“.
 */
export function PlayerRail({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const table = usePortraitTable(game);
  return (
    <>
      <ol
        className="hud-players"
        data-choosing={table.mode ?? undefined}
        aria-label={t('initiativeOrder')}
      >
        {playerRail(game).map((entry) => (
          <Portrait key={entry.id} game={game} entry={entry} table={table} />
        ))}
      </ol>
      <SpeakerGroup table={table} />
    </>
  );
}
