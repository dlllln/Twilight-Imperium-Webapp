import {
  findPlayer,
  type GameState,
  type Goods,
  neighborsOf,
  NO_GOODS,
  type PlayerId,
} from '@stellar/domain';
import { type ReactElement, useState } from 'react';
import { useGameStore } from '../../game-store.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from './PlayerTag.tsx';
import { Stepper } from './Stepper.tsx';

interface TurnProps {
  readonly game: GameState;
  readonly player: PlayerId;
}

/** Nachbarn, mit denen in diesem Zug noch getauscht werden darf (RR 82.1). */
const partnersOf = (game: GameState, player: PlayerId): readonly PlayerId[] =>
  neighborsOf(game, player).filter((id) => game.actionPhase?.transactedWith.includes(id) !== true);

function GoodsSteppers(props: {
  readonly label: string;
  readonly owner: PlayerId;
  readonly game: GameState;
  readonly value: Goods;
  readonly onChange: (goods: Goods) => void;
}): ReactElement {
  const t = useT();
  const stock = findPlayer(props.game, props.owner);
  const step = (key: keyof Goods) => (
    <Stepper
      label={`${props.label}: ${t(key)}`}
      value={props.value[key]}
      canAdd={props.value[key] < (stock?.[key] ?? 0)}
      onChange={(delta) => props.onChange({ ...props.value, [key]: props.value[key] + delta })}
    />
  );
  return (
    <>
      {step('tradeGoods')}
      {step('commodities')}
    </>
  );
}

function useOffer(game: GameState, player: PlayerId) {
  const partners = partnersOf(game, player);
  const [chosen, setPartner] = useState<PlayerId | null>(null);
  const partner = chosen !== null && partners.includes(chosen) ? chosen : (partners[0] ?? null);
  const [offer, setOffer] = useState(NO_GOODS);
  const [request, setRequest] = useState(NO_GOODS);
  return { partners, partner, setPartner, offer, setOffer, request, setRequest };
}

type Offer = ReturnType<typeof useOffer>;

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

/** Was der aktive Spieler gibt und was er vom Nachbarn verlangt. */
function OfferFields(props: TurnProps & { readonly partner: PlayerId; readonly form: Offer }) {
  const t = useT();
  const { game, player, partner, form } = props;
  return (
    <>
      <GoodsSteppers
        label={t('give')}
        owner={player}
        game={game}
        value={form.offer}
        onChange={form.setOffer}
      />
      <GoodsSteppers
        label={t('ask')}
        owner={partner}
        game={game}
        value={form.request}
        onChange={form.setRequest}
      />
    </>
  );
}

/** RR 82: Angebot an einen Nachbarn; er nimmt es an oder lehnt ab. */
export function TransactionForm({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const form = useOffer(game, player);
  const { partner, offer, request } = form;
  if (partner === null) return null;
  const propose = () =>
    send({ type: 'ProposeTransaction', issuedBy: player, partner, offer, request });
  return (
    <details className="transaction">
      <summary>{t('transaction')}</summary>
      <p className="hint">{t('transactionHint')}</p>
      <PartnerChoice
        game={game}
        partners={form.partners}
        value={partner}
        onChange={form.setPartner}
      />
      <OfferFields game={game} player={player} partner={partner} form={form} />
      <button type="button" onClick={propose}>
        {t('propose')}
      </button>
    </details>
  );
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

/** Das offene Angebot: der Empfänger stimmt zu oder lehnt ab. */
export function TransactionReply({ game, player }: TurnProps): ReactElement | null {
  const t = useT();
  const send = useGameStore((state) => state.send);
  const pending = game.actionPhase?.transaction;
  if (pending == null) return null;
  return (
    <div className="turn-block">
      <h3>{t('transaction')}</h3>
      <p data-testid="offer">
        <PlayerTag game={game} id={pending.from} /> {t('offers')}{' '}
        <GoodsText goods={pending.offer} /> {t('asksFor')} <GoodsText goods={pending.request} />
      </p>
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
