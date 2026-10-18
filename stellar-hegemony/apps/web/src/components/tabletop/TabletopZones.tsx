import { type GameState } from '@stellar/domain';
import { ChevronDown, Layers3 } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../use-translation.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import { TabletopTransactions } from './TabletopTransactions.tsx';
import { pileLabel } from './tabletop-copy.ts';
import { tabletopPiles, type TabletopPile } from './tabletop-model.ts';
import './tabletop.css';

function Pile({ pile }: { readonly pile: TabletopPile }) {
  const language = useLanguage();
  const label = pileLabel(pile.id, language);
  return (
    <li
      className="tabletop-pile"
      data-pile={pile.id}
      data-empty={pile.count === 0}
      aria-label={`${label}: ${String(pile.count)}`}
    >
      <div className="tabletop-card-stack">
        <CompleteCardArtwork artwork={pile.artwork} />
        <b>{pile.count}</b>
      </div>
      <span>{label}</span>
    </li>
  );
}

function SupplyToggle({
  expanded,
  toggle,
}: {
  readonly expanded: boolean;
  readonly toggle: () => void;
}) {
  const language = useLanguage();
  return (
    <button
      type="button"
      className="tabletop-supply-toggle"
      onClick={toggle}
      aria-expanded={expanded}
      aria-controls="tabletop-piles"
      aria-label={language === 'de' ? 'Gemeinsamer Vorrat' : 'Shared supply'}
    >
      <Layers3 size={13} aria-hidden="true" />
      <span>{language === 'de' ? 'Gemeinsamer Vorrat' : 'Shared supply'}</span>
      <ChevronDown size={12} aria-hidden="true" />
    </button>
  );
}

function useSupply() {
  const media = useMemo(
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 1101px), (min-width: 761px) and (orientation: landscape)')
        : null,
    [],
  );
  const [expanded, setExpanded] = useState(media?.matches ?? false);
  useEffect(() => {
    if (media === null) return;
    const resize = () => setExpanded(media.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, [media]);
  return { expanded, toggle: () => setExpanded((value) => !value) };
}

function Supply({ game }: { readonly game: GameState }) {
  const language = useLanguage();
  const { expanded, toggle } = useSupply();
  return (
    <section
      className="tabletop-supply"
      data-expanded={expanded}
      aria-label={language === 'de' ? 'Gemeinsame Kartenstapel' : 'Shared card piles'}
    >
      <SupplyToggle expanded={expanded} toggle={toggle} />
      <ol id="tabletop-piles" className="tabletop-piles">
        {tabletopPiles(game).map((pile) => (
          <Pile key={pile.id} pile={pile} />
        ))}
      </ol>
    </section>
  );
}

/** Fixed places for the shared components; neither the surface nor short flights intercept the map. */
export const TabletopZones = memo(function TabletopZones({ game }: { readonly game: GameState }) {
  return (
    <div className="tabletop-zones" data-testid="tabletop-zones">
      <div className="tabletop-rim" aria-hidden="true" />
      <Supply game={game} />
      <TabletopTransactions game={game} />
    </div>
  );
});
