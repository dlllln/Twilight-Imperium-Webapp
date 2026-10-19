import { canExploreFrontier, diplomacySystems, type StructurePlacement } from '@stellar/domain';
import { X } from 'lucide-react';
import { type ReactElement, useEffect, useRef } from 'react';
import { planetLabel, unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { structureTarget, targetKey } from '../../table/target-ref.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { SystemSelect } from '../game/FormParts.tsx';
import { TransactionForm } from '../game/TransactionForm.tsx';
import type { PartProps } from './PromptParts.tsx';

/*
 * Bausteine der Ansage für die taktische Aktion und die Strategiekarten mit Zielen auf der Karte:
 * Systemwahl der Diplomatie als Tastaturweg, gesetzte Gebäude zum Zurücknehmen, der Abschlusssatz
 * der taktischen Aktion und der Handel, der während der ganzen taktischen Aktion offen bleibt.
 */

/** Diplomatie primär: dieselben Systeme, die auf der Karte leuchten, als Auswahlliste. */
export function DiplomacyPick({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const { route, specId, draft } = decision;
  const systems = route.actor === null ? [] : diplomacySystems(game, route.actor, content.tiles);
  if (specId !== 'diplomacyPrimary' || draft?.kind !== 'system' || systems.length === 0)
    return null;
  return (
    <SystemSelect
      game={game}
      label={t('chooseSystem')}
      options={systems}
      value={draft.system}
      onChange={(system) => {
        if (system !== null) decision.act({ kind: 'system', system });
      }}
    />
  );
}

interface ChipProps {
  readonly placement: StructurePlacement;
  readonly index: number;
  readonly onRemove: () => void;
}

/** Ein gesetztes Gebäude: Antippen nimmt es zurück in den Bauvorrat. */
function PlacementChip({ placement, index, onRemove }: ChipProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const structure = unitLabel(placement.type, language);
  const planet = planetLabel(placement.planet, language);
  const label = t('removePlacement').replace('{structure}', structure).replace('{planet}', planet);
  return (
    <button
      type="button"
      className="placement-chip"
      aria-label={label}
      data-placement={index}
      onClick={onRemove}
    >
      <span>{structure}</span>
      <span className="placement-chip-planet">{planet}</span>
      <X aria-hidden="true" size={12} strokeWidth={2.5} />
    </button>
  );
}

/** Was zuletzt zurückgenommen wurde: Stelle in der Liste und Gebäudeart. */
interface Unplaced {
  readonly index: number;
  readonly type: StructurePlacement['type'];
}

const chipAt = (index: number): HTMLElement | null =>
  document.querySelector<HTMLElement>(`.placement-list [data-placement="${String(index)}"]`);

/**
 * Nach dem Zurücknehmen landet der Fokus nie im Leeren: auf der Plakette, die nachrückt, sonst
 * der davor, sonst dem Gebäude im Bauvorrat, sonst dem Siegel (wie nach dem Ablegen).
 */
function focusAfterUnplace({ index, type }: Unplaced): void {
  const piece = `[data-piece="${targetKey(structureTarget(type))}"]`;
  const next =
    chipAt(index) ??
    chipAt(index - 1) ??
    document.querySelector<HTMLElement>(piece) ??
    document.querySelector<HTMLElement>('[data-testid="confirm"]:not(:disabled)');
  next?.focus();
}

/** Merkt sich das Zurücknehmen und setzt den Fokus, sobald die Liste neu gezeichnet ist. */
function useUnplaceFocus(): (unplaced: Unplaced) => void {
  const pending = useRef<Unplaced | null>(null);
  useEffect(() => {
    if (pending.current === null) return;
    focusAfterUnplace(pending.current);
    pending.current = null;
  });
  return (unplaced) => {
    pending.current = unplaced;
  };
}

/** Schlüssel ohne Listenstelle: Planet, Art und wievielte gleiche Plakette. */
function chipKeys(placements: readonly StructurePlacement[]): readonly string[] {
  const seen = new Map<string, number>();
  return placements.map(({ planet, type }) => {
    const base = `${planet}-${type}`;
    const nth = (seen.get(base) ?? 0) + 1;
    seen.set(base, nth);
    return `${base}-${String(nth)}`;
  });
}

/** Infrastruktur: die vorgemerkten Gebäude in ihrer Reihenfolge. */
export function PlacementList({ decision }: PartProps): ReactElement | null {
  const t = useT();
  const remember = useUnplaceFocus();
  const { draft } = decision;
  if (draft?.kind !== 'construction' || draft.placements.length === 0) return null;
  const keys = chipKeys(draft.placements);
  const remove = (index: number, placement: StructurePlacement) => {
    remember({ index, type: placement.type });
    decision.act({ kind: 'unplace', index });
  };
  return (
    <ul className="placement-list" aria-label={t('placedStructures')}>
      {draft.placements.map((placement, index) => (
        <li key={keys[index]}>
          <PlacementChip
            placement={placement}
            index={index}
            onRemove={() => remove(index, placement)}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Ende der taktischen Aktion: der bekannte Satz als einzige Hinweiszeile (statt des Hinweises
 * der Entscheidung), dazu der Hinweis auf den Grenzmarker, solange er sich noch erkunden lässt.
 */
export function DoneLine({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const { route, specId } = decision;
  if (specId !== 'tacticalDone' || route.actor === null) return null;
  const explore = canExploreFrontier(game, route.actor, content);
  return (
    <>
      <p className="hint table-prompt-hint">{t('tacticalDone')}</p>
      {explore && <p className="hint table-prompt-explore">{t('tableHintExplore')}</p>}
    </>
  );
}

/** Handeln (RR 82) bleibt während jeder am Tisch gespielten taktischen Aktion erreichbar. */
export function TradeCorner({ game, decision }: PartProps): ReactElement | null {
  const { route, specId } = decision;
  if (route.kind !== 'tactical' || specId === null || route.actor === null) return null;
  return (
    <div className="table-prompt-trade">
      <TransactionForm game={game} player={route.actor} />
    </div>
  );
}
