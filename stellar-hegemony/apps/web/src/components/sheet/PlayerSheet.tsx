import type { GameState } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { zoneCounts } from '../../hud/token-ledger.ts';
import { useSheetModel, useSheetPulse, useTokenLedger } from '../../hud/use-sheet.ts';
import { seatColor } from '../../seat-colors.ts';
import { useT } from '../../use-translation.ts';
import { CommandWing } from './CommandWing.tsx';
import { SheetDefs } from './SheetTokens.tsx';
import { TreasuryWing } from './TreasuryWing.tsx';

/**
 * Das eigene Kommandopult am unteren Rand, wie eine Spielertafel vor dem eigenen Platz:
 * links die Kommandomarker, rechts die Schatzkammer, dazwischen die Mulde für die Hand.
 */
export function PlayerSheet({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const model = useSheetModel(game);
  const ledger = useTokenLedger(zoneCounts(model));
  const pulse = useSheetPulse(model);
  if (model === null) return null;
  return (
    <section
      className="player-sheet"
      aria-label={t('playerSheet')}
      data-tutorial="resources"
      style={{ '--seat': seatColor(model.seat) } as CSSProperties}
    >
      <SheetDefs />
      <CommandWing model={model} ledger={ledger} pulse={pulse} />
      <div className="sheet-well" aria-hidden="true">
        <span className="sheet-well-label">{t('sheetWell')}</span>
      </div>
      <TreasuryWing model={model} pulse={pulse} />
    </section>
  );
}
