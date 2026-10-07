import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlayerId, TechnologyId } from '../shared/ids.ts';
import type { TechnologyEvent } from './technology-events.ts';

const gain = (state: GameState, player: PlayerId, technologies: readonly TechnologyId[]) =>
  updatePlayer(state, player, (p) => ({
    ...p,
    technologies: [...p.technologies, ...technologies.filter((id) => !p.technologies.includes(id))],
  }));

export const technologyReducers: ReducerMap<GameState, TechnologyEvent> = {
  TechnologyResearched: (state, event) => gain(state, event.player, [event.technology]),
  TechnologiesGranted: (state, event) => gain(state, event.player, event.technologies),
};
