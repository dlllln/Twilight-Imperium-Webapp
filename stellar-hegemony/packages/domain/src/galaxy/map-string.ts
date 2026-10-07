import { hexDistance, hexKey, hexSpiral, ORIGIN } from '../hex/hex-coordinate.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import { systemId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { MapLayout, MapSlot, SlotContent } from './map-layout.ts';

/*
 * Map-String: Tafel-Ids in Spiral-Reihenfolge (Zentrum, dann Ring 1, 2, …, jeder
 * Ring im Uhrzeigersinn ab Norden), getrennt durch Leerraum.
 * `H` markiert einen Heimat-Platz, `.` ein leeres Feld.
 */
export const HOME_TOKEN = 'H';
export const EMPTY_TOKEN = '.';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

function ringsNeeded(tokenCount: number): number {
  let radius = 0;
  while (hexSpiral(ORIGIN, radius).length < tokenCount) radius++;
  return radius;
}

function slotFor(
  token: string,
  index: number,
  positions: ReturnType<typeof hexSpiral>,
): MapSlot | null {
  const position = positions[index] ?? ORIGIN;
  if (token === EMPTY_TOKEN) return null;
  if (token === HOME_TOKEN) return { position, content: { kind: 'home' } };
  return { position, content: { kind: 'tile', tileId: systemId(token) } };
}

export function parseMapString(mapString: string): Result<MapLayout, DomainError> {
  const tokens = mapString
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return err(domainError('map.empty', 'Map-String ist leer'));
  const invalid = tokens.find((token) => token !== EMPTY_TOKEN && !TOKEN_PATTERN.test(token));
  if (invalid !== undefined) {
    return err(
      domainError('map.invalidToken', `Ungültiges Zeichen im Map-String: ${invalid}`, {
        token: invalid,
      }),
    );
  }
  const positions = hexSpiral(ORIGIN, ringsNeeded(tokens.length));
  return ok(
    tokens.map((token, index) => slotFor(token, index, positions)).filter((slot) => slot !== null),
  );
}

function tokenFor(content: SlotContent | undefined): string {
  if (content === undefined) return EMPTY_TOKEN;
  return content.kind === 'home' ? HOME_TOKEN : content.tileId;
}

export function formatMapString(layout: MapLayout): string {
  const radius = Math.max(0, ...layout.map((slot) => hexDistance(ORIGIN, slot.position)));
  const byKey = new Map(layout.map((slot) => [hexKey(slot.position), slot.content]));
  const tokens = hexSpiral(ORIGIN, radius).map((position) => tokenFor(byKey.get(hexKey(position))));
  while (tokens.at(-1) === EMPTY_TOKEN) tokens.pop();
  return tokens.join(' ');
}
