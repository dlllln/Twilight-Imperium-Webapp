import {
  ACTION_BACK,
  fragmentArtwork,
  legendaryArtwork,
  RELIC_BACK,
  strategyArtwork,
  type CardArtworkSource,
} from '../../artwork/cards.ts';
import { type HandEntry, isTable, type TableEntry } from '../../hand/hand-model.ts';
import { CardArtwork } from '../cards/CardArtwork.tsx';

function tableArtwork(entry: TableEntry): CardArtworkSource {
  switch (entry.kind) {
    case 'relic':
      return RELIC_BACK;
    case 'fragment':
      return fragmentArtwork(entry.fragment);
    case 'legendary':
      return legendaryArtwork(entry.planet);
  }
}

function sourceOf(entry: HandEntry): CardArtworkSource {
  if (isTable(entry)) return tableArtwork(entry);
  if (entry.kind === 'pick' || entry.kind === 'strategic')
    return strategyArtwork(entry.card.mechanic);
  if (entry.kind === 'tactical') return strategyArtwork('warfare');
  if (entry.kind === 'pass') return strategyArtwork('commandTokens');
  return ACTION_BACK;
}

function shapeOf(entry: HandEntry): string {
  if (entry.kind === 'fragment' || entry.kind === 'legendary') return 'hand-world-art';
  if (entry.kind === 'action' || entry.kind === 'relic') return 'hand-action-art';
  return 'hand-strategy-art';
}

/** Original TI4 strategy emblems or the action deck's printed back emblem. */
export function CardArt({ entry }: { readonly entry: HandEntry }) {
  return (
    <span className="hand-art" aria-hidden="true">
      <CardArtwork artwork={sourceOf(entry)} className={shapeOf(entry)} />
    </span>
  );
}
