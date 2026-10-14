import { FACTION_NAMES, TI4_FACTIONS, TI4_FACTION_METADATA } from '@stellar/content';
import { type ReactElement, useState } from 'react';
import { useLanguage } from '../../use-translation.ts';

export const EDITION_NAMES: Readonly<Record<string, string>> = {
  base: 'Grundspiel',
  pok: 'Prophecy of Kings',
  codex: 'Codex · Keleres',
  te: 'Thunder’s Edge',
};

interface BrowserProps {
  readonly children: (id: string) => ReactElement;
}

function EmptyResults({ german }: { readonly german: boolean }): ReactElement {
  return <p>{german ? 'Keine passende Fraktion gefunden.' : 'No matching faction found.'}</p>;
}

interface FilterProps {
  readonly german: boolean;
  readonly query: string;
  readonly edition: string;
  readonly setQuery: (value: string) => void;
  readonly setEdition: (value: string) => void;
}

function SearchField({ german, query, setQuery }: FilterProps): ReactElement {
  return (
    <input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={german ? 'Fraktionen suchen…' : 'Search factions…'}
      aria-label={german ? 'Fraktionen suchen' : 'Search factions'}
    />
  );
}

function EditionField({ german, edition, setEdition }: FilterProps): ReactElement {
  return (
    <select
      value={edition}
      onChange={(event) => setEdition(event.target.value)}
      aria-label={german ? 'Fraktionsedition' : 'Faction edition'}
    >
      <option value="all">{german ? 'Alle Editionen' : 'All editions'}</option>
      {Object.entries(EDITION_NAMES).map(([id, name]) => (
        <option value={id} key={id}>
          {id === 'base' && !german ? 'Base game' : name}
        </option>
      ))}
    </select>
  );
}

/** Search and edition filters share the same catalog in multiplayer and the simulator. */
export function FactionBrowser({ children }: BrowserProps): ReactElement {
  const language = useLanguage();
  const [query, setQuery] = useState('');
  const [edition, setEdition] = useState('all');
  const needle = query.toLocaleLowerCase().trim();
  const shown = TI4_FACTIONS.filter(({ id }) => matches(id, needle, edition));
  const filters = { german: language === 'de', query, edition, setQuery, setEdition };
  return (
    <>
      <div className="ti4-faction-filters">
        <SearchField {...filters} />
        <EditionField {...filters} />
      </div>
      <p className="ti4-faction-count" role="status">
        {shown.length} / {TI4_FACTIONS.length} {language === 'de' ? 'Fraktionen' : 'factions'}
      </p>
      <div
        className="faction-grid"
        role="radiogroup"
        aria-label={language === 'de' ? 'Fraktion' : 'Faction'}
      >
        {shown.map(({ id }) => children(id))}
      </div>
      {shown.length === 0 && <EmptyResults german={language === 'de'} />}
    </>
  );
}

function matches(id: string, needle: string, edition: string): boolean {
  const metadata = TI4_FACTION_METADATA[id];
  const name = FACTION_NAMES[id];
  const search = `${name?.de ?? ''} ${name?.en ?? ''} ${id}`.toLocaleLowerCase();
  return (edition === 'all' || metadata?.edition === edition) && search.includes(needle);
}
