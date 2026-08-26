import type { Config } from 'tailwindcss'

/**
 * Tailwind маппится НА ТОКЕНЫ, а не заводит собственную шкалу.
 *
 * Правило проекта 2: только семантические токены из design-system/tokens.css;
 * сырые hex, px вне шкалы отступов и собственные цвета запрещены. Правило
 * проекта 2 плюс запрет произвольных значений `[...]` в className означают,
 * что здесь не должно появиться ни одного литерала — только ссылки на
 * переменные CSS.
 *
 * Почему так, а не удобнее. Вторая шкала рядом с токенами — это второй
 * источник правды о размерах, и он разойдётся с первым в первый же день.
 * Ровно этот класс дефекта аудит находил в проекте девять раз.
 *
 * `corePlugins` глушит то, что правила проекта запрещают: скругления,
 * тени и градиенты. Заглушить в конфиге дешевле, чем ловить в ревью, —
 * и невозможно обойти невнимательностью.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Полная замена, не extend: дефолтная палитра Tailwind не должна быть
    // доступна вовсе, иначе `bg-blue-500` пройдёт мимо токенов.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      brand: {
        accent: 'var(--color-brand-accent)',
      },
      action: {
        'primary-bg': 'var(--color-action-primary-bg)',
        'primary-hover': 'var(--color-action-primary-hover)',
        'primary-pressed': 'var(--color-action-primary-pressed)',
        'primary-text': 'var(--color-action-primary-text)',
        'secondary-bg': 'var(--color-action-secondary-bg)',
        'secondary-border': 'var(--color-action-secondary-border)',
        'secondary-text': 'var(--color-action-secondary-text)',
        'secondary-hover': 'var(--color-action-secondary-hover)',
      },
      selection: { border: 'var(--color-selection-border)' },
      focus: {
        separator: 'var(--color-focus-separator)',
        ring: 'var(--color-focus-ring)',
      },
      text: {
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        disabled: 'var(--color-text-disabled)',
        inverse: 'var(--color-text-inverse)',
        'display-accent': 'var(--color-text-display-accent)',
        // R1 (ADR-R1-02): stage-deep is the one surface where inverse text
        // AND the orange hero-numeral exception both apply.
        'stage-deep': 'var(--color-text-stage-deep-primary)',
        'display-accent-stage-deep': 'var(--color-text-display-accent-on-stage-deep)',
      },
      surface: {
        canvas: 'var(--color-surface-canvas)',
        default: 'var(--color-surface-default)',
        // R1 (ADR-R1-01/02): paper/stage/stage-deep — the three-layer model.
        paper: 'var(--color-surface-paper)',
        stage: 'var(--color-surface-stage)',
        'stage-deep': 'var(--color-surface-stage-deep)',
        subtle: 'var(--color-surface-subtle)',
        selected: 'var(--color-surface-selected)',
        overlay: 'var(--color-surface-overlay)',
      },
      border: {
        subtle: 'var(--color-border-subtle)',
        default: 'var(--color-border-default)',
        strong: 'var(--color-border-strong)',
        warning: 'var(--color-border-warning)',
        error: 'var(--color-border-error)',
      },
      // R1 (ADR-R1-03): status trio + dataviz ramp — first Tailwind mapping,
      // both were raw-`var()`/components.css-only before this task.
      status: {
        info: 'var(--color-status-info)',
        success: 'var(--color-status-success)',
        warning: 'var(--color-status-warning)',
        error: 'var(--color-status-error)',
      },
      dataviz: {
        'category-1': 'var(--color-dataviz-category-1)',
        'category-2': 'var(--color-dataviz-category-2)',
        'category-3': 'var(--color-dataviz-category-3)',
        'category-4': 'var(--color-dataviz-category-4)',
        'category-5': 'var(--color-dataviz-category-5)',
        'category-6': 'var(--color-dataviz-category-6)',
        neutral: 'var(--color-dataviz-neutral)',
        divider: 'var(--color-dataviz-segment-divider)',
      },
    },
    // Шкала отступов — ровно восемь шагов токенов. База 8, полушаг 4.
    spacing: {
      0: '0',
      1: 'var(--space-1)',
      2: 'var(--space-2)',
      3: 'var(--space-3)',
      4: 'var(--space-4)',
      5: 'var(--space-5)',
      6: 'var(--space-6)',
      7: 'var(--space-7)',
      8: 'var(--space-8)',
      'hit-target': 'var(--size-hit-target-default)',
    },
    fontFamily: {
      sans: ['var(--font-family)'],
    },
    fontSize: {
      // Пара «кегль + интерлиньяж» неразделима (R-24): назначить кегль
      // без интерлиньяжа — половина правила, и матрица типографики
      // перестаёт быть проверяемой.
      'display-numeric': ['var(--type-display-numeric-desktop-size)',
                          { lineHeight: 'var(--type-display-numeric-desktop-line)' }],
      'display-numeric-narrow': ['var(--type-display-numeric-narrow-size)',
                                 { lineHeight: 'var(--type-display-numeric-narrow-line)' }],
      'heading-1': ['var(--type-heading-1-desktop-size)',
                    { lineHeight: 'var(--type-heading-1-desktop-line)' }],
      'heading-2': ['var(--type-heading-2-size)', { lineHeight: 'var(--type-heading-2-line)' }],
      'heading-3': ['var(--type-heading-3-size)', { lineHeight: 'var(--type-heading-3-line)' }],
      // R1 (ADR-R1-04): metric ramp's middle tier + the mid-page heading
      // recalibration (DESIGN-08/12) — see design-system/tokens.css.
      'metric-section': ['var(--type-metric-section-size)',
                         { lineHeight: 'var(--type-metric-section-line)' }],
      'section-title': ['var(--type-section-title-size)',
                        { lineHeight: 'var(--type-section-title-line)' }],
      body: ['var(--type-body-size)', { lineHeight: 'var(--type-body-line)' }],
      small: ['var(--type-small-size)', { lineHeight: 'var(--type-small-line)' }],
      caption: ['var(--type-caption-size)', { lineHeight: 'var(--type-caption-line)' }],
    },
    fontWeight: {
      regular: 'var(--font-weight-regular)',
      medium: 'var(--font-weight-medium)',
      bold: 'var(--font-weight-bold)',
    },
    // Ширины бордеров — ровно три объявленных токена. Прежняя редакция
    // ссылалась на `--border-width-hairline/-contrast/-selected`, которых в
    // tokens.css НЕ СУЩЕСТВУЕТ: система объявляет `-default/-strong/-focus`.
    // Каждый `border`, `border-contrast` и `border-selected` во всём
    // прототипе получал `border-width: var(<нет такого>)` — объявление
    // невалидно и отбрасывается, то есть ширина приходила от браузера, а не
    // от системы. Нашла это проверка TOKEN-EXISTS на первом же прогоне;
    // глазами дефект не виден, потому что бордер всё равно рисуется.
    borderWidth: {
      0: '0',
      DEFAULT: 'var(--border-width-default)',
      contrast: 'var(--border-width-strong)',
      selected: 'var(--border-width-strong)',
      focus: 'var(--border-width-focus)',
    },
    zIndex: {
      header: 'var(--layer-header)',
      popover: 'var(--layer-popover)',
      tooltip: 'var(--layer-tooltip)',
      'dialog-backdrop': 'var(--layer-dialog-backdrop)',
      dialog: 'var(--layer-dialog)',
      toast: 'var(--layer-toast)',
    },
    transitionDuration: {
      fast: 'var(--motion-duration-fast)',
      base: 'var(--motion-duration-base)',
      slow: 'var(--motion-duration-slow)',
    },
    extend: {
      // Один ключ height: дубль ключа в объекте молча затирает первый —
      // row/row-financial уже однажды пропали именно так.
      height: {
        row: 'var(--row-height)',
        'row-financial': 'var(--row-height-financial)',
      },
      minHeight: {
        'hit-target': 'var(--size-hit-target-default)',
        'delta-slot': 'calc(var(--space-6) + var(--space-2))',
      },
      minWidth: { 'hit-target': 'var(--size-hit-target-default)' },
      maxWidth: {
        content: 'var(--content-max-width)',
        // Панель оффера не имеет права расти за свою ширину, что бы в неё
        // ни положили: в флекс-строке минимальная ширина элемента равна
        // min-content, и одна неразрывная строка кеглем 48 px уносила
        // панель далеко за 400 px, съедая рабочую область.
        'panel-right': 'var(--panel-right-width)',
      },
      width: {
        field: '12ch',
        'panel-left': 'var(--panel-left-width)',
        'panel-right': 'var(--panel-right-width)',
      },
      // R1 (DESIGN-05/§8): MediaFrame's three starting ratios.
      aspectRatio: {
        'media-pano': 'var(--size-ratio-media-pano)',
        'media-card': 'var(--size-ratio-media-card)',
        'media-tile': 'var(--size-ratio-media-tile)',
      },
    },
  },
  corePlugins: {
    // Запрещено правилами проекта 4 и подтверждено аудитом. Идеальные круги
    // разрешены и делаются точечно классом `.circle` в токенах, а не
    // произвольной шкалой скруглений.
    borderRadius: false,
    boxShadow: false,
    dropShadow: false,
    gradientColorStops: false,
    backgroundImage: false,
    blur: false,
  },
}

export default config
