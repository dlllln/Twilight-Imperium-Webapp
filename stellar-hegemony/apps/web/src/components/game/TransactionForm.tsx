import {
  findPlayer,
  type GameState,
  type Goods,
  NO_GOODS,
  type PlayerId,
  tradePartners,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import type { GoodKind } from '../../table/target-ref.ts';
import {
  askGoods,
  canPropose,
  choosePartner,
  fitted,
  giveGoods,
  proposalOf,
  type TradeDraft,
  tradeDraft,
} from '../../table/trade-draft.ts';
import { useTradeMat } from '../../table/use-trade-mat.ts';
import { useT } from '../../use-translation.ts';
import { OfferMat, TradeMat } from '../table/TradeMat.tsx';
import { PlayerTag } from './PlayerTag.tsx';
import { Stepper } from './Stepper.tsx';

/*
 * Tausch mit Nachbarn (RR 82). In der Tischansicht liegt er als Handelsmatte in der Ansage,
 * sonst als Formular; beide bauen auf demselben Entwurf (`trade-draft.ts`): Ein anderer Partner
 * leert das Verlangte, ein ganz leeres Angebot lässt sich nicht machen.
 */

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

const GOODS: readonly GoodKind[] = ['tradeGoods', 'commodities'];

/** Vorrat eines Spielers an Handelswaren und Rohstoffen; ohne Spieler `null`. */
function goodsOf(game: GameState, id: PlayerId | null): Goods | null {
  const found = id === null ? undefined : findPlayer(game, id);
  return found === undefined
    ? null
    : { tradeGoods: found.tradeGoods, commodities: found.commodities };
}

function GoodsSteppers(props: {
  readonly label: string;
  readonly value: Goods;
  /** Vorrat, der diese Seite begrenzt; `null` sperrt Plus. */
  readonly stock: Goods | null;
  readonly onStep: (good: GoodKind, delta: number) => void;
}): ReactElement {
  const t = useT();
  const { label, value, stock, onStep } = props;
  return (
    <>
      {GOODS.map((good) => (
        <Stepper
          key={good}
          label={`${label}: ${t(good)}`}
          value={value[good]}
          canAdd={stock !== null && value[good] < stock[good]}
          onChange={(delta) => onStep(good, delta)}
        />
      ))}
    </>
  );
}

/** Entwurf des Formulars: wie die Matte, nur lokal und mit dem ersten Nachbarn vorgewählt. */
function useClassicDraft(game: GameState, player: PlayerId) {
  const partners = tradePartners(game, player);
  const [stored, setStored] = useState<TradeDraft>(tradeDraft);
  const own = goodsOf(game, player) ?? NO_GOODS;
  const fit = fitted(stored, partners, own, goodsOf(game, stored.partner));
  const first = partners[0];
  const draft = fit.partner === null && first !== undefined ? choosePartner(fit, first) : fit;
  const theirs = goodsOf(game, draft.partner);
  return {
    partners,
    draft,
    own,
    theirs,
    choose: (partner: PlayerId) => setStored(choosePartner(draft, partner)),
    give: (good: GoodKind, delta: number) => setStored(giveGoods(draft, good, delta, own)),
    ask: (good: GoodKind, delta: number) => setStored(askGoods(draft, good, delta, theirs)),
  };
}

function PartnerChoice(props: {
  readonly game: GameState;
  readonly partners: readonly PlayerId[];
  readonly value: PlayerId;
  readonly onChange: (partner: PlayerId) => void;
}): ReactElement {
  const t = useT();
  return (
    <div className="partner-choice" role="radiogroup" aria-label={t('partner')}>
      {props.partners.map((id) => (
        <label key={id}>
          <input type="radio" checked={id === props.value} onChange={() => props.onChange(id)} />
          <PlayerTag game={props.game} id={id} />
        </label>
      ))}
    </div>
  );
}

/** Das Formular der klassischen Ansicht: Nachbar, was man gibt, was man verlangt. */
function ClassicTransaction({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const form = useClassicDraft(game, player);
  const { draft } = form;
  if (draft.partner === null) return null;
  const propose = () => {
    const command = proposalOf(draft, player);
    if (command !== null) send(command);
  };
  return (
    <details className="transaction">
      <summary>{t('transaction')}</summary>
      <p className="hint">{t('transactionHint')}</p>
      <PartnerChoice
        game={game}
        partners={form.partners}
        value={draft.partner}
        onChange={form.choose}
      />
      <GoodsSteppers label={t('give')} value={draft.give} stock={form.own} onStep={form.give} />
      <GoodsSteppers label={t('ask')} value={draft.ask} stock={form.theirs} onStep={form.ask} />
      <button type="button" disabled={!canPropose(draft)} onClick={propose}>
        {t('propose')}
      </button>
    </details>
  );
}

/** RR 82: Angebot an einen Nachbarn; am Tisch als Handelsmatte, sonst als Formular. */
export function TransactionForm({ game, player }: TurnProps): ReactElement | null {
  const mat = useTradeMat(game);
  if (mat !== null && mat.player === player) return <TradeMat game={game} mat={mat} />;
  return <ClassicTransaction game={game} player={player} />;
}

function GoodsText({ goods }: { readonly goods: Goods }): ReactElement {
  const t = useT();
  if (goods.tradeGoods === 0 && goods.commodities === 0) return <>{t('nothing')}</>;
  return (
    <>
      {goods.tradeGoods} {t('tradeGoods')}, {goods.commodities} {t('commodities')}
    </>
  );
}

/** Das offene Angebot: der Empfänger stimmt zu oder lehnt ab; am Tisch liegt es dazu als Matte. */
export function TransactionReply({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const table = useSettingsStore((state) => state.tableView);
  const pending = game.actionPhase?.transaction;
  if (pending == null) return null;
  return (
    <div className="turn-block">
      <h3>{t('transaction')}</h3>
      <p data-testid="offer">
        <PlayerTag game={game} id={pending.from} /> {t('offers')}{' '}
        <GoodsText goods={pending.offer} /> {t('asksFor')} <GoodsText goods={pending.request} />
      </p>
      {table && (
        <OfferMat game={game} from={pending.from} offer={pending.offer} request={pending.request} />
      )}
      <div className="actions">
        <button type="button" onClick={() => send({ type: 'AcceptTransaction', issuedBy: player })}>
          {t('accept')}
        </button>
        <button type="button" onClick={() => send({ type: 'RejectTransaction', issuedBy: player })}>
          {t('decline')}
        </button>
      </div>
    </div>
  );
}
