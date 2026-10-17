import {
  findPlayer,
  strategyCardsOf,
  type GameState,
  type PlayerState,
  type StrategyCardState,
} from '@stellar/domain';
import { Megaphone } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { playerRail, type RailEntry } from '../../hud/hud-model.ts';
import { seatColor } from '../../seat-colors.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { strategyFrame } from '../../artwork/cards.ts';
import { factionLabel } from '../../labels.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import { useSidebarStore } from '../game/sidebar-store.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';

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
      {entry.speaker && (
        <Megaphone className="portrait-speaker" size={13} aria-label={t('speaker')} />
      )}
    </>
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

function Portrait({ game, entry }: { readonly game: GameState; readonly entry: RailEntry }) {
  const language = useLanguage();
  const me = useGameStore((state) => state.me);
  const player = findPlayer(game, entry.id);
  const reveal = useSidebarStore((state) => state.reveal);
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
        onClick={() => reveal('players')}
        aria-label={player.name}
        title={factionLabel(player.faction, language)}
      >
        <PortraitContents game={game} player={player} entry={entry} />
      </button>
    </li>
  );
}

/** Porträts aller Spieler links oben: Wappen, Siegpunkte, Strategiekarten, wer am Zug ist. */
export function PlayerRail({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <ol className="hud-players" aria-label={t('initiativeOrder')}>
      {playerRail(game).map((entry) => (
        <Portrait key={entry.id} game={game} entry={entry} />
      ))}
    </ol>
  );
}
