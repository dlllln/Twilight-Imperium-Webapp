import type { PlanetDefinition } from './planet-definition.ts';
import type { PlanetAttachment, PlanetState } from './planet-state.ts';

const sum = (attachments: readonly PlanetAttachment[], value: 'resources' | 'influence') =>
  attachments.reduce((total, attachment) => total + attachment[value], 0);

/**
 * PoK Erkundung: Stammdaten samt angelegter Karten. Ressourcen und Einfluss addieren sich;
 * ein Planet hat höchstens eine Spezialisierung, eine angelegte zählt nur ohne eigene.
 */
export function withAttachments(
  definition: PlanetDefinition,
  state: PlanetState,
): PlanetDefinition {
  const attachments = state.attachments ?? [];
  if (attachments.length === 0) return definition;
  const specialty =
    definition.technologySpecialty ?? attachments.find((a) => a.specialty)?.specialty;
  return {
    ...definition,
    resources: definition.resources + sum(attachments, 'resources'),
    influence: definition.influence + sum(attachments, 'influence'),
    ...(specialty === undefined ? {} : { technologySpecialty: specialty }),
  };
}
