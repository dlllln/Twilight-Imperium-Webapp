import {
  AGAINST,
  type AgendaView,
  currentAgenda,
  FOR,
  type GameState,
  votingPower,
} from '@stellar/domain';
import { type ReactElement, useRef } from 'react';
import { AGENDA_BACK } from '../../artwork/cards.ts';
import { planetLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import type { TableSpecId } from '../../table/table-specs.ts';
import { type DropHandler, outcomeTarget, targetKey } from '../../table/target-ref.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useTarget } from '../../table/use-target.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { AgendaCard } from '../agenda/AgendaCard.tsx';
import { outcomeLabel } from '../agenda/outcome-label.ts';
import { CardArtwork } from '../cards/CardArtwork.tsx';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';
import { useMatFloor } from './use-mat-floor.ts';
import '../cards/card-table.css';
import './research-spread.css';
import './agenda-table.css';

/*
 * Der Agendatisch (RR 2, RR 7): In der Agendaphase liegt die offene Agenda in der freien Mitte;
 * sie dreht sich von der Rückseite auf die Vorderseite. Darunter liegt je Ergebnis eine Platte
 * (Dafür/Dagegen, die Porträts einer Wahl, die Planeten einer Planetenwahl) mit den schon
 * abgegebenen Stimmen. Wer abstimmt, tippt eine Platte an und Planeten der Planetenreihe; ihre
 * Stimmen stapeln sich als Plättchen auf der gewählten Platte. Bei Gleichstand leuchten die
 * gleichauf liegenden Platten, der Sprecher tippt eine an und entscheidet mit dem Siegel.
 */

const TABLE_SPECS: ReadonlySet<TableSpecId> = new Set(['vote', 'tieBreak']);

const ownDecision = (decision: TableDecision | null): TableDecision | null =>
  decision?.specId != null && TABLE_SPECS.has(decision.specId) ? decision : null;

interface PlateProps {
  readonly game: GameState;
  readonly view: AgendaView;
  readonly outcome: string;
  readonly decision: TableDecision | null;
  readonly router: DropHandler;
}

/** Dafür und Dagegen: ein Häkchen bzw. ein Kreuz aus eigenen Strichen. */
function VoteSign({ outcome }: { readonly outcome: string }): ReactElement {
  const path = outcome === FOR ? 'M5 13l5 5 10-12' : 'M6 6l12 12M18 6L6 18';
  return (
    <svg className="plate-sign" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** Das Bild der Platte: Zeichen, Porträt des Gewählten oder eine Planetenscheibe. */
function PlateFace({ game, outcome }: { readonly game: GameState; readonly outcome: string }) {
  if (outcome === FOR || outcome === AGAINST) return <VoteSign outcome={outcome} />;
  const player = game.players.find((candidate) => candidate.id === outcome);
  if (player !== undefined) return <FactionEmblem id={player.faction} size={38} />;
  return <span className="plate-planet" aria-hidden="true" />;
}

/** Die abgegebenen Stimmen auf der Platte: Wappen der Abstimmenden mit ihrer Zahl. */
function CastPile({ game, outcome }: { readonly game: GameState; readonly outcome: string }) {
  const votes = (game.agendaPhase?.votes ?? []).filter((vote) => vote.outcome === outcome);
  if (votes.length === 0) return null;
  return (
    <span className="plate-cast" aria-hidden="true">
      {votes.map((vote) => {
        const faction = game.players.find((player) => player.id === vote.player)?.faction;
        return (
          <span key={vote.player} className="plate-voter">
            {faction !== undefined && <FactionEmblem id={faction} size={18} />}
            <span>{vote.votes}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Die eigenen, noch nicht abgegebenen Planeten als Plättchen auf der gewählten Platte. */
function PendingPile(props: { readonly game: GameState; readonly decision: TableDecision }) {
  const language = useLanguage();
  const { game, decision } = props;
  const { draft, route } = decision;
  if (draft?.kind !== 'vote' || route.actor === null) return null;
  const power = votingPower(game, route.actor, content);
  const chosen = power.planets.filter((planet) => draft.planets.includes(planet.id));
  return (
    <span className="plate-pending" data-testid="plate-pending">
      {chosen.map((planet) => (
        <span key={planet.id} className="plate-chip" title={planetLabel(planet.id, language)}>
          {planet.influence}
        </span>
      ))}
    </span>
  );
}

/** Gewählte Platte des eigenen Entwurfs (Abstimmung oder Gleichstand). */
const chosenOf = (decision: TableDecision | null): string | null => {
  const draft = decision?.draft;
  return draft?.kind === 'vote' || draft?.kind === 'outcome' ? draft.outcome : null;
};

const tiedOf = (game: GameState, outcome: string): boolean =>
  game.agendaPhase?.tied?.includes(outcome) ?? false;

/** Inhalt einer Platte: Bild, Name, Stimmen; auf der gewählten liegen die eigenen Plättchen. */
function PlateBody(props: PlateProps & { readonly chosen: boolean }) {
  const t = useT();
  const language = useLanguage();
  const { game, view, outcome, decision, chosen } = props;
  const votes = view.counts.get(outcome) ?? 0;
  return (
    <>
      <PlateFace game={game} outcome={outcome} />
      <span className="plate-name">{outcomeLabel(game, outcome, language, t)}</span>
      <span className="plate-votes" data-testid={`plate-votes-${outcome}`}>
        {t('plateVotes').replace('{n}', String(votes))}
      </span>
      <CastPile game={game} outcome={outcome} />
      {chosen && decision !== null && <PendingPile game={game} decision={decision} />}
      {tiedOf(game, outcome) && <span className="plate-tied">{t('tiedPlate')}</span>}
    </>
  );
}

/** Eine Platte, die sich wählen lässt: Knopf, gedrückt, wenn sie die eigene Wahl ist. */
function PlateButton(props: PlateProps & { readonly decision: TableDecision }) {
  const ref = outcomeTarget(props.outcome);
  const state = props.decision.targets.get(targetKey(ref));
  const target = useTarget(ref, state, props.router);
  const chosen = chosenOf(props.decision) === props.outcome;
  const { onClick, onKeyDown, ...marks } = target.props;
  const pick = () => props.decision.act({ kind: 'outcome', outcome: props.outcome });
  return (
    <button
      type="button"
      className="outcome-plate"
      data-outcome={props.outcome}
      data-tied={tiedOf(props.game, props.outcome) || undefined}
      aria-pressed={chosen}
      disabled={state === undefined}
      {...marks}
      onClick={onClick ?? pick}
      {...(onKeyDown === undefined ? {} : { onKeyDown })}
    >
      <PlateBody {...props} chosen={chosen} />
    </button>
  );
}

/** Eine Platte ohne eigene Entscheidung: nur Bild und Zählung. */
function Plate(props: PlateProps): ReactElement {
  if (props.decision !== null) return <PlateButton {...props} decision={props.decision} />;
  return (
    <div
      className="outcome-plate"
      data-outcome={props.outcome}
      data-tied={tiedOf(props.game, props.outcome) || undefined}
    >
      <PlateBody {...props} chosen={false} />
    </div>
  );
}

/** Die Agendakarte dreht sich beim Aufdecken jeder neuen Agenda einmal um. */
function FlipCard({ game, view }: { readonly game: GameState; readonly view: AgendaView }) {
  const number = game.agendaPhase?.number ?? 1;
  return (
    <div className="agenda-flip" data-agenda={view.agenda.id}>
      <span className="agenda-flip-back" aria-hidden="true">
        <CardArtwork artwork={AGENDA_BACK} className="ti4-print-frame" />
      </span>
      <span className="agenda-flip-face">
        <AgendaCard game={game} view={view} number={number} />
      </span>
    </div>
  );
}

/** Der Agendatisch der Agendaphase; sonst liegt nichts auf dem Tisch. */
export function AgendaTable({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const view = game.phase === 'agenda' ? currentAgenda(game, content) : null;
  const decision = ownDecision(useTableDecision(game));
  const router = useDropRouter(game);
  const ref = useRef<HTMLElement>(null);
  useMatFloor(ref, view !== null);
  if (view === null) return null;
  return (
    <section
      ref={ref}
      className="research-spread agenda-table"
      role="region"
      aria-label={t('agendaTable')}
      data-testid="agenda-table"
      data-deciding={decision?.specId ?? undefined}
    >
      <FlipCard key={view.agenda.id} game={game} view={view} />
      <div className="outcome-plates" role="group" aria-label={t('outcomePlates')}>
        {view.outcomes.map((outcome) => (
          <Plate key={outcome} {...{ game, view, outcome, decision, router }} />
        ))}
      </div>
    </section>
  );
}
