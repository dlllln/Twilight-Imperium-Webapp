// @vitest-environment jsdom
import {
  type GameCommand,
  type GameEvent,
  type GameState,
  type PlayerId,
  updatePlayer,
} from '@stellar/domain';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TABLE_GAIN, playTableCue, tableCueVolume } from '../src/audio/table-cues.ts';
import type { SoundCue } from '../src/audio/sound-cues.ts';
import { RECIPES } from '../src/audio/sound-recipes.ts';
import { setSoundPort } from '../src/audio/use-sound-effects.ts';
import { combatRole, type CombatLogEvent } from '../src/combat-view.ts';
import { AsListScope, FormList } from '../src/components/table/AsList.tsx';
import { VictoryTrack } from '../src/components/table/VictoryTrack.tsx';
import { useGameStore } from '../src/game-store.ts';
import { finalStanding, vpTrack } from '../src/hud/vp-track.ts';
import { FELT, seamless, WOOD, weavePixels } from '../src/render/table-textures.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { useGalaxyStore } from '../src/store.ts';
import { centerOf, deckFlights, firstVisible, MAX_FLYING } from '../src/table/deck-flights.ts';
import { carriedKey, installDraftCarry } from '../src/table/draft-carry.ts';
import { useDraftStore } from '../src/table/draft-store.ts';
import { actionCue, confirmCue, planetCue } from '../src/table/gesture-cues.ts';
import { intentCue } from '../src/table/use-drop-router.ts';
import { TUTORIAL_STEPS } from '../src/tutorial/tutorial-steps.ts';
import { pickAll, started } from './game-helpers.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  useSettingsStore.setState({ sound: true, tableSounds: true, volume: 0.5, animations: false });
  useDraftStore.getState().clear();
});

afterEach(() => {
  cleanup();
  setSoundPort(null);
});

/** Punkte je Spieler setzen (Reihenfolge der Sitze). */
function withPoints(game: GameState, points: readonly number[]): GameState {
  return game.players.reduce(
    (state, player, index) =>
      updatePlayer(state, player.id, (next) => ({ ...next, victoryPoints: points[index] ?? 0 })),
    game,
  );
}

const idOf = (game: GameState, seat: number): PlayerId => {
  const player = game.players.find((candidate) => candidate.seat === seat);
  if (player === undefined) throw new Error('kein Sitz');
  return player.id;
};

describe('Siegpunktleiste', () => {
  it('legt je Spieler eine Scheibe auf sein Feld; gleiche Felder stapeln sich nach Sitz', () => {
    const game = withPoints(started(), [3, 3, 0]);
    const track = vpTrack(game);
    expect(track.goal).toBe(game.config.victoryPointsToWin);
    expect(track.markers.map((marker) => [marker.field, marker.stack, marker.seat])).toEqual([
      [3, 0, 1],
      [3, 1, 2],
      [0, 0, 3],
    ]);
  });

  it('die Scheibe bleibt am Ziel stehen, auch wenn jemand darüber hinaus punktet', () => {
    const game = withPoints(started(), [99, 0, 0]);
    const [first] = vpTrack(game).markers;
    expect(first?.field).toBe(game.config.victoryPointsToWin);
    expect(first?.points).toBe(99);
  });

  it('Endstand: Sieger zuerst, gleiche Punkte teilen sich den Platz', () => {
    const base = withPoints(started(), [7, 10, 7]);
    const game: GameState = { ...base, winner: idOf(base, 1) };
    const rows = finalStanding(game);
    expect(rows.map((row) => [row.player, row.rank, row.winner])).toEqual([
      [idOf(base, 1), 1, true],
      [idOf(base, 0), 2, false],
      [idOf(base, 2), 2, false],
    ]);
  });

  it('am Ende liegt der Endstand mit Krone über der Leiste; vorher nur die Leiste', () => {
    const base = withPoints(started(), [4, 10, 2]);
    const { rerender } = render(<VictoryTrack game={base} />);
    const track = screen.getByRole('region', { name: 'Siegpunktleiste' });
    expect(track.getAttribute('data-tutorial')).toBe('vp-track');
    expect(screen.queryByRole('region', { name: 'Endstand' })).toBeNull();
    rerender(<VictoryTrack game={{ ...base, phase: 'gameOver', winner: idOf(base, 1) }} />);
    const standing = screen.getByRole('region', { name: 'Endstand' });
    const first = within(standing).getAllByRole('listitem')[0];
    expect(first?.textContent).toContain('1. Platz');
    expect(first?.textContent).toContain('Sieger');
  });
});

describe('Tischklänge', () => {
  it('leiser als die Partie; still ohne Klang, ohne Tischklänge oder ohne Lautstärke', () => {
    expect(tableCueVolume({ sound: true, tableSounds: true, volume: 1 })).toBe(TABLE_GAIN);
    expect(tableCueVolume({ sound: false, tableSounds: true, volume: 1 })).toBeNull();
    expect(tableCueVolume({ sound: true, tableSounds: false, volume: 1 })).toBeNull();
    expect(tableCueVolume({ sound: true, tableSounds: true, volume: 0 })).toBeNull();
  });

  it('spielt über den Klangweg und schweigt, sobald die Tischklänge aus sind', () => {
    const played: [SoundCue, number][] = [];
    setSoundPort({ play: (cue, volume) => played.push([cue, volume]) });
    playTableCue('coin');
    playTableCue(null);
    act(() => useSettingsStore.getState().toggle('tableSounds'));
    playTableCue('gavel');
    expect(played).toEqual([['coin', 0.5 * TABLE_GAIN]]);
  });

  it('jeder Tischklang hat ein eigenes Rezept aus Tönen oder Rauschen', () => {
    for (const cue of ['exhaust', 'ready', 'coin', 'token', 'draw', 'reveal', 'gavel'] as const)
      expect(RECIPES[cue].length).toBeGreaterThan(0);
  });

  it('Gesten tragen ihren Klang: Marker, Münze, Hammer, Planeten kippen und aufrichten', () => {
    expect(actionCue({ kind: 'tradeGoods', delta: 1 })).toBe('coin');
    expect(actionCue({ kind: 'move', from: 'tactic', to: 'fleet' })).toBe('token');
    expect(actionCue({ kind: 'player', player: 'p1' as PlayerId })).toBeNull();
    expect(confirmCue('vote')).toBe('gavel');
    expect(confirmCue('politics')).toBe('gavel');
    expect(confirmCue('tokens')).toBe('token');
    expect(confirmCue('hits')).toBeNull();
    expect(planetCue('pay', false)).toBe('exhaust');
    expect(planetCue('pay', true)).toBe('ready');
    expect(planetCue('ready', false)).toBe('ready');
    expect(planetCue('ready', true)).toBe('exhaust');
  });

  it('Ablegen ohne Entwurf: Marker im Sockel und Aktivierung klingen, anderes nicht', () => {
    const issuedBy = 'p1' as PlayerId;
    const activate = { type: 'ActivateSystem', issuedBy, system: 's1' } as unknown as GameCommand;
    const pass = { type: 'Pass', issuedBy } as unknown as GameCommand;
    expect(intentCue({ kind: 'socket' })).toBe('token');
    expect(intentCue({ kind: 'send', command: activate })).toBe('token');
    expect(intentCue({ kind: 'send', command: pass })).toBeNull();
    expect(intentCue({ kind: 'coins', delta: 1 })).toBeNull();
  });
});

describe('Kartenflüge', () => {
  const viewer = 'p1' as PlayerId;

  it('nur eigene Ziehungen fliegen, höchstens drei Karten je Ziehung', () => {
    const flights = deckFlights(
      [
        { kind: 'draw', item: 'action', player: viewer, count: 5 },
        { kind: 'draw', item: 'secret', player: 'p2' as PlayerId, count: 1 },
        { kind: 'gain', item: 'action', player: viewer, count: 1 },
        { kind: 'draw', item: 'relic', player: viewer, count: 1 },
      ],
      viewer,
    );
    expect(flights).toEqual([
      { item: 'action', cards: MAX_FLYING },
      { item: 'relic', cards: 1 },
    ]);
    expect(deckFlights([{ kind: 'draw', item: 'action', player: viewer, count: 1 }], null)).toEqual(
      [],
    );
  });

  it('misst die Mitte des ersten sichtbaren Ziels; leere Rechtecke zählen nicht', () => {
    expect(centerOf({ left: 10, top: 20, width: 100, height: 40 })).toEqual({ x: 60, y: 40 });
    expect(centerOf({ left: 10, top: 20, width: 0, height: 40 })).toBeNull();
    const root = document.createElement('div');
    root.innerHTML = '<i class="pile"></i>';
    expect(firstVisible(['.missing', '.pile'], root)).toBeNull();
  });
});

describe('Entwurf über einen Handel hinweg', () => {
  const trade = { type: 'TransactionCompleted' } as unknown as GameEvent;
  const built = { type: 'UnitsProduced' } as unknown as GameEvent;

  it('ein reiner Handel auf dem Stand des Entwurfs trägt ihn auf den neuen Stand', () => {
    const before = started();
    const last = { serial: 1, before, events: [trade] };
    const key = `production:p1@${String(before.version)}`;
    expect(carriedKey(key, last, before.version + 1)).toBe(
      `production:p1@${String(before.version + 1)}`,
    );
    expect(carriedKey(key, { ...last, events: [trade, built] }, before.version + 1)).toBeNull();
    expect(carriedKey(`production:p1@${String(before.version - 1)}`, last, 9)).toBeNull();
    expect(carriedKey(null, last, 9)).toBeNull();
  });

  it('die vorgemerkte Werftbestellung überlebt ein Angebot an der Handelsmatte', () => {
    const before = started();
    const after: GameState = { ...before, version: before.version + 1 };
    const stop = installDraftCarry();
    useDraftStore.getState().begin(`production@${String(before.version)}`, { kind: 'done' });
    useGameStore.setState({ game: after, lastEvents: { serial: 7, before, events: [trade] } });
    stop();
    expect(useDraftStore.getState().key).toBe(`production@${String(after.version)}`);
    expect(useDraftStore.getState().draft).toEqual({ kind: 'done' });
  });
});

describe('Filz und Holz', () => {
  it('Kacheln sind reproduzierbar und bleiben zart (Filz im Mittel unter 10 %, nie über 20 % deckend)', () => {
    const felt = weavePixels(FELT);
    expect(felt).toEqual(weavePixels(FELT));
    expect(felt.length).toBe(FELT.width * FELT.height * 4);
    const alphas = felt.filter((_, index) => index % 4 === 3);
    const mean = alphas.reduce((sum, alpha) => sum + alpha, 0) / alphas.length;
    expect(mean).toBeLessThan(0.1 * 255);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.2 * 255);
    expect(weavePixels(WOOD)[0]).toBe(0);
  });

  it('kachelbar: Gegenüberliegende Ränder treffen sich', () => {
    const field = (x: number, y: number) => Math.sin(x * 0.37) + Math.cos(y * 0.91) + x * 0.01;
    const tile = seamless(field, 64, 32);
    expect(tile(0, 10)).toBeCloseTo(tile(64, 10), 9);
    expect(tile(10, 0)).toBeCloseTo(tile(10, 32), 9);
  });
});

describe('Als Liste', () => {
  it('in der Ansage eingeklappt und nicht im Baum, bis man aufklappt oder vorgemerkt wird', () => {
    const list = (open: boolean) => (
      <AsListScope>
        <FormList openWhen={open}>
          <ul aria-label="Schiffe" />
        </FormList>
      </AsListScope>
    );
    const { rerender } = render(list(false));
    const toggle = screen.getByRole('button', { name: 'Als Liste' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Schiffe' })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('list', { name: 'Schiffe' })).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole('list', { name: 'Schiffe' })).toBeNull();
    rerender(list(true));
    expect(screen.getByRole('list', { name: 'Schiffe' })).toBeTruthy();
  });

  it('außerhalb der Ansage bleibt die Liste offen wie bisher', () => {
    render(
      <FormList>
        <ul aria-label="Schiffe" />
      </FormList>,
    );
    expect(screen.getByRole('list', { name: 'Schiffe' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Als Liste' })).toBeNull();
  });
});

/** Aktive Spielerin, ein Gegner mit seiner Heimat und ein Dritter in der Aktionsphase. */
function cannonScene() {
  const game = pickAll(started());
  const active = game.actionPhase?.active ?? null;
  const [other, third] = game.players.filter((player) => player.id !== active).map((p) => p.id);
  const home = Object.values(game.systems).find((system) =>
    system.spaceUnits.some((unit) => unit.owner === other),
  );
  if (active === null || other === undefined || third === undefined || home === undefined)
    throw new Error('kein Aufbau');
  return { game, active, other, third, home };
}

describe('Kampfrollen', () => {
  it('Weltraumkanonen: wer im System steht, ist schon Verteidiger, kein Zuschauer', () => {
    const { game, active, other, third, home } = cannonScene();
    const log = [
      {
        type: 'SpaceCannonFired',
        system: home.id,
        volley: { player: other, target: active, rolls: [], hits: 0 },
      },
    ] as unknown as CombatLogEvent[];
    expect(combatRole(game, log, active)).toBe('attacker');
    expect(combatRole(game, log, other)).toBe('defender');
    expect(combatRole(game, log, third)).toBe('bystander');
  });
});

describe('Anleitung am Tisch', () => {
  it('zeigt am Tisch auf Hand, Kommandomarker, Kampfmatte, Siegpunktleiste und Planeten', () => {
    const table = Object.fromEntries(TUTORIAL_STEPS.map((step) => [step.id, step.table]));
    expect(table).toMatchObject({
      strategy: 'hand',
      players: 'command-tokens',
      combat: 'battle-mat',
      objectives: 'vp-track',
      table: 'planet-row',
    });
  });
});
