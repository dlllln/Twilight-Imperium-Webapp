import * as Tooltip from '@radix-ui/react-tooltip';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

interface IconButtonProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
}

/** Runder Knopf nur mit Symbol; der Name steht im Tooltip und für Screenreader im Label. */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  pressed,
}: IconButtonProps): ReactElement {
  return (
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
      <Tooltip.Portal>
        <Tooltip.Content className="ui-tooltip" side="top" sideOffset={6}>
          {label}
          <Tooltip.Arrow className="ui-tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
