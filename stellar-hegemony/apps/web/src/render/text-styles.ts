import { Text, type TextStyleOptions } from 'pixi.js';
import { GOLD_BRIGHT } from './palette.ts';

export const UI_FONT = "'Exo 2', 'Segoe UI', sans-serif";
export const TITLE_FONT = "'Cinzel', Georgia, serif";
const OUTLINE = { color: 0x02040a, width: 3, join: 'round' } as const;
/** Text wird mehrfach aufgelöst gerendert, damit er beim Hineinzoomen scharf bleibt. */
const TEXT_RESOLUTION = 4;

export const RESOURCE_STYLE: TextStyleOptions = {
  fontFamily: UI_FONT,
  fontSize: 11,
  fontWeight: '700',
  fill: GOLD_BRIGHT,
  stroke: OUTLINE,
};

export const INFLUENCE_STYLE: TextStyleOptions = { ...RESOURCE_STYLE, fill: 0x7cc4ff };

export const COUNT_STYLE: TextStyleOptions = {
  fontFamily: UI_FONT,
  fontSize: 8,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: OUTLINE,
};

export const LABEL_STYLE: TextStyleOptions = {
  fontFamily: UI_FONT,
  fontSize: 7,
  fill: 0x9aa6c8,
  letterSpacing: 1,
};

export const SEAT_STYLE: TextStyleOptions = {
  fontFamily: TITLE_FONT,
  fontSize: 30,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: { ...OUTLINE, width: 4 },
};

export const GLYPH_STYLE: TextStyleOptions = { ...COUNT_STYLE, fontSize: 11 };

/** Zentrierter Text an einer Stelle des Hexfelds. */
export function label(text: string, style: TextStyleOptions, x: number, y: number): Text {
  const result = new Text({ text, style, resolution: TEXT_RESOLUTION });
  result.anchor.set(0.5);
  result.position.set(x, y);
  return result;
}
