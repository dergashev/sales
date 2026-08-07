# -*- coding: utf-8 -*-
"""Инвентарь немецких строк прототипа, не покрытых переводом EN.

Метод — грубый и это заявлено: строки достаются регулярными выражениями
(JSX-текст между тегами + строковые литералы с немецкой лексикой), а не
парсером TypeScript. Инструмент отвечает на вопрос «что показать копирайту
как объём работы», а не «какие строки рендерятся» — ложные срабатывания
отсекаются фильтрами и глазами при передаче задания.

Покрытой считается строка, которая (а) есть среди значений GENERATED_DE —
мост translateText её переведёт; (б) есть в LOCAL_TEXT_EN; (в) есть среди
значений локального словаря `de` в src/i18n/index.ts. Всё остальное на
экране останется немецким при переключении на EN.

Выход — docs/audit/i18n-remainder-<дата>.md, таблица «файл · строка» в
формате, из которого Codex соберёт вторую поставку той же схемы, что
i18n-en-260806.md.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/audit/i18n-remainder-260806.md'

# Немецкая лексика: умляуты/ß или частотные служебные слова. Строка без
# этих признаков может быть немецкой (например, «Termine»), поэтому ниже
# добавлен второй признак — заглавное слово из двух и более букв.
RX_DE_HINT = re.compile(
    r'[äöüÄÖÜß]|\b(der|die|das|und|oder|nicht|kein|keine|mit|ohne|für|nach|'
    r'aus|bei|wird|werden|ist|sind|noch|schon|nur|alle|des|dem|den|im|zum|'
    r'zur|vom|auf|über|unter|gegen|wie|als|wenn|dann|hier|jetzt)\b')
RX_CAPWORD = re.compile(r'\b[A-ZÄÖÜ][a-zäöüß]{2,}')

# Явный шум: классы, токены, пути, ключи, идентификаторы, форматные хвосты.
RX_NOISE = re.compile(
    r'^(a3-|--|var\(|\.|/|#|http|src/|docs/|design-system/|opt_|cov_|kg[_\d]|'
    r'DEMO-|[A-Z_]+$|[a-z]+([A-Z][a-z]+)+$)|^[\d\s.,%€§+±−×callckwh-]*$')

# JSX-текст: между > и <, без вложенных скобок-выражений.
RX_JSX_TEXT = re.compile(r'>\s*([^<>{}\n][^<>{}]*?)\s*<')
# Строковые литералы в одинарных/двойных кавычках (без многострочных).
RX_STR = re.compile(r'''(['"])((?:(?!\1)[^\\\n]|\\.)+)\1''')


def visible_candidates(text: str) -> set[str]:
    out: set[str] = set()
    for rx, grp in ((RX_JSX_TEXT, 1), (RX_STR, 2)):
        for m in rx.finditer(text):
            s = m.group(grp).replace("\\'", "'").strip()
            # JSX переносит текст с отступом — в разметке это один пробел.
            # ТОЛЬКО ASCII-пробелы: `\s` в Python матчит и U+202F, и первая
            # редакция этой строки расплющила узкий неразрывный в обычный —
            # тот же класс, что героические heredoc-провалы, седьмой заход.
            s = re.sub(r'[ \t\n\r]+', ' ', s)
            if len(s) < 3 or RX_NOISE.search(s):
                continue
            if not (RX_DE_HINT.search(s) or RX_CAPWORD.search(s)):
                continue
            out.add(s)
    return out


def covered_values() -> set[str]:
    gen = (ROOT / 'src/i18n/generated.ts').read_text(encoding='utf-8')
    idx = (ROOT / 'src/i18n/index.ts').read_text(encoding='utf-8')
    vals: set[str] = set()
    de_block = gen.split('GENERATED_DE')[1].split('GENERATED_EN')[0]
    for m in re.finditer(r":\s*'((?:[^'\\]|\\.)*)'", de_block):
        vals.add(m.group(1).replace("\\'", "'").replace('\\n', '\n'))
    # Локальный словарь de (LOCAL_TEXT_EN упразднён поставкой № 3:
    # источник EN — только поставки Codex).
    block = idx.split('const de')[1].split('\n}')[0]
    for m in re.finditer(r"'((?:[^'\\]|\\.)*)'", block):
        vals.add(m.group(1).replace("\\'", "'"))
    return vals


def main() -> None:
    covered = covered_values()
    rows: list[tuple[str, str]] = []
    for p in sorted(ROOT.glob('src/**/*.tsx')):
        rel = p.relative_to(ROOT).as_posix()
        if '__tests__' in rel:
            continue
        for s in sorted(visible_candidates(p.read_text(encoding='utf-8'))):
            if s in covered:
                continue
            rows.append((rel, s))

    lines = [
        '# Остаток перевода EN — инвентарь для задания копирайта № 2',
        '',
        f'Метод: tools/i18n_remainder.py (грубая экстракция, признак немецкой',
        'лексики; ложные срабатывания возможны и отсеиваются при взятии в',
        'работу). Покрытие: значения GENERATED_DE + локальный словарь +',
        'LOCAL_TEXT_EN. Всё в таблице останется немецким на EN.',
        '',
        f'**Строк: {len(rows)} в {len(set(r[0] for r in rows))} файлах.**',
        '',
        '| файл | немецкая строка |',
        '|---|---|',
    ]
    esc_pipe = '\\|'
    for rel, s in rows:
        cell = s.replace('|', esc_pipe)
        lines.append(f'| `{rel}` | {cell} |')
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'строк: {len(rows)} → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    sys.exit(main())
