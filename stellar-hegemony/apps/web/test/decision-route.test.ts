import {
  agendaId,
  currentActor,
  type GameState,
  type PlayerId,
  strategyCardId,
  systemId,
  TACTICAL_STEPS,
  updatePlayer,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf, type DecisionRoute, type RouteInput } from '../src/table/decision-route.ts';
import { tableSpecOf } from '../src/table/table-specs.ts';
import { keepSecrets, pickAll, started } from './game-helpers.ts';

const route = (input: Partial<RouteInput> & Pick<RouteInput, 'game'>): DecisionRoute | null =>
  decisionOf({ actor: null, waitingOn: null, chosen: null, ...input });

const activeOf = (game: GameState): PlayerId => game.actionPhase?.active as PlayerId;

const otherThan = (game: GameState, player: PlayerId): PlayerId =>
  game.players.find((candidate) => candidate.id !== player)?.id as PlayerId;

/** Aktionsphase, in der der Aktive ein System aktiviert hat. */
function activated(): GameState {
  const game = pickAll(started());
  const active = activeOf(game);
  for (const id of Object.keys(game.systems)) {
    const command = { type: 'ActivateSystem', issuedBy: active, system: systemId(id) } as const;
    const next = tryCommand(game, command);
    if (next.ok) return next.value;
  }
  throw new Error('kein System aktivierbar');
}

function withTactical(game: GameState, change: object): GameState {
  const turn = game.actionPhase;
  if (turn?.tactical == null) throw new Error('keine Taktikaktion');
  return { ...game, actionPhase: { ...turn, tactical: { ...turn.tactical, ...change } } };
}

function statusGame(step: 'scoring' | 'tokens'): GameState {
  const game = pickAll(started());
  const order = game.players.map((player) => player.id);
  const statusPhase = { step, order, waiting: order, scored: {} };
  return { ...game, phase: 'status', actionPhase: null, statusPhase };
}

function agendaGame(number: number, tied: readonly string[] | null): GameState {
  const game = statusGame('tokens');
  const awaiting = game.players.map((player) => player.id);
  const agendaPhase = { number, agenda: agendaId('a'), awaiting, votes: [], tied };
  return { ...game, phase: 'agenda', statusPhase: null, agendaPhase };
}

function secondaryGame(card: string, awaiting: readonly PlayerId[]): GameState {
  const game = pickAll(started());
  const turn = game.actionPhase;
  if (turn === null) throw new Error('keine Aktionsphase');
  const secondary = { card: strategyCardId(card), awaiting, free: [] };
  return { ...game, actionPhase: { ...turn, secondary } };
}

describe('Route der offenen Entscheidung', () => {
  it('Geheimauftrags-Wahl unterbricht jede Phase', () => {
    const fresh = started();
    const chooser = currentActor(fresh) as PlayerId;
    expect(route({ game: fresh, actor: chooser })?.kind).toBe('secretChoice');
    const action = pickAll(started());
    const active = activeOf(action);
    const choice = fresh.players.find((player) => player.id === chooser)?.secretChoice ?? null;
    const interrupted = updatePlayer(action, active, (p) => ({ ...p, secretChoice: choice }));
    expect(route({ game: interrupted, actor: active })?.kind).toBe('secretChoice');
    const status = updatePlayer(statusGame('tokens'), active, (p) => ({
      ...p,
      secretChoice: choice,
    }));
    expect(route({ game: status, actor: active })?.kind).toBe('secretChoice');
  });

  it('der Verteidiger bekommt die Kampfentscheidung, nicht die taktische Aktion des Angreifers', () => {
    const game = activated();
    const active = activeOf(game);
    const defender = otherThan(game, active);
    const fighting = withTactical(game, { pendingHits: [{ player: defender, hits: 1 }] });
    expect(route({ game: fighting, actor: defender })?.kind).toBe('combat');
    expect(route({ game: fighting, waitingOn: defender })?.kind).toBe('waiting');
    expect(route({ game, actor: active })?.kind).toBe('tactical');
  });

  it('jeder Schritt der taktischen Aktion hat einen eigenen Schlüssel', () => {
    const game = activated();
    const actor = activeOf(game);
    const keys = TACTICAL_STEPS.map(
      (step) => route({ game: withTactical(game, { step }), actor })?.key,
    );
    expect(new Set(keys).size).toBe(TACTICAL_STEPS.length);
  });

  it('Wertung und Markerverteilung der Statusphase haben verschiedene Schlüssel', () => {
    const scoring = statusGame('scoring');
    const actor = scoring.players[0]?.id as PlayerId;
    const first = route({ game: scoring, actor });
    const second = route({ game: statusGame('tokens'), actor });
    expect(first?.kind).toBe('scoring');
    expect(second?.kind).toBe('tokens');
    expect(first?.key).not.toBe(second?.key);
  });

  it('jede Person in der Warteschlange der Sekundärfähigkeit bekommt einen eigenen Schlüssel', () => {
    const base = pickAll(started());
    const [first, second] = base.players.map((player) => player.id) as [PlayerId, PlayerId];
    const before = route({ game: secondaryGame('vanguard', [first, second]), actor: first });
    const after = route({ game: secondaryGame('vanguard', [second]), actor: second });
    expect(before).toMatchObject({ kind: 'secondary', card: 'vanguard', ability: 'secondary' });
    expect(after?.kind).toBe('secondary');
    expect(before?.key).not.toBe(after?.key);
  });

  it('zweite Agenda und Gleichstand ergeben neue Schlüssel', () => {
    const actor = agendaGame(1, null).players[0]?.id as PlayerId;
    const first = route({ game: agendaGame(1, null), actor });
    const second = route({ game: agendaGame(2, null), actor });
    const tie = route({ game: agendaGame(2, ['for', 'against']), actor });
    expect([first?.kind, second?.kind, tie?.kind]).toEqual(['vote', 'vote', 'tieBreak']);
    expect(new Set([first?.key, second?.key, tie?.key]).size).toBe(3);
  });

  it('Strategiephase ohne Unterbrechung: keine Entscheidung', () => {
    const game = keepSecrets(started());
    expect(game.phase).toBe('strategy');
    expect(route({ game, actor: currentActor(game) })).toBeNull();
    expect(route({ game, waitingOn: currentActor(game) })?.kind).toBe('waiting');
    expect(route({ game: { ...game, phase: 'gameOver' } })?.kind).toBe('gameOver');
  });

  it('nur Markerverteilung, Führung und Kriegsführung primär sind auf dem Tisch spielbar', () => {
    const game = pickAll(started());
    const actor = activeOf(game);
    const spec = (found: DecisionRoute | null) =>
      found === null ? null : tableSpecOf(found, content);
    const primary = (card: string) => route({ game, actor, chosen: strategyCardId(card) });
    const secondary = (card: string) => route({ game: secondaryGame(card, [actor]), actor });
    expect(spec(route({ game: statusGame('tokens'), actor }))).toBe('tokens');
    expect(spec(primary('vanguard'))).toBe('leadership');
    expect(spec(secondary('vanguard'))).toBe('leadership');
    expect(spec(primary('armament'))).toBe('warfare');
    expect(spec(secondary('armament'))).toBeNull();
    expect(spec(primary('embassy'))).toBeNull();
    expect(spec(route({ game, actor }))).toBeNull();
    expect(spec(route({ game: statusGame('scoring'), actor }))).toBeNull();
    expect(spec(route({ game: activated(), actor }))).toBeNull();
  });
});
