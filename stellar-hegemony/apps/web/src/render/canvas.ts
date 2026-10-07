/** Leere 2D-Zeichenfläche; null, falls der Browser kein Canvas kann (z. B. Tests). */
export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  return context === null ? null : { canvas, context };
}

/** Füllt ein Bild Pixel für Pixel über eine Farbfunktion (RGBA, 0–255). */
export function paintPixels(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): void {
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y);
      const offset = (y * width + x) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = a;
    }
  }
  context.putImageData(image, 0, 0);
}
