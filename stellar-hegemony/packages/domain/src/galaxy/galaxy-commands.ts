import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import type { GameState } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import { andThen, err, map, type Result } from '../shared/result.ts';
import { assembleGalaxy } from './galaxy-assembler.ts';
import type { GalaxyAssembled } from './galaxy-events.ts';
import { generateGalaxyLayout } from './galaxy-generator.ts';
import { parseMapString } from './map-string.ts';

/** Galaxie aus einem Map-String übernehmen (vordefinierte Karte). */
export interface ImportMap extends Command<'ImportMap'> {
  readonly mapString: string;
}

/** Zufällige Galaxie aus der Vorlage für die Spielerzahl erzeugen. */
export type GenerateGalaxy = Command<'GenerateGalaxy'>;

const hostInSetup = (state: GameState, command: Command): Check =>
  firstFailure([
    guard(state.phase === 'setup', 'setup.notInSetup', 'Die Galaxie steht nach Spielbeginn fest'),
    guard(command.issuedBy === state.host, 'setup.hostOnly', 'Nur der Gastgeber baut die Galaxie'),
  ]);

const asEvents = (
  result: Result<GalaxyAssembled, DomainError>,
): Result<readonly GalaxyAssembled[], DomainError> => map(result, (event) => [event]);

export const importMapHandler = {
  commandType: 'ImportMap',
  decide(state: GameState, command: ImportMap, context: DecisionContext) {
    const allowed = hostInSetup(state, command);
    if (!allowed.ok) return allowed;
    const layout = parseMapString(command.mapString);
    return asEvents(
      andThen(layout, (parsed) =>
        assembleGalaxy(parsed, context.content.tiles, state.config.playerCount),
      ),
    );
  },
} as const satisfies CommandHandler<GameState, ImportMap, GalaxyAssembled>;

export const generateGalaxyHandler = {
  commandType: 'GenerateGalaxy',
  decide(state: GameState, command: GenerateGalaxy, context: DecisionContext) {
    const allowed = hostInSetup(state, command);
    if (!allowed.ok) return allowed;
    const { playerCount } = state.config;
    const template = context.content.galaxyTemplate(playerCount);
    if (template === undefined) {
      return err(
        domainError('galaxy.noTemplate', 'Keine Kartenvorlage für diese Spielerzahl', {
          playerCount,
        }),
      );
    }
    const layout = generateGalaxyLayout(template, context.content.tiles, context.random);
    return asEvents(
      andThen(layout, (generated) => assembleGalaxy(generated, context.content.tiles, playerCount)),
    );
  },
} as const satisfies CommandHandler<GameState, GenerateGalaxy, GalaxyAssembled>;
