#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Двустороннее доказательство живости GOV-* границ.

Каждый случай строит минимальное синтетическое дерево. Запрещённый случай
обязан дать адресную находку нужного класса; разрешённый — не дать ни одной
GOV-находки. Поэтому детектор, который всегда срабатывает, тест не пройдёт.

Запуск: `python3 tools/selftest_governance.py`.
"""
import pathlib
import json
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
    # The capability-manifest mutations below own GOV-CAPABILITY. Existing
    # architecture-boundary probes intentionally use a smaller synthetic
    # tree, so keep their signal focused on their own GOV classes.
    return [finding for finding in verifier.new
            if finding[0].startswith('GOV-') and finding[0] != 'GOV-CAPABILITY']


# VR3-01 (backlog 1dedc823) added the ten project-readiness capabilities to
# the gate's approved lifecycle set and moved the canonical WorkflowStepper's
# second real consumer from the retired `OpportunityCard.tsx` to
# `ProjectHome.tsx`. This harness proves the branch in BOTH directions on a
# synthetic tree, so it has to carry the same manifest the gate expects —
# governance requires the two to move atomically.
VR3_CAPABILITY_IDS = [
    'semantic-status', 'authority-trace', 'metric-readout', 'processing-job',
    'document-row', 'prerequisite-state', 'action-gate', 'project-readiness',
    'conflict-resolver', 'question-queue',
    # VR3-02 — the Option building-scope family.
    'building-scope-panel', 'workflow-gate',
    # VR3-03 — the unified configuration family.
    'choice-group', 'scope-decision-ledger', 'kg-configuration-page',
    'commercial-rail', 'commercial-number',
    # VR3-04 — the schedule/validation/save family. Governance requires this
    # harness and `verify.py`'s own allowlist to move ATOMICALLY: the
    # synthetic manifest below must carry exactly the ids the gate expects,
    # or the "valid lifecycle metadata" branch fails on a manifest that is
    # only missing the newest capabilities.
    'schedule-editor', 'validation-review', 'save-receipt',
]
VO_T4_IDS = [
    'canvas', 'paper', 'stage', 'stage-deep', 'media-frame',
    'workflow-stepper', 'legacy-workflow-stepper', 'date-field', 'stepper',
    'composition-bar', 'metric-hierarchy', 'structure-type', 'warning',
    'continuity', 'direction', 'reveal', 'state', 'stagger-list',
    *VR3_CAPABILITY_IDS,
]
VO_T4_ACTIVE = {
    'canvas', 'media-frame', 'workflow-stepper', 'date-field',
    'composition-bar', 'metric-hierarchy', 'warning', 'continuity',
    *VR3_CAPABILITY_IDS,
}
VO_T4_DOWNSTREAM = {
    'paper', 'stage', 'stage-deep', 'stepper', 'structure-type',
    'direction', 'reveal', 'state',
}


def vo_t4_manifest(*, active_consumer_path='src/Probe.tsx', expiry='2099-12-31',
                   owners=True, spine_shell='src/components/Sidebar.tsx'):
    capabilities = []
    for cap_id in VO_T4_IDS:
        if cap_id in VO_T4_ACTIVE:
            if cap_id == 'workflow-stepper':
                # VR3-03: the Sidebar renders the canonical journey SPINE,
                # not a second stepper of its own — the chapter list that
                # justified the old two-consumer manifest is retired.
                consumers = [
                    {'path': spine_shell,
                     'pattern': '<OptionWorkflowSpine' if spine_shell.endswith('Sidebar.tsx')
                     else '<ProjectWorkflowSpine'},
                    {'path': 'src/components/WorkflowSpine.tsx', 'pattern': '<WorkflowStepper'},
                ]
            else:
                consumers = [{'path': active_consumer_path, 'pattern': 'ACTIVE'}]
            capabilities.append({'id': cap_id, 'disposition': 'ACTIVE', 'productConsumers': consumers})
        elif cap_id in VO_T4_DOWNSTREAM:
            entry = {'id': cap_id, 'disposition': 'APPROVED_DOWNSTREAM', 'expiresAt': expiry}
            if owners:
                entry['owners'] = ['VO-T3']
            capabilities.append(entry)
        else:
            capabilities.append({'id': cap_id, 'disposition': 'RETIRED'})
    return json.dumps({'version': 1, 'capabilities': capabilities})


def vo_t4_findings(root: pathlib.Path):
    verifier = Verifier(root)
    verifier._check_vo_t4_capabilities()
    return [finding for finding in verifier.new if finding[0] == 'GOV-CAPABILITY']


def run_vo_t4_capability_cases() -> list[str]:
    cases = [
        ('GOV-CAPABILITY: valid active and downstream lifecycle metadata', {}, None),
        ('GOV-CAPABILITY: active registry-only claim is rejected',
         {'manifest': vo_t4_manifest(active_consumer_path='src/design-system/registry.tsx')},
         'Foundation'),
        ('GOV-CAPABILITY: missing downstream owner is rejected',
         {'manifest': vo_t4_manifest(owners=False)}, 'lacks named downstream owners'),
        ('GOV-CAPABILITY: expired downstream approval is rejected',
         {'manifest': vo_t4_manifest(expiry='2000-01-01')}, 'expired on 2000-01-01'),
        ('GOV-CAPABILITY: duplicate WorkflowStepper ownership is rejected',
         {'src/components/designSystem.tsx': 'export function WorkflowStepper() {}\n'},
         'second WorkflowStepper owner'),
        # VR3-03: one canonical journey definition is the stronger state, but
        # only while a product shell actually renders it — otherwise it is
        # registry-only adoption with one extra hop.
        ('GOV-CAPABILITY: an unrendered journey spine is rejected',
         {'src/components/Sidebar.tsx': 'export const Sidebar = null\n',
          'src/screens/ProjectHome.tsx': 'export const ProjectHome = null\n'},
         'no product shell renders the canonical journey spine'),
        ('GOV-CAPABILITY: a spine rendered by the project shell alone is accepted',
         {'manifest': vo_t4_manifest(spine_shell='src/screens/ProjectHome.tsx'),
          'src/components/Sidebar.tsx': 'export const Sidebar = null\n',
          'src/screens/ProjectHome.tsx': "import { ProjectWorkflowSpine } from '../components/WorkflowSpine'\nexport const ProjectHome = <ProjectWorkflowSpine />\n"},
         None),
    ]
    failed = []
    for description, overrides, message_fragment in cases:
        root = pathlib.Path(tempfile.mkdtemp(prefix='a3-vo-t4-capability-'))
        try:
            base = {
                'src/Probe.tsx': 'export const Probe = "ACTIVE"\n',
                'src/design-system/WorkflowStepper.tsx': 'export function WorkflowStepper() {}\n',
                'src/components/Sidebar.tsx': "import { OptionWorkflowSpine } from './WorkflowSpine'\nexport const Sidebar = <OptionWorkflowSpine />\n",
                'src/components/WorkflowSpine.tsx': "import { WorkflowStepper } from '../design-system/WorkflowStepper'\nexport const Spine = <WorkflowStepper />\n",
                'src/components/designSystem.tsx': 'export const DesignSystem = {}\n',
                'src/design-system/registry.tsx': 'export const Registry = "ACTIVE"\n',
            }
            manifest = overrides.pop('manifest', vo_t4_manifest())
            base['design-system/capability-governance.json'] = manifest
            base.update(overrides)
            build(root, base)
            findings = vo_t4_findings(root)
            ok = not findings if message_fragment is None else any(
                message_fragment in finding[2] for finding in findings)
            mark = '✓' if ok else '✗'
            print(f'  {mark} {description}')
            if not ok:
                print(f'      expected {message_fragment or "no findings"}; got: {findings[:3]}')
                failed.append(description)
        finally:
            shutil.rmtree(root, ignore_errors=True)
    return failed


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

    failed.extend(run_vo_t4_capability_cases())

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
