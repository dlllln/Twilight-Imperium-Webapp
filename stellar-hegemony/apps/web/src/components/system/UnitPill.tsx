import type { ReactElement } from 'react';
import { unitLabel } from '../../labels.ts';
import { unitImage } from '../../render/images.ts';
import type { UnitCount } from '../../render/scene-model.ts';
import { useLanguage } from '../../use-translation.ts';

/** Kleine Miniatur mit Anzahl, z. B. „▶ 3 Kreuzer“. */
export function UnitPill({ unit }: { readonly unit: UnitCount }): ReactElement {
  const language = useLanguage();
  const image = unitImage(unit.type, unit.seat);
  const name = unitLabel(unit.type, language);
  return (
    <span className="unit-pill" title={name}>
      {image !== null && <img src={image} alt="" />}
      <strong>{unit.count}</strong> {name}
    </span>
  );
}
