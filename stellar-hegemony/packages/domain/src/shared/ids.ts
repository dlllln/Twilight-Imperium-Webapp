/**
 * Gebrandete Ids verhindern Verwechslungen (z. B. PlanetId statt SystemId)
 * bereits zur Compile-Zeit.
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type GameId = Brand<string, 'GameId'>;
export type PlayerId = Brand<string, 'PlayerId'>;
export type FactionId = Brand<string, 'FactionId'>;
export type SystemId = Brand<string, 'SystemId'>;
export type PlanetId = Brand<string, 'PlanetId'>;
export type UnitId = Brand<string, 'UnitId'>;
export type UnitTypeId = Brand<string, 'UnitTypeId'>;
export type TechnologyId = Brand<string, 'TechnologyId'>;

export const gameId = (value: string): GameId => value as GameId;
export const playerId = (value: string): PlayerId => value as PlayerId;
export const factionId = (value: string): FactionId => value as FactionId;
export const systemId = (value: string): SystemId => value as SystemId;
export const planetId = (value: string): PlanetId => value as PlanetId;
export const unitId = (value: string): UnitId => value as UnitId;
export const unitTypeId = (value: string): UnitTypeId => value as UnitTypeId;
export const technologyId = (value: string): TechnologyId => value as TechnologyId;
