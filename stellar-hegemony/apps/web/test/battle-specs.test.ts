import { type GameCommand, type PlayerId, unitId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { tryCommand } from '../src/rules-preview.ts';
import { content } from '../src/store.ts';
import { decisionOf } from '../src/table/decision-route.ts';
import {
  addPeg,
  assignmentOf,
  cycleMark,
  type HitMarks,
  marksFrom,
  placedPegs,
} from '../src/table/hit-draft.ts';
import { HITS_SPEC, RETREAT_SPEC } from '../src/table/spec-battle.ts';
import type { HitPlan, SpecContext, SystemPlan, TableAction } from '../src/table/table-specs.ts';
import { tableSpecOf } from '../src/table/table-specs.ts';
import { HIT_PEG, systemTarget, targetKey, unitTarget } from '../src/table/target-ref.ts';
import { type BattleScene, hitScene, retreatScene } from './battle-scene.ts';

const DREAD = unitId('dread');
const CRUISER = unitId('kreuzer');

function contextOf(scene: BattleScene, actor: PlayerId): SpecContext {
  const route = decisionOf({ game: scene.game, actor, waitingOn: null, chosen: null });
  if (route === null) throw new Error('keine Entscheidung');
  return { game: scene.game, actor, route };
}

const passes = (scene: BattleScene, command: GameCommand) => tryCommand(scene.game, command).ok;

const hits = (ctx: SpecContext, draft: HitPlan, ...actions: TableAction[]): HitPlan =>
  actions.reduce((current, action) => HITS_SPEC.apply(ctx, current, action), draft);

const NONE: HitPlan = { kind: 'hits', marks: {} };

describe('Trefferstifte (reine Funktionen)', () => {
  it('zählt Stifte und trennt Schadensresistenz und Zerstörung für AssignHits', () => {
    const marks: HitMarks = { a: 'sustain', b: 'destroy', c: 'both', d: 'none' };
    expect(placedPegs(marks)).toBe(4);
    expect(assignmentOf(marks)).toEqual({ sustained: ['a', 'c'], destroyed: ['b', 'c'] });
  });

  it('Antippen schaltet weiter, so weit freie Stifte reichen; ohne Resistenz nur zerstören', () => {
    expect(cycleMark('none', true, 2)).toBe('sustain');
    expect(cycleMark('sustain', true, 1)).toBe('destroy');
    expect(cycleMark('destroy', true, 1)).toBe('both');
    expect(cycleMark('destroy', true, 0)).toBe('none');
    expect(cycleMark('none', false, 1)).toBe('destroy');
    expect(cycleMark('none', false, 0)).toBe('none');
  });

  it('ein Stift mehr fängt zuerst Schaden ab; volle Schiffe bleiben voll', () => {
    expect(addPeg('none', true)).toBe('sustain');
    expect(addPeg('sustain', true)).toBe('both');
    expect(addPeg('both', true)).toBe('both');
    expect(addPeg('none', false)).toBe('destroy');
    expect(addPeg('destroy', false)).toBe('destroy');
  });

  it('der Vorschlag der Domain wird zu Stiften', () => {
    const unit = (id: string) => ({ unit: { id: unitId(id) }, sustainable: true });
    const units = [unit('a'), unit('b')] as never;
    const marks = marksFrom({ sustained: [unitId('a')], destroyed: [unitId('a')] }, units);
    expect(marks).toEqual({ a: 'both', b: 'none' });
  });
});

describe('Kampfmatte: Treffer zuweisen', () => {
  const scene = hitScene();
  const ctx = contextOf(scene, scene.attacker);

  it('der Angreifer im Raumkampf bekommt die Kampfmatte, ohne Spielstand die Taktikansage', () => {
    expect(ctx.route.kind).toBe('tactical');
    expect(tableSpecOf(ctx.route, content, scene.game)).toBe('hits');
    expect(tableSpecOf(ctx.route, content)).not.toBe('hits');
  });

  it('beginnt mit dem Vorschlag; das Siegel ist bereit und der Befehl besteht die Probe der Domain', () => {
    const draft = HITS_SPEC.initial(ctx);
    expect(HITS_SPEC.progress(ctx, draft)).toEqual({ done: 2, needed: 2, ready: true });
    expect(passes(scene, HITS_SPEC.command(ctx, draft))).toBe(true);
  });

  it('Antippen: Schaden abfangen, zerstören, beides; mehr als verlangt wird es nie', () => {
    const tapped = hits(ctx, NONE, { kind: 'hit', unit: DREAD }, { kind: 'hit', unit: DREAD });
    expect(tapped.marks[DREAD]).toBe('destroy');
    const both = hits(ctx, tapped, { kind: 'hit', unit: DREAD });
    expect(both.marks[DREAD]).toBe('both');
    expect(hits(ctx, both, { kind: 'hit', unit: CRUISER }).marks[CRUISER] ?? 'none').toBe('none');
    expect(HITS_SPEC.progress(ctx, both).ready).toBe(true);
    expect(passes(scene, HITS_SPEC.command(ctx, both))).toBe(true);
  });

  it('der Stift darf auf jedes Schiff, das noch einen nimmt; danach nirgends mehr hin', () => {
    const legal = HITS_SPEC.legal?.(ctx, NONE, HIT_PEG) ?? new Set();
    expect([...legal].sort()).toEqual(
      [targetKey(unitTarget(DREAD)), targetKey(unitTarget(CRUISER))].sort(),
    );
    const pegged = hits(ctx, NONE, { kind: 'peg', unit: CRUISER }, { kind: 'peg', unit: DREAD });
    expect(pegged.marks).toEqual({ [CRUISER]: 'destroy', [DREAD]: 'sustain' });
    expect(HITS_SPEC.legal?.(ctx, pegged, HIT_PEG).size).toBe(0);
    expect(HITS_SPEC.targets(ctx, pegged).get(targetKey(unitTarget(DREAD)))).toBe('chosen');
    expect(passes(scene, HITS_SPEC.command(ctx, pegged))).toBe(true);
  });

  it('„Vorschlag“ stellt die Stifte der Domain wieder her; fremde Schiffe nehmen keine', () => {
    const changed = hits(ctx, NONE, { kind: 'hit', unit: unitId('feind-kreuzer') });
    expect(changed.marks).toEqual({});
    expect(HITS_SPEC.alternative?.(ctx, changed)?.label).toBe('hitSuggestion');
    expect(hits(ctx, changed, { kind: 'suggest' })).toEqual(HITS_SPEC.initial(ctx));
  });
});

describe('Kampfmatte: Rückzug ankündigen', () => {
  const scene = retreatScene();
  const ctx = contextOf(scene, scene.defender);
  const plan = (system: SystemPlan['system']): SystemPlan => ({ kind: 'system', system });

  it('der Verteidiger entscheidet über den Rückzug; das Ziel leuchtet auf der Karte', () => {
    expect(ctx.route.kind).toBe('combat');
    expect(tableSpecOf(ctx.route, content, scene.game)).toBe('retreat');
    const targets = RETREAT_SPEC.targets(ctx, plan(null));
    expect(targets.get(targetKey(systemTarget(scene.refuge)))).toBe('legal');
    expect(targets.has(targetKey(systemTarget(scene.system)))).toBe(false);
  });

  it('ohne Ziel kämpft das Siegel weiter; mit Ziel kündigt es den Rückzug an', () => {
    expect(RETREAT_SPEC.confirm(ctx, plan(null))).toBe('fightOn');
    const chosen = RETREAT_SPEC.apply(ctx, plan(null), { kind: 'system', system: scene.refuge });
    expect(chosen.system).toBe(scene.refuge);
    expect(RETREAT_SPEC.confirm(ctx, chosen)).toBe('announceRetreat');
    expect(passes(scene, RETREAT_SPEC.command(ctx, chosen))).toBe(true);
    const fight = RETREAT_SPEC.alternative?.(ctx, chosen);
    expect(fight?.label).toBe('fightOn');
    expect(fight?.command !== undefined && passes(scene, fight.command)).toBe(true);
    expect(passes(scene, RETREAT_SPEC.command(ctx, plan(null)))).toBe(true);
  });

  it('ein nicht erlaubtes System bleibt unberührt; zweites Antippen nimmt das Ziel zurück', () => {
    const ignored = RETREAT_SPEC.apply(ctx, plan(null), { kind: 'system', system: scene.system });
    expect(ignored.system).toBeNull();
    const once = RETREAT_SPEC.apply(ctx, plan(null), { kind: 'system', system: scene.refuge });
    expect(
      RETREAT_SPEC.apply(ctx, once, { kind: 'system', system: scene.refuge }).system,
    ).toBeNull();
  });
});
