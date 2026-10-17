import type { Point } from '../hex-geometry.ts';
import type { FleetOrigin } from './fleet-placement.ts';

export interface FleetPointer {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly currentTarget: HTMLElement;
}

export interface LiftedFleet {
  readonly origin: FleetOrigin;
  readonly at: Point;
}

export interface FleetDragConfig {
  readonly lift: (fleet: LiftedFleet) => void;
  readonly draw: (at: Point, valid: boolean) => void;
  readonly accept: (at: Point) => boolean;
  readonly stage: (origin: FleetOrigin) => void;
  readonly settle: (fleet: LiftedFleet, valid: boolean) => void;
}

interface Held extends LiftedFleet {
  readonly pointer: number;
  readonly element: HTMLElement;
  readonly start: Point;
  readonly offset: Point;
}

function mapOffset(element: HTMLElement): Point {
  const map = element.closest('.galaxy');
  if (map === null) return { x: 0, y: 0 };
  map.setAttribute('data-lifting-fleet', 'true');
  const box = map.getBoundingClientRect();
  return { x: box.left + map.clientLeft, y: box.top + map.clientTop };
}

/** Only the floating miniature moves per frame. React and the board scene stay untouched. */
export class FleetDrag {
  private held: Held | null = null;
  private pending = 0;
  private suppressClick = false;

  constructor(private readonly read: () => FleetDragConfig) {}

  get active(): boolean {
    return this.held !== null;
  }

  dispose(): void {
    this.finish();
  }

  start(event: FleetPointer, origin: FleetOrigin): void {
    if (event.button !== 0 || this.held !== null) return;
    this.suppressClick = false;
    const offset = mapOffset(event.currentTarget);
    const at = { x: event.clientX - offset.x, y: event.clientY - offset.y };
    this.held = {
      origin,
      at,
      start: at,
      offset,
      pointer: event.pointerId,
      element: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    this.read().lift({ origin, at });
  }

  move(event: Pick<FleetPointer, 'pointerId' | 'clientX' | 'clientY'>): void {
    if (this.held?.pointer !== event.pointerId) return;
    this.held = { ...this.held, at: this.point(event) };
    if (this.pending === 0) this.pending = requestAnimationFrame(this.paint);
  }

  release(event: Pick<FleetPointer, 'pointerId' | 'clientX' | 'clientY'>): void {
    if (this.held?.pointer !== event.pointerId) return;
    const fleet = { ...this.held, at: this.point(event) };
    this.suppressClick = Math.hypot(fleet.at.x - fleet.start.x, fleet.at.y - fleet.start.y) > 5;
    const valid = this.suppressClick && this.read().accept(fleet.at);
    this.read().draw(fleet.at, valid);
    if (valid) this.read().stage(fleet.origin);
    this.finish();
    this.read().settle(fleet, valid);
  }

  consumeClick(): boolean {
    const skip = this.suppressClick;
    this.suppressClick = false;
    return skip;
  }

  cancel(pointer?: number): void {
    if (pointer !== undefined && this.held?.pointer !== pointer) return;
    const fleet = this.held;
    this.finish();
    this.suppressClick = true;
    if (fleet !== null) this.read().settle(fleet, false);
  }

  private point(event: { readonly clientX: number; readonly clientY: number }): Point {
    const offset = this.held?.offset ?? { x: 0, y: 0 };
    return { x: event.clientX - offset.x, y: event.clientY - offset.y };
  }

  private finish(): void {
    cancelAnimationFrame(this.pending);
    this.pending = 0;
    const fleet = this.held;
    this.held = null;
    fleet?.element.closest('.galaxy')?.removeAttribute('data-lifting-fleet');
    if (fleet?.element.hasPointerCapture(fleet.pointer))
      fleet.element.releasePointerCapture(fleet.pointer);
  }

  private readonly paint = (): void => {
    this.pending = 0;
    if (this.held !== null) this.read().draw(this.held.at, this.read().accept(this.held.at));
  };
}
