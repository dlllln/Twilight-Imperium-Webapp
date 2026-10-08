import type { GameEvent, Volley } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { battleLayout, type BattleSide } from '../src/battle/battle-layout.ts';
import {
  roundDuration,
  SHOT_STEP_MS,
  shotsOf,
  type RoundFire,
} from '../src/battle/battle-shots.ts';
import {
  type CombatStage,
  roundStart,
  stageFire,
  targetsOn,
  withFallen,
} from '../src/battle/combat-stage.ts';
import type { CombatLogEvent } from '../src/combat-view.ts';

const ship = (id: string, type: string, seat = 1) => ({ id, type, seat, damaged: false });

const side = (seat: number, ...ships: { id: string; type: string }[]): BattleSide => ({
  seat,
  ships: ships.map((entry) => ship(entry.id, entry.type, seat)),
});

/** Eine Salve mit einem Würfel je Einheit; Treffer ab 6. */
const volley = (player: string, target: string, rolls: readonly [string, number][]): Volley =>
  ({
    player,
    target,
    rolls: rolls.map(([unit, value]) => ({ unit, type: 'cruiser', hitOn: 6, results: [value] })),
    hits: rolls.filter(([, value]) => value >= 6).length,
  }) as unknown as Volley;

/** Zuweisung mit Test-Kennungen statt gebrandeter Ids. */
const assignment = (player: string, destroyed: readonly string[], sustained: readonly string[]) =>
  ({ player, destroyed, sustained }) as unknown as RoundFire['assignments'][number];

const event = (value: object) => value as unknown as CombatLogEvent;
const roll = (round: number, volleys: readonly Volley[]) =>
  event({ type: 'CombatRoundRolled', system: 's', round, volleys });
const assigned = (
  player: string,
  destroyed: readonly string[],
  sustained: readonly string[] = [],
) => event({ type: 'HitsAssigned', player, system: 's', destroyed, sustained });
const barrage = (shot: Volley, destroyed: readonly string[]) =>
  event({ type: 'AntiFighterBarrageFired', system: 's', volley: shot, destroyed });
const started = event({ type: 'SpaceCombatStarted', system: 's', attacker: 'a', defender: 'd' });

describe('Aufstellung der Kampfbühne', () => {
  it('Verteidiger links mit Blick nach rechts, Angreifer rechts mit Blick nach links', () => {
    const spots = battleLayout(
      side(2, { id: 'd1', type: 'cruiser' }),
      side(1, { id: 'a1', type: 'dreadnought' }),
    );
    const [left, right] = spots;
    expect(left?.facing).toBe(1);
    expect(left?.x).toBeLessThan(0);
    expect(right?.facing).toBe(-1);
    expect(right?.x).toBeGreaterThan(0);
  });

  it('Jäger fliegen als kleine Staffel über den großen Schiffen; das größte steht vorn', () => {
    const spots = battleLayout(
      side(
        1,
        { id: 'f', type: 'fighter' },
        { id: 'c', type: 'cruiser' },
        { id: 'w', type: 'sunbreaker' },
      ),
      side(2),
    );
    const byId = new Map(spots.map((spot) => [spot.id, spot]));
    expect(byId.get('f')?.y).toBeLessThan(byId.get('c')?.y ?? 0);
    expect(byId.get('f')?.scale).toBeLessThan(byId.get('c')?.scale ?? 0);
    expect(spots[0]?.id).toBe('w');
  });
});

describe('Choreografie einer Runde', () => {
  const targets = (player: string) => (player === 'd' ? ['d1', 'd2'] : ['a1']);

  it('Treffer folgen der Zuweisung: erst zerstören, dann beschädigen; Fehlschüsse verfehlen', () => {
    const fire: RoundFire = {
      barrage: [],
      volleys: [
        volley('a', 'd', [
          ['a1', 9],
          ['a2', 7],
          ['a3', 2],
        ]),
      ],
      assignments: [assignment('d', ['d1'], ['d2'])],
    };
    const outcomes = shotsOf(fire, targets).map((shot) => [shot.to, shot.outcome]);
    expect(outcomes).toEqual([
      ['d1', 'destroy'],
      ['d2', 'damage'],
      ['d1', 'miss'],
    ]);
  });

  it('abgewehrte Treffer prallen an Schilden ab; ohne Zuweisung schlagen sie nur ein', () => {
    const shot = volley('a', 'd', [['a1', 8]]);
    const cancelled = shotsOf(
      {
        barrage: [],
        volleys: [shot],
        assignments: [assignment('d', [], [])],
      },
      targets,
    );
    expect(cancelled[0]?.outcome).toBe('blocked');
    const pending = shotsOf({ barrage: [], volleys: [shot], assignments: [] }, targets);
    expect(pending[0]?.outcome).toBe('hit');
  });

  it('RR 63.5: die Jägerabwehr feuert zuerst, die Kampfwürfe folgen nach einer Pause', () => {
    const fire: RoundFire = {
      barrage: [{ volley: volley('a', 'd', [['a1', 9]]), destroyed: ['d2'] }],
      volleys: [volley('a', 'd', [['a1', 3]])],
      assignments: [],
    };
    const [first, second] = shotsOf(fire, targets);
    expect(first).toMatchObject({ to: 'd2', outcome: 'destroy', delay: 0 });
    expect(second?.delay).toBeGreaterThan(SHOT_STEP_MS);
    expect(roundDuration([], 1000)).toBe(0);
    expect(roundDuration(shotsOf(fire, targets), 1000)).toBe((second?.delay ?? 0) + 1000);
  });
});

describe('Kampfbühne in der Partie', () => {
  const stage: CombatStage = {
    left: { player: 'd' as never, side: side(2, { id: 'd1', type: 'cruiser' }) },
    right: { player: 'a' as never, side: side(1, { id: 'a1', type: 'dreadnought' }) },
  };

  it('die jüngste Runde beginnt beim letzten Kampfwurf, in Runde 1 bei der Jägerabwehr', () => {
    const shot = volley('a', 'd', [['a1', 9]]);
    expect(roundStart([started])).toBe(1);
    expect(roundStart([started, barrage(shot, [])])).toBe(1);
    expect(roundStart([started, barrage(shot, []), roll(1, [shot])])).toBe(1);
    const second = [
      started,
      barrage(shot, []),
      roll(1, [shot]),
      assigned('d', []),
      roll(2, [shot]),
    ];
    expect(roundStart(second)).toBe(4);
  });

  it('Schüsse stammen nur aus der jüngsten Runde, samt ihrer Zuweisungen', () => {
    const early = volley('a', 'd', [['a1', 9]]);
    const late = volley('d', 'a', [['d1', 9]]);
    const fire = stageFire([
      roll(1, [early]),
      assigned('d', ['d9']),
      roll(2, [late]),
      assigned('a', []),
    ]);
    expect(fire.volleys).toEqual([late]);
    expect(fire.assignments).toHaveLength(1);
    expect(fire.assignments[0]?.player).toBe('a');
  });

  it('zerstörte Schiffe bleiben für die Salve auf der Bühne, mit ihrer gewürfelten Art', () => {
    const shot = volley('d', 'a', [['d1', 9]]);
    const log = [
      started,
      roll(1, [volley('a', 'd', [['a2', 1]])]),
      assigned('d', []),
      roll(2, [shot]),
      assigned('a', ['a2']),
    ];
    const fallen = withFallen(stage, log.slice(3), log);
    expect(fallen.right.side.ships.map((entry) => [entry.id, entry.type])).toEqual([
      ['a1', 'dreadnought'],
      ['a2', 'cruiser'],
    ]);
    expect(fallen.left).toEqual(stage.left);
    expect(targetsOn(fallen)('a' as never)).toEqual(['a1', 'a2']);
  });

  it('von der Jägerabwehr zerstörte Jäger kehren als Jäger zurück', () => {
    const shot = volley('a', 'd', [['a1', 9]]);
    const events = [started, barrage(shot, ['f1']), roll(1, [shot])] as GameEvent[];
    const fallen = withFallen(stage, events as CombatLogEvent[], events as CombatLogEvent[]);
    expect(fallen.left.side.ships.at(-1)).toMatchObject({ id: 'f1', type: 'fighter', seat: 2 });
  });
});
