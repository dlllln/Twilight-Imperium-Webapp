import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { type ReactElement, type ReactNode, useState } from 'react';

interface PanelProps {
  readonly title: ReactNode;
  readonly icon: LucideIcon;
  readonly children: ReactNode;
  /** Anker für die Anleitung (`data-tutorial`). */
  readonly tutorial?: string;
  readonly className?: string;
  readonly defaultOpen?: boolean;
}

/**
 * Einklappbarer Abschnitt der Seitenleiste mit Symbol. Der Inhalt bleibt im DOM
 * (nur verborgen), damit Zustände von Formularen beim Zuklappen erhalten bleiben.
 */
export function Panel({
  title,
  icon: Icon,
  children,
  tutorial,
  className = '',
  defaultOpen = true,
}: PanelProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <section className={`game-section panel ${className}`} data-tutorial={tutorial}>
        <h2 className="panel-title">
          <Collapsible.Trigger className="panel-trigger">
            <Icon size={16} className="panel-icon" aria-hidden="true" />
            <span className="panel-label">{title}</span>
            <ChevronDown size={16} className="panel-chevron" aria-hidden="true" />
          </Collapsible.Trigger>
        </h2>
        <Collapsible.Content forceMount className="panel-body">
          {children}
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
}
