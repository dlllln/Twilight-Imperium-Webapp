import { GlProgram, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js';
import type { PlanetLook } from './planet-texture.ts';
import { planetPaint } from './planet-paint.ts';
import { HALO_EXTENT, PLANET_FRAGMENT, PLANET_VERTEX, RING_EXTENT } from './planet-shader.ts';

/** Ein Programm für alle Planeten; nur die Werte je Planet unterscheiden sich (Flyweight). */
let program: GlProgram | null = null;
const planetProgram = (): GlProgram =>
  (program ??= GlProgram.from({
    vertex: PLANET_VERTEX,
    fragment: PLANET_FRAGMENT,
    name: 'planet',
  }));

const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

const quads = new Map<string, MeshGeometry>();
const shaders = new Map<string, Shader>();

/**
 * Viereck um den Planeten; die UV-Werte sind Kugelkoordinaten (1 = Planetenrand), `extent`
 * reicht bis zum Rand der Atmosphäre bzw. des Rings. Je Größe geteilt.
 */
function quad(radius: number, extent: number): MeshGeometry {
  const key = `${String(radius)}:${String(extent)}`;
  const known = quads.get(key);
  if (known !== undefined) return known;
  const geometry = square(radius, extent);
  quads.set(key, geometry);
  return geometry;
}

function square(radius: number, extent: number): MeshGeometry {
  const corners = (size: number) =>
    new Float32Array([-size, -size, size, -size, size, size, -size, size]);
  return new MeshGeometry({
    positions: corners(radius * extent),
    uvs: corners(extent),
    indices: QUAD_INDICES,
  });
}

const vec3 = (value: readonly number[]) => ({
  value: new Float32Array(value),
  type: 'vec3<f32>' as const,
});

function planetUniforms(id: string, look: PlanetLook): UniformGroup {
  const paint = planetPaint(id, look);
  return new UniformGroup({
    uSeed: vec3(paint.seed),
    uLow: vec3(paint.low),
    uMid: vec3(paint.mid),
    uHigh: vec3(paint.high),
    uAtmosphere: vec3(paint.atmosphere),
    uNight: vec3(paint.night),
    uFeatures: { value: new Float32Array(paint.features), type: 'vec4<f32>' as const },
    uShape: { value: new Float32Array(paint.shape), type: 'vec4<f32>' as const },
    uRing: { value: new Float32Array(paint.ring), type: 'vec2<f32>' as const },
  });
}

/** Planet als Shader-Fläche mit Durchmesser `diameter` (Karteneinheiten), mittig im Ursprung. */
export function planetMesh(
  id: string,
  look: PlanetLook,
  diameter: number,
): Mesh<MeshGeometry, Shader> {
  const extent = planetPaint(id, look).ring[0] > 0 ? RING_EXTENT : HALO_EXTENT;
  return new Mesh({ geometry: quad(diameter / 2, extent), shader: planetShader(id, look) });
}

/** Ein Shader je Planet, über alle Neuaufbauten der Karte hinweg geteilt. */
function planetShader(id: string, look: PlanetLook): Shader {
  const key = `${id}:${look}`;
  const known = shaders.get(key);
  if (known !== undefined) return known;
  const shader = new Shader({
    glProgram: planetProgram(),
    resources: { planet: planetUniforms(id, look) },
  });
  shaders.set(key, shader);
  return shader;
}
