/**
 * Рантайм-проверка фирменного шрифта.
 *
 * Почему это код, а не доверие к CSS. Шрифт однажды молча не подключился, и
 * дефект дошёл до просмотра макетов: файлы были на месте, base64 валиден,
 * но `font-family` был объявлен только на `html`, тогда как внешний reset
 * объявлял его прямо на `body` — прямое объявление победило наследование.
 * Визуально всё выглядело правильно ровно до того момента, когда это стало
 * важно.
 *
 * Отсюда правило README §1.8, три части которого обязательны вместе:
 * `font-family` на `html` И на `body` И на элементах форм · URL в `@font-face`
 * всегда в кавычках · `font-display: block`.
 *
 * Но правило в документе не гарантирует состояние в браузере, поэтому здесь
 * проверка факта: браузер сообщает, доступно ли начертание. Провал показывается
 * ВИДИМО — тихий провал был бы повторением исходного дефекта.
 */

export type FontCheck = {
  ok: boolean
  missing: string[]
  checked: string[]
}

const REQUIRED: ReadonlyArray<readonly [string, string]> = [
  ['400 16px "Visuelt Pro"', 'Regular — caption и плотные таблицы'],
  ['500 16px "Visuelt Pro"', 'Medium — body'],
  ['700 16px "Visuelt Pro"', 'Bold — заголовки и герой-числа'],
]

/**
 * Проверяет три начертания. Вызывать ПОСЛЕ `document.fonts.ready`, иначе
 * ответ будет отрицательным просто потому, что загрузка не завершилась —
 * то есть проверка соврёт в безопасную сторону, а это тоже ложь.
 */
export function checkFonts(): FontCheck {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return { ok: false, missing: ['document.fonts недоступен'], checked: [] }
  }
  const missing: string[] = []
  const checked: string[] = []
  for (const [spec, role] of REQUIRED) {
    checked.push(`${spec} · ${role}`)
    if (!document.fonts.check(spec)) missing.push(`${spec} (${role})`)
  }
  return { ok: missing.length === 0, missing, checked }
}

/**
 * Дополнительная проверка каскада: `font-family` обязан быть применён к
 * `html`, к `body` и к элементам форм. Первые две — то самое место, где
 * дефект прожил незамеченным; третья — потому что внешний reset обычно
 * сбрасывает шрифт именно у форм.
 */
export function checkCascade(): string[] {
  if (typeof document === 'undefined') return ['document недоступен']
  const problems: string[] = []
  const wanted = 'Visuelt Pro'

  const probe = (el: Element, where: string) => {
    const fam = getComputedStyle(el).fontFamily
    if (!fam.includes(wanted)) problems.push(`${where}: font-family = ${fam}`)
  }
  probe(document.documentElement, 'html')
  probe(document.body, 'body')

  const input = document.createElement('input')
  document.body.appendChild(input)
  probe(input, 'input')
  input.remove()

  // Фон страницы обязан быть белым: акцентный оранжевый достигает порога
  // контраста R-01 только на белом. На канве он даёт 2,60:1 — дефект,
  // который прожил четыре цикла аудита, потому что величину 3,10:1 никто
  // не спросил «на какой подложке».
  const bg = getComputedStyle(document.body).backgroundColor
  const white = ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)', 'transparent']
  if (!white.includes(bg)) {
    problems.push(`body background = ${bg}; акцентный текст требует белой подложки (R-01)`)
  }
  return problems
}
