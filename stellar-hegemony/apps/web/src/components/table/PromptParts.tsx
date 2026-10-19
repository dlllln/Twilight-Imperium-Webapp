import { type GameState, warfareTokenSystems } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import type { Language, MessageKey } from '../../i18n.ts';
import { objectiveLabel, systemLabel } from '../../labels.ts';
import { payHintOf } from '../../table/planet-table.ts';
import type {
  DiscardPlan,
  ObjectivePlan,
  PlacementPlan,
  PlayersPlan,
  Progress,
  TableDraft,
  TableSpecId,
  TokenPlan,
} from '../../table/table-specs.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { SystemSelect } from '../game/FormParts.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
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

/** Entscheidungen, die statt eines Kartennamens ihre Tätigkeit als zweite Zeile tragen. */
const SPEC_TITLES: Partial<Record<TableSpecId, MessageKey>> = {
  tokens: 'allocateTokens',
  scoring: 'scoreObjectives',
  discard: 'discardCards',
  reaction: 'reaction',
};

/**
 * Was die Entscheidung betrifft: Markerverteilung, Wertung, Ablegen, Reaktion, aktiviertes
 * System oder Kartenname (sekundär mit Vorsilbe).
 */
export function subtitleOf(
  decision: TableDecision,
  t: Translate,
  language: Language,
  game: GameState | null = null,
): string | null {
  const { route, specId } = decision;
  const titled = specId === null ? undefined : SPEC_TITLES[specId];
  if (route.kind === 'tactical') return activeSystemOf(game, t, language);
  if (titled !== undefined) return t(titled);
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
  readonly game: GameState;
  readonly decision: TableDecision;
  readonly draft: TableDraft;
  readonly progress: Progress;
}

/** Ablegen: vorgemerkte Karten / so viele müssen weg. */
function DiscardMeter({ progress }: { readonly progress: Progress }): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      <span>
        {t('toDiscard')}: <strong data-testid="discard-count">{progress.done}</strong> /{' '}
        {progress.needed}
      </span>
    </MeterLine>
  );
}

/** Die gewählten Mitspieler mit ihrer Platzfarbe, durch Kommas getrennt; keiner: Strich. */
function PlayerNames({ game, plan }: { readonly game: GameState; readonly plan: PlayersPlan }) {
  if (plan.players.length === 0) return <>—</>;
  return (
    <>
      {plan.players.map((id, index) => (
        <span key={id}>
          {index > 0 && ', '}
          <PlayerTag game={game} id={id} />
        </span>
      ))}
    </>
  );
}

/** Politik: der neue Sprecher; Handel: wer einen Freibrief hält. */
function PlayersMeter(props: {
  readonly game: GameState;
  readonly plan: PlayersPlan;
  readonly politics: boolean;
}): ReactElement {
  const t = useT();
  return (
    <MeterLine>
      <span className="table-prompt-chosen" data-testid="chosen-players">
        {t(props.politics ? 'chooseSpeaker' : 'freeLetter')}:{' '}
        <PlayerNames game={props.game} plan={props.plan} />
      </span>
    </MeterLine>
  );
}

/** Messleisten der Hand und der Menschen am Tisch: Ablegen, Politik, Handel. */
function PeopleMeter(props: DraftMeterProps & { readonly draft: DiscardPlan | PlayersPlan }) {
  const { game, decision, draft, progress } = props;
  if (draft.kind === 'discard') return <DiscardMeter progress={progress} />;
  return <PlayersMeter game={game} plan={draft} politics={decision.specId === 'politics'} />;
}

const isPeople = (draft: TableDraft): draft is DiscardPlan | PlayersPlan =>
  draft.kind === 'discard' || draft.kind === 'players';

/** Figuren der Entscheidung (ohne Gebäude): so viele lassen sich zuweisen. */
const unitCount = (decision: TableDecision): number =>
  decision.pieces.filter((piece) => piece.ref.kind === 'unit').length;

function DraftMeter(props: DraftMeterProps): ReactElement | null {
  const { decision, draft, progress } = props;
  if (isPeople(draft)) return <PeopleMeter {...props} draft={draft} />;
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
export function PromptProgress({ game, decision }: PartProps) {
  const { draft, progress } = decision;
  if (draft === null || progress === null) return null;
  return <DraftMeter game={game} decision={decision} draft={draft} progress={progress} />;
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
