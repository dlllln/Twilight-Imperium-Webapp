import { findPlayer, type GameState } from '@stellar/domain';
import { type CSSProperties, type ReactElement, type RefObject, useEffect, useRef } from 'react';
import { strategyFrame } from '../../artwork/cards.ts';
import type { MessageKey } from '../../i18n.ts';
import { seatColor } from '../../seat-colors.ts';
import { type SecondarySocket, useSecondarySocket } from '../../table/secondary-socket.ts';
import { type SocketPlay, useSocketPlay } from '../../table/socket-play.ts';
import { type DropHandler, SOCKET } from '../../table/target-ref.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useTarget } from '../../table/use-target.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import { PromptText } from '../cards/ReactionPrompt.tsx';
import { revealInPrompt } from './prompt-scroll.ts';
import './table-people.css';

/*
 * Menschen und Karten in der Ansage: Wer der Karte eines anderen folgt, sieht die Karte und den
 * achteckigen Sockel, in den er seinen Strategiemarker legt (oder antippt, wenn es nichts kostet).
 * Im Reaktionsfenster liegt die gespielte Karte offen in der Ansage.
 */

interface PeopleProps {
  readonly game: GameState;
  readonly decision: TableDecision;
}

/** Was der Sockel kostet: einen Marker, nichts, oder es fehlt der Marker. */
function costKey(socket: SecondarySocket): MessageKey {
  if (!socket.affordable) return 'costMissing';
  return socket.cost === 0 ? 'costFree' : 'costStrategyToken';
}

const OCTAGON = '12,1 28,1 39,12 39,28 28,39 12,39 1,28 1,12';
const BED = '14,7 26,7 33,14 33,26 26,33 14,33 7,26 7,14';

/**
 * Der achteckige Sockel. Schwebt der getragene Marker darüber, öffnet sich nur sein Bett
 * (gestrichelt in der Platzfarbe): Der Marker selbst ist der Geist am Zeiger. Ein zweiter, gleich
 * großer Marker an derselben Stelle ließe den Geist darin verschwinden.
 */
function SocketSlot(props: {
  readonly socket: SecondarySocket;
  readonly open: boolean;
}): ReactElement {
  return (
    <svg className="secondary-socket-slot" viewBox="0 0 40 40" aria-hidden="true">
      <polygon className="socket-rim" points={OCTAGON} />
      {props.open && <polygon className="socket-bed" points={BED} />}
      {!props.open && (
        <text x="20" y="25" textAnchor="middle" className="socket-cost">
          {props.socket.cost}
        </text>
      )}
    </svg>
  );
}

interface SocketTargetProps {
  readonly socket: SecondarySocket;
  readonly play: () => void;
  readonly router: DropHandler;
  readonly name: string;
}

/**
 * Rollt die Ansage (nur sie) so weit, dass die Zeile des Sockels ganz über der Leiste des Siegels
 * steht. Liegt darunter die Werft, rückt der Sockel beim Öffnen nur ins Bild, wenn ihre Steine
 * dabei sichtbar bleiben: Das Siegel tut dort dasselbe wie der Sockel, die Bestellung geht vor.
 * Trägt man den Strategiemarker, rückt der Sockel in jedem Fall ins Bild: Er ist das Ziel.
 */
function revealSocket(button: HTMLElement, carried: boolean): void {
  const line = button.closest<HTMLElement>('.secondary-socket') ?? button;
  const pieces = line.closest('.table-prompt')?.querySelector('.shipyard-pieces');
  if (pieces == null || carried) revealInPrompt(line);
  else revealInPrompt(line, pieces, true);
}

/**
 * Öffnet sich der Sockel (etwa nach Wahl und Bezahlung am Tisch) oder nimmt man den Marker auf,
 * rückt er in den sichtbaren Teil der Ansage: Auf niedrigen Bildschirmen rollt sie sonst an ihm
 * vorbei, und der Marker fände kein Ziel.
 */
function useRevealSocket(ref: RefObject<HTMLButtonElement | null>, carried: boolean): void {
  useEffect(() => {
    if (ref.current !== null) revealSocket(ref.current, carried);
  }, [ref, carried]);
}

/**
 * Der Sockel als Ziel: Der oberste Strategiemarker vom Pult wird hier abgelegt; Antippen oder
 * Enter folgen ebenso (kostenlose Karten nur so). Trägt man den Marker, legt ein Klick ihn ab.
 */
function SocketTarget({ socket, play, router, name }: SocketTargetProps): ReactElement {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const target = useTarget(SOCKET, undefined, router);
  const { onClick, onKeyDown, ...marks } = target.props;
  useRevealSocket(ref, target.state === 'legal');
  return (
    <button
      ref={ref}
      type="button"
      className="secondary-socket-target"
      aria-label={`${t('socketFollow')}: ${name}`}
      title={t(socket.cost === 1 ? 'socketHintToken' : 'socketHintFree')}
      data-over={target.over ? 'true' : undefined}
      {...marks}
      onClick={onClick ?? play}
      {...(onKeyDown === undefined ? {} : { onKeyDown })}
    >
      <SocketSlot socket={socket} open={target.over} />
    </button>
  );
}

/** Platzfarbe dessen, der folgt; ohne Platz die Messingfarbe. */
function seatOf(game: GameState, decision: TableDecision): CSSProperties {
  const player = decision.route.actor === null ? undefined : findPlayer(game, decision.route.actor);
  return player === undefined ? {} : ({ '--seat': seatColor(player.seat + 1) } as CSSProperties);
}

interface PlaceProps {
  readonly game: GameState;
  readonly socket: SecondarySocket;
  readonly socketPlay: SocketPlay;
}

/**
 * Der Sockel: ein Ziel, solange er etwas auslösen kann, sonst nur das Bild. Wartet er auf die
 * Wahl am Tisch (Forschungsauslage, Werft), sagt sein Titel, was zuerst zu tun ist.
 */
function SocketPlace({ game, socket, socketPlay }: PlaceProps) {
  const t = useT();
  const router = useDropRouter(game);
  const name = cardText(socket.card).name[useLanguage()];
  const { play, awaitsDraft } = socketPlay;
  if (play !== null)
    return <SocketTarget socket={socket} play={play} router={router} name={name} />;
  const title = awaitsDraft ? t('socketHintDraft') : undefined;
  return (
    <span className="secondary-socket-wait" title={title} data-awaits={awaitsDraft || undefined}>
      <SocketSlot socket={socket} open={false} />
    </span>
  );
}

/**
 * Sekundärfähigkeit: die Karte des anderen, der Sockel und Name samt Kosten in Worten. Für jede
 * Karte, ob am Tisch gespielt oder noch mit Formular; der Sockel nimmt den Strategiemarker an.
 */
export function SecondarySocketLine({ game, decision }: PeopleProps): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const socket = useSecondarySocket(game);
  const socketPlay = useSocketPlay(game);
  if (socket === null || decision.route.kind !== 'secondary') return null;
  return (
    <div
      className="secondary-socket"
      data-cost={socket.cost}
      data-affordable={socket.affordable}
      data-waived={socket.waived}
      style={seatOf(game, decision)}
    >
      <span className="secondary-socket-card" aria-hidden="true">
        <CompleteCardArtwork artwork={strategyFrame(socket.mechanic)} />
      </span>
      <SocketPlace game={game} socket={socket} socketPlay={socketPlay} />
      <p className="secondary-socket-cost">
        <span className="secondary-socket-name">{cardText(socket.card).name[language]}</span>
        {' – '}
        {t('secondaryCost')}: <strong>{t(costKey(socket))}</strong>
        {socketPlay.awaitsDraft && (
          <small className="secondary-socket-draft">{t('socketHintDraft')}</small>
        )}
      </p>
    </div>
  );
}

/** Reaktion: die gespielte Karte, die man verhindern dürfte, oder der Anlass des Fensters. */
export function ReactionLine({ game, decision }: PeopleProps): ReactElement | null {
  if (decision.specId !== 'reaction') return null;
  return (
    <div className="table-prompt-reaction">
      <PromptText game={game} />
    </div>
  );
}
