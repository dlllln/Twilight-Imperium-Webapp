import type { Container } from 'pixi.js';
import { boardGrid } from './board-grid.ts';
import { drawHex, type DrawnHex, type HexLayers } from './hex-view.ts';
import type { Placed } from './board-pieces.ts';
import type { SceneHex } from './scene-model.ts';

interface Rendered {
  readonly signature: string;
  readonly drawn: DrawnHex;
  readonly children: readonly Container[];
}

export interface SceneUpdate {
  readonly changed: boolean;
  readonly placed: readonly Placed[];
  readonly fresh: readonly Placed[];
  readonly retired: readonly Container[];
}

/** Preserve shared depth-sorted layers while replacing only changed systems. */
export class HexSceneCache {
  private readonly records = new Map<string, Rendered>();
  private grid: Rendered | null = null;

  constructor(
    private readonly layers: HexLayers,
    private readonly draw = drawHex,
    private readonly drawGrid = boardGrid,
  ) {}

  update(hexes: readonly SceneHex[]): SceneUpdate {
    const retired: Container[] = [];
    const fresh: Placed[] = [];
    let changed = this.removeMissing(new Set(hexes.map((hex) => hex.key)), retired);
    for (const hex of hexes) changed = this.updateHex(hex, retired, fresh) || changed;
    const gridChanged = this.updateGrid(hexes, retired, fresh);
    const placed = [...this.records.values()].flatMap((record) => record.drawn.placed);
    return {
      changed: changed || gridChanged,
      placed: [...placed, ...(this.grid?.drawn.placed ?? [])],
      fresh,
      retired,
    };
  }

  private removeMissing(keys: ReadonlySet<string>, retired: Container[]): boolean {
    let changed = false;
    for (const [key, record] of this.records)
      if (!keys.has(key)) {
        this.retire(record, retired);
        this.records.delete(key);
        changed = true;
      }
    return changed;
  }

  private updateHex(hex: SceneHex, retired: Container[], fresh: Placed[]): boolean {
    const signature = JSON.stringify(hex);
    const previous = this.records.get(hex.key);
    if (previous?.signature === signature) return false;
    this.retire(previous, retired);
    const record = this.capture(signature, () => this.draw(hex, this.layers));
    this.records.set(hex.key, record);
    fresh.push(...record.drawn.placed);
    return true;
  }

  private updateGrid(hexes: readonly SceneHex[], retired: Container[], fresh: Placed[]): boolean {
    const signature = JSON.stringify(hexes.map(({ key, position }) => [key, position]));
    if (this.grid?.signature === signature) return false;
    this.retire(this.grid, retired);
    this.grid = this.capture(signature, () => ({
      placed: this.drawGrid(this.layers.base, hexes),
      pulse: null,
    }));
    fresh.push(...this.grid.drawn.placed);
    return true;
  }

  private capture(signature: string, build: () => DrawnHex): Rendered {
    const layers = (Object.keys(this.layers) as (keyof HexLayers)[]).map(
      (name) => this.layers[name],
    );
    const counts = layers.map((layer) => layer.children.length);
    const drawn = build();
    const children = layers.flatMap((layer, index) => layer.children.slice(counts[index]));
    return { signature, drawn, children };
  }

  private retire(record: Rendered | null | undefined, retired: Container[]): void {
    if (record == null) return;
    for (const child of record.children) child.parent?.removeChild(child);
    retired.push(...record.children);
  }
}
