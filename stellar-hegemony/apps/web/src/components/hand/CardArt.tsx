import {
  ACTION_BACK,
  fragmentArtwork,
  legendaryArtwork,
  RELIC_BACK,
  strategyArtwork,
  type CardArtworkSource,
} from '../../artwork/cards.ts';
import { Crosshair, LogOut, Medal } from 'lucide-react';
import { leaderArtwork } from '../../artwork/leaders.ts';
import { type HandEntry, isTable, type TableEntry } from '../../hand/hand-model.ts';
import { CardArtwork } from '../cards/CardArtwork.tsx';

function tableArtwork(entry: TableEntry): CardArtworkSource | undefined {
  switch (entry.kind) {
    case 'leader':
      return leaderArtwork(entry.leader.id);
    case 'relic':
      return RELIC_BACK;
    case 'fragment':
      return fragmentArtwork(entry.fragment);
    case 'legendary':
      return legendaryArtwork(entry.planet);
  }
}

function sourceOf(entry: HandEntry): CardArtworkSource | undefined {
  if (isTable(entry)) return tableArtwork(entry);
  if (entry.kind === 'pick' || entry.kind === 'strategic')
    return strategyArtwork(entry.card.mechanic);
  if (entry.kind === 'tactical' || entry.kind === 'pass') return undefined;
  return ACTION_BACK;
}

function shapeOf(entry: HandEntry): string {
  if (entry.kind === 'leader') return 'hand-leader-art';
  if (entry.kind === 'fragment' || entry.kind === 'legendary') return 'hand-world-art';
  if (entry.kind === 'action' || entry.kind === 'relic') return 'hand-action-art';
  return 'hand-strategy-art';
}

/** Original TI4 strategy emblems or the action deck's printed back emblem. */
export function CardArt({ entry }: { readonly entry: HandEntry }) {
  const artwork = sourceOf(entry);
  const Icon = entry.kind === 'tactical' ? Crosshair : entry.kind === 'pass' ? LogOut : Medal;
  return (
    <span className="hand-art" aria-hidden="true">
      {artwork === undefined ? (
        <Icon />
      ) : (
        <CardArtwork artwork={artwork} className={shapeOf(entry)} />
      )}
    </span>
  );
}
