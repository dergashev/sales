import manifest from '../../design-system/assets/options/manifest.json'

/**
 * Изображения карточек опций (поставка № 18).
 *
 * Соответствие «группа + значение → файл» берётся из МАНИФЕСТА поставки,
 * а не собирается по шаблону имени. Шаблон казался бы короче, но он
 * молчалив: переименованный вариант каталога дал бы пустую картинку без
 * единого сигнала. Манифест же сверяется с каталогом машинно — класс
 * `OPT-IMAGE` в `npm run verify` называет и пропущенное значение, и
 * файл-сироту, и объявленный, но отсутствующий файл.
 *
 * Сами файлы разрешаются сборщиком (`import.meta.glob`): в разработке это
 * путь, в сборке — хешированный URL. Строкового пути в коде не существует,
 * поэтому переименование файла ломает сборку, а не показ.
 *
 * Изображение — ВТОРИЧНЫЙ носитель (правило 8): подпись и цена остаются
 * на плитке независимо от того, загрузилось оно или нет.
 */

type Entry = { group: string; value: string; file: string; motifDe: string }

const FILES = {
  ...(import.meta.glob(
    '../../design-system/assets/options/*.webp',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>),
  ...(import.meta.glob(
    '../../design-system/assets/options/*.png',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>),
}

const BY_NAME = new Map(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!, url]),
)

const INDEX = new Map(
  (manifest as Entry[]).map((e) => [`${e.group}/${e.value}`, e]),
)

export type OptionImage = { url: string; motif: string }

/** URL и мотив изображения варианта; `null` — изображения нет. */
export function optionImage(group: string, value: string): OptionImage | null {
  const entry = INDEX.get(`${group}/${value}`)
  if (!entry) return null
  const url = BY_NAME.get(entry.file)
  return url ? { url, motif: entry.motifDe } : null
}
