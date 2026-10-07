import type { UnitCapability, UnitDefinition } from '../unit/unit-definition.ts';
import type { CapabilityChange, UnitChange, UnitSelector } from './technology-definition.ts';

/** Kleinster sinnvoller Wert für Würfelziele und Bewegung. */
const MIN_HIT_ON = 1;

export function matches(selector: UnitSelector, unit: UnitDefinition): boolean {
  return (
    (selector.types === undefined || selector.types.includes(unit.id)) &&
    (selector.category === undefined || selector.category === unit.category) &&
    (selector.fighters === undefined || selector.fighters === unit.isFighter)
  );
}

const plus = (value: number | undefined, delta: number | undefined): number | undefined =>
  value === undefined || delta === undefined ? value : value + delta;

const hitOnPlus = (hitOn: number, delta: number | undefined) =>
  Math.max(MIN_HIT_ON, hitOn + (delta ?? 0));

const add = (value: number, delta: number | undefined) => value + (delta ?? 0);

/** Würfelprofil einer Fähigkeit nach der Änderung. */
const profiled = (capability: UnitCapability, change: CapabilityChange) =>
  'profile' in capability
    ? {
        profile: {
          hitOn: hitOnPlus(capability.profile.hitOn, change.hitOn),
          dice: add(capability.profile.dice, change.dice),
        },
      }
    : {};

/** Zahlenwerte (Reichweite, Produktionsbonus, Jägerplätze) nach der Änderung. */
function counted(capability: UnitCapability, change: CapabilityChange) {
  return {
    ...('range' in capability ? { range: add(capability.range, change.range) } : {}),
    ...('bonus' in capability ? { bonus: add(capability.bonus, change.bonus) } : {}),
    ...('fighters' in capability ? { fighters: add(capability.fighters, change.fighters) } : {}),
  };
}

/** Addiert die Werte einer Fähigkeitsänderung, sofern die Fähigkeit sie besitzt. */
function changeCapability(capability: UnitCapability, change: CapabilityChange): UnitCapability {
  if (capability.kind !== change.kind) return capability;
  return { ...capability, ...profiled(capability, change), ...counted(capability, change) };
}

function withCapabilities(unit: UnitDefinition, change: UnitChange): readonly UnitCapability[] {
  const base =
    change.capability === undefined
      ? unit.capabilities
      : unit.capabilities.map((c) => changeCapability(c, change.capability as CapabilityChange));
  const added = (change.add ?? []).filter((c) => !base.some((own) => own.kind === c.kind));
  return [...base, ...added];
}

function combatOf(unit: UnitDefinition, change: UnitChange): Partial<UnitDefinition> {
  const combat = unit.combat;
  if (combat === undefined) return {};
  return {
    combat: {
      hitOn: hitOnPlus(combat.hitOn, change.hitOn),
      dice: combat.dice + (change.dice ?? 0),
    },
  };
}

/** Wendet eine Änderung auf eine Einheitendefinition an (rein, ohne Seiteneffekte). */
export function applyChange(unit: UnitDefinition, change: UnitChange): UnitDefinition {
  const replaced: UnitDefinition = { ...unit, ...change.set };
  const move = plus(replaced.move, change.move);
  const capacity = plus(replaced.capacity, change.capacity);
  return {
    ...replaced,
    ...combatOf(replaced, change),
    ...(move === undefined ? {} : { move }),
    ...(capacity === undefined ? {} : { capacity }),
    capabilities: withCapabilities(replaced, change),
  };
}
