import type { GameState } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { zoneCounts } from '../../hud/token-ledger.ts';
import {
  poolPlanOf,
  useSheetModel,
  useSheetPulse,
  useSheetTable,
  useTokenLedger,
} from '../../hud/use-sheet.ts';
import { seatColor } from '../../seat-colors.ts';
import { useCarryReset } from '../../table/carry-store.ts';
import { useT } from '../../use-translation.ts';
import { CarryAnnouncer } from '../table/CarryAnnouncer.tsx';
import { DragGhost } from '../table/DragGhost.tsx';
import { CommandWing } from './CommandWing.tsx';
import { PlanetRow } from './PlanetRow.tsx';
import { SheetDefs } from './SheetTokens.tsx';
import { TreasuryWing } from './TreasuryWing.tsx';

/**
 * Das eigene Kommandopult am unteren Rand, wie eine Spielertafel vor dem eigenen Platz:
 * links die Kommandomarker, rechts die Schatzkammer, dazwischen die Mulde für die Hand. Über
 * der Schatzkammer liegen die eigenen Planeten als Karten (die Planetenreihe mit der Kasse).
 * Die Marker sind Spielsteine: Während einer Verteilung zeigt das Pult den Entwurf, sonst lässt
 * sich der Taktikmarker auf ein System tragen. Eine neue Entscheidung legt ein getragenes Stück
 * zurück.
 */
export function PlayerSheet({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const model = useSheetModel(game);
  const table = useSheetTable(game);
  useCarryReset(`${table.decision?.route.key ?? ''}@${String(game.version)}`);
  const ledger = useTokenLedger(zoneCounts(model, poolPlanOf(table)));
  const pulse = useSheetPulse(model);
  if (model === null) return null;
  const seat = seatColor(model.seat);
  return (
    <section
      className="player-sheet"
      aria-label={t('playerSheet')}
      data-tutorial="resources"
      style={{ '--seat': seat } as CSSProperties}
    >
      <SheetDefs />
      <CommandWing model={model} ledger={ledger} pulse={pulse} table={table} />
      <div className="sheet-well" aria-hidden="true">
        <span className="sheet-well-label">{t('sheetWell')}</span>
      </div>
      <TreasuryWing game={game} model={model} pulse={pulse} table={table} />
      <PlanetRow game={game} table={table} />
      <DragGhost faction={model.faction} seat={seat} />
      <CarryAnnouncer game={game} />
    </section>
  );
}
