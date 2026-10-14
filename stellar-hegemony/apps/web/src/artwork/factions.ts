import type { Language } from '../i18n.ts';

export interface FactionArtwork {
  readonly name: Readonly<Record<Language, string>>;
  readonly icon: string;
  readonly illustration: string;
  readonly sheet: string;
  readonly source: string;
}

const SOURCE_COMMIT = 'f5750930f0ed3283e15fc891af206eded2ebe739';
const SOURCE_ROOT = `https://github.com/TI4-Online/TI4-TTPG/blob/${SOURCE_COMMIT}/assets/Textures`;

const artwork = (id: string, de: string, en: string): FactionArtwork => ({
  name: { de, en },
  icon: `/ti4/factions/${id}-icon.png`,
  illustration: `/ti4/factions/${id}-back.jpg`,
  sheet: `/ti4/factions/${id}-front.jpg`,
  source: `${SOURCE_ROOT}/en/factionsheets/base/${id}.back.jpg`,
});

/** Original TI4 artwork for the existing factions; their custom game rules stay intact. */
export const FACTION_ARTWORK: Readonly<Record<string, FactionArtwork>> = {
  aurel: artwork('sol', 'Föderation Sol', 'The Federation of Sol'),
  orun: artwork('naalu', 'Naalu-Kollektiv', 'The Naalu Collective'),
  sel: artwork('hacan', 'Emirate von Hacan', 'The Emirates of Hacan'),
  karth: artwork('letnev', 'Baronie Letnev', 'The Barony of Letnev'),
  nesh: artwork('xxcha', 'Xxcha-Königreich', 'The Xxcha Kingdom'),
  quel: artwork('norr', 'Sardakk N’orr', 'Sardakk N’orr'),
};

export const factionArtwork = (id: string): FactionArtwork | undefined => FACTION_ARTWORK[id];
