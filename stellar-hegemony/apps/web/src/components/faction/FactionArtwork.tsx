import type { ReactElement } from 'react';
import { factionArtwork } from '../../artwork/factions.ts';
import '../../artwork/factions.css';
import { useLanguage } from '../../use-translation.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';

/** Illustration on the back of the original faction sheet. */
export function FactionPortrait({ id }: { readonly id: string }): ReactElement | null {
  const artwork = factionArtwork(id);
  const language = useLanguage();
  if (artwork === undefined) return null;
  return (
    <div className="ti4-faction-portrait">
      <img
        className="ti4-faction-illustration"
        src={artwork.illustration}
        alt={artwork.name[language]}
      />
      <FactionEmblem id={id} size={60} />
    </div>
  );
}

/** View the actual components without replacing the app's playable faction rules. */
export function FactionOriginalSheets({ id }: { readonly id: string }): ReactElement | null {
  const artwork = factionArtwork(id);
  const language = useLanguage();
  if (artwork === undefined) return null;
  const german = language === 'de';
  return (
    <details className="ti4-faction-sheets">
      <summary>{german ? 'Original-Fraktion ansehen' : 'View original faction'}</summary>
      <OriginalRulesNote />
      <div className="ti4-faction-sheet-grid">
        <SheetLink
          image={artwork.sheet}
          name={artwork.name[language]}
          side={german ? 'Vorderseite' : 'Front'}
        />
        <SheetLink
          image={artwork.illustration}
          name={artwork.name[language]}
          side={german ? 'Rückseite' : 'Back'}
        />
      </div>
      <OriginalCredit source={artwork.source} />
    </details>
  );
}

function OriginalRulesNote(): ReactElement {
  const language = useLanguage();
  return (
    <p>
      {language === 'de'
        ? 'Im Spiel gelten die oben angezeigten angepassten Fähigkeiten und Startwerte.'
        : 'The game uses the adapted abilities and starting values shown above.'}
    </p>
  );
}

function OriginalCredit({ source }: { readonly source: string }): ReactElement {
  const language = useLanguage();
  return (
    <p className="ti4-faction-credit">
      Twilight Imperium © Fantasy Flight Games ·{' '}
      <a href={source} target="_blank" rel="noreferrer">
        {language === 'de' ? 'Bildquelle' : 'Image source'}
      </a>
    </p>
  );
}

function SheetLink({
  image,
  name,
  side,
}: {
  readonly image: string;
  readonly name: string;
  readonly side: string;
}): ReactElement {
  return (
    <a href={image} target="_blank" rel="noreferrer">
      <img src={image} alt={`${name} · ${side}`} loading="lazy" />
      <span>{side}</span>
    </a>
  );
}
