// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CompleteCardArtwork } from '../src/components/cards/CompleteCardArtwork.tsx';
import { HandFace } from '../src/components/hand/HandFaces.tsx';
import { strategyFrame } from '../src/artwork/cards.ts';
import { started } from './game-helpers.ts';

afterEach(cleanup);

const ratioOf = (container: HTMLElement) => {
  const [width, height = '1'] = (
    container.querySelector<HTMLElement>('.ti4-complete-card')?.style.aspectRatio ?? '0'
  ).split('/');
  return Number(width) / Number(height);
};

describe('Complete original cards', () => {
  it('shows the whole square strategy scan without an image window or overprinted app text', () => {
    const game = started();
    const card = Object.values(game.strategyCards).find((entry) => entry.mechanic === 'warfare');
    if (card === undefined) throw new Error('Missing warfare');
    const { container } = render(
      <HandFace game={game} entry={{ kind: 'pick', card, playable: true }} />,
    );
    const image = container.querySelector('img');
    if (image === null) throw new Error('Missing card scan');
    Object.defineProperties(image, { naturalWidth: { value: 512 }, naturalHeight: { value: 512 } });
    fireEvent.load(image);
    expect(image.getAttribute('src')).toBe(strategyFrame('warfare').path);
    expect(image.style.width).toBe('100%');
    expect(image.style.height).toBe('100%');
    expect(ratioOf(container)).toBe(1);
    expect(container.querySelector('.hand-art')).toBeNull();
    expect(container.querySelector('.hand-print-copy')).toBeNull();
    expect(container.querySelector('.hand-original-face')?.textContent).toBe('');
  });

  it('extracts one entire atlas cell and preserves its portrait proportions even if a crop was supplied', () => {
    const { container } = render(
      <CompleteCardArtwork
        artwork={{
          path: '/cards.jpg',
          columns: 12,
          rows: 7,
          index: 40,
          crop: { x: 0.2, y: 0.3, width: 0.4, height: 0.1 },
        }}
      />,
    );
    const image = container.querySelector('img');
    if (image === null) throw new Error('Missing scan');
    Object.defineProperties(image, {
      naturalWidth: { value: 4080 },
      naturalHeight: { value: 3570 },
    });
    fireEvent.load(image);
    expect(image.style.width).toBe('1200%');
    expect(image.style.height).toBe('700%');
    expect(image.style.left).toBe('-400%');
    expect(image.style.top).toBe('-300%');
    expect(ratioOf(container)).toBeCloseTo(2 / 3);
  });

  it.each(['tactical', 'pass'] as const)(
    '%s uses its own action control without borrowing an unrelated TI4 card',
    (kind) => {
      const game = started();
      const entry =
        kind === 'tactical'
          ? ({ kind, system: null, playable: false } as const)
          : ({ kind, playable: false } as const);
      const { container } = render(<HandFace game={game} entry={entry} />);
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('.hand-title')?.textContent.length).toBeGreaterThan(0);
    },
  );
});
