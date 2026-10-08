import * as Tooltip from '@radix-ui/react-tooltip';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

interface IconButtonProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly side?: 'top' | 'bottom';
}

const TOOLTIP_DELAY = 250;

function TooltipBubble({
  label,
  side,
}: {
  readonly label: string;
  readonly side: 'top' | 'bottom';
}) {
  return (
    <Tooltip.Portal>
      <Tooltip.Content className="ui-tooltip" side={side} sideOffset={6}>
        {label}
        <Tooltip.Arrow className="ui-tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

/** Runder Knopf nur mit Symbol; der Name steht im Tooltip und für Screenreader im Label. Bringt seinen Tooltip-Provider selbst mit. */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  pressed,
  side = 'top',
}: IconButtonProps): ReactElement {
  return (
    <Tooltip.Provider delayDuration={TOOLTIP_DELAY}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="round-button"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <TooltipBubble label={label} side={side} />
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
