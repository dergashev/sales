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

Четвёртый охваченный индекс (v4) — **число открытых блокирующих ADR**. Тот же
класс дефекта, найденный в четвёртый раз: `design-system/README.md` §0 заявлял
«34 блокирующих ADR», при том что тот же документ в §2 называет 51, а реестр
`docs/audit/adr-blocking.md` ввёл 17 новых записей разделом 6a — то есть
партия увеличила число и продолжила цитировать старое. Фактическая величина
выводится из состава реестра тремя независимыми путями (заголовки разделов,
таблица пересчёта, номера строк таблиц) и сверяется с итогом §7; расхождение
внутри самого реестра — тоже находка, а не повод довериться одному числу.

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

try:
    from .validation_paths import RepositoryValidationScope
except ImportError:  # Direct execution: python3 tools/check_indices.py
    from validation_paths import RepositoryValidationScope

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Устаревшие индексы в файлах других владельцев: печатаются всегда, валят
# только --strict — та же конвенция, что KNOWN_OPEN в verify.py.
#
# КЛЮЧ РЕГИСТРАЦИИ — ИДЕНТИЧНОСТЬ НАХОДКИ (v4c, принцип 8 verify.py). Прежде
# ключом была пара `(файл, класс расхождения)`, и такая запись скрывала ЛЮБОЕ
# будущее расхождение того же класса в том же файле — включая другое число,
# появившееся после регистрации. Регистрация долга не бывает шире долга,
# поэтому в ключ входит ЗАЯВЛЕННАЯ величина: она умирает вместе с исправлением
# строки и не переживает появления второго, ещё не зарегистрированного числа.
#
# Четыре записи предыдущей редакции (`roadmap.md` и `TASK-01`) сняты: оба
# документа перестали называть числа в прозе — ровно та правка, которую запись
# и просила. Инертная регистрация читается как непогашенный долг, которого
# нет; её отсутствие теперь видно предупреждением ниже.
KNOWN_OPEN = {
    # (файл, класс расхождения, ЗАЯВЛЕННАЯ величина) → ссылка на владельца
    # Текст задания описывает снимок инструмента на момент его выдачи и старел
    # вместе с инструментом. Отличается от вердикта Codex: тот пришпилен к
    # commit и SHA-256 и потому индексом не считается вовсе — измерение снимка
    # обязано остаться прежним.
    ('docs/audit/verdicts/TASK-04-stage4-content.md', 'CHECKS', '90'):
        'задание этапа 4 описывает реестр до второй независимой атаки '
        '(90 классов); после неё добавлены OUT-BINDING, OUT-SESSION, '
        'DM-CARDINALITY. Правка — у автора задания; актуальное число — в этой '
        'же строке отчёта после слова «фактически»',
    ('docs/audit/verdicts/TASK-04-stage4-content.md', 'SELFTEST', '203/203'):
        'там же: набор мутаций вырос вместе с новыми классами. Лучше вообще '
        'не называть число в прозе — «полный проход --selftest»',
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


def adr_registry(root=ROOT):
    """(фактическое число открытых ADR, список расхождений внутри реестра).

    Величина выводится, а не читается: три независимых пути обязаны дать одно
    и то же число, иначе расхождение внутри реестра само является находкой.
      · заголовки разделов 1–3 («— N записей») в сумме;
      · таблица пересчёта («**ВСЕГО** | 31 строка | 34 имени»);
      · номера строк таблицы §1 (максимальный `| N |`) — против её заголовка;
      · раздел 6a: заголовок «— N токенов» против номеров строк его таблицы;
      · итог §7 («N открытый ADR (A из разделов 1–3 + B из раздела 6a)»).
    Возврат `None` означает: реестр не разобран, число заявлять нельзя.
    """
    p = pathlib.Path(root) / 'docs/audit/adr-blocking.md'
    if not p.exists():
        return None, [('docs/audit/adr-blocking.md', 1,
                       'реестр блокирующих ADR отсутствует — число открытых ADR '
                       'в шапках документов не проверяется')]
    t = p.read_text(encoding='utf-8')
    rel, bad = 'docs/audit/adr-blocking.md', []

    def lineno(pos):
        return t[:pos].count('\n') + 1

    # заголовки разделов 1–3 и 6a
    heads = {}
    for m in re.finditer(r'^##\s*(\d+a?)\.[^\n—]*—\s*(\d+)\s*(?:запис\w+|токен\w+)', t, re.M):
        heads[m.group(1)] = (int(m.group(2)), lineno(m.start()))
    missing = [k for k in ('1', '2', '3', '6a') if k not in heads]
    if missing:
        bad.append((rel, 1, f'в реестре ADR не найдены заголовки разделов с числом записей: '
                            f'{", ".join(missing)} — фактическое число открытых ADR '
                            f'невыводимо'))
        return None, bad
    sum_1_3 = sum(heads[k][0] for k in ('1', '2', '3'))
    n6a = heads['6a'][0]

    # таблица пересчёта: «**ВСЕГО** | **31 строка** | **34 имени**»
    m = re.search(r'\|\s*\*\*ВСЕГО\*\*\s*\|[^|]*\|\s*\*\*(\d+)\s*им', t)
    if not m:
        bad.append((rel, 1, 'таблица пересчёта состава раздела 13 («**ВСЕГО** … имён») '
                            'не найдена — число записей разделов 1–3 подтверждается '
                            'только заголовками'))
    elif int(m.group(1)) != sum_1_3:
        bad.append((rel, lineno(m.start()),
                    f'таблица пересчёта даёт {m.group(1)} имён, заголовки разделов 1–3 '
                    f'в сумме дают {sum_1_3} — реестр расходится сам с собой'))

    # номера строк таблиц §1 и §6a против заголовков
    for sec, want in (('1', heads['1'][0]), ('6a', n6a)):
        m = re.search(r'^##\s*' + sec + r'\.(.*?)(?=^##\s|\Z)', t, re.S | re.M)
        if not m:
            continue
        nums = [int(x) for x in re.findall(r'^\|\s*(\d+)\s*\|', m.group(1), re.M)]
        if not nums:
            continue
        if sorted(nums) != list(range(1, len(nums) + 1)):
            bad.append((rel, heads[sec][1],
                        f'раздел {sec}: номера строк таблицы не образуют непрерывный '
                        f'1…{len(nums)} — состав не пересчитывается'))
        if len(nums) != want:
            bad.append((rel, heads[sec][1],
                        f'раздел {sec} заявляет {want} записей, таблица содержит '
                        f'{len(nums)} строк'))

    total = sum_1_3 + n6a
    # итог §7 обязан совпадать со составом
    m = re.search(r'\*\*(\d+)\s*открыт\w*\s+ADR\*\*\s*\((\d+)\s*из\s*разделов\s*1[–-]3\s*\+\s*'
                  r'(\d+)\s*из\s*раздела\s*6a\)', t)
    if not m:
        bad.append((rel, 1, 'раздел 7 реестра не называет итог в форме '
                            '«N открытый ADR (A из разделов 1–3 + B из раздела 6a)» — '
                            'итог не сверяется с составом'))
    else:
        a, b, c = (int(x) for x in m.groups())
        if (b, c) != (sum_1_3, n6a) or a != b + c:
            bad.append((rel, lineno(m.start()),
                        f'итог §7 «{a} = {b} + {c}» против состава реестра '
                        f'«{total} = {sum_1_3} + {n6a}»'))
    return total, bad


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
    path_scope = RepositoryValidationScope(root)
    real, bad = collect(root), []
    adr, adr_bad = adr_registry(root)
    bad.extend(adr_bad)
    for f in sorted(root.rglob('*.md')):
        if path_scope.excludes(f):
            continue
        t = f.read_text(encoding='utf-8', errors='ignore')
        rel = f.relative_to(root).as_posix()
        for i, line in enumerate(t.split('\n'), 1):
            # ИЗМЕРЕНИЕ, ПРИШПИЛЕННОЕ К СНИМКУ, — не индекс. Строка, называющая
            # commit или SHA-256 проверяемого файла, утверждает о ПРОШЛОМ
            # состоянии и обязана остаться неизменной: вердикт аудита, в котором
            # число подтянули к сегодняшнему, перестаёт быть свидетельством.
            # Признак структурный и проверяемый по самой строке, а не по файлу,
            # каталогу или слову-маркеру.
            if re.search(r'\b(?:commit|SHA-?256)\b[^\n]{0,40}`?[0-9a-f]{7,64}`?', line, re.I):
                continue
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
            if adr is None:
                continue
            for m in re.finditer(r'(\d+)\s+(?:открыт\w*|блокирующ\w*)\s+ADR', line):
                if int(m.group(1)) != adr:
                    bad.append((rel, i, f'заявлено {m.group(1)} открытых блокирующих ADR, '
                                        f'фактический состав реестра '
                                        f'docs/audit/adr-blocking.md даёт {adr}'))
    return bad


def _kind(msg):
    if 'классов проверок' in msg:
        return 'CHECKS'
    if 'selftest' in msg:
        return 'SELFTEST'
    if 'ADR' in msg:
        return 'ADR'
    return 'RANGE'


def _ident(msg):
    """Идентичность находки: класс расхождения + ЗАЯВЛЕННАЯ в документе величина.

    Заявленная величина, а не фактическая: фактическая меняется от каждой
    правки инструмента, и ключ, привязанный к ней, разваливался бы сам. А
    заявленная умирает ровно тогда, когда строку исправят, — это и есть
    идентичность долга.
    """
    kind = _kind(msg)
    if kind == 'RANGE':
        m = re.search(r'диапазон\s+(\S+)\s+заявлен\s+до\s+(\d+)', msg)
        return (kind, f'{m.group(1)}:{m.group(2)}') if m else (kind, msg)
    m = re.search(r'заявлен\w*\s+(?:selftest\s+)?([\d/]+)', msg)
    return (kind, m.group(1)) if m else (kind, msg)


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
    new, known, used = [], [], set()
    for rel, lineno, msg in bad:
        kind, claimed = _ident(msg)
        key = (rel, kind, claimed)
        ref = KNOWN_OPEN.get(key)
        if ref:
            used.add(key)
        (known if ref else new).append((rel, lineno, msg, ref))
    for rel, lineno, msg, _ in new:
        print(f'  ✗ {rel}:{lineno} — {msg}')
    for rel, lineno, msg, ref in known:
        print(f'  ! {rel}:{lineno} — {msg}\n      → известно, зарегистрировано: {ref}')
    # Fail-safe той же конвенции, что в verify.py: запись, которая не
    # сработала, обязана быть ВИДНА. Инертная регистрация читается как
    # непогашенный долг, которого нет, — и снимается по этому предупреждению,
    # а не по чьей-то догадке о состоянии документа.
    for key in KNOWN_OPEN:
        if key not in used and (ROOT / key[0]).exists():
            print(f'  ⚠ KNOWN_OPEN-запись не сработала (индекс исправлен?): {key}')
    if not new and not known:
        print('  ✓ индексы актуальны')
    elif not new:
        print(f'  ✓ новых расхождений нет; {len(known)} известных открытых — см. выше')
    return 1 if (new or (args.strict and known)) else 0


if __name__ == '__main__':
    sys.exit(main())
