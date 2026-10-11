/*
 * Planeten werden auf der Grafikkarte gerechnet, nicht als Bild hochskaliert: Jeder Bildpunkt
 * bestimmt Kugelnormale, Oberfläche (fraktales 3D-Rauschen mit Verwirbelung), Wolken, Glanz,
 * Nachtlichter und Atmosphäre neu. So bleibt ein Planet in jeder Zoomstufe gestochen scharf.
 * Licht fällt wie überall von links oben ein. GLSL ES 3.0 (WebGL 2) wegen `fwidth` für glatte Ränder.
 */

export const PLANET_VERTEX = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vSphere;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vSphere = aUV;
}
`;

export const PLANET_FRAGMENT = /* glsl */ `#version 300 es
in vec2 vSphere;
out vec4 finalColor;

uniform vec4 uColor;
uniform vec3 uSeed;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec3 uAtmosphere;
uniform vec3 uNight;
uniform vec4 uFeatures;

const vec3 LIGHT = vec3(-0.55, -0.45, 0.7);
const float HALO = 0.15;
const float BUMP = 0.012;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), u.x);
  float b = mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x);
  float c = mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x);
  float d = mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float norm = 0.0;
  for (int octave = 0; octave < 10; octave++) {
    if (octave >= octaves) break;
    sum += amplitude * noise(p);
    norm += amplitude;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return sum / norm;
}

vec3 ramp(float t) {
  return t < 0.5 ? mix(uLow, uMid, t * 2.0) : mix(uMid, uHigh, (t - 0.5) * 2.0);
}

/* Oberfläche: Kontinente/Gestein aus verwirbeltem Rauschen, bei der Thronwelt mit Bändern. */
float terrain(vec3 p, vec3 normal) {
  vec3 warp = vec3(fbm(p * 0.7, 4), fbm(p * 0.7 + 5.2, 4), fbm(p * 0.7 + 9.1, 4));
  float t = fbm(p + warp * 1.1, 8);
  float bands = sin(normal.y * 9.0 + t * 4.0) * 0.12 * uFeatures.w;
  return clamp((t - 0.5) * 2.4 + 0.5 + bands, 0.0, 1.0);
}

/* Feines Relief (Grate, Krater, Täler): sichtbar erst aus der Nähe. */
float relief(vec3 p) {
  float ridges = 1.0 - abs(fbm(p * 7.0 + 21.0, 7) * 2.0 - 1.0);
  return ridges * ridges;
}

/* Normale mit Relief: Höhenunterschiede neigen die Fläche zum Licht hin oder davon weg. */
vec3 bumped(vec3 normal, vec3 p) {
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.001), normal));
  vec3 north = cross(normal, east);
  float step_ = 0.0015;
  float here = relief(p);
  float dx = relief(p + east * step_) - here;
  float dy = relief(p + north * step_) - here;
  return normalize(normal - (east * dx + north * dy) * (BUMP / step_));
}

vec3 surface(vec3 normal) {
  vec3 light = normalize(LIGHT);
  vec3 p = normal * 2.4 + uSeed;
  float t = terrain(p, normal);
  float ocean = smoothstep(0.46, 0.4, t);
  vec3 shaped = bumped(normal, p);
  float lambert = dot(shaped, light);
  float lit = max(0.03, mix(lambert, dot(normal, light), ocean));
  float grain = (relief(p) - 0.5) * 0.18 * (1.0 - ocean);
  vec3 ground = ramp(clamp(t + grain, 0.0, 1.0)) * lit;
  float cloud = clamp((fbm(p * vec3(1.5, 3.4, 1.5) + 50.0, 7) - 0.56) * 3.2, 0.0, 0.85);
  cloud *= uFeatures.x;
  vec3 color = mix(ground, vec3(0.93, 0.95, 0.99) * max(0.03, dot(normal, light)), cloud);
  vec3 towardSun = normalize(light + vec3(0.0, 0.0, 1.0));
  float gloss = pow(max(0.0, dot(normal, towardSun)), 60.0) * (0.35 + ocean);
  color += gloss * uFeatures.y * (1.0 - cloud);
  float dark = clamp((0.2 - dot(normal, light)) * 5.0, 0.0, 1.0);
  float sites = clamp((fbm(p * 16.0 + 70.0, 6) - 0.6) * 9.0, 0.0, 1.0) * (1.0 - ocean);
  color = mix(color, uNight, sites * dark * uFeatures.z * (1.0 - cloud));
  float rim = pow(1.0 - normal.z, 2.5) * clamp(dot(normal, light) + 0.4, 0.0, 1.0);
  return color + uAtmosphere * rim * 0.75;
}

void main() {
  float d = length(vSphere);
  float edge = max(fwidth(d), 0.0005);
  float disc = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, d);
  vec2 n = vSphere / max(d, 1.0);
  vec3 normal = vec3(n, sqrt(max(0.0, 1.0 - dot(n, n))));
  vec3 inside = disc > 0.0 ? surface(normal) : vec3(0.0);
  float outer = clamp(1.0 - (d - 1.0) / HALO, 0.0, 1.0);
  float side = clamp(dot(n, normalize(LIGHT.xy)) * 0.6 + 0.5, 0.15, 1.0);
  float halo = outer * outer * 0.75 * side * (1.0 - disc);
  finalColor = vec4(inside * disc + uAtmosphere * halo, disc + halo) * uColor;
}
`;

/** Wie weit die Atmosphäre über den Planetenradius hinausreicht (Größe des Vierecks). */
export const HALO_EXTENT = 1.15;
