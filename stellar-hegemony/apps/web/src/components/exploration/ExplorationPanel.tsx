import {
  EXPLORATION_DECKS,
  type ExplorationDeckKind,
  type FragmentKind,
  type GameState,
  type PlayerState,
} from '@stellar/domain';
import { Compass } from 'lucide-react';
import type { ReactElement } from 'react';
import {
  explorationArtwork,
  explorationFrame,
  fragmentArtwork,
  RELIC_BACK,
  RELIC_DECK_BACK,
} from '../../artwork/cards.ts';
import {
  deckLabel,
  explorationCardEffect,
  explorationCardLabel,
  relicEffect,
  relicLabel,
} from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { CardArtwork } from '../cards/CardArtwork.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { Panel } from '../ui/Panel.tsx';

function DeckDiscard({
  card,
  deck,
}: {
  readonly card: string;
  readonly deck: ExplorationDeckKind;
}) {
  const language = useLanguage();
  return (
    <li
      className="ti4-print-card ti4-exploration-discard"
      title={explorationCardEffect(card, language)}
    >
      <CardArtwork artwork={explorationFrame(card, deck)} className="ti4-print-frame" />
      <CardArtwork artwork={explorationArtwork(deck)} className="ti4-discard-back" />
      <strong>{explorationCardLabel(card, language)}</strong>
      <span>{explorationCardEffect(card, language)}</span>
    </li>
  );
}

/** Ein Erkundungsstapel: verdeckt übrig, offen abgelegt; die Ablage lässt sich aufklappen. */
function DeckRow({ game, deck }: { readonly game: GameState; readonly deck: ExplorationDeckKind }) {
  const t = useT();
  const language = useLanguage();
  const left = game.exploration.decks[deck].length;
  const discards = game.exploration.discards[deck];
  return (
    <li className={`deck-row deck-${deck}`}>
      <CardArtwork artwork={explorationArtwork(deck)} className="ti4-exploration-deck" />
      <span className="deck-name">{deckLabel(deck, language)}</span>
      <span className="deck-count" title={t('deckLeft')}>
        {left}
      </span>
      <details className="deck-discards">
        <summary title={t('deckDiscards')}>{discards.length}</summary>
        <ul>
          {discards.map((card, index) => (
            <DeckDiscard key={`${card}-${String(index)}`} card={card} deck={deck} />
          ))}
        </ul>
      </details>
    </li>
  );
}

/** Fragmente eines Spielers als Chips je Art, z. B. „Kulturell ×2“. */
function FragmentChips({ fragments }: { readonly fragments: readonly FragmentKind[] }) {
  const language = useLanguage();
  return (
    <>
      {EXPLORATION_DECKS.map((kind) => {
        const count = fragments.filter((fragment) => fragment === kind).length;
        if (count === 0) return null;
        return (
          <span key={kind} className={`fragment-chip deck-${kind}`}>
            <CardArtwork artwork={fragmentArtwork(kind)} className="ti4-fragment-chip-art" />
            {deckLabel(kind, language)} ×{count}
          </span>
        );
      })}
    </>
  );
}

/** Was ein Spieler offen vor sich hat: Fragmente und Relikte (erschöpfte gedimmt). */
function PlayerFinds({ game, player }: { readonly game: GameState; readonly player: PlayerState }) {
  const t = useT();
  const language = useLanguage();
  if (player.relics.length === 0 && player.relicFragments.length === 0) return null;
  return (
    <li className="player-finds" data-testid={`finds-${player.id}`}>
      <PlayerTag game={game} id={player.id} />
      <FragmentChips fragments={player.relicFragments} />
      {player.relics.map((relic) => (
        <span
          key={relic.id}
          className={relic.exhausted ? 'relic-chip exhausted' : 'relic-chip'}
          title={relicEffect(relic.id, language)}
        >
          <CardArtwork artwork={RELIC_BACK} className="ti4-relic-chip-art" />
          {relicLabel(relic.id, language)}
          {relic.exhausted && ` · ${t('exhausted')}`}
        </span>
      ))}
    </li>
  );
}

function RelicDeck({ left }: { readonly left: number }): ReactElement {
  const t = useT();
  return (
    <li className="deck-row deck-relic">
      <CardArtwork artwork={RELIC_DECK_BACK} className="ti4-exploration-deck" />
      <span className="deck-name">{t('relicDeck')}</span>
      <span className="deck-count" title={t('deckLeft')}>
        {left}
      </span>
    </li>
  );
}

/** PoK Erkundung: Stapelgrößen, Ablagen, Reliktstapel und die Funde aller Spieler. */
export function ExplorationPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const finds = game.players.filter(
    (player) => player.relics.length > 0 || player.relicFragments.length > 0,
  );
  return (
    <Panel title={t('explorationTitle')} icon={Compass} className="exploration-panel">
      <ul className="deck-list" aria-label={t('explorationDecks')}>
        {EXPLORATION_DECKS.map((deck) => (
          <DeckRow key={deck} game={game} deck={deck} />
        ))}
        <RelicDeck left={game.exploration.relicDeck.length} />
      </ul>
      {finds.length === 0 ? (
        <p className="hint">{t('noFinds')}</p>
      ) : (
        <ul className="finds-list">
          {finds.map((player) => (
            <PlayerFinds key={player.id} game={game} player={player} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
