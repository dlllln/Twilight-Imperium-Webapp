import { describe, expect, it } from 'vitest';
import {
  currentActor,
  decideGameCommand,
  findPlanetDefinition,
  type GameState,
  type PlayerId,
  playerId,
  relicId,
  shipsOf,
  technologyId,
  updatePlayer,
  withTechnologies,
} from '@stellar/domain';
import {
  botView,
  componentActions,
  explorationFirst,
  gainSplit,
  heuristicBot,
  pickStrategyCard,
  planPayment,
  preferredOutcomes,
  purgeFragments,
  readyPlanets,
  splitGain,
} from '../src/index.ts';
import { UNIT_TYPES } from '@stellar/content';
import { apply, botGame, content, contextFor, playBots } from './bot-game.ts';

const SEED = 3;
const P1 = playerId('p1');

const viewOf = (state: GameState, player: PlayerId) =>
  botView(state, player, contextFor(state, SEED));

describe('KI-Bots: ganze Partien', () => {
  it.each([3, 4, 6, 7, 8])(
    '%i Bots spielen eine Partie bis zum Ende, jeder Zug ist regelkonform',
    (n) => {
      const start = botGame(n, SEED);
      const run = playBots(start, SEED, 4000);
      expect(run.stuck).toBe(false);
      expect(run.state.phase).toBe('gameOver');
      expect(run.state.winner).not.toBeNull();
      expect(run.state.round).toBeGreaterThan(3);
      const kinds = new Set(run.commands.map((command) => command.type));
      for (const kind of ['ActivateSystem', 'MoveShips', 'ProduceUnits', 'CastVotes'])
        expect(kinds.has(kind as never)).toBe(true);
      // PoK Mech: Mechs kauft der Bot nur mit dem Rest des Budgets, also als letzte Bestellung.
      const orders = run.commands.flatMap((c) => (c.type === 'ProduceUnits' ? [c.orders] : []));
      const withMech = orders.filter((list) => list.some((o) => o.type === UNIT_TYPES.mech));
      expect(withMech.length).toBeGreaterThan(0);
      expect(withMech.every((list) => list.at(-1)?.type === UNIT_TYPES.mech)).toBe(true);
      // PoK Erkundung: freie Planeten werden beim Übernehmen erkundet.
      const cards = (state: GameState) => Object.values(state.exploration.decks).flat().length;
      expect(cards(run.state)).toBeLessThan(cards(start));
      // PoK Anführer: Agenten werden genutzt; mindestens ein Kommandant oder Held wird frei.
      expect(kinds.has('UseLeader')).toBe(true);
      const unlocked = run.state.players.flatMap((player) =>
        player.leaders.filter((leader) => leader.kind !== 'agent' && leader.status !== 'locked'),
      );
      expect(unlocked.length).toBeGreaterThan(0);
    },
    // Partien mit 7–8 Spielern dauern deutlich länger als die kleinen.
    150_000,
  );

  it.each([7, 8])(
    'RR 76 (PoK %i Spieler): jeder Bot nimmt genau eine Strategiekarte, der Sprecher steht fest',
    (n) => {
      const start = botGame(n, SEED);
      expect(start.speaker).not.toBeNull();
      const picked = playBots(start, SEED, 200, (s) => s.phase === 'action').state;
      const holders = Object.values(picked.strategyCards).map((card) => card.holder);
      for (const player of picked.players)
        expect(holders.filter((holder) => holder === player.id)).toHaveLength(1);
      expect(holders.filter((holder) => holder === null)).toHaveLength(8 - n);
    },
  );

  it('der Bot schlägt nur Commands vor, die die Domain annimmt', () => {
    let state = botGame(3, SEED);
    for (let turn = 0; turn < 150; turn += 1) {
      const actor = currentActor(state);
      if (actor === null) break;
      const command = heuristicBot.nextCommand(state, actor, contextFor(state, SEED));
      if (command === null) throw new Error('kein Zug');
      expect(decideGameCommand(state, command, contextFor(state, SEED)).ok).toBe(true);
      state = apply(state, command, SEED);
    }
    expect(state.phase).not.toBe('setup');
  });

  it('wer nicht an der Reihe ist, bekommt keinen Vorschlag', () => {
    const picking = (s: GameState) =>
      s.phase === 'strategy' && s.players.every((player) => player.secretChoice === null);
    const state = playBots(botGame(3, SEED), SEED, 100, picking).state;
    const waiting = state.players.find((player) => player.id !== currentActor(state));
    expect(waiting).toBeDefined();
    expect(heuristicBot.nextCommand(state, waiting?.id ?? P1, contextFor(state, SEED))).toBeNull();
  });
});

describe('KI-Bots: neue Fraktionen (PoK 8 Spieler)', () => {
  it('PoK Mech: Tarn-Mechs haben Produktion 1, Vyr-Mechs treffen bei 5, Tarn-Kreuzer sind schneller', () => {
    const state = botGame(8, SEED);
    const units = withTechnologies(contextFor(state, SEED), state).content.units;
    const vyr = playerId('p7');
    const tarn = playerId('p8');
    expect(state.players.map((player) => player.faction).slice(6)).toEqual(['vyr', 'tarn']);
    const forge = units.find(UNIT_TYPES.mech, tarn)?.capabilities;
    expect(forge?.find((capability) => capability.kind === 'production')).toMatchObject({
      bonus: 1,
    });
    expect(units.find(UNIT_TYPES.mech, vyr)?.combat?.hitOn).toBe(5);
    expect(units.find(UNIT_TYPES.cruiser, tarn)).toMatchObject({ move: 3, combat: { hitOn: 6 } });
    expect(units.find(UNIT_TYPES.mech, P1)?.combat?.hitOn).toBe(6);
  });
});

describe('KI-Bots: Planer', () => {
  it('RR 76: die Strategiekarte mit Vorliebe und Handelswaren zuerst', () => {
    const game = playBots(botGame(3, SEED), SEED, 100, (s) => s.phase === 'strategy').state;
    const picker = game.pickQueue[0] ?? P1;
    const [first] = pickStrategyCard(viewOf(game, picker));
    expect(first?.type).toBe('PickStrategyCard');
    expect(pickStrategyCard(viewOf(game, game.players[1]?.id ?? P1))).toEqual([]);
  });

  it('RR 73.5: neue Marker füllen zuerst Flotte und Strategie auf', () => {
    expect(gainSplit({ tactic: 3, fleet: 2, strategy: 1 }, 2)).toEqual({
      tactic: 0,
      fleet: 1,
      strategy: 1,
    });
    expect(gainSplit({ tactic: 3, fleet: 3, strategy: 2 }, 2)).toEqual({
      tactic: 2,
      fleet: 0,
      strategy: 0,
    });
    expect(splitGain({ tactic: 3, fleet: 2, strategy: 2 }, 1)).toEqual({
      tactic: 3,
      fleet: 3,
      strategy: 2,
    });
  });

  it('RR 22.3: Bezahlung erst mit Planeten, den Rest mit Handelswaren; sonst null', () => {
    const state = updatePlayer(botGame(3, SEED), P1, (p) => ({ ...p, tradeGoods: 2 }));
    const view = viewOf(state, P1);
    const total = readyPlanets(view, 'resources').reduce((sum, p) => sum + p.value, 0);
    expect(planPayment(view, 'resources', 0)).toEqual({ planets: [], tradeGoods: 0 });
    expect(planPayment(view, 'resources', total + 2)?.tradeGoods).toBe(2);
    expect(planPayment(view, 'resources', total + 3)).toBeNull();
  });

  it('RR 2: Bots stimmen für sich selbst, eigene Planeten, sonst dafür', () => {
    const state = botGame(3, SEED);
    const view = viewOf(state, P1);
    const own = Object.values(state.planets).find((planet) => planet.controller === P1)?.id ?? '';
    expect(preferredOutcomes(view, ['against', 'for', 'p2', own, 'p1'])).toEqual([
      own,
      'p1',
      'for',
      'against',
      'p2',
    ]);
  });

  it('PoK Anführer: zu Beginn sind nur die Agenten bereit, kein Kommandant ist schon frei', () => {
    const start = botGame(6, SEED);
    for (const player of start.players)
      expect(player.leaders.map((leader) => leader.status)).toEqual(['ready', 'locked', 'locked']);
  });

  it('RR 27.21: zu Beginn verliert niemand Einheiten an Flottenlimit oder Kapazität', () => {
    const state = botGame(6, SEED);
    const ships = state.players.map(
      (player) =>
        Object.values(state.systems)
          .flatMap((system) => system.spaceUnits)
          .filter((unit) => unit.owner === player.id).length,
    );
    expect(ships.every((count) => count > 0)).toBe(true);
  });
});

describe('KI-Bots: Erkundung und Relikte (PoK)', () => {
  const inAction = () =>
    playBots(
      botGame(3, SEED),
      SEED,
      200,
      (s) => s.phase === 'action' && s.actionPhase?.active === currentActor(s),
    ).state;

  it('PoK Relikt: drei passende Fragmente tauscht der Bot sofort gegen ein Relikt', () => {
    const start = inAction();
    const actor = currentActor(start) ?? P1;
    const state = updatePlayer(start, actor, (p) => ({
      ...p,
      relicFragments: ['cultural', 'frontier', 'cultural'],
    }));
    expect(heuristicBot.nextCommand(state, actor, contextFor(state, SEED))).toEqual({
      type: 'PurgeRelicFragments',
      issuedBy: actor,
      fragments: ['cultural', 'cultural', 'frontier'],
    });
    const empty = { ...state, exploration: { ...state.exploration, relicDeck: [] } };
    expect(purgeFragments(viewOf(empty, actor))).toEqual([]);
  });

  it('PoK Relikt, PoK Legendäre Planeten, PoK Anführer: Relikt-, Planeten- und Agentenaktionen vor dem Passen', () => {
    const start = inAction();
    const actor = currentActor(start) ?? P1;
    const legendary = Object.values(start.planets).find(
      (p) => findPlanetDefinition(content.tiles, p.id)?.legendary !== undefined,
    );
    const owned = {
      ...start,
      planets: { ...start.planets, [legendary?.id ?? '']: { ...legendary, controller: actor } },
    } as GameState;
    const state = updatePlayer(owned, actor, (p) => ({
      ...p,
      relics: [{ id: relicId('trade-prism'), exhausted: false }],
    }));
    const commands = componentActions(viewOf(state, actor)).map((command) => command.type);
    expect(commands).toEqual(['UseRelic', 'UseLegendaryAbility', 'UseLeader']);
  });

  it('PoK Grenzmarker: mit Scanner und Schiff erkundet der Bot am Ende der Taktikaktion', () => {
    const done = playBots(botGame(3, SEED), SEED, 2000, (s) => {
      const tactical = s.actionPhase?.tactical;
      const active = s.actionPhase?.active;
      return (
        tactical?.step === 'done' &&
        active != null &&
        shipsOf(s, tactical.system, active, content.units).length > 0
      );
    }).state;
    const actor = done.actionPhase?.active ?? P1;
    const system = done.actionPhase?.tactical?.system;
    const scanning = updatePlayer(done, actor, (p) => ({
      ...p,
      technologies: [...p.technologies, technologyId('deep-space-scanner')],
    }));
    const state = {
      ...scanning,
      exploration: {
        ...scanning.exploration,
        frontierTokens: system === undefined ? [] : [system],
      },
    };
    expect(explorationFirst(viewOf(done, actor))).toEqual([]);
    expect(heuristicBot.nextCommand(state, actor, contextFor(state, SEED))?.type).toBe(
      'ExploreFrontier',
    );
  });
});
