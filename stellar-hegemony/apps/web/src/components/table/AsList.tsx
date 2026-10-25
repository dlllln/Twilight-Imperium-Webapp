import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, List } from 'lucide-react';
import { createContext, type ReactElement, type ReactNode, useContext, useState } from 'react';
import { useT } from '../../use-translation.ts';

/*
 * „Als Liste“: Was eine Entscheidung am Tisch noch als Formularliste kennt (die Schiffsliste der
 * Bewegung), liegt in der Ansage eingeklappt. Zugeklappt ist die Liste gar nicht im Baum, damit
 * es nie zwei Bedienwege mit demselben Namen gibt; der Tisch (Flottengriffe) ist der erste Weg.
 * Merkt der Tisch etwas vor, klappt sie von selbst auf und zeigt, was vorgemerkt ist.
 */

/** Ob Formularlisten gerade in der Ansage stehen (Tischansicht) oder offen (klassisch). */
const ListScope = createContext(false);

/** Umschließt alte Formulare in der Ansage: Ihre Listen werden zu „Als Liste“. */
export function AsListScope({ children }: { readonly children: ReactNode }): ReactElement {
  return <ListScope.Provider value>{children}</ListScope.Provider>;
}

interface ListProps {
  readonly children: ReactNode;
  /** Wird dies wahr (etwa: Schiffe vorgemerkt), klappt die Liste von selbst auf. */
  readonly openWhen?: boolean;
}

/** Offen, bis man schließt; ein neues `openWhen` öffnet sie wieder. */
function useAutoOpen(openWhen: boolean) {
  const [open, setOpen] = useState(openWhen);
  const [cause, setCause] = useState(openWhen);
  if (cause !== openWhen) {
    setCause(openWhen);
    if (openWhen) setOpen(true);
  }
  return { open, setOpen };
}

function CollapsedList({ children, openWhen = false }: ListProps): ReactElement {
  const t = useT();
  const { open, setOpen } = useAutoOpen(openWhen);
  return (
    <Collapsible.Root className="as-list" open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="as-list-toggle">
        <List size={13} aria-hidden="true" />
        <span>{t('asList')}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </Collapsible.Trigger>
      <Collapsible.Content className="as-list-body">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

/** Eine Formularliste: in der Ansage eingeklappt „Als Liste“, sonst unverändert offen. */
export function FormList(props: ListProps): ReactElement {
  const scoped = useContext(ListScope);
  return scoped ? <CollapsedList {...props} /> : <>{props.children}</>;
}
