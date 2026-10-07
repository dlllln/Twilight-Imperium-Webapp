import type { GameState, MapLayout } from '@stellar/domain';
import {
  forwardRef,
  lazy,
  Suspense,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type MapEffect, mapEffects } from '../animation/map-effects.ts';
import { useGameStore } from '../game-store.ts';
import { type Bounds, boundsOf, hexCorners, hexToPixel, toSvgPoints } from '../hex-geometry.ts';
import type { Language } from '../i18n.ts';
import { gameScene, layoutScene, type SceneHex } from '../render/scene-model.ts';
import { content, useGalaxyStore, type Viewport } from '../store.ts';
import { highlightsOf, movementChoices } from '../tactical-view.ts';
import { useSettingsStore } from '../settings-store.ts';
import { usePanZoom } from '../use-pan-zoom.ts';
import { HexTooltip } from './HexTooltip.tsx';

/** Pixi wird nachgeladen, damit die Oberfläche sofort erscheint. */
const PixiCanvas = lazy(() =>
  import('./PixiCanvas.tsx').then((module) => ({ default: module.PixiCanvas })),
);

interface SceneInput {
  readonly layout: MapLayout;
  readonly game: GameState | null;
  readonly selected: string | null;
  readonly language: Language;
}

function sceneFor({ layout, game, selected, language }: SceneInput): readonly SceneHex[] {
  if (game === null) return layoutScene(layout, content, language);
  const highlights = highlightsOf(game, movementChoices(game, content), selected);
  return gameScene(game, content, language, highlights);
}

/** Szene aus Galaxie-Layout (Aufbau) oder Spielzustand (Partie). */
function useScene(): readonly SceneHex[] {
  const layout = useGalaxyStore((state) => state.layout);
  const language = useGalaxyStore((state) => state.language);
  const game = useGameStore((state) => state.game);
  const selected = useGameStore((state) => state.selected);
  return useMemo(
    () => sceneFor({ layout, game, selected, language }),
    [layout, game, selected, language],
  );
}

const NO_EFFECTS: readonly MapEffect[] = [];

/** Effekte des letzten Zugs, wenn Animationen eingeschaltet sind. */
function useMapEffects(): readonly MapEffect[] {
  const last = useGameStore((state) => state.lastEvents);
  const animations = useSettingsStore((state) => state.animations);
  return useMemo(
    () => (animations && last !== null ? mapEffects(last.before, last.events) : NO_EFFECTS),
    [animations, last],
  );
}

const tileClass = (hex: SceneHex): string =>
  hex.kind === 'homeSlot' || hex.back === 'home' ? 'tile-home' : `tile-${hex.back}`;

interface TargetProps {
  readonly hex: SceneHex;
  readonly hovered: boolean;
  readonly onHover: (key: string | null) => void;
  readonly onPick: (hex: SceneHex) => void;
}

/** Unsichtbare Trefferfläche je Feld: Maus, Tastatur, Screenreader und E2E-Tests. */
function HexTarget({ hex, hovered, onHover, onPick }: TargetProps): ReactElement {
  const pickable = hex.systemId !== null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') onPick(hex);
  };
  return (
    <polygon
      points={toSvgPoints(hexCorners(hexToPixel(hex.position)))}
      className={`hex ${tileClass(hex)} highlight-${hex.highlight}${hovered ? ' highlighted' : ''}`}
      data-slot={hex.key}
      data-system={hex.systemId ?? undefined}
      data-anomaly={hex.anomaly}
      data-seat={hex.seat ?? undefined}
      role={pickable ? 'button' : undefined}
      aria-label={hex.systemId ?? `${hex.kind} ${String(hex.seat)}`}
      tabIndex={pickable ? 0 : undefined}
      onPointerEnter={() => onHover(hex.key)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(hex.key)}
      onClick={() => onPick(hex)}
      onKeyDown={onKeyDown}
    />
  );
}

interface TargetsProps {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  readonly onPick: (hex: SceneHex) => void;
}

const viewBoxOf = (b: Bounds): string =>
  [b.minX, b.minY, b.width, b.height].map((value) => String(value)).join(' ');

/** SVG-Ebene über dem Pixi-Bild, mit derselben Abbildung wie `worldTransform`. */
const HexTargets = forwardRef<SVGSVGElement, TargetsProps>(function HexTargets(
  { hexes, bounds, viewport, onPick },
  svg,
): ReactElement {
  const { hovered, hover } = useGalaxyStore();
  const { panX, panY, zoom } = viewport;
  return (
    <svg ref={svg} viewBox={viewBoxOf(bounds)} aria-label="galaxy">
      <g transform={`translate(${String(panX)} ${String(panY)}) scale(${String(zoom)})`}>
        {hexes.map((hex) => (
          <HexTarget
            key={hex.key}
            hex={hex}
            hovered={hex.key === hovered}
            onHover={hover}
            onPick={onPick}
          />
        ))}
      </g>
    </svg>
  );
});

export function GalaxyMap(): ReactElement {
  const { hovered, viewport } = useGalaxyStore();
  const hexes = useScene();
  const effects = useMapEffects();
  const bounds = useMemo(() => boundsOf(hexes.map((hex) => hex.position)), [hexes]);
  const svg = useRef<SVGSVGElement>(null);
  const { cursor, wasDrag, ...handlers } = usePanZoom(svg, bounds.width);
  const [flat, setFlat] = useState(false);
  const onUnavailable = useCallback(() => setFlat(true), []);
  const pick = (hex: SceneHex) => {
    const { game, select } = useGameStore.getState();
    if (!wasDrag() && game !== null) select(hex.systemId);
  };
  const hoveredHex = hexes.find((hex) => hex.key === hovered);
  return (
    <div className={flat ? 'galaxy flat' : 'galaxy'} data-tutorial="galaxy" {...handlers}>
      {!flat && (
        <Suspense fallback={null}>
          <PixiCanvas {...{ hexes, bounds, viewport, effects, onUnavailable }} />
        </Suspense>
      )}
      <HexTargets ref={svg} hexes={hexes} bounds={bounds} viewport={viewport} onPick={pick} />
      {hoveredHex !== undefined && <HexTooltip hex={hoveredHex} x={cursor.x} y={cursor.y} />}
    </div>
  );
}
