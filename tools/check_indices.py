#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Инвариант против устаревших индексов в шапках документов.

Класс дефекта, найденный внешним аудитом трижды: индекс/шапка ссылается на
диапазон, который давно вырос — «D-01…D-10» при 16 решениях, «G1–G18» при 21,
«12 классов проверок» при 16. Читатель верит шапке и работает по отменённым
данным. Проверка выводит фактические величины из содержимого и сверяет
с каждым упоминанием.

Вызывается из `tools/verify.py` (класс `INDEX`, метод `Verifier.check_index`)
и работает автономно: `python3 tools/check_indices.py [--strict]`.

Почему счёт классов больше не инструментируется прогоном. Прежняя редакция
считала классы двумя способами сразу: динамически (инструментировала точки
регистрации нарушения и прогоняла verify.py) и статически (литералы
`self.fail('X'`). Аудитор показал, что счёт разваливается от четырёх
совершенно посторонних воздействий:

  · `black`/`ruff format` меняет `'` на `"`               → 30 → 22
  · пересборка HTML-артефактов (плановая задача Batch 8)  → 30 → 28
  · уборка ретроспективной прозы (плановая задача Batch 5)→ 30 → 28
  · любое исключение внутри verify.py + `except: pass`    → 30 → 14

То есть «фактическое» число зависело от форматирования кода и от того,
сколько нарушений сегодня в документах. Теперь источник один: явный кортеж
`CHECK_CLASSES` в `verify.py`. Он читается разбором AST — без импорта и без
прогона, поэтому ни форматтер, ни состояние документов на счёт не влияют.
Двусторонний инвариант («объявлено = используется») проверяет сам verify.py
классом `TOOL-REGISTRY`. Невозможность прочитать реестр — явный провал
«инструмент сломан», а не тихий ноль.
"""
import argparse
import ast
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Устаревшие индексы в файлах других владельцев: печатаются всегда, валят
# только --strict — та же конвенция, что KNOWN_OPEN в verify.py.
KNOWN_OPEN = {
    # Шапка roadmap описывает редакцию verify.py v2. Правка — подставить
    # величины, которые печатает эта же строка отчёта («фактически N»);
    # число в реестре намеренно не дублируется: зафиксированное здесь, оно
    # старело бы ровно тем же способом, против которого написана проверка.
    ('docs/product/roadmap.md', 'CHECKS'):
        'Batch 5 · заявленное число классов проверок устарело; актуальное — '
        'в этой же строке отчёта после слова «фактически»',
    ('docs/product/roadmap.md', 'SELFTEST'):
        'Batch 5 · заявленный счёт --selftest устарел; актуальный — там же. '
        'Лучше вообще не называть число в прозе: «полный проход --selftest»',
}


class ToolBroken(RuntimeError):
    """Реестр verify.py не читается — это поломка инструмента, а не документа."""


def _literal(src: str, name: str):
    """Значение литерала верхнего уровня из исходника — разбором AST."""
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == name:
                    return ast.literal_eval(node.value)
    raise ToolBroken(f'в tools/verify.py нет литерала верхнего уровня {name}')


def registry(root=None):
    """(классы проверок, число мутаций selftest) из verify.py.

    Реестр принадлежит ИНСТРУМЕНТУ, а не проверяемому каталогу: путь берётся
    от `__file__`. Иначе прогон против временной копии репозитория (selftest)
    не находил бы verify.py и объявлял бы инструмент сломанным.
    """
    vf = pathlib.Path(__file__).resolve().parent / 'verify.py'
    if not vf.exists():
        raise ToolBroken('tools/verify.py отсутствует рядом с check_indices.py')
    src = vf.read_text(encoding='utf-8')
    classes = _literal(src, 'CHECK_CLASSES')
    if not isinstance(classes, (tuple, list)) or not classes:
        raise ToolBroken('CHECK_CLASSES пуст или не является кортежем')
    if len(set(classes)) != len(classes):
        raise ToolBroken('CHECK_CLASSES содержит дубликаты')
    # число мутаций selftest — длина списка MUTATIONS, тоже разбором AST
    tree = ast.parse(src)
    muts = None
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == 'MUTATIONS':
                    if not isinstance(node.value, (ast.List, ast.Tuple)):
                        raise ToolBroken('MUTATIONS не литеральный список')
                    muts = len(node.value.elts)
    if muts is None:
        raise ToolBroken('в tools/verify.py нет литерала верхнего уровня MUTATIONS')
    return tuple(classes), muts


def collect(root=ROOT):
    root = pathlib.Path(root)
    out = {}
    dec = root / 'docs/product/decisions.md'
    if dec.exists():
        n = [int(m) for m in re.findall(r'^## D-(\d+)', dec.read_text(encoding='utf-8'), re.M)]
        if n:
            out['D'] = max(n)
    gui = root / 'docs/product/guidance-system.md'
    if gui.exists():
        n = [int(m) for m in re.findall(r'\bG(\d+)\b', gui.read_text(encoding='utf-8'))]
        if n:
            out['G'] = max(n)
    rd = root / 'design-system/README.md'
    if rd.exists():
        n = [int(m) for m in re.findall(r'DC-(\d+)', rd.read_text(encoding='utf-8'))]
        if n:
            out['DC'] = max(n)
    classes, muts = registry()              # исключение наружу: инструмент сломан
    out['CHECKS'] = len(classes)
    out['SELFTEST'] = muts
    return out


def run(root=ROOT):
    """→ [(relpath, lineno, сообщение)]. Исключение = поломка инструмента."""
    root = pathlib.Path(root)
    real, bad = collect(root), []
    for f in sorted(root.rglob('*.md')):
        if any(p in f.parts for p in ('node_modules', '.git')):
            continue
        t = f.read_text(encoding='utf-8', errors='ignore')
        rel = f.relative_to(root).as_posix()
        for i, line in enumerate(t.split('\n'), 1):
            for pre in ('D', 'G', 'DC'):
                if pre not in real:
                    continue
                pat = r'%s-?0?1\s*[…\-–]+\s*%s-?(\d+)' % (pre, pre)
                for m in re.finditer(pat, line):
                    if int(m.group(1)) != real[pre]:
                        bad.append((rel, i, f'диапазон {pre} заявлен до {m.group(1)}, '
                                             f'фактически до {real[pre]}'))
            for m in re.finditer(r'(\d+)\s+классов проверок', line):
                if int(m.group(1)) != real['CHECKS']:
                    bad.append((rel, i, f'заявлено {m.group(1)} классов проверок, '
                                        f'фактически {real["CHECKS"]}'))
            for m in re.finditer(r'--?selftest`?\D{0,4}(\d+)\s*/\s*(\d+)', line):
                if int(m.group(2)) != real['SELFTEST'] or int(m.group(1)) != int(m.group(2)):
                    bad.append((rel, i, f'заявлен selftest {m.group(1)}/{m.group(2)}, '
                                        f'фактически {real["SELFTEST"]}/{real["SELFTEST"]}'))
    return bad


def _kind(msg):
    if 'классов проверок' in msg:
        return 'CHECKS'
    if 'selftest' in msg:
        return 'SELFTEST'
    return 'RANGE'


def main():
    ap = argparse.ArgumentParser(description='Инвариант актуальности индексов в шапках')
    ap.add_argument('--strict', action='store_true',
                    help='известные открытые расхождения тоже валят запуск')
    args = ap.parse_args()
    try:
        bad = run()
    except ToolBroken as exc:
        print(f'  ✗ ИНСТРУМЕНТ СЛОМАН: {exc}')
        print('    Это поломка проверяльщика, а не документа. Молчаливый ноль здесь запрещён.')
        return 2
    new, known = [], []
    for rel, lineno, msg in bad:
        ref = KNOWN_OPEN.get((rel, _kind(msg)))
        (known if ref else new).append((rel, lineno, msg, ref))
    for rel, lineno, msg, _ in new:
        print(f'  ✗ {rel}:{lineno} — {msg}')
    for rel, lineno, msg, ref in known:
        print(f'  ! {rel}:{lineno} — {msg}\n      → известно, зарегистрировано: {ref}')
    if not new and not known:
        print('  ✓ индексы актуальны')
    elif not new:
        print(f'  ✓ новых расхождений нет; {len(known)} известных открытых — см. выше')
    return 1 if (new or (args.strict and known)) else 0


if __name__ == '__main__':
    sys.exit(main())
