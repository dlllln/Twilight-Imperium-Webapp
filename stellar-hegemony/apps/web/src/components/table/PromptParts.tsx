import { type GameState, warfareTokenSystems } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import type { Language } from '../../i18n.ts';
import { objectiveLabel, systemLabel } from '../../labels.ts';
import { payHintOf } from '../../table/planet-table.ts';
import type {
  ObjectivePlan,
  PlacementPlan,
  Progress,
  TableDraft,
  TokenPlan,
} from '../../table/table-specs.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { SystemSelect } from '../game/FormParts.tsx';
import { PHASE_TITLE } from '../game/TurnPanel.tsx';
import { ConfirmSeal } from './ConfirmSeal.tsx';

/*
 * Bausteine der Ansage: Kopf, Messleiste je Art des Entwurfs, Systemwahl der Kriegsführung und
 * die Knöpfe unten. Marker, Planeten und Münzen liegen auf dem Pult, Aufträge auf der
 * Auftragsleiste; hier steht nur, was dort fehlt.
 */

export interface PartProps {
  readonly game: GameState;
  readonly decision: TableDecision;
}

type Translate = ReturnType<typeof useT>;

/** Taktische Schritte: „Aktiviertes System: …“; ohne Spielstand (Live-Zeile) keiner. */
function activeSystemOf(game: GameState | null, t: Translate, language: Language): string | null {
  const system = game?.actionPhase?.tactical?.system;
  if (game === null || system == null) return null;
  return `${t('activeSystem')}: ${systemLabel(game, system, language)}`;
}

/**
 * Was die Entscheidung betrifft: Markerverteilung, aktiviertes System oder Kartenname
 * (sekundär mit Vorsilbe).
 */
export function subtitleOf(
  decision: TableDecision,
  t: Translate,
  language: Language,
  game: GameState | null = null,
): string | null {
  const { route, specId } = decision;
  if (route.kind === 'tactical') return activeSystemOf(game, t, language);
  if (specId === 'tokens') return t('allocateTokens');
  if (specId === 'scoring') return t('scoreObjectives');
  if (route.card === null) return null;
  const name = cardText(route.card).name[language];
  return route.ability === 'secondary' ? `${t('secondaryPrompt')}: ${name}` : name;
}

/**
 * Zweite Zeile des Kopfs; die alten Formulare bringen ihren Kartennamen (und das aktivierte
 * System) selbst mit.
 */
function useSubtitle(game: GameState, decision: TableDecision): string | null {
  const t = useT();
  const language = useLanguage();
  return decision.specId === null ? null : subtitleOf(decision, t, language, game);
}

export function PromptHead({ game, decision }: PartProps): ReactElement {
  const t = useT();
  const subtitle = useSubtitle(game, decision);
  return (
    <header className="table-prompt-head">
      <h2>{t(PHASE_TITLE[game.phase])}</h2>
      {subtitle !== null && <h3>{subtitle}</h3>}
    </header>
  );
}

/** Die Messleiste ist eine Live-Region: Bildschirmleser hören jede Änderung. Leer bleibt sie weg. */
function MeterLine({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <p className="table-prompt-meter" aria-live="polite" aria-atomic="true">
      {children}
    </p>
  );
}

interface MeterProps {
  readonly needed: number;
  readonly plan: TokenPlan;
  readonly warfare: boolean;
  /** Führung: Wert der Bezahlung in Einfluss laut Domain; sonst `null`. */
  readonly paid: number | null;
}

/**
 * Erhaltene (bei der Kriegsführung von der Karte genommene) Marker und was davon noch in der
 * Schale liegt, bei der Führung dazu der bezahlte Einfluss. Auch Plus und Minus an den Leisten
 * ändern die Zeile.
 */
export function PromptMeter({ needed, plan, warfare, paid }: MeterProps): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      {needed > 0 && (
        <>
          <span>
            {t(warfare ? 'tokensTaken' : 'tokensGained')}:{' '}
            <strong data-testid="tokens-gained">{needed}</strong>
          </span>
          {' · '}
          <span>
            {t('toDistribute')}: <strong data-testid="free-tokens">{plan.pools.loose}</strong>
          </span>
        </>
      )}
      {paid !== null && (
        <span>
          {t('influence')}: <strong data-testid="paid">{paid}</strong>
        </span>
      )}
    </MeterLine>
  );
}

interface ObjectiveMeterProps {
  readonly plan: ObjectivePlan;
  readonly progress: Progress;
}

/** Wertung und Imperium: der gewählte Auftrag und bei Ausgaben „bezahlt / benötigt“. */
function ObjectiveMeter({ plan, progress }: ObjectiveMeterProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { objective, payment } = plan;
  return (
    <MeterLine>
      {objective !== null && (
        <span className="table-prompt-chosen">
          {t('chosenObjective')}: <strong>{objectiveLabel(objective, language)}</strong>
        </span>
      )}
      {payment !== null && (
        <span>
          {t(payment.currency)}: <strong data-testid="paid">{progress.done}</strong> /{' '}
          {progress.needed}
        </span>
      )}
    </MeterLine>
  );
}

/** Diplomatie sekundär: vorgemerkte Planeten / erlaubte Anzahl. */
function ReadyMeter({ progress }: { readonly progress: Progress }): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      <span>
        {t('planetsToReady')}: <strong data-testid="ready-count">{progress.done}</strong> /{' '}
        {progress.needed}
      </span>
    </MeterLine>
  );
}

/** Bombardement und Landung: zugewiesene Figuren, bei der Thronwelt dazu „bezahlt / benötigt“. */
function PlacementMeter(props: {
  readonly plan: PlacementPlan;
  readonly progress: Progress;
  readonly units: number;
}): ReactElement {
  const t = useT();
  const { plan, progress, units } = props;
  return (
    <MeterLine>
      <span>
        {t('assignedUnits')}:{' '}
        <strong data-testid="assigned-count">{Object.keys(plan.assignments).length}</strong> /{' '}
        {units}
      </span>
      {plan.payment !== null && (
        <span>
          {t('influence')}: <strong data-testid="paid">{progress.done}</strong> / {progress.needed}
        </span>
      )}
    </MeterLine>
  );
}

/** Infrastruktur: gesetzte Gebäude / erlaubte Anzahl; ohne Bauplatz bleibt die Leiste leer. */
function BuildMeter({ progress }: { readonly progress: Progress }): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      {progress.needed > 0 && (
        <span>
          {t('placedStructures')}: <strong data-testid="placed-count">{progress.done}</strong> /{' '}
          {progress.needed}
        </span>
      )}
    </MeterLine>
  );
}

/** Führung: der bezahlte Einfluss für die Messleiste; sonst keiner. */
const leadershipPaid = (decision: TableDecision): number | null =>
  decision.specId === 'leadership' ? (decision.planets?.paid ?? null) : null;

interface DraftMeterProps {
  readonly decision: TableDecision;
  readonly draft: TableDraft;
  readonly progress: Progress;
}

/** Figuren der Entscheidung (ohne Gebäude): so viele lassen sich zuweisen. */
const unitCount = (decision: TableDecision): number =>
  decision.pieces.filter((piece) => piece.ref.kind === 'unit').length;

function DraftMeter({ decision, draft, progress }: DraftMeterProps): ReactElement | null {
  if (draft.kind === 'objective') return <ObjectiveMeter plan={draft} progress={progress} />;
  if (draft.kind === 'ready') return <ReadyMeter progress={progress} />;
  if (draft.kind === 'construction') return <BuildMeter progress={progress} />;
  if (draft.kind === 'placement')
    return <PlacementMeter plan={draft} progress={progress} units={unitCount(decision)} />;
  if (draft.kind !== 'tokens') return null;
  const warfare = decision.specId === 'warfare';
  const paid = leadershipPaid(decision);
  return <PromptMeter needed={progress.needed} plan={draft} warfare={warfare} paid={paid} />;
}

/** Die Messleiste passend zur Art des Entwurfs. */
export function PromptProgress({ decision }: { readonly decision: TableDecision }) {
  const { draft, progress } = decision;
  if (draft === null || progress === null) return null;
  return <DraftMeter decision={decision} draft={draft} progress={progress} />;
}

/** Eine Bezahlung ist offen: Ausgabe-Auftrag oder Landung auf der Thronwelt. */
const paying = (draft: TableDraft | null): boolean =>
  (draft?.kind === 'objective' || draft?.kind === 'placement') && draft.payment !== null;

/** Solange eine Bezahlung offen ist: wo bezahlt wird (Planetenreihe, Karte, Kasse). */
export function PromptPayHint({ decision }: { readonly decision: TableDecision }) {
  const t = useT();
  if (!paying(decision.draft)) return null;
  return (
    <p className="hint table-prompt-pay">{t(payHintOf(decision.planets?.ownTradeGoods ?? 0))}</p>
  );
}

/** Kriegsführung: der Weg per Tastatur zum Marker auf der Karte (dort leuchten dieselben Systeme). */
export function PromptWarfare({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const { route, specId, draft } = decision;
  const systems = route.actor === null ? [] : warfareTokenSystems(game, route.actor);
  if (specId !== 'warfare' || draft?.kind !== 'tokens' || systems.length === 0) return null;
  return (
    <SystemSelect
      game={game}
      label={t('takeBackToken')}
      options={systems}
      value={draft.system}
      none="—"
      onChange={(system) => {
        if (system !== null) decision.act({ kind: 'system', system });
      }}
    />
  );
}

/** Unten: der Ausweg (Ablehnen, Zurück) und das Siegel mit der bekannten Beschriftung. */
export function PromptActions({ decision }: { readonly decision: TableDecision }): ReactElement {
  const t = useT();
  const { alternative, confirmLabel, progress } = decision;
  return (
    <div className="table-prompt-actions">
      {alternative !== null && (
        <button type="button" className="table-prompt-alt" onClick={alternative.run}>
          {t(alternative.label)}
        </button>
      )}
      {confirmLabel !== null && (
        <ConfirmSeal
          label={confirmLabel}
          ready={progress?.ready ?? false}
          onConfirm={decision.confirm}
        />
      )}
    </div>
  );
}
