import {
  type ContentPort,
  findPlayer,
  type GameState,
  NO_PAYMENT,
  type ObjectiveId,
  type PlayerId,
  type PublicObjectiveSlot,
  scoredBy,
  scoringOptions,
} from '@stellar/domain';
import { tryCommand } from '../rules-preview.ts';

/*
 * Die Auftragsleiste auf dem Tisch (reine Abbildung): öffentliche Aufträge in ihrer Reihenfolge,
 * verdeckte nur als Rückseite ohne Kennung, danach die eigenen geheimen. Wer einen Auftrag
 * gewertet hat, steht als Sitznummer (0-basiert wie im Spielstand) daneben.
 */

export interface StripCard {
  /** `null` bei verdeckten Aufträgen: Ihre Vorderseite verrät die Leiste nicht. */
  readonly id: ObjectiveId | null;
  readonly category: 'public' | 'secret';
  readonly stage: number | null;
  readonly points: number;
  /** Sitze (0-basiert) der Spieler, die den Auftrag gewertet haben. */
  readonly scorerSeats: readonly number[];
  readonly revealed: boolean;
}

const seatsOf = (game: GameState, objective: ObjectiveId): readonly number[] =>
  scoredBy(game, objective).flatMap((player) => findPlayer(game, player)?.seat ?? []);

const pointsOf = (content: ContentPort, objective: ObjectiveId): number =>
  content.objectives.find((entry) => entry.id === objective)?.points ?? 0;

function publicCard(game: GameState, slot: PublicObjectiveSlot, content: ContentPort): StripCard {
  const { id, stage, revealed } = slot;
  if (!revealed)
    return { id: null, category: 'public', stage, points: 0, scorerSeats: [], revealed };
  const points = pointsOf(content, id);
  return { id, category: 'public', stage, points, scorerSeats: seatsOf(game, id), revealed };
}

function secretCard(game: GameState, id: ObjectiveId, content: ContentPort): StripCard {
  const points = pointsOf(content, id);
  return {
    id,
    category: 'secret',
    stage: null,
    points,
    scorerSeats: seatsOf(game, id),
    revealed: true,
  };
}

/** Öffentliche Plätze in Reihenfolge, verdeckte als Rückseiten, dann die eigenen geheimen. */
export function objectiveStrip(
  game: GameState,
  viewer: PlayerId | null,
  content: ContentPort,
): readonly StripCard[] {
  const publicCards = game.objectives.public.map((slot) => publicCard(game, slot, content));
  const secrets = viewer === null ? [] : (findPlayer(game, viewer)?.secretObjectives ?? []);
  return [...publicCards, ...secrets.map((id) => secretCard(game, id, content))];
}

/**
 * Aufträge, die der Betrachter in der Aktionsphase sofort werten kann: erfüllt, jetzt erlaubt und
 * ohne Bezahlung (die Domain erprobt `ScoreObjective` an einer Kopie).
 */
export function scorableNow(
  game: GameState,
  viewer: PlayerId | null,
  content: ContentPort,
): ReadonlySet<ObjectiveId> {
  if (viewer === null || game.phase !== 'action') return new Set();
  const met = scoringOptions(game, viewer, content).filter((option) => option.met);
  const ids = met.map((option) => option.definition.id);
  return new Set(
    ids.filter(
      (objective) =>
        tryCommand(game, {
          type: 'ScoreObjective',
          issuedBy: viewer,
          objective,
          payment: NO_PAYMENT,
        }).ok,
    ),
  );
}
