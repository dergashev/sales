# -*- coding: utf-8 -*-
"""Доказательство живости ПРЕДУПРЕЖДАЮЩИХ классов проверок.

Зачем отдельный файл. `verify.py --selftest` измеряет ровно одно:
появилось ли НАРУШЕНИЕ после порчи файла. Классы `DC-COVERAGE`,
`NO-VISUAL-UTILITY` и `OPT-IMAGE` нарушений не создают — они пишут
предупреждения, и мутационный прогон проходит мимо них, показывая
218/218 вне зависимости от того, работают они или мертвы.

Ограничение было названо в реестре, но названная дыра остаётся дырой.
Здесь она закрывается: детектор запускается на СИНТЕТИЧЕСКОМ дереве, где
дефект внесён нарочно, и проверяется, что он найден — и, что не менее
важно, что на чистом дереве он молчит. Односторонняя проверка («сработал»)
доказывает половину: детектор, срабатывающий всегда, тоже «работает».

Особый случай — `OPT-IMAGE`. На момент постройки манифеста изображений не
существует, поэтому в живом прогоне выполняется ровно одна его ветка
(«манифеста нет»). Ветки, ради которых класс написан — пропущенное
значение каталога и файл-сирота, — до поставки № 18 не выполнялись бы ни
разу. Здесь они выполняются сегодня.

Запуск: `python3 tools/selftest_warnings.py` · выход 0 = все ветки живы.
"""
import json
import pathlib
import shutil
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify import Verifier  # noqa: E402  (путь настраивается выше)

ROOT = pathlib.Path(__file__).resolve().parent.parent

CATALOG = {
    'kg300': {'groups': [
        {'id': 'balkone', 'choices': [{'value': 'ja'}, {'value': 'nein'}]},
    ]},
    'kg400': {'groups': [
        {'id': 'kg420', 'choices': [{'value': 'waermepumpe'}]},
    ]},
    'zertifikate': {'groups': []},
}

CSS_GROUP = (
    '/* DC-99 · ProbeComponent. Structure: .a3-probe > .a3-probe-num.\n'
    '   Classes: .a3-probe · .a3-probe-num · .a3-probe-cap. */\n'
    '.a3-probe{display:block}\n'
    '.a3-probe-num{font-weight:700}\n'
    '.a3-probe-cap{color:#323232}\n'
    '.a3-cap{font-size:14px}\n'
)


def build(tmp: pathlib.Path, *, tsx: str, manifest=None, images=()):
    """Синтетическое дерево: только то, что читают проверяемые классы."""
    (tmp / 'design-system').mkdir(parents=True, exist_ok=True)
    (tmp / 'design-system/components.css').write_text(CSS_GROUP, encoding='utf-8')
    (tmp / 'src').mkdir(parents=True, exist_ok=True)
    (tmp / 'src/Probe.tsx').write_text(tsx, encoding='utf-8')
    (tmp / 'src/fixtures').mkdir(parents=True, exist_ok=True)
    (tmp / 'src/fixtures/derived-prototype.json').write_text(
        json.dumps(CATALOG), encoding='utf-8')
    if manifest is not None:
        d = tmp / 'design-system/assets/options'
        d.mkdir(parents=True, exist_ok=True)
        (d / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
        for name in images:
            (d / name).write_bytes(b'\x00')


def warns(tmp: pathlib.Path, cls: str) -> list[str]:
    v = Verifier(tmp)
    v.check_dc_coverage()
    v.check_no_visual_utility()
    v.check_option_images()
    return [w for w in v.warn if w.startswith(cls + ':')]


CASES: list[tuple[str, str, dict, bool]] = [
    # (описание, класс, аргументы дерева, ожидается ли предупреждение)
    ('DC-COVERAGE: взят корень, дочерние не взяты',
     'DC-COVERAGE',
     {'tsx': 'export const P = () => <div className="a3-probe" />'},
     True),
    ('DC-COVERAGE: взята вся группа — молчит',
     'DC-COVERAGE',
     {'tsx': ('export const P = () => <div className="a3-probe">'
              '<b className="a3-probe-num" /><i className="a3-probe-cap" /></div>')},
     False),
    ('DC-COVERAGE: группа не используется вовсе — молчит (не долг)',
     'DC-COVERAGE',
     {'tsx': 'export const P = () => <div className="other" />'},
     False),
    ('NO-VISUAL-UTILITY: цвет и паддинг поверх контрактного класса',
     'NO-VISUAL-UTILITY',
     {'tsx': 'export const P = () => <div className="a3-probe p-4 text-text-muted" />'},
     True),
    ('NO-VISUAL-UTILITY: отступ и сетка — композиция, не вид',
     'NO-VISUAL-UTILITY',
     {'tsx': 'export const P = () => <div className="a3-probe mt-4 flex gap-3" />'},
     False),
    ('NO-VISUAL-UTILITY: цвет поверх типографического примитива — переопределение роли',
     'NO-VISUAL-UTILITY',
     {'tsx': 'export const P = () => <div className="a3-cap text-text-muted" />'},
     True),
    ('NO-VISUAL-UTILITY: отступ у типографического примитива — композиция страницы',
     'NO-VISUAL-UTILITY',
     {'tsx': 'export const P = () => <div className="a3-cap py-1 pr-4 text-left" />'},
     False),
    ('NO-VISUAL-UTILITY: утилита без контрактного класса — не наш случай',
     'NO-VISUAL-UTILITY',
     {'tsx': 'export const P = () => <div className="p-4 text-text-muted" />'},
     False),
    ('OPT-IMAGE: манифеста нет — объявляется отсутствие покрытия',
     'OPT-IMAGE',
     {'tsx': 'export const P = () => null'},
     True),
    ('OPT-IMAGE: значение каталога без изображения',
     'OPT-IMAGE',
     {'tsx': 'export const P = () => null',
      'manifest': [
          {'group': 'balkone', 'value': 'ja', 'file': 'a.webp'},
          {'group': 'kg420', 'value': 'waermepumpe', 'file': 'b.webp'},
      ],
      'images': ('a.webp', 'b.webp')},
     True),
    ('OPT-IMAGE: изображение без значения каталога (сирота)',
     'OPT-IMAGE',
     {'tsx': 'export const P = () => null',
      'manifest': [
          {'group': 'balkone', 'value': 'ja', 'file': 'a.webp'},
          {'group': 'balkone', 'value': 'nein', 'file': 'b.webp'},
          {'group': 'kg420', 'value': 'waermepumpe', 'file': 'c.webp'},
          {'group': 'balkone', 'value': 'vielleicht', 'file': 'd.webp'},
      ],
      'images': ('a.webp', 'b.webp', 'c.webp', 'd.webp')},
     True),
    ('OPT-IMAGE: файл объявлен, но отсутствует на диске',
     'OPT-IMAGE',
     {'tsx': 'export const P = () => null',
      'manifest': [
          {'group': 'balkone', 'value': 'ja', 'file': 'a.webp'},
          {'group': 'balkone', 'value': 'nein', 'file': 'b.webp'},
          {'group': 'kg420', 'value': 'waermepumpe', 'file': 'c.webp'},
      ],
      'images': ('a.webp', 'b.webp')},
     True),
    ('OPT-IMAGE: покрытие полное и файлы на месте — молчит',
     'OPT-IMAGE',
     {'tsx': 'export const P = () => null',
      'manifest': [
          {'group': 'balkone', 'value': 'ja', 'file': 'a.webp'},
          {'group': 'balkone', 'value': 'nein', 'file': 'b.webp'},
          {'group': 'kg420', 'value': 'waermepumpe', 'file': 'c.webp'},
      ],
      'images': ('a.webp', 'b.webp', 'c.webp')},
     False),
]


def main() -> int:
    failed = []
    for desc, cls, kwargs, expect in CASES:
        tmp = pathlib.Path(tempfile.mkdtemp(prefix='a3-warn-'))
        try:
            build(tmp, **kwargs)
            got = warns(tmp, cls)
            ok = bool(got) == expect
            mark = '✓' if ok else '✗'
            print(f'  {mark} {desc}' + ('' if ok else
                  f'\n      ожидалось {"срабатывание" if expect else "молчание"}, '
                  f'получено {len(got)}: {got[:1]}'))
            if not ok:
                failed.append(desc)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    print(f'\nПРЕДУПРЕЖДАЮЩИЕ КЛАССЫ · {len(CASES)} веток, провалов: {len(failed)}')
    if failed:
        print('НЕ ДОКАЗАНО:')
        for d in failed:
            print(f'  ✗ {d}')
        return 1
    print('Каждая ветка срабатывает на внесённом дефекте и молчит на чистом дереве.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
