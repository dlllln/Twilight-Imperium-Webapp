// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../src/game-store.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { sameView } from '../src/render/board-view.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { content } from '../src/store.ts';
import { TURN_MS, useBoardView } from '../src/system/board-camera.ts';
import { started } from './game-helpers.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useGameStore.getState().leave();
});

it('finishes a seating rotation on time when game updates recreate the same board geometry', () => {
  let now = 0;
  let serial = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const tick = (time: number) =>
    act(() => {
      now = time;
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    });
  const game = started();
  useGameStore.setState({ game });
  useSettingsStore.setState({ animations: true });
  const scene = gameScene(game, content, 'de', new Map());
  const { result, rerender } = renderHook(({ hexes }) => useBoardView(hexes), {
    initialProps: { hexes: scene },
  });
  const moved = scene.map((hex) => (hex.seat === 1 ? { ...hex, position: { q: -3, r: 0 } } : hex));
  rerender({ hexes: moved });
  tick(TURN_MS / 2);
  expect(result.current.view.angle).not.toBeCloseTo(result.current.target.angle, 3);
  rerender({ hexes: [...moved] });
  tick(TURN_MS);
  expect(sameView(result.current.view, result.current.target)).toBe(true);
  expect(frames.size).toBe(0);
});
