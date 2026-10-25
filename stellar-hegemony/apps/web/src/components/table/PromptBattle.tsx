import type { GameState, SystemId } from '@stellar/domain';
import type { ReactElement } from 'react';
import { systemLabel } from '../../labels.ts';
import type { OutcomePlan, Progress, SystemPlan, VotePlan } from '../../table/table-specs.ts';
import { parseTargetKey } from '../../table/target-ref.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { outcomeLabel } from '../agenda/outcome-label.ts';
import { MeterLine } from './PromptMeters.tsx';
import type { PartProps } from './PromptParts.tsx';

/*
 * Bausteine der Ansage für Kampfmatte und Agendatisch: Messleisten (Trefferstifte, Stimmen,
 * gewählte Platte, Rückzugsziel) und die Knöpfe „Rückzug nach …“ als Weg ohne Karte. Stifte,
 * Schiffe, Platten und Planeten liegen auf dem Tisch; hier steht nur, was dort fehlt.
 */

/** Kampfmatte: gelegte Trefferstifte / verlangte Treffer. */
export function HitMeter({ progress }: { readonly progress: Progress }): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      <span>
        {t('hitPegs')}: <strong data-testid="hit-count">{progress.done}</strong> / {progress.needed}
      </span>
    </MeterLine>
  );
}

/** Der Name einer Platte; ohne Wahl ein Strich. */
function OutcomeName(props: { readonly game: GameState; readonly outcome: string | null }) {
  const t = useT();
  const language = useLanguage();
  if (props.outcome === null) return <>—</>;
  return <strong>{outcomeLabel(props.game, props.outcome, language, t)}</strong>;
}

/** Abstimmung: Stimmen der angetippten Planeten (mit Gesetzen) und die gewählte Platte. */
export function VoteMeter(props: {
  readonly game: GameState;
  readonly plan: VotePlan;
  readonly progress: Progress;
}): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      <span>
        {t('votesOf')}: <strong data-testid="vote-total">{props.progress.done}</strong>
      </span>
      {' · '}
      <span className="table-prompt-chosen" data-testid="vote-outcome">
        {t('outcomePlate')}: <OutcomeName game={props.game} outcome={props.plan.outcome} />
      </span>
    </MeterLine>
  );
}

/** Gleichstand: die Platte, für die sich der Sprecher entscheidet. */
export function TieMeter(props: {
  readonly game: GameState;
  readonly plan: OutcomePlan;
}): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      <span className="table-prompt-chosen" data-testid="tie-outcome">
        {t('outcomePlate')}: <OutcomeName game={props.game} outcome={props.plan.outcome} />
      </span>
    </MeterLine>
  );
}

/** Rückzug: das vorgemerkte Ziel; ohne Ziel bleibt die Leiste leer (das Siegel kämpft weiter). */
export function RetreatMeter(props: {
  readonly game: GameState;
  readonly plan: SystemPlan;
}): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const { system } = props.plan;
  if (system === null) return null;
  return (
    <MeterLine>
      <span className="table-prompt-chosen" data-testid="retreat-target">
        {t('retreatTo')}: <strong>{systemLabel(props.game, system, language)}</strong>
      </span>
    </MeterLine>
  );
}

/** Die erlaubten Rückzugsziele der Entscheidung, in der Reihenfolge der Domain. */
const retreatSystems = (decision: TableDecision): readonly SystemId[] =>
  [...decision.targets.keys()].flatMap((key) => {
    const ref = parseTargetKey(key);
    return ref?.kind === 'system' ? [ref.id] : [];
  });

/**
 * Rückzug ohne Karte: je erlaubtem System ein Schalter „Rückzug nach …“; er merkt das System vor
 * wie ein Antippen des leuchtenden Felds.
 */
export function RetreatPick({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  if (decision.specId !== 'retreat' || decision.draft?.kind !== 'system') return null;
  const chosen = decision.draft.system;
  return (
    <div className="retreat-pick" role="group" aria-label={t('retreatHeading')}>
      {retreatSystems(decision).map((system) => (
        <button
          key={system}
          type="button"
          className="retreat-pick-option"
          aria-pressed={system === chosen}
          onClick={() => decision.act({ kind: 'system', system })}
        >
          {t('retreatTo')} {systemLabel(game, system, language)}
        </button>
      ))}
    </div>
  );
}
