import type { ComponentProps, CSSProperties, FocusEvent, PointerEvent, ReactElement } from 'react';
import { useState } from 'react';
import { objectiveArtwork, objectiveFrame } from '../../artwork/cards.ts';
import type { StripCard } from '../../hud/objective-strip.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';

/*
 * Vergrößerte Karte der Auftragsleiste: Wer mit dem Zeiger über einer Karte steht oder sie per
 * Tastatur erreicht, sieht sie groß unter der Leiste, mit vollem Namen und der Bedingung in
 * Worten. Die Leiste selbst rollt waagrecht und würde eine wachsende Karte abschneiden; die
 * Vergrößerung liegt deshalb neben ihr und fängt keine Gesten ab.
 */

/** Vorderseite (eigener Druck) oder bei verdeckten Aufträgen die Rückseite ihrer Stufe. */
export function StripFace({ card }: { readonly card: StripCard }): ReactElement {
  const artwork =
    card.id === null
      ? objectiveArtwork('public', card.stage)
      : objectiveFrame(card.id, card.category, card.stage);
  return (
    <span className="objective-strip-face">
      <CompleteCardArtwork artwork={artwork} />
    </span>
  );
}

export interface Zoom {
  readonly index: number;
  /** Mitte der Karte, waagrecht in Pixeln ab dem linken Rand der Leiste. */
  readonly x: number;
}

type Shown = PointerEvent<HTMLElement> | FocusEvent<HTMLElement>;

/** Was eine Karte der Leiste braucht, damit sie sich vergrößern lässt. */
export type ZoomHandlers = Pick<
  ComponentProps<'li'>,
  'onPointerEnter' | 'onPointerLeave' | 'onFocus' | 'onBlur'
>;

/** Merkt sich, welche Karte vergrößert ist und wo sie in der Leiste liegt. */
export function useZoom() {
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const show = (index: number) => (event: Shown) => {
    // Ein Finger hinterlässt kein Schweben; die Vergrößerung würde nur kurz aufblitzen.
    if ('pointerType' in event && event.pointerType === 'touch') return;
    const item = event.currentTarget;
    const strip = item.closest('.objective-strip');
    if (strip === null) return;
    const box = item.getBoundingClientRect();
    setZoom({ index, x: box.left + box.width / 2 - strip.getBoundingClientRect().left });
  };
  const hide = () => setZoom(null);
  const handlers = (index: number): ZoomHandlers => {
    const enter = show(index);
    return { onPointerEnter: enter, onFocus: enter, onPointerLeave: hide, onBlur: hide };
  };
  return { zoom, handlers };
}

interface ZoomProps {
  readonly card: StripCard;
  readonly name: string;
  readonly text: string;
  readonly x: number;
}

/** Die große Karte; für Bildschirmleser stehen Name und Bedingung schon an der Karte selbst. */
export function StripZoom({ card, name, text, x }: ZoomProps): ReactElement {
  return (
    <div
      className="objective-strip-zoom"
      aria-hidden="true"
      style={{ '--zoom-x': `${String(Math.round(x))}px` } as CSSProperties}
    >
      <StripFace card={card} />
      <strong>{name}</strong>
      {text !== '' && <span>{text}</span>}
    </div>
  );
}
