import { FACTION_NAMES, TACTIC_CARD_TEXTS } from '@stellar/content';
import type { PlayerId, SimBattle, SimRoundReport, SimSide } from '@stellar/domain';
import { Crosshair, Flag, LogOut, RotateCcw } from 'lucide-react';
import { type ReactElement, useMemo } from 'react';
import type { BattleSide } from '../../battle/battle-layout.ts';
import type { MessageKey } from '../../i18n.ts';
import { unitLabel } from '../../labels.ts';
import { RIVAL, seatOf, seriesScore, YOU } from '../../simulator/simulator-rules.ts';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { BattleCanvas } from '../battle/BattleCanvas.tsx';
import { FactionEmblem } from './FactionEmblem.tsx';
import { SeriesPips } from './SeriesPips.tsx';

const toBattleSide = (side: SimSide): BattleSide => ({
  seat: seatOf(side.player),
  ships: side.units.map((unit) => ({
    id: unit.id,
    type: unit.type,
    seat: seatOf(unit.owner),
    damaged: unit.damaged,
  })),
});

/** Schiffe einer Seite als kurze Liste, z. B. „2 Kreuzer · 1 Träger“. */
function useFleetLine(side: SimSide): string {
  const language = useLanguage();
  const counts = new Map<string, number>();
  for (const unit of side.units) counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
  return [...counts]
    .map(([type, count]) => `${String(count)} ${unitLabel(type, language)}`)
    .join(' · ');
}

function SideCard({
  side,
  role,
  faction,
}: {
  readonly side: SimSide;
  readonly role: MessageKey;
  readonly faction: string;
}) {
  const t = useT();
  const language = useLanguage();
  const line = useFleetLine(side);
  return (
    <section className={`side-card ${side.player === YOU ? 'you' : 'rival'}`} aria-label={t(role)}>
      <FactionEmblem id={faction} size={52} />
      <div>
        <p className="side-role">
          {t(role)} · {t(side.player === YOU ? 'you' : 'rival')}
        </p>
        <h3>{FACTION_NAMES[faction]?.[language]}</h3>
        <p className="side-fleet" data-testid={`fleet-${side.player === YOU ? 'you' : 'rival'}`}>
          {line}
        </p>
      </div>
    </section>
  );
}

function hitsOn(report: SimRoundReport, shooter: PlayerId): string {
  const volley = report.volleys.find((entry) => entry.player === shooter);
  const blocked = report.cancelled.find((entry) => entry.player === volley?.target)?.hits ?? 0;
  return `${String(volley?.hits ?? 0)}${blocked > 0 ? ` (${String(blocked)} ✕)` : ''}`;
}

function RoundLog({ report }: { readonly report: SimRoundReport | null }): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  if (report === null) return null;
  const rivalCard = report.played.find((entry) => entry.player === RIVAL)?.card;
  return (
    <p className="round-log" role="status">
      {t('yourVolley')}: <strong>{hitsOn(report, YOU)}</strong> {t('hits')} · {t('rivalVolley')}:{' '}
      <strong>{hitsOn(report, RIVAL)}</strong> {t('hits')}
      {rivalCard !== undefined &&
        ` · ${t('rivalPlays')}: ${TACTIC_CARD_TEXTS[rivalCard]?.name[language] ?? rivalCard}`}
    </p>
  );
}

function Banner({ battle }: { readonly battle: SimBattle }): ReactElement {
  const t = useT();
  return (
    <header className="battle-banner">
      <SeriesPips />
      <div className="banner-plate">
        <h2>{t('spaceCombat')}</h2>
        <p>
          {t('round')} {Math.max(1, battle.round)}
        </p>
      </div>
    </header>
  );
}

function TacticCardButton({ id, busy }: { readonly id: string; readonly busy: boolean }) {
  const language = useLanguage();
  const { card, pickCard } = useSimulatorStore();
  return (
    <button
      type="button"
      className="tactic-card"
      aria-pressed={card === id}
      disabled={busy}
      onClick={() => pickCard(id)}
    >
      <strong>{TACTIC_CARD_TEXTS[id]?.name[language] ?? id}</strong>
      <span>{TACTIC_CARD_TEXTS[id]?.effect[language]}</span>
    </button>
  );
}

function TacticHand({ side, busy }: { readonly side: SimSide; readonly busy: boolean }) {
  const t = useT();
  return (
    <div
      className="tactic-hand"
      role="group"
      aria-label={`${t('tactics')} · ${t('oneCardPerRound')}`}
    >
      {side.hand.map((id) => (
        <TacticCardButton key={id} id={id} busy={busy} />
      ))}
    </div>
  );
}

function outcomeKey(outcome: SimBattle['outcome']): MessageKey {
  if (outcome === YOU) return 'victory';
  return outcome === RIVAL ? 'defeat' : 'draw';
}

function seriesKey(you: number, rival: number): MessageKey {
  if (you === rival) return 'seriesDrawn';
  return you > rival ? 'seriesWon' : 'seriesLost';
}

function Result({ battle }: { readonly battle: SimBattle }): ReactElement {
  const t = useT();
  const { results, nextBattle, close } = useSimulatorStore();
  const score = seriesScore(results);
  return (
    <div className={`battle-result ${outcomeKey(battle.outcome)}`} role="alert">
      <h2>{t(outcomeKey(battle.outcome))}</h2>
      {score.over && (
        <p>
          {t(seriesKey(score.you, score.rival))} · {score.you}:{score.rival}
        </p>
      )}
      <div className="sim-actions">
        <button type="button" className="hex-button" onClick={close}>
          <LogOut size={16} aria-hidden="true" /> {t('leaveSimulator')}
        </button>
        <button type="button" className="hex-button primary" onClick={nextBattle}>
          {score.over ? (
            <RotateCcw size={16} aria-hidden="true" />
          ) : (
            <Flag size={16} aria-hidden="true" />
          )}{' '}
          {t(score.over ? 'newSeries' : 'nextBattle')}
        </button>
      </div>
    </div>
  );
}

function Controls({
  battle,
  busy,
}: {
  readonly battle: SimBattle;
  readonly busy: boolean;
}): ReactElement {
  const t = useT();
  const fire = useSimulatorStore((state) => state.fire);
  return (
    <footer className="battle-controls">
      <TacticHand side={battle.attacker} busy={busy} />
      <button
        type="button"
        className="hex-button primary fire-button"
        disabled={busy}
        onClick={fire}
      >
        <Crosshair size={18} aria-hidden="true" /> {t('fire')}
      </button>
    </footer>
  );
}

/** Dritter Schritt: der Raumkampf auf der Bühne mit Seitenkarten, Runde, Karten und Feuerknopf. */
export function BattleScreen(): ReactElement | null {
  const { shown, battle, faction, rival, report, shots, volley, seed } = useSimulatorStore();
  const sides = useMemo(
    () => (shown === null ? null : [toBattleSide(shown.defender), toBattleSide(shown.attacker)]),
    [shown],
  );
  if (shown === null || battle === null || sides === null) return null;
  const [left, right] = sides as [BattleSide, BattleSide];
  const busy = shown !== battle;
  const over = !busy && shown.outcome !== null;
  return (
    <div className="sim-battle">
      <BattleCanvas left={left} right={right} shots={shots} volley={volley} seed={seed} />
      <Banner battle={shown} />
      <SideCard side={shown.defender} role="defender" faction={rival} />
      <SideCard side={shown.attacker} role="attacker" faction={faction} />
      {busy || over ? null : <RoundLog report={report} />}
      {over ? <Result battle={shown} /> : <Controls battle={shown} busy={busy} />}
    </div>
  );
}
