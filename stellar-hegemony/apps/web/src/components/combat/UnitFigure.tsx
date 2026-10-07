import { findPlayer, type GameState, type Unit } from '@stellar/domain';
import type { ReactElement } from 'react';
import { unitLabel } from '../../labels.ts';
import { unitImage } from '../../render/images.ts';
import { useLanguage, useT } from '../../use-translation.ts';

/** Miniatur einer Einheit mit Namen; beschädigte Einheiten sind markiert. */
export function UnitFigure({
  game,
  unit,
}: {
  readonly game: GameState;
  readonly unit: Unit;
}): ReactElement {
  const t = useT();
  const language = useLanguage();
  const seat = (findPlayer(game, unit.owner)?.seat ?? 0) + 1;
  const image = unitImage(unit.type, seat);
  const name = unitLabel(unit.type, language);
  return (
    <figure className={unit.damaged ? 'unit-figure damaged' : 'unit-figure'} data-unit={unit.id}>
      {image === null ? <span className="unit-glyph" /> : <img src={image} alt="" />}
      <figcaption>
        {name}
        {unit.damaged && <span className="damage-mark"> · {t('damaged')}</span>}
      </figcaption>
    </figure>
  );
}
