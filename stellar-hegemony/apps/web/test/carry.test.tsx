// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCarryEscape, useCarryStore } from '../src/table/carry-store.ts';
import {
  type DropHandler,
  poolTarget,
  systemTarget,
  type TargetRef,
  targetKey,
} from '../src/table/target-ref.ts';
import { useDragSource } from '../src/table/use-drag-source.ts';
import { useTarget } from '../src/table/use-target.ts';
import { installDomPolyfills } from './dom-polyfills.ts';

installDomPolyfills();

const TACTIC = poolTarget('tactic');
const ALLOWED = systemTarget('18');
const REFUSED = systemTarget('19');
const LEGAL: ReadonlySet<string> = new Set([targetKey(ALLOWED)]);

function Piece({ onDrop }: { readonly onDrop: DropHandler }): ReactElement {
  const props = useDragSource(TACTIC, () => LEGAL, onDrop);
  return (
    <button type="button" {...props}>
      Taktik
    </button>
  );
}

function Spot(props: { readonly target: TargetRef; readonly onDrop: DropHandler }): ReactElement {
  const { state, props: target } = useTarget(props.target, undefined, props.onDrop);
  return (
    <div role="button" tabIndex={0} aria-label={targetKey(props.target)} {...target}>
      {state}
    </div>
  );
}

function Table({ onDrop }: { readonly onDrop: DropHandler }): ReactElement {
  useCarryEscape();
  return (
    <>
      <Piece onDrop={onDrop} />
      <Spot target={ALLOWED} onDrop={onDrop} />
      <Spot target={REFUSED} onDrop={onDrop} />
    </>
  );
}

const piece = () => screen.getByRole('button', { name: 'Taktik' });
const spot = (target: TargetRef) => screen.getByRole('button', { name: targetKey(target) });
const carried = () => useCarryStore.getState().piece;

beforeEach(() => {
  const empty = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };
  useCarryStore.setState({ ...empty, news: null });
});

afterEach(cleanup);

describe('Stücke aufnehmen und ablegen', () => {
  it('ein Klick nimmt den Marker auf, ein Klick auf ein erlaubtes Ziel legt ihn ab', () => {
    const onDrop = vi.fn<DropHandler>();
    render(<Table onDrop={onDrop} />);
    fireEvent.click(piece());
    expect(piece().getAttribute('aria-pressed')).toBe('true');
    expect(useCarryStore.getState().mode).toBe('sticky');
    expect(spot(ALLOWED).getAttribute('data-target-state')).toBe('legal');
    expect(spot(REFUSED).hasAttribute('data-target-state')).toBe(false);
    fireEvent.click(spot(ALLOWED));
    expect(onDrop).toHaveBeenCalledWith(TACTIC, ALLOWED);
    expect(carried()).toBeNull();
    expect(useCarryStore.getState().news).toMatchObject({ kind: 'placed', ref: ALLOWED });
    expect(piece().getAttribute('aria-pressed')).toBe('false');
  });

  it('ein nicht erlaubtes Ziel legt den Marker zurück, nichts wird gesendet', () => {
    const onDrop = vi.fn<DropHandler>();
    render(<Table onDrop={onDrop} />);
    fireEvent.click(spot(REFUSED));
    expect(useCarryStore.getState().news).toBeNull();
    fireEvent.click(piece());
    fireEvent.keyDown(spot(REFUSED), { key: 'Enter' });
    expect(onDrop).not.toHaveBeenCalled();
    expect(carried()).toBeNull();
    expect(useCarryStore.getState().news).toMatchObject({ kind: 'putBack', ref: TACTIC });
  });

  it('Escape legt zurück und erreicht keine anderen Tastenhörer', () => {
    const listener = vi.fn();
    window.addEventListener('keydown', listener);
    document.addEventListener('keydown', listener, true);
    render(<Table onDrop={vi.fn<DropHandler>()} />);
    fireEvent.click(piece());
    fireEvent.keyDown(piece(), { key: 'Escape' });
    expect(carried()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    fireEvent.keyDown(piece(), { key: 'Escape' });
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('keydown', listener);
    document.removeEventListener('keydown', listener, true);
  });

  it('Ziehen über fünf Pixel trägt den Marker, Loslassen über einem Ziel legt ihn ab', () => {
    const onDrop = vi.fn<DropHandler>();
    render(<Table onDrop={onDrop} />);
    const under = () => [spot(ALLOWED)];
    Object.defineProperty(document, 'elementsFromPoint', { value: under, configurable: true });
    fireEvent.pointerDown(piece(), { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece(), { pointerId: 1, clientX: 3, clientY: 0 });
    expect(carried()).toBeNull();
    fireEvent.pointerMove(piece(), { pointerId: 1, clientX: 10, clientY: 0 });
    expect(useCarryStore.getState()).toMatchObject({ mode: 'drag', over: targetKey(ALLOWED) });
    fireEvent.pointerUp(piece(), { pointerId: 1, clientX: 40, clientY: 30 });
    fireEvent.click(piece());
    expect(onDrop).toHaveBeenCalledWith(TACTIC, ALLOWED);
    expect(carried()).toBeNull();
    expect(useCarryStore.getState().news?.kind).toBe('placed');
  });
});
