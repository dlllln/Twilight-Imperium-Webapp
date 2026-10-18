import { findPlayer, type GameState, warfareTokenSystems } from '@stellar/domain';
import type { ReactElement } from 'react';
import type { Language } from '../../i18n.ts';
import type { TokenPlan } from '../../table/table-specs.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { SystemSelect } from '../game/FormParts.tsx';
import { PHASE_TITLE } from '../game/TurnPanel.tsx';
import { ConfirmSeal } from './ConfirmSeal.tsx';

/*
 * Bausteine der Ansage: Kopf, Messleiste, Münzen der Führung, Systemwahl der Kriegsführung und
 * die Knöpfe unten. Die Marker selbst liegen auf dem Pult; hier steht nur, was dort fehlt.
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

interface MeterProps {
  readonly needed: number;
  readonly plan: TokenPlan;
  readonly warfare: boolean;
}

/**
 * Erhaltene (bei der Kriegsführung von der Karte genommene) Marker und was davon noch in der
 * Schale liegt. Ohne Marker bleibt sie leer und unsichtbar. Die Zeile ist eine Live-Region:
 * Bildschirmleser hören jede Änderung, auch die von Plus und Minus an den Leisten.
 */
export function PromptMeter({ needed, plan, warfare }: MeterProps): ReactElement {
  const t = useT();
  return (
    <p className="table-prompt-meter" aria-live="polite" aria-atomic="true">
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
    </p>
  );
}

/** Führung: Handelswaren als Einfluss, Münze für Münze; jede Änderung setzt die Verteilung zurück. */
export function PromptCoins({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const spent = decision.draft?.tradeGoods ?? 0;
  const actor = decision.route.actor;
  const own = actor === null ? 0 : (findPlayer(game, actor)?.tradeGoods ?? 0);
  if (decision.specId !== 'leadership') return null;
  const step = (delta: 1 | -1, symbol: string, enabled: boolean) => (
    <button
      type="button"
      className="table-prompt-step"
      aria-label={`${t('spendTradeGoods')} ${symbol}`}
      disabled={!enabled}
      onClick={() => decision.act({ kind: 'tradeGoods', delta })}
    >
      {symbol}
    </button>
  );
  return (
    <div className="table-prompt-coins">
      <span>{t('spendTradeGoods')}</span>
      {step(-1, '−', spent > 0)}
      <strong className="table-prompt-count">{spent}</strong>
      {step(1, '+', spent < own)}
    </div>
  );
}

/** Kriegsführung: der Weg per Tastatur zum Marker auf der Karte (dort leuchten dieselben Systeme). */
export function PromptWarfare({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const { route, specId, draft } = decision;
  const systems = route.actor === null ? [] : warfareTokenSystems(game, route.actor);
  if (specId !== 'warfare' || draft === null || systems.length === 0) return null;
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
