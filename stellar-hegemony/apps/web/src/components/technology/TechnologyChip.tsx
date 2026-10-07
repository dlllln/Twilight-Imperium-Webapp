import type { TechnologyDefinition } from '@stellar/domain';
import type { ReactElement } from 'react';
import { technologyEffectText, technologyLabel } from '../../labels.ts';
import { useLanguage, useT } from '../../use-translation.ts';

/** Farbiges Kärtchen einer Technologie; Aufwertungen haben keine Farbe (RR 80.7). */
export function TechnologyChip({
  technology,
}: {
  readonly technology: TechnologyDefinition;
}): ReactElement {
  const language = useLanguage();
  return (
    <span
      className={`tech-chip tech-${technology.color ?? 'upgrade'}`}
      title={technologyEffectText(technology.id, language)}
    >
      {technologyLabel(technology.id, language)}
    </span>
  );
}

/** Voraussetzungen als farbige Punkte, die fehlenden hervorgehoben. */
export function Prerequisites({
  technology,
  missing,
}: {
  readonly technology: TechnologyDefinition;
  readonly missing: readonly string[];
}): ReactElement {
  const t = useT();
  const open = [...missing];
  return (
    <span className="prerequisites" aria-label={t('prerequisites')}>
      {technology.prerequisites.map((color, index) => {
        const lacking = open.includes(color);
        if (lacking) open.splice(open.indexOf(color), 1);
        return (
          <span
            key={`${color}-${String(index)}`}
            className={`tech-dot tech-${color}${lacking ? ' missing' : ''}`}
            title={t(color)}
          />
        );
      })}
    </span>
  );
}
