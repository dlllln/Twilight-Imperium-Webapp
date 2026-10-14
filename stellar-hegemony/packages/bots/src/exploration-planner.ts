import {
  canExploreFrontier,
  type GameCommand,
  purgeOptions,
  usableLegendaryPlanets,
  usableLeaders,
  usableRelics,
} from '@stellar/domain';
import { type BotView, contentOf, issued } from './bot-view.ts';

/** PoK Relikt: sobald drei passende Fragmente da sind, gegen ein Relikt eintauschen. */
export const purgeFragments = (view: BotView): readonly GameCommand[] =>
  view.state.exploration.relicDeck.length === 0
    ? []
    : purgeOptions(view.state, view.player).map((fragments) => ({
        type: 'PurgeRelicFragments',
        ...issued(view),
        fragments,
      }));

/** Relikt-, Planeten- und Anführeraktionen (PoK), die gerade etwas bewirken (vor dem Passen). */
export const componentActions = (view: BotView): readonly GameCommand[] => [
  ...usableRelics(view.state, view.player, contentOf(view)).map((relic) => ({
    type: 'UseRelic' as const,
    ...issued(view),
    relic,
  })),
  ...usableLegendaryPlanets(view.state, view.player, contentOf(view)).map((planet) => ({
    type: 'UseLegendaryAbility' as const,
    ...issued(view),
    planet,
  })),
  ...usableLeaders(view.state, view.player, contentOf(view)).map((leader) => ({
    type: 'UseLeader' as const,
    ...issued(view),
    leader,
  })),
];

/** PoK Grenzmarker: am Ende der Taktikaktion erkunden, wenn es geht. */
export const explorationFirst = (view: BotView): readonly GameCommand[] =>
  canExploreFrontier(view.state, view.player, contentOf(view))
    ? [{ type: 'ExploreFrontier', ...issued(view) }]
    : [];
