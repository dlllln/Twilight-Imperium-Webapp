import { type GameState, warfareTokenSystems } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { Language, MessageKey } from '../../i18n.ts';
import { objectiveLabel, systemLabel } from '../../labels.ts';
import { payHintOf } from '../../table/planet-table.ts';
import { shipyardOf } from '../../table/shipyard.ts';
import { researchSpreadOf } from '../../table/spec-research.ts';
import type {
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
import { HitMeter, RetreatMeter, TieMeter, VoteMeter } from './PromptBattle.tsx';
import { MeterLine, ProductionMeter, ResearchMeter } from './PromptMeters.tsx';

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
  hits: 'assignHits',
  retreat: 'retreatHeading',
  vote: 'voteHeading',
  tieBreak: 'tieBreak',
};

/**
 * Was die Entscheidung betrifft: Markerverteilung, Wertung, Ablegen, Reaktion, Treffer, Rückzug,
 * Abstimmung, Gleichstand, aktiviertes System oder Kartenname (sekundär mit Vorsilbe).
 */
export function subtitleOf(
  decision: TableDecision,
  t: Translate,
  language: Language,
  game: GameState | null = null,
): string | null {
  const { route, specId } = decision;
  const titled = specId === null ? undefined : SPEC_TITLES[specId];
  if (titled !== undefined) return t(titled);
  if (route.kind === 'tactical') return activeSystemOf(game, t, language);
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

/** Figuren der Entscheidung (ohne Gebäude): so viele lassen sich zuweisen. */
const unitCount = (decision: TableDecision): number =>
  decision.pieces.filter((piece) => piece.ref.kind === 'unit').length;

type DraftOf<K extends TableDraft['kind']> = Extract<TableDraft, { readonly kind: K }>;

type MeterFor<K extends TableDraft['kind']> = (
  props: DraftMeterProps & { readonly draft: DraftOf<K> },
) => ReactElement | null;

/** Marker: erhaltene bzw. genommene Marker, bei der Führung der bezahlte Einfluss. */
const TokensMeter: MeterFor<'tokens'> = ({ decision, draft, progress }) => (
  <PromptMeter
    needed={progress.needed}
    plan={draft}
    warfare={decision.specId === 'warfare'}
    paid={leadershipPaid(decision)}
  />
);

/** Werft: Zahlen aus der Werft, der bezahlte Wert aus der Planetenreihe. */
const YardMeter: MeterFor<'production'> = ({ game, decision }) => {
  const yard = shipyardOf(game, decision);
  return yard === null ? null : (
    <ProductionMeter yard={yard} paid={decision.planets?.paid ?? null} />
  );
};

/** Forschungsauslage: Zahlen aus der Auslage, der bezahlte Wert aus der Planetenreihe. */
const SpreadMeter: MeterFor<'research'> = ({ game, decision }) => {
  const spread = researchSpreadOf(game, decision);
  if (spread === null) return null;
  return <ResearchMeter spread={spread} paid={decision.planets?.paid ?? null} />;
};

/** Je Art des Entwurfs ihre Messleiste (Polymorphie über `kind` statt Verzweigungen). */
const METERS: { readonly [K in TableDraft['kind']]: MeterFor<K> } = {
  tokens: TokensMeter,
  objective: ({ draft, progress }) => <ObjectiveMeter plan={draft} progress={progress} />,
  ready: ({ progress }) => <ReadyMeter progress={progress} />,
  placement: ({ decision, draft, progress }) => (
    <PlacementMeter plan={draft} progress={progress} units={unitCount(decision)} />
  ),
  system: ({ game, decision, draft }) =>
    decision.specId === 'retreat' ? <RetreatMeter game={game} plan={draft} /> : null,
  construction: ({ progress }) => <BuildMeter progress={progress} />,
  done: () => null,
  discard: ({ progress }) => <DiscardMeter progress={progress} />,
  players: ({ game, decision, draft }) => (
    <PlayersMeter game={game} plan={draft} politics={decision.specId === 'politics'} />
  ),
  production: YardMeter,
  research: SpreadMeter,
  hits: ({ progress }) => <HitMeter progress={progress} />,
  vote: ({ game, draft, progress }) => <VoteMeter game={game} plan={draft} progress={progress} />,
  outcome: ({ game, draft }) => <TieMeter game={game} plan={draft} />,
};

function DraftMeter(props: DraftMeterProps): ReactElement | null {
  const Meter = METERS[props.draft.kind] as MeterFor<TableDraft['kind']>;
  return <Meter {...props} />;
}

/** Die Messleiste passend zur Art des Entwurfs. */
export function PromptProgress({ game, decision }: PartProps) {
  const { draft, progress } = decision;
  if (draft === null || progress === null) return null;
  return <DraftMeter game={game} decision={decision} draft={draft} progress={progress} />;
}

/** Entwürfe mit eigener Bezahlung im Entwurf: Ausgabe-Auftrag oder Landung auf der Thronwelt. */
const ownPayment = (draft: TableDraft | null): boolean =>
  (draft?.kind === 'objective' || draft?.kind === 'placement') && draft.payment !== null;

/** Werft und Forschung bezahlen, solange die Planetenreihe eine Bezahlung anbietet. */
const rowPayment = (decision: TableDecision): boolean =>
  (decision.draft?.kind === 'production' || decision.draft?.kind === 'research') &&
  decision.planets?.mode === 'pay';

/** Eine Bezahlung ist offen. */
const paying = (decision: TableDecision): boolean =>
  ownPayment(decision.draft) || rowPayment(decision);

/** Solange eine Bezahlung offen ist: wo bezahlt wird (Planetenreihe, Karte, Kasse). */
export function PromptPayHint({ decision }: { readonly decision: TableDecision }) {
  const t = useT();
  if (!paying(decision)) return null;
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
