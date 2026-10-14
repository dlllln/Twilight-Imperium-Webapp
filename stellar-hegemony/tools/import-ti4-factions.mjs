import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

const asyncCommit = 'e0de5a7db198ae4fd66cfa5270fcca893bb510a3';
const ttpgCommit = 'f5750930f0ed3283e15fc891af206eded2ebe739';
const source = `https://raw.githubusercontent.com/AsyncTI4/TI4_map_generator_bot/${asyncCommit}/src/main/resources`;
const target = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const load = async (path) => {
  const response = await fetch(`${source}/${path}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};

const groups = await Promise.all(
  ['base', 'pok', 'keleres', 'te_factions'].map((id) => load(`data/factions/${id}.json`)),
);
const factions = [
  ...groups[0],
  ...groups[1],
  groups[2][0],
  ...groups[3].filter((f) => f.alias !== 'obsidian'),
];
const leaders = (
  await Promise.all(['pok', 'te_leaders'].map((id) => load(`data/leaders/${id}.json`)))
).flat();
const planets = new Map();
for (let offset = 0; offset < factions.length; offset += 6) {
  await Promise.all(
    factions.slice(offset, offset + 6).flatMap((faction) =>
      faction.homePlanets.map(async (id) => {
        planets.set(id, await load(`planets/${id}.json`));
      }),
    ),
  );
}

const archetypes = {
  arborec: 'quel',
  ghost: 'nesh',
  hacan: 'sel',
  jolnar: 'vyr',
  l1z1x: 'karth',
  letnev: 'karth',
  mentak: 'tarn',
  muaat: 'karth',
  naalu: 'orun',
  nekro: 'karth',
  saar: 'tarn',
  sardakk: 'quel',
  sol: 'aurel',
  winnu: 'orun',
  xxcha: 'nesh',
  yin: 'quel',
  yssaril: 'orun',
  argent: 'nesh',
  cabal: 'quel',
  empyrean: 'sel',
  mahact: 'orun',
  nomad: 'tarn',
  naaz: 'vyr',
  titans: 'nesh',
  keleresm: 'orun',
  bastion: 'aurel',
  deepwrought: 'vyr',
  firmament: 'orun',
  crimson: 'tarn',
  ralnel: 'sel',
};
const names = {
  arborec: 'Die Arborec',
  ghost: 'Geister von Creuss',
  hacan: 'Emirate von Hacan',
  jolnar: 'Universitäten von Jol-Nar',
  l1z1x: 'L1Z1X-Gedankennetz',
  letnev: 'Baronie Letnev',
  mentak: 'Mentak-Koalition',
  muaat: 'Glut von Muaat',
  naalu: 'Naalu-Kollektiv',
  nekro: 'Nekro-Virus',
  saar: 'Clan von Saar',
  sardakk: 'Sardakk N’orr',
  sol: 'Föderation Sol',
  winnu: 'Die Winnu',
  xxcha: 'Xxcha-Königreich',
  yin: 'Yin-Bruderschaft',
  yssaril: 'Yssaril-Stämme',
  argent: 'Argent-Flug',
  cabal: 'Vuil’raith-Kabal',
  empyrean: 'Die Empyreaner',
  mahact: 'Mahact-Genzauberer',
  nomad: 'Der Nomade',
  naaz: 'Naaz-Rokha-Allianz',
  titans: 'Titanen von Ul',
  keleresm: 'Rat der Keleres',
  bastion: 'Last Bastion',
  deepwrought: 'Deepwrought Scholarate',
  firmament: 'Das Firmament',
  crimson: 'Crimson Rebellion',
  ralnel: 'Ral Nel Consortium',
};
const techMap = {
  nm: 'cell-regeneration',
  st: 'target-acquisition',
  ps: 'reactive-plating',
  md: 'bunker-works',
  amd: 'ion-drive',
  gd: 'expanded-holds',
  sar: 'living-shipyards',
  bs: 'hangar-automation',
  da: 'chitin-plating',
  dxa: 'brood-chambers',
  gls: 'orbital-sensors',
  det: 'deep-space-scanner',
  aida: 'siege-mortars',
  sdn: 'relay-command',
  scanlink: 'relay-command',
  pi: 'target-acquisition',
  pa: 'cell-regeneration',
  sr: 'ion-drive',
};
const techNames = {
  nm: 'Neural Motivator',
  st: 'Sarween Tools',
  ps: 'Plasma Scoring',
  md: 'Magen Defense Grid',
  amd: 'Antimass Deflectors',
  gd: 'Gravity Drive',
  sar: 'Self-Assembly Routines',
  bs: 'Bio-Stims',
  da: 'Dacxive Animators',
  dxa: 'Dacxive Animators',
  gls: 'Graviton Laser System',
  det: 'Dark Energy Tap',
  aida: 'AI Development Algorithm',
  sdn: 'Scanlink Drone Network',
  scanlink: 'Scanlink Drone Network',
  pi: 'Predictive Intelligence',
  pa: 'Psychoarchaeology',
  sr: 'Sling Relay',
};
const unitMap = {
  cv: 'carrier',
  cr: 'cruiser',
  ca: 'cruiser',
  dd: 'destroyer',
  dn: 'dreadnought',
  ff: 'fighter',
  fs: 'flagship',
  ws: 'sunbreaker',
  inf: 'infantry',
  mech: 'mech',
  pds: 'orbitalBattery',
  sd: 'orbitalDock',
};

function groundPlanet(faction, hint) {
  if (!hint) return faction.homePlanets[0];
  const explicit = { ar: 'archonren', at: 'archontau' }[hint];
  if (explicit && faction.homePlanets.includes(explicit)) return explicit;
  return faction.homePlanets.find((id) => id.startsWith(hint)) ?? faction.homePlanets[0];
}

function startingForces(faction) {
  const space = [];
  const ground = new Map(faction.homePlanets.map((id) => [id, []]));
  for (const item of faction.startingFleet.split(',')) {
    const match = /^\s*(\d+)?\s*([a-z]+)(?:\s+(\S+))?\s*$/.exec(item);
    if (!match || !unitMap[match[2]])
      throw new Error(`Unknown fleet entry: ${faction.alias}/${item}`);
    const unit = unitMap[match[2]];
    const stack = [unit, Number(match[1] ?? 1)];
    if (['infantry', 'mech', 'orbitalBattery', 'orbitalDock'].includes(unit))
      ground.get(groundPlanet(faction, match[3])).push(stack);
    else space.push(stack);
  }
  return { space, ground: [...ground].map(([planet, units]) => ({ planet, units })) };
}

function leaderSeeds(faction) {
  return ['agent', 'commander', 'hero'].map((kind) => {
    const candidates = faction.leaders.map((id) => leaders.find((leader) => leader.id === id));
    const leader = candidates.find((candidate) => candidate?.type === kind);
    if (!leader) throw new Error(`Missing leader: ${faction.alias}/${kind}`);
    return { kind, id: `ti4-${faction.alias}-${kind}`, name: leader.name };
  });
}

function technologySetup(faction) {
  const choice = faction.alias === 'keleresm' ? 2 : (faction.startingTechAmount ?? 0);
  const options = faction.startingTechOptions?.length
    ? faction.startingTechOptions
    : ['amd', 'nm', 'st', 'ps'];
  const techs =
    faction.alias === 'keleresm'
      ? options.slice(0, choice)
      : (faction.startingTech ?? options.slice(0, choice));
  const mapped = [...new Set(techs.map((id) => techMap[id]).filter(Boolean))];
  if (faction.alias === 'muaat') mapped.push('sunbreaker-blueprint');
  return {
    technologies: mapped,
    originalTechnologies: techs.map((id) => techNames[id] ?? id),
    technologyChoice: choice,
  };
}

const editionOf = (value) => ({ thunders_edge: 'te', codex3: 'codex' })[value] ?? value;
const groupOf = (value) => ({ thunders_edge: 'te_factions', codex3: 'keleres' })[value] ?? value;

function factionSeed(faction) {
  return {
    id: faction.alias === 'keleresm' ? 'keleres' : faction.alias,
    name: {
      de: names[faction.alias],
      en: faction.alias === 'keleresm' ? 'The Council Keleres' : faction.factionName,
    },
    edition: editionOf(faction.source),
    archetype: archetypes[faction.alias],
    complexity: { Low: 1, Medium: 2, High: 3 }[faction.complexity] ?? 3,
    commodities: faction.commodities,
    home: faction.homePlanets.map((id) => {
      const planet = planets.get(id);
      return {
        alias: id,
        name: planet.name,
        resources: planet.resources,
        influence: planet.influence,
      };
    }),
    ...startingForces(faction),
    ...technologySetup(faction),
    leaders: leaderSeeds(faction),
    source: `${source}/data/factions/${groupOf(faction.source)}.json`,
  };
}

const seeds = factions.map(factionSeed);
if (seeds.length !== 30 || new Set(seeds.map((f) => f.id)).size !== 30)
  throw new Error('Expected 30 unique standard factions');
const heading = `// Generated by tools/import-ti4-factions.mjs; source snapshots are pinned.\nimport type { OfficialFactionSeed } from './official-faction-model.ts';\n\n`;
await writeFile(
  target('packages/content/src/official-faction-data.ts'),
  `${heading}export const OFFICIAL_FACTION_DATA: readonly OfficialFactionSeed[] = ${JSON.stringify(seeds, null, 2)};\n`,
);

const aliases = {
  ghost: 'creuss',
  sardakk: 'norr',
  cabal: 'vuilraith',
  naaz: 'naazrokha',
  titans: 'ul',
};
const manifest = JSON.parse(await readFile(target('tools/ti4/factions.json'), 'utf8'));
const arts = [];
for (const faction of seeds) {
  const alias = aliases[faction.id] ?? faction.id;
  const folder = faction.edition === 'codex' ? 'codex.vigil' : faction.edition;
  const base = `https://raw.githubusercontent.com/TI4-Online/TI4-TTPG/${ttpgCommit}/assets/Textures`;
  const artwork = { id: faction.id, name: faction.name, icon: `factions/${alias}-icon.png` };
  const iconUrl =
    faction.edition === 'te'
      ? `${source}/factions/${faction.id}.png`
      : `${base}/global/factions/${alias}_icon.png`;
  manifest.push({ path: artwork.icon, url: iconUrl });
  if (faction.edition === 'te') {
    artwork.illustration = `factions/${alias}-reference.png`;
    artwork.sheet = artwork.illustration;
    artwork.referenceOnly = true;
    manifest.push({
      path: artwork.illustration,
      url: `${source}/quick_reference/TE/${faction.id}.png`,
    });
  } else {
    artwork.illustration = `factions/${alias}-back.jpg`;
    artwork.sheet = `factions/${alias}-front.jpg`;
    manifest.push({
      path: artwork.illustration,
      url: `${base}/en/factionsheets/${folder}/${alias}.back.jpg`,
    });
    manifest.push({
      path: artwork.sheet,
      url: `${base}/en/factionsheets/${folder}/${alias}.face.jpg`,
    });
  }
  artwork.source = (manifest.find((entry) => entry.path === artwork.illustration)?.url ?? '')
    .replace('raw.githubusercontent.com', 'github.com')
    .replace(`/${ttpgCommit}/`, `/blob/${ttpgCommit}/`)
    .replace(`/${asyncCommit}/`, `/blob/${asyncCommit}/`);
  arts.push(artwork);
}
await writeFile(
  target('tools/ti4/factions.json'),
  `${JSON.stringify([...new Map(manifest.map((entry) => [entry.path, entry])).values()], null, 2)}\n`,
);
await writeFile(
  target('apps/web/src/artwork/official-faction-artwork.ts'),
  `// Generated by tools/import-ti4-factions.mjs.\nimport type { FactionArtwork } from './factions.ts';\n\nexport const OFFICIAL_FACTION_ARTWORK: Readonly<Record<string, FactionArtwork>> = ${JSON.stringify(Object.fromEntries(arts.map(({ id, ...art }) => [id, { ...art, icon: `/ti4/${art.icon}`, illustration: `/ti4/${art.illustration}`, sheet: `/ti4/${art.sheet}` }])), null, 2)};\n`,
);
console.log(`Imported ${seeds.length} standard factions and their original artwork.`);
