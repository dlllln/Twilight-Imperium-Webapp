import type { ReactElement } from 'react';
import { UnitArtwork } from '../../artwork/UnitArtwork.tsx';
import { unitLabel } from '../../labels.ts';
import type { UnitCount } from '../../render/scene-model.ts';
import { useLanguage } from '../../use-translation.ts';

/** Kleine Miniatur mit Anzahl, z. B. „▶ 3 Kreuzer“. */
export function UnitPill({ unit }: { readonly unit: UnitCount }): ReactElement {
  const language = useLanguage();
  const name = unitLabel(unit.type, language);
  return (
    <span className="unit-pill" title={name}>
      <UnitArtwork type={unit.type} seat={unit.seat} />
      <strong>{unit.count}</strong> {name}
    </span>
  );
}
