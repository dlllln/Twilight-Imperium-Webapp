import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { withAttachments } from './planet-attachments.ts';
import type { PlanetDefinition } from './planet-definition.ts';
import type { PlanetState } from './planet-state.ts';

/**
 * Information Expert: Ein Planet kennt seine Ressourcen, seinen Einfluss,
 * seinen Besitzer und ob er erschöpft ist. Unveränderlich; Änderungen
 * liefern einen neuen `PlanetState`.
 */
export class Planet {
  private constructor(
    readonly definition: PlanetDefinition,
    readonly state: PlanetState,
  ) {}

  static of(definition: PlanetDefinition, state: PlanetState): Result<Planet, DomainError> {
    if (definition.id !== state.id) {
      return err(domainError('planet.mismatch', 'Stammdaten und Zustand gehören nicht zusammen'));
    }
    // PoK Erkundung: angelegte Karten zählen überall mit, wo Planetenwerte gelesen werden.
    return ok(new Planet(withAttachments(definition, state), state));
  }

  get resources(): number {
    return this.definition.resources;
  }

  get influence(): number {
    return this.definition.influence;
  }

  get isExhausted(): boolean {
    return this.state.exhausted;
  }

  isControlledBy(player: PlayerId): boolean {
    return this.state.controller === player;
  }

  /** Regel 26: Nur bereite Planeten können ausgegeben (erschöpft) werden. */
  exhaust(spender: PlayerId): Result<PlanetState, DomainError> {
    if (!this.isControlledBy(spender)) {
      return err(domainError('planet.notControlled', 'Planet gehört nicht dem Spieler'));
    }
    if (this.isExhausted) {
      return err(domainError('planet.alreadyExhausted', 'Planet ist bereits erschöpft'));
    }
    return ok({ ...this.state, exhausted: true });
  }

  ready(): PlanetState {
    return { ...this.state, exhausted: false };
  }

  /** Was der Planet derzeit zum Bezahlen beitragen kann. */
  availableResources(): number {
    return this.isExhausted ? 0 : this.resources;
  }

  availableInfluence(): number {
    return this.isExhausted ? 0 : this.influence;
  }
}
