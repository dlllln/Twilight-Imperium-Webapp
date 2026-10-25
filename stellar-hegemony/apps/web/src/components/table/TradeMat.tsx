import { findPlayer, type GameState, type Goods, type PlayerId } from '@stellar/domain';
import { AnimatePresence } from 'motion/react';
import { type ReactElement, type RefObject, useEffect, useRef } from 'react';
import type { GoodKind } from '../../table/target-ref.ts';
import type { TradeMat as Mat } from '../../table/use-trade-mat.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { Coin, Crate } from '../sheet/SheetTokens.tsx';
import { revealInPrompt } from './prompt-scroll.ts';
import './trade-mat.css';

/*
 * Die Handelsmatte in der Ansage (RR 82): links liegt, was man gibt, rechts, was man vom
 * Nachbarn erbittet, je als Münzstapel und Kistenreihe. Gelegt wird über das Bild eines
 * Nachbarn (Münze oder Kiste dorthin ziehen) oder mit Plus und Minus; die Radioknöpfe sind der
 * Weg für Tastatur und Bildschirmleser. Beim Empfänger liegt das Angebot als Matte ohne Knöpfe.
 * Die Matte bleibt flach (eine Zeile je Hälfte); ändert sie sich, rückt „Angebot machen“ ins Bild.
 */

/** So viele Steine liegen je Ware sichtbar auf der Matte; die Zahl daneben zählt alle. */
const SHOWN = 5;

const GOODS: readonly GoodKind[] = ['tradeGoods', 'commodities'];

/** Münzen als Stapel, Kisten als Reihe; beides fällt mit dem Sprung des Pults auf die Matte. */
function GoodStack({ good, count }: { readonly good: GoodKind; readonly count: number }) {
  return (
    <span className="trade-mat-stack" data-good={good} aria-hidden="true">
      <AnimatePresence initial={false}>
        {Array.from({ length: Math.min(count, SHOWN) }, (_, index) =>
          good === 'tradeGoods' ? <Coin key={index} index={index} /> : <Crate key={index} />,
        )}
      </AnimatePresence>
    </span>
  );
}

interface GoodProps {
  /** „Geben“ bzw. „Erbitten“; ohne Präfix heißt die Ware nur nach sich selbst. */
  readonly prefix: string | null;
  readonly good: GoodKind;
  readonly count: number;
  readonly canAdd: boolean;
  readonly onStep?: (delta: 1 | -1) => void;
}

/** Eine Ware auf der Matte: Steine, Zahl und (wo man legt) Minus und Plus. */
function MatGood({ prefix, good, count, canAdd, onStep }: GoodProps): ReactElement {
  const t = useT();
  const name = prefix === null ? t(good) : `${prefix}: ${t(good)}`;
  const step = (sign: '−' | '+', delta: 1 | -1, enabled: boolean) => (
    <button
      type="button"
      className="rail-step"
      aria-label={`${name} ${sign}`}
      disabled={!enabled}
      onClick={() => onStep?.(delta)}
    >
      {sign}
    </button>
  );
  return (
    <div className="trade-mat-good" data-good={good} title={name}>
      <GoodStack good={good} count={count} />
      <output className="trade-mat-count" aria-label={name}>
        {count}
      </output>
      {onStep !== undefined && (
        <span className="trade-mat-steps">
          {step('−', -1, count > 0)}
          {step('+', 1, canAdd)}
        </span>
      )}
    </div>
  );
}

interface HalfProps {
  readonly side: 'offer' | 'request';
  readonly label: string;
  readonly prefix: string | null;
  readonly goods: Goods;
  /** Vorrat, der diese Seite begrenzt; `null` sperrt Plus (kein Partner, nur Ansicht). */
  readonly stock: Goods | null;
  readonly onStep?: (good: GoodKind, delta: 1 | -1) => void;
}

/** Eine Hälfte der Matte: „Du gibst“ oder „Du erbittest“. */
function MatHalf({ side, label, prefix, goods, stock, onStep }: HalfProps): ReactElement {
  return (
    <section className="trade-mat-half" data-side={side} aria-label={label}>
      <span className="trade-mat-caption" aria-hidden="true">
        {label}
      </span>
      {GOODS.map((good) => (
        <MatGood
          key={good}
          prefix={prefix}
          good={good}
          count={goods[good]}
          canAdd={stock !== null && goods[good] < stock[good]}
          {...(onStep !== undefined && { onStep: (delta: 1 | -1) => onStep(good, delta) })}
        />
      ))}
    </section>
  );
}

/** Die Nachbarn als Radiogruppe: der Weg ohne Ziehen. */
function PartnerRadios({ game, mat }: { readonly game: GameState; readonly mat: Mat }) {
  const t = useT();
  return (
    <div className="trade-partners" role="radiogroup" aria-label={t('partner')}>
      {mat.partners.map((id) => (
        <label key={id} className="trade-partner">
          <input
            type="radio"
            name="trade-partner"
            checked={id === mat.draft.partner}
            onChange={() => mat.choose(id)}
          />
          <PlayerTag game={game} id={id} />
        </label>
      ))}
    </div>
  );
}

/** Beide Hälften der Matte des Aktiven: geben aus dem eigenen, erbitten aus seinem Vorrat. */
function OwnHalves({ mat }: { readonly mat: Mat }): ReactElement {
  const t = useT();
  const { draft } = mat;
  return (
    <div className="trade-mat-halves">
      <MatHalf
        side="offer"
        label={t('tradeYouGive')}
        prefix={t('give')}
        goods={draft.give}
        stock={mat.own}
        onStep={mat.give}
      />
      <MatHalf
        side="request"
        label={t('tradeYouAsk')}
        prefix={t('tradeAsk')}
        goods={draft.ask}
        stock={mat.theirs}
        onStep={mat.ask}
      />
    </div>
  );
}

/** Stand der Matte als Schlüssel: Partner und beide Seiten. */
const signatureOf = (mat: Mat): string => {
  const { partner, give, ask } = mat.draft;
  return [partner, give.tradeGoods, give.commodities, ask.tradeGoods, ask.commodities].join('|');
};

/**
 * Ändert sich die Matte (etwa durch eine Ware auf dem Bild eines Nachbarn), öffnet sie sich und
 * rollt die Ansage, bis ihr Fuß mit „Angebot machen“ zu sehen ist; beim Erscheinen nicht.
 */
function useRevealOnChange(foot: RefObject<HTMLElement | null>, signature: string): void {
  const seen = useRef(signature);
  useEffect(() => {
    if (seen.current === signature) return;
    seen.current = signature;
    const mat = foot.current?.closest('details');
    if (foot.current == null || !(mat instanceof HTMLDetailsElement)) return;
    mat.open = true;
    revealInPrompt(mat, foot.current);
  }, [foot, signature]);
}

/** Unten: warum noch kein Angebot geht (immer als Live-Region im Baum) und der Knopf. */
function MatFoot({ mat, foot }: { readonly mat: Mat; readonly foot: RefObject<HTMLDivElement> }) {
  const t = useT();
  return (
    <div ref={foot} className="trade-mat-foot">
      <p className="hint trade-mat-hint" aria-live="polite">
        {mat.ready ? null : t('tradeNothing')}
      </p>
      <button type="button" className="primary" disabled={!mat.ready} onClick={mat.propose}>
        {t('propose')}
      </button>
    </div>
  );
}

/** Die Handelsmatte des Aktiven; „Angebot machen“ bleibt gesperrt, solange nichts darauf liegt. */
export function TradeMat({ game, mat }: { readonly game: GameState; readonly mat: Mat }) {
  const t = useT();
  const foot = useRef<HTMLDivElement>(null);
  useRevealOnChange(foot, signatureOf(mat));
  return (
    <details className="transaction trade-mat" open aria-label={t('tradeMat')}>
      <summary>{t('transaction')}</summary>
      <p className="hint">{t('tableHintTradeDrop')}</p>
      <PartnerRadios game={game} mat={mat} />
      <OwnHalves mat={mat} />
      <MatFoot mat={mat} foot={foot} />
    </details>
  );
}

interface OfferProps {
  readonly game: GameState;
  readonly from: PlayerId;
  readonly offer: Goods;
  readonly request: Goods;
}

/** Das offene Angebot beim Empfänger: was der Anbieter bietet und was man selbst gäbe. */
export function OfferMat({ game, from, offer, request }: OfferProps): ReactElement {
  const t = useT();
  const name = findPlayer(game, from)?.name ?? from;
  return (
    <div className="trade-mat-halves" data-readonly="true">
      <MatHalf
        side="offer"
        label={`${name} ${t('offers')}`}
        prefix={null}
        goods={offer}
        stock={null}
      />
      <MatHalf
        side="request"
        label={t('tradeYouGive')}
        prefix={null}
        goods={request}
        stock={null}
      />
    </div>
  );
}
