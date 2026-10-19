import { type GameState, warfareTokenSystems } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import type { Language } from '../../i18n.ts';
import { objectiveLabel } from '../../labels.ts';
import type { ObjectivePlan, Progress, TokenPlan } from '../../table/table-specs.ts';
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

/** Was die Entscheidung betrifft: Markerverteilung oder Kartenname (sekundär mit Vorsilbe). */
export function subtitleOf(
  decision: TableDecision,
  t: Translate,
  language: Language,
): string | null {
  const { route, specId } = decision;
  if (specId === 'tokens') return t('allocateTokens');
  if (specId === 'scoring') return t('scoreObjectives');
  if (route.card === null) return null;
  const name = cardText(route.card).name[language];
  return route.ability === 'secondary' ? `${t('secondaryPrompt')}: ${name}` : name;
}

/** Zweite Zeile des Kopfs; die alten Formulare bringen ihren Kartennamen selbst mit. */
function useSubtitle(decision: TableDecision): string | null {
  const t = useT();
  const language = useLanguage();
  return decision.specId === null ? null : subtitleOf(decision, t, language);
}

export function PromptHead({ game, decision }: PartProps): ReactElement {
  const t = useT();
  const subtitle = useSubtitle(decision);
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

/** Die Messleiste passend zur Art des Entwurfs. */
export function PromptProgress({ decision }: { readonly decision: TableDecision }) {
  const { draft, progress, specId } = decision;
  if (draft === null || progress === null) return null;
  if (draft.kind === 'objective') return <ObjectiveMeter plan={draft} progress={progress} />;
  if (draft.kind === 'ready') return <ReadyMeter progress={progress} />;
  const paid = specId === 'leadership' ? (decision.planets?.paid ?? null) : null;
  return (
    <PromptMeter needed={progress.needed} plan={draft} warfare={specId === 'warfare'} paid={paid} />
  );
}

/** Solange eine Bezahlung offen ist: wo bezahlt wird (Planetenreihe, Karte, Kasse). */
export function PromptPayHint({ decision }: { readonly decision: TableDecision }) {
  const t = useT();
  const { draft } = decision;
  if (draft?.kind !== 'objective' || draft.payment === null) return null;
  return <p className="hint table-prompt-pay">{t('payOnTable')}</p>;
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
