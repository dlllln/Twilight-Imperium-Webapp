import type { GameState } from '@stellar/domain';
import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import { useSettingsStore } from '../../settings-store.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useT } from '../../use-translation.ts';
import { TurnPanelBody } from '../game/TurnPanel.tsx';
import {
  type PartProps,
  PromptActions,
  PromptHead,
  PromptPayHint,
  PromptProgress,
  PromptWarfare,
} from './PromptParts.tsx';
import { RetreatPick } from './PromptBattle.tsx';
import { ReactionLine, SecondarySocketLine } from './PromptPeople.tsx';
import { DiplomacyPick, DoneLine, PlacementList, TradeCorner } from './PromptTactical.tsx';
import { Shipyard } from './Shipyard.tsx';
import { StructureTray } from './StructureTray.tsx';

/*
 * Die Ansage: ein Messingschild über dem rechten Flügel des Pults. Es trägt jede Entscheidung der
 * Tischansicht; was schon am Tisch gespielt wird, zeigt hier nur Kopf, Messleiste und Siegel,
 * alles andere sein bisheriges Formular.
 */

/** Steigt aus dem Flügel auf, statt wie eine Benachrichtigung hereinzugleiten. */
const RISE = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring', stiffness: 380, damping: 32 },
} as const;

const STILL = { initial: false } as const;

/** Diese Arten zeigen nur ihre eine Zeile, ohne Kopf. */
const COMPACT = new Set(['waiting', 'gameOver']);

/**
 * Hinweis über dem Formular; den Kampfhinweis bringt das Formular selbst mit, am Ende der
 * taktischen Aktion steht an seiner Stelle der Abschlusssatz (`DoneLine`).
 */
function PromptHint({ decision }: { readonly decision: TableDecision }): ReactElement | null {
  const t = useT();
  const { hint, route, specId } = decision;
  if (hint === null || specId === 'tacticalDone') return null;
  if (route.kind === 'combat' && specId === null) return null;
  return <p className="hint table-prompt-hint">{t(hint)}</p>;
}

/**
 * Eine am Tisch gespielte Entscheidung: Marker und Planeten auf dem Pult, Aufträge auf der
 * Auftragsleiste, Figuren und Bauplätze auf der Karte, Menschen auf ihren Porträts. Hier stehen
 * von oben nach unten die offene Karte einer Reaktion, Messleiste, Tastaturweg bzw. Bauvorrat
 * oder Werft, gesetzte Gebäude, Ausweg und Siegel, zuletzt der Handel.
 */
function PortedPrompt({ game, decision }: PartProps): ReactElement {
  return (
    <>
      <ReactionLine game={game} decision={decision} />
      <PromptProgress game={game} decision={decision} />
      <DoneLine game={game} decision={decision} />
      <PromptPayHint decision={decision} />
      <PromptWarfare game={game} decision={decision} />
      <DiplomacyPick game={game} decision={decision} />
      <RetreatPick game={game} decision={decision} />
      <StructureTray game={game} decision={decision} />
      <Shipyard game={game} decision={decision} />
      <PlacementList game={game} decision={decision} />
      <PromptActions decision={decision} />
      <TradeCorner game={game} decision={decision} />
    </>
  );
}

function PromptContent({ game, decision }: PartProps): ReactElement {
  const { route, specId } = decision;
  if (COMPACT.has(route.kind)) return <TurnPanelBody game={game} route={route} />;
  return (
    <>
      <PromptHead game={game} decision={decision} />
      <PromptHint decision={decision} />
      <SecondarySocketLine game={game} decision={decision} />
      {specId !== null ? (
        <PortedPrompt game={game} decision={decision} />
      ) : (
        <div className="table-prompt-body">
          <TurnPanelBody game={game} route={route} />
        </div>
      )}
    </>
  );
}

/** Die offene Entscheidung am Pult; ohne Entscheidung bleibt das Schild weg. */
export function TablePrompt({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const animations = useSettingsStore((state) => state.animations);
  const decision = useTableDecision(game);
  if (decision === null) return null;
  return (
    <motion.section
      {...(animations ? RISE : STILL)}
      role="region"
      aria-label={t('decisionRegion')}
      data-testid="decision"
      data-tutorial="turn"
      data-kind={decision.route.kind}
      className="table-prompt"
    >
      <PromptContent game={game} decision={decision} />
    </motion.section>
  );
}
