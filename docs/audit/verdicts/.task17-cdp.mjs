import { writeFileSync } from 'node:fs'

const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json())
const target = targets.find((t) => t.type === 'page')
if (!target) throw new Error('CDP page target not found')

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

let nextId = 1
const pending = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id) return
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result)
})

function send(method, params = {}) {
  const id = nextId++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}

async function waitFor(expression, timeout = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out: ${expression}`)
}

async function clickText(text, selector = 'button', index = 0) {
  const ok = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((node) => (node.innerText || node.textContent || '').includes(${JSON.stringify(text)}))
    const node = nodes[${index}]
    if (!node) return false
    node.click()
    return true
  })()`)
  if (!ok) throw new Error(`No ${selector} containing ${text}`)
  await new Promise((resolve) => setTimeout(resolve, 80))
}

async function setViewport(width, height = 1000) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  })
  await new Promise((resolve) => setTimeout(resolve, 80))
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(`/tmp/task17-${name}.png`, Buffer.from(result.data, 'base64'))
}

async function surface(name, takeScreenshot = true) {
  await waitFor('document.querySelector("main")')
  const value = await evaluate(`(() => ({
    name: ${JSON.stringify(name)},
    main: document.querySelector('main')?.innerText || '',
    aside: document.querySelector('aside')?.innerText || '',
    h1: document.querySelector('main h1')?.innerText || '',
  }))()`)
  if (takeScreenshot) await screenshot(name)
  return value
}

async function chapter(n) {
  const ok = await evaluate(`(() => {
    const node = document.querySelectorAll('.a3-chapters button')[${n - 1}]
    if (!node) return false
    node.click()
    return true
  })()`)
  if (!ok) throw new Error(`Chapter ${n} not found`)
  await new Promise((resolve) => setTimeout(resolve, 100))
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.bringToFront')
await setViewport(1440)
await send('Page.navigate', { url: 'http://127.0.0.1:5174/' })
await waitFor('document.querySelector("main")')

const de = []
de.push(await surface('01-list'))
await clickText('Vorbereiten')
de.push(await surface('02-opportunity'))

await clickText('Kundenwert übernehmen')
await clickText('Projektparameter bestätigen')
await clickText('Opportunity Option anlegen')
await clickText('Opportunity Option anlegen')
await clickText('Öffnen')
await waitFor('document.querySelector("aside")')

// Chapter 1: confirm both classification and the building before entering catalog chapters.
await clickText('Klassifikation bestätigen')
await clickText('Gebäudedaten bestätigen')
de.push(await surface('03-ch1'))
for (let n = 2; n <= 9; n++) {
  await chapter(n)
  de.push(await surface(`${String(n + 2).padStart(2, '0')}-ch${n}`))
}
de.push({ name: '12-panel', main: '', aside: de.at(-1).aside, h1: '' })

await clickText('Variantenvergleich')
de.push(await surface('13-compare'))
await clickText('Export')
de.push(await surface('14-export'))

// Geometry at the required viewport widths, in DE and then EN.
const geometry = []
for (const width of [1100, 1440, 1920]) {
  await setViewport(width)
  geometry.push(await evaluate(`(() => {
    const aside = document.querySelector('aside')
    const total = document.querySelector('.a3-hb-total .a3-hb-num')
    const body = document.documentElement
    const ar = aside?.getBoundingClientRect()
    const tr = total?.getBoundingClientRect()
    return { width: ${width}, lang: 'de', asideClient: aside?.clientWidth, asideScroll: aside?.scrollWidth,
      asideRight: ar?.right, totalRight: tr?.right, viewport: innerWidth,
      documentClient: body.clientWidth, documentScroll: body.scrollWidth }
  })()`))
}

// Return to list, switch EN, and repeat the golden path using the retained store.
await setViewport(1440)
await clickText('Opportunities')
await evaluate(`document.querySelector('input[value="en"]')?.click()`)
await new Promise((resolve) => setTimeout(resolve, 100))
const en = []
en.push(await surface('en-list', false))
await clickText('Prepare')
en.push(await surface('en-opportunity', false))
await clickText('Open', 'button', 1)
for (let n = 1; n <= 9; n++) {
  await chapter(n)
  en.push(await surface(`en-ch${n}`, false))
}
en.push({ name: 'en-panel', main: '', aside: en.at(-1).aside, h1: '' })
await clickText('Variant comparison')
en.push(await surface('en-compare', false))
await clickText('Export')
en.push(await surface('en-export', false))

for (const width of [1100, 1440, 1920]) {
  await setViewport(width)
  geometry.push(await evaluate(`(() => {
    const aside = document.querySelector('aside')
    const total = document.querySelector('.a3-hb-total .a3-hb-num')
    const body = document.documentElement
    const ar = aside?.getBoundingClientRect()
    const tr = total?.getBoundingClientRect()
    return { width: ${width}, lang: 'en', asideClient: aside?.clientWidth, asideScroll: aside?.scrollWidth,
      asideRight: ar?.right, totalRight: tr?.right, viewport: innerWidth,
      documentClient: body.clientWidth, documentScroll: body.scrollWidth }
  })()`))
}

// Presentation DOM: the classification reason must not expose internal requirement IDs.
await setViewport(1440)
await evaluate(`document.querySelector('input[value="praesentation"]')?.click()`)
await new Promise((resolve) => setTimeout(resolve, 100))
await clickText('Configurator')
await chapter(1)
const presentation = await evaluate(`({
  hasCalc004: document.body.innerText.includes('CALC-004'),
  calcLines: document.body.innerText.split('\\n').filter((x) => x.includes('CALC-004')),
  hasRussian: /[А-Яа-яЁё]/.test(document.body.innerText),
})`)

// Popover: open a low trigger with its trigger at the viewport bottom.
await evaluate(`document.querySelector('input[value="intern"]')?.click()`)
await chapter(1)
await evaluate(`(() => {
  const aside = document.querySelector('aside')
  const disclosure = [...aside.querySelectorAll('button')].find((b) =>
    b.innerText.includes('Kostentreiber') || b.innerText.includes('Cost drivers'))
  disclosure?.click()
})()`)
await new Promise((resolve) => setTimeout(resolve, 100))
const detailsCount = await evaluate(`document.querySelectorAll('aside button').length`)
await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('aside button')].filter((b) => b.innerText.includes('Details'))
  const button = buttons.at(-1)
  button?.scrollIntoView({block:'end'})
  button?.click()
})()`)
await new Promise((resolve) => setTimeout(resolve, 120))
const popoverOpen = await evaluate(`(() => {
  const dialog = document.querySelector('body > [role="dialog"]')
  const r = dialog?.getBoundingClientRect()
  return { detailsCount: ${detailsCount}, exists: !!dialog, parent: dialog?.parentElement?.tagName,
    top: r?.top, bottom: r?.bottom, left: r?.left, right: r?.right,
    viewportW: innerWidth, viewportH: innerHeight,
    invalidPBlock: document.querySelectorAll('p div, p ol').length,
    activeText: document.activeElement?.innerText || '' }
})()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
await new Promise((resolve) => setTimeout(resolve, 100))
const popoverEsc = await evaluate(`({ exists: !!document.querySelector('body > [role="dialog"]'),
  activeText: document.activeElement?.innerText || '' })`)

// Reopen and prove capture-phase scrolling closes the layer.
await evaluate(`(() => {
  const button = [...document.querySelectorAll('aside button')].filter((b) => b.innerText.includes('Details')).at(-1)
  button?.click()
})()`)
await new Promise((resolve) => setTimeout(resolve, 80))
await evaluate(`document.querySelector('aside')?.scrollBy(0, -20)`)
await new Promise((resolve) => setTimeout(resolve, 80))
const popoverScroll = await evaluate(`({ exists: !!document.querySelector('body > [role="dialog"]') })`)

// Delta slot must reserve layout; movement belongs to the system class, not Framer inline styles.
await chapter(6)
await new Promise((resolve) => setTimeout(resolve, 4200))
const deltaBefore = await evaluate(`(() => {
  const slot = document.querySelector('.a3-delta-slot')
  const cart = document.querySelector('[aria-label="Im Angebot gewählt"]')
  return { slotHeight: slot?.getBoundingClientRect().height, cartTop: cart?.getBoundingClientRect().top }
})()`)
await evaluate(`(() => {
  const radios = [...document.querySelectorAll('main input[type="radio"]')].filter((r) => !r.checked && !r.disabled)
  radios[0]?.click()
})()`)
const deltaImmediate = await evaluate(`(() => {
  const chip = document.querySelector('.a3-delta')
  const cart = document.querySelector('[aria-label="Im Angebot gewählt"]')
  return { classes: chip?.className, inlineStyle: chip?.getAttribute('style'),
    transition: chip ? getComputedStyle(chip).transitionProperty : null,
    cartTop: cart?.getBoundingClientRect().top }
})()`)
await new Promise((resolve) => setTimeout(resolve, 40))
const deltaAfterFrame = await evaluate(`(() => {
  const chip = document.querySelector('.a3-delta')
  const cart = document.querySelector('[aria-label="Im Angebot gewählt"]')
  return { classes: chip?.className, opacity: chip ? getComputedStyle(chip).opacity : null,
    transform: chip ? getComputedStyle(chip).transform : null,
    cartTop: cart?.getBoundingClientRect().top }
})()`)
await new Promise((resolve) => setTimeout(resolve, 300))
const deltaSettled = await evaluate(`(() => {
  const chip = document.querySelector('.a3-delta')
  const cart = document.querySelector('[aria-label="Im Angebot gewählt"]')
  return { classes: chip?.className, opacity: chip ? getComputedStyle(chip).opacity : null,
    transform: chip ? getComputedStyle(chip).transform : null,
    cartTop: cart?.getBoundingClientRect().top }
})()`)

// Reduced motion: both Gantt and delta transitions/animations are suppressed.
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await chapter(9)
await new Promise((resolve) => setTimeout(resolve, 100))
const reducedMotion = await evaluate(`(() => {
  const seg = document.querySelector('.a3-g-seg')
  const chip = document.querySelector('.a3-delta')
  return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    ganttTransition: seg ? getComputedStyle(seg).transitionDuration : null,
    ganttAnimation: seg ? getComputedStyle(seg).animationName : null,
    ganttTransform: seg ? getComputedStyle(seg).transform : null,
    deltaTransition: chip ? getComputedStyle(chip).transitionDuration : null,
    deltaAnimation: chip ? getComputedStyle(chip).animationName : null }
})()`)

// Scroll-reset proof. Scroll main, switch chapter, and read the resulting offset.
await evaluate(`document.querySelector('main').scrollTop = 900`)
const scrollBefore = await evaluate(`document.querySelector('main').scrollTop`)
await chapter(8)
await new Promise((resolve) => setTimeout(resolve, 100))
const scrollReset = await evaluate(`({ before: ${scrollBefore}, after: document.querySelector('main').scrollTop,
  activeTag: document.activeElement?.tagName, activeText: document.activeElement?.innerText || '' })`)

const german = /[äöüÄÖÜß]|\b(der|die|das|und|oder|noch|nicht|mit|aus|für|von|zum|zur|im|auf|Angebot|Kapitel|Gebäude|Preis|Schätzunsicherheit|Monate|Berechnung|Kunde|bestätigt|enthalten|Kostentreiber|Bauzeit|Flächen|Frage|Risiko|Zurück|Weiter|wählen|verfügbar|Dokumentation|Prüfung|Ergebnis|Umfang|Technik|Energie|Zertifikate|Termine|Kommerzielles|Herkunft|Änderung|Grundstück)\b/i
const enRemainder = en.map((s) => ({
  name: s.name,
  lines: [...new Set(`${s.main}\n${s.aside}`.split('\n').map((x) => x.trim()).filter((x) => x && german.test(x)))],
}))

console.log(JSON.stringify({
  de: de.map(({ name, h1 }) => ({ name, h1 })),
  geometry,
  presentation,
  popoverOpen,
  popoverEsc,
  popoverScroll,
  deltaBefore,
  deltaImmediate,
  deltaAfterFrame,
  deltaSettled,
  reducedMotion,
  scrollReset,
  enRemainder,
}, null, 2))

ws.close()
