import { Container, Sprite } from 'pixi.js';
import { seededRandom } from './noise.ts';
import { glowTexture } from './textures.ts';

/** Ein Teil einer Bühne: was gezeichnet wird und wie es sich mit der Zeit bewegt. */
export interface Piece {
  readonly display: Container;
  readonly animate: (time: number) => void;
}

const STAR_COUNT = 140;

function twinkle(size: number, alpha: number): Sprite {
  const star = new Sprite(glowTexture());
  star.anchor.set(0.5);
  star.setSize(size, size);
  star.alpha = alpha;
  star.blendMode = 'add';
  return star;
}

/** Funkelnde Hintergrundsterne in festen, aber je Bühne verschiedenen Positionen. */
export function starfield(seed: number, width: number, height: number): Piece {
  const random = seededRandom(seed);
  const display = new Container();
  const stars = Array.from({ length: STAR_COUNT }, () => {
    const star = twinkle(3 + random() * 7, 0.3 + random() * 0.6);
    star.position.set((random() - 0.5) * width, (random() - 0.5) * height);
    display.addChild(star);
    return { star, phase: random() * Math.PI * 2, base: star.alpha };
  });
  const animate = (time: number) => {
    for (const { star, phase, base } of stars)
      star.alpha = base * (0.65 + 0.35 * Math.sin(time * 0.002 + phase));
  };
  return { display, animate };
}
