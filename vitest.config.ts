import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Две среды в одном прогоне — намеренно.
 *
 * Движок и хранилище считаются в `node`: им DOM не нужен, а лишняя среда
 * замедляет самый частый прогон. Взаимодействие (клавиатура, фокус,
 * таймеры, `prefers-reduced-motion`) считается в `jsdom` — до 06.08 этой
 * среды не было вовсе, и **весь** этот класс поведения оставался
 * непроверенным: независимый аудит честно вынес его в раздел «проверяется
 * только в браузере».
 *
 * Граница возможностей названа прямо: jsdom **не считает раскладку**.
 * Геометрия — зона нажатия 44 × 44, отсутствие горизонтальной прокрутки,
 * вычисленные кегли 64/48, контраст, загрузка шрифта — здесь непроверяема
 * и остаётся за живым браузером. Тест, который делал бы вид, что проверяет
 * геометрию в jsdom, был бы хуже отсутствующего: он закрывал бы пункт
 * чек-листа, не закрывая риск.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/tests/browser/**'],
    environmentMatchGlobs: [['**/*.dom.test.tsx', 'jsdom']],
    setupFiles: ['./src/test/setup.ts'],
  },
})
