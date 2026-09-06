import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Общая подготовка jsdom-прогонов.
 *
 * `matchMedia` в jsdom не реализован, а от него зависит канонический
 * `useSemanticMotion`,
 * то есть правило проекта 21. Заглушка сделана **управляемой**: тест может
 * объявить, что пользователь просит уменьшить движение, и проверить, что
 * движение действительно погашено. Заглушка, всегда отвечающая «нет»,
 * закрывала бы вопрос, не проверяя его.
 */
let reducedMotion = false

export function setReducedMotion(value: boolean): void {
  reducedMotion = value
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  // framer-motion и счёт числа опираются на кадры анимации; в jsdom их нет.
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame
    window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame
  }
}

afterEach(() => {
  cleanup()
  setReducedMotion(false)
  vi.useRealTimers()
  /**
   * The address bar is application state now (2026-09-06 IA audit): a
   * destination writes a path, and `App` reads that path back on mount. In
   * a browser every session starts at whatever the user opened; in a suite,
   * jsdom keeps ONE `window` for a whole file, so a case that navigated
   * into an Option would hand the next case its deep link and the next case
   * would boot inside that Option instead of at the portfolio.
   *
   * Resetting here is the honest equivalent of a fresh tab, and it is the
   * SAME place `cleanup()` already resets the DOM — the alternative, making
   * `__resetStoreForTests` touch `history`, would put a browser concern
   * inside the store.
   */
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/')
  }
})
