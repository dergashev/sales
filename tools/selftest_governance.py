#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Двустороннее доказательство живости GOV-* границ.

Каждый случай строит минимальное синтетическое дерево. Запрещённый случай
обязан дать адресную находку нужного класса; разрешённый — не дать ни одной
GOV-находки. Поэтому детектор, который всегда срабатывает, тест не пройдёт.

Запуск: `python3 tools/selftest_governance.py`.
"""
import pathlib
import shutil
import sys
import tempfile
from typing import Dict, Optional

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify import Verifier  # noqa: E402  (путь настраивается выше)


BASE_FILES = {
    'src/App.tsx': (
        "import { Grundlagen } from './screens/Grundlagen'\n"
        'export const App = Grundlagen\n'
    ),
    'src/components/primitives.tsx': (
        "import { useId } from 'react'\n"
        "import { formatDE } from '../engine/money'\n"
        "import { useT } from '../i18n'\n"
        "import { useSemanticMotion } from '../design-system/motion'\n"
        'export const Primitive = { useId, formatDE, useT, useSemanticMotion }\n'
    ),
    'src/components/EstimateUncertaintyBadge.tsx': (
        "import { formatDE } from '../engine/money'\n"
        'export const EstimateUncertaintyBadge = formatDE\n'
    ),
    'src/components/controls.tsx': (
        "import { useId } from 'react'\nexport const Control = useId\n"
    ),
    'src/components/designSystem.tsx': (
        "import { Primitive } from './primitives'\n"
        "import { Control } from './controls'\n"
        'export const DesignSystem = { Primitive, Control }\n'
    ),
    'src/components/Dialog.tsx': (
        "import { createPortal } from 'react-dom'\nexport const Dialog = createPortal\n"
    ),
    'src/components/DataStates.tsx': (
        "import { Primitive } from './primitives'\nexport const DataStates = Primitive\n"
    ),
    'src/design-system/motion.ts': (
        "import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'\n"
        'export const useSemanticMotion = useFramerReducedMotion\n'
    ),
    'src/screens/Grundlagen.tsx': (
        "import { Diagnostics } from '../components/Diagnostics'\n"
        "import { Gallery } from '../design-system/Gallery'\n"
        'export const Grundlagen = { Diagnostics, Gallery }\n'
    ),
    'src/components/Diagnostics.tsx': 'export const Diagnostics = 1\n',
    'src/design-system/Gallery.tsx': (
        "import { Registry } from './registry'\nexport const Gallery = Registry\n"
    ),
    'src/design-system/registry.tsx': (
        "import { Primitive } from '../components/primitives'\n"
        'export const Registry = Primitive\n'
    ),
    'src/state/data-states.ts': 'export const DATA_STATES = {}\n',
    'src/Probe.tsx': 'export const Probe = () => null\n',
    'design-system/components.css': '.a3-probe{color:var(--color-text-primary)}\n',
    'vite.config.ts': 'export default {}\n',
    'vitest.config.ts': 'export default {}\n',
    'tailwind.config.ts': 'export default {}\n',
    'tsconfig.json': '{}\n',
}


def build(root: pathlib.Path, overrides: Dict[str, Optional[str]]) -> None:
    files = dict(BASE_FILES)
    files.update(overrides)
    for rel, source in files.items():
        path = root / rel
        if source is None:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding='utf-8')


def governance_findings(root: pathlib.Path):
    verifier = Verifier(root)
    verifier.check_design_system_governance()
    return [finding for finding in verifier.new if finding[0].startswith('GOV-')]


# Описание, изменённые файлы, ожидаемый класс (None = полное молчание),
# фрагмент actionable-сообщения, который обязан присутствовать.
CASES = [
    (
        'GOV-DS-DEP: canonical → state/store запрещён',
        {'src/components/primitives.tsx': "import { useStore } from '../state/store'\n"},
        'GOV-DS-DEP', '../state/store',
    ),
    (
        'GOV-DS-DEP: canonical → i18n разрешён',
        {'src/components/primitives.tsx': "import { useT } from '../i18n'\n"},
        None, None,
    ),
    (
        'GOV-DS-DEP: canonical → exact engine/money разрешён',
        {'src/components/EstimateUncertaintyBadge.tsx':
         "import { formatDE } from '../engine/money'\n"},
        None, None,
    ),
    (
        'GOV-DS-DEP: закомментированный запрещённый import молчит',
        {'src/components/primitives.tsx':
         "// import { useStore } from '../state/store'\nexport const Primitive = 1\n"},
        None, None,
    ),
    (
        'GOV-DS-DEP: отсутствующий manifest-модуль не превращается в тихий ноль',
        {'src/components/Dialog.tsx': None},
        'GOV-DS-DEP', '[вакуум]',
    ),
    (
        'GOV-QA-BOUNDARY: продукт → Gallery запрещён',
        {'src/screens/S3Konfigurator.tsx':
         "import { Gallery } from '../design-system/Gallery'\n"},
        'GOV-QA-BOUNDARY', 'единственная внешняя грань',
    ),
    (
        'GOV-QA-BOUNDARY: динамический продукт → Gallery запрещён',
        {'src/screens/S3Konfigurator.tsx':
         "export const load = () => import('../design-system/Gallery')\n"},
        'GOV-QA-BOUNDARY', 'единственная внешняя грань',
    ),
    (
        'GOV-QA-BOUNDARY: App → Grundlagen разрешён',
        {'src/App.tsx': "import { Grundlagen } from './screens/Grundlagen'\n"},
        None, None,
    ),
    (
        'GOV-QA-BOUNDARY: Grundlagen → Diagnostics разрешён',
        {'src/screens/Grundlagen.tsx':
         "import { Diagnostics } from '../components/Diagnostics'\n"},
        None, None,
    ),
    (
        'GOV-QA-BOUNDARY: barrel re-export запрещён',
        {'src/design-system/Gallery.tsx': "export { Registry } from './registry'\n"},
        'GOV-QA-BOUNDARY', 'barrel re-export',
    ),
    (
        'GOV-RETIRED-PATH: @ds alias не возвращается',
        {'vite.config.ts': "export const alias = { '@ds': './design-system' }\n"},
        'GOV-RETIRED-PATH', '@ds',
    ),
    (
        'GOV-RETIRED-PATH: EstimateUncertaintyBadge не совпадает подстрокой',
        {'src/Probe.tsx': (
            "import { EstimateUncertaintyBadge } "
            "from './components/EstimateUncertaintyBadge'\n")},
        None, None,
    ),
    (
        'GOV-RETIRED-PATH: UncertaintyBand запрещён',
        {'src/Probe.tsx': "import { UncertaintyBand } from './components/UncertaintyBand'\n"},
        'GOV-RETIRED-PATH', 'EstimateUncertaintyBadge',
    ),
    (
        'GOV-RETIRED-PATH: product useReducedMotion запрещён',
        {'src/Probe.tsx': "import { useReducedMotion } from 'framer-motion'\n"},
        'GOV-RETIRED-PATH', 'useSemanticMotion',
    ),
    (
        'GOV-RETIRED-PATH: framer hook внутри motion.ts разрешён',
        {'src/design-system/motion.ts': (
            "import { useReducedMotion as useFramerReducedMotion } "
            "from 'framer-motion'\n")},
        None, None,
    ),
    (
        'GOV-RETIRED-PATH: ALL_SPECIMENS не возвращается',
        {'src/Probe.tsx': 'export const ALL_SPECIMENS = []\n'},
        'GOV-RETIRED-PATH', 'COMPONENT_REGISTRY',
    ),
    (
        'GOV-RETIRED-PATH: DataStateKey не возвращается',
        {'src/Probe.tsx': 'export type DataStateKey = string\n'},
        'GOV-RETIRED-PATH', 'DataStateKind',
    ),
    (
        'GOV-RETIRED-PATH: HIT helper не возвращается',
        {'src/Probe.tsx': "export const HIT = 'before:min-h-hit-target'\n"},
        'GOV-RETIRED-PATH', 'hit-target',
    ),
    (
        'GOV-RETIRED-PATH: qa.notBuilt key не возвращается',
        {'src/Probe.tsx': "export const key = 'qa.notBuilt'\n"},
        'GOV-RETIRED-PATH', 'cf7a7bf',
    ),
    (
        'GOV-RETIRED-PATH: общий .circle helper запрещён',
        {'src/local.css': '.circle{border-radius:50%}\n'},
        'GOV-RETIRED-PATH', '.circle',
    ),
    (
        'GOV-RETIRED-PATH: историческое имя в комментарии молчит',
        {'src/Probe.tsx': '// ALL_SPECIMENS был снят в cleanup\nexport const Probe = 1\n'},
        None, None,
    ),
    (
        'GOV-TOKEN: literal color в components.css запрещён',
        {'design-system/components.css': '.a3-probe{color:#FD5E00}\n'},
        'GOV-TOKEN', '#FD5E00',
    ),
    (
        'GOV-TOKEN: semantic var в components.css разрешён',
        {'design-system/components.css':
         '.a3-probe{color:var(--color-brand-accent)}\n'},
        None, None,
    ),
    (
        'GOV-TOKEN: литерал в CSS-комментарии молчит',
        {'design-system/components.css':
         '/* снято: #FD5E00 */\n.a3-probe{color:var(--color-brand-accent)}\n'},
        None, None,
    ),
    (
        'GOV-TOKEN: gradient в src CSS запрещён',
        {'src/local.css': '.x{background:linear-gradient(red, blue)}\n'},
        'GOV-TOKEN', 'linear-gradient',
    ),
    (
        'GOV-TOKEN: literal color в production TSX запрещён',
        {'src/Probe.tsx': "export const color = '#FD5E00'\n"},
        'GOV-TOKEN', '#FD5E00',
    ),
    (
        'GOV-TOKEN: browser-normalized font diagnostic sentinels разрешены',
        {'src/lib/font-check.ts': (
            "const white = ['rgb(255, 255, 255)', "
            "'rgba(0, 0, 0, 0)', 'transparent']\n")},
        None, None,
    ),
    (
        'GOV-TOKEN: похожий browser color вне exact sentinel запрещён',
        {'src/lib/font-check.ts':
         "export const style = 'rgb(255, 255, 255)'\n"},
        'GOV-TOKEN', 'rgb(255, 255, 255)',
    ),
    (
        'GOV-TOKEN: test-only contrast literals разрешены',
        {'src/components/__tests__/button.dom.test.tsx':
         "export const accent = '#FD5E00'\n"},
        None, None,
    ),
    (
        'GOV-TOKEN: w-[42px] запрещён',
        {'src/Probe.tsx':
         'export const Probe = () => <div className="w-[42px]" />\n'},
        'GOV-TOKEN', 'w-[42px]',
    ),
    (
        'GOV-TOKEN: arbitrary rem также запрещён',
        {'src/Probe.tsx':
         'export const Probe = () => <div className="mt-[1.5rem]" />\n'},
        'GOV-TOKEN', 'mt-[1.5rem]',
    ),
    (
        'GOV-TOKEN: token-based arbitrary color разрешён',
        {'src/Probe.tsx': (
            'export const Probe = () => '
            '<input className="accent-[color:var(--x)]" />\n')},
        None, None,
    ),
    (
        'GOV-TOKEN: structural content arbitrary value разрешён',
        {'src/Probe.tsx':
         "export const Probe = () => <span className=\"before:content-['']\" />\n"},
        None, None,
    ),
]


def main() -> int:
    failed = []
    for description, overrides, expected_class, message_fragment in CASES:
        root = pathlib.Path(tempfile.mkdtemp(prefix='a3-governance-'))
        try:
            build(root, overrides)
            findings = governance_findings(root)
            if expected_class is None:
                ok = not findings
            else:
                matching = [finding for finding in findings
                            if finding[0] == expected_class]
                ok = bool(matching) and (
                    message_fragment is None
                    or any(message_fragment in finding[2] for finding in matching))
            mark = '✓' if ok else '✗'
            print(f'  {mark} {description}')
            if not ok:
                print(f'      ожидался класс {expected_class or "полное молчание"}; '
                      f'получено: {findings[:3]}')
                failed.append(description)
        finally:
            shutil.rmtree(root, ignore_errors=True)

    print(f'\nGOVERNANCE · {len(CASES)} разрешённых/запрещённых веток, '
          f'провалов: {len(failed)}')
    if failed:
        print('НЕ ДОКАЗАНО:')
        for description in failed:
            print(f'  ✗ {description}')
        return 1
    print('Каждый запрет срабатывает адресно, каждый разрешённый случай молчит.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
