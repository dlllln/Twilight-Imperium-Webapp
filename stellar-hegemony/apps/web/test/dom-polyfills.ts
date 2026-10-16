/** jsdom kennt einige Browser-APIs nicht, die Radix und unsere Hooks nutzen. */
export function installDomPolyfills(): void {
  if (!('ResizeObserver' in globalThis))
    Object.assign(globalThis, {
      ResizeObserver: class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    });
  const element = Element.prototype as Partial<Element>;
  element.scrollIntoView ??= () => undefined;
  element.hasPointerCapture ??= () => false;
  element.setPointerCapture ??= () => undefined;
  element.releasePointerCapture ??= () => undefined;
}
