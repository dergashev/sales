#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Остаток немецкого на EN-пути → адресный список работ.

Замер по DOM (`src/i18n/__tests__/en-remainder.dom.test.tsx`) отвечает на
вопрос «сколько осталось». Он намеренно не отвечает на «где и почему»: обход
живого дерева видит текст, но не строку исходника, которая его породила.
Пока этого второго ответа нет, остаток остаётся числом, а не работой.

Скрипт классифицирует каждый фрагмент **машинно**, по трём независимым
признакам, и порядок между ними важен:

  · единственный адрес фрагмента — `src/fixtures/*.json` → это язык
    артефакта (D-13), а не пропущенный перевод, и работой по хрому он не
    является вовсе;
  · поставка помечает ключ «числовое: да» → рядом стоит число, DOM собрал
    строку конкатенацией, и правило 36 требует целого ключа с подстановкой,
    а не обёртки;
  · иначе — целая строка с готовым ключом: не хватает `tx()` в месте рендера.

Признак конкатенации взят из колонки поставки, а не выведен из словаря, и
это принципиально. Поставка № 5 сознательно выдала ключи **на фрагменты**,
чтобы обратный мост заработал немедленно; после этого «фрагмент есть в
словаре целым значением» перестало отличать целую строку от куска. Классифика‑
ция по словарю показала бы 47 однострочных правок там, где 17 требуют
переделки места рендера, — и остаток «закрылся» бы, оставшись нарушением
правила 36.

`src/**` только читается: скрипт совместим с заморозкой `PROTOCOL §2-ter`.

Запуск: python3 tools/i18n_worklist.py
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_i18n import SOURCES, merge, unescape  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT = ROOT / 'docs/audit/i18n-en-remainder-dom.md'
OUT = ROOT / 'docs/audit/i18n-en-worklist.md'
SRC = ROOT / 'src'

HEADING_WIRED = 'Перевод есть — строка не проходит через мост'
HEADING_MISSING = 'Перевода нет'


def fragments(text):
    """Пункты списка из отчёта замера, по разделам. Многострочные — целиком."""
    out = {}
    section = None
    item = None
    for line in text.split('\n'):
        if line.startswith('## '):
            if section and item:
                out[section].append(item.rstrip('\n'))
            section, item = line[3:].strip(), None
            out.setdefault(section, [])
            continue
        if section is None:
            continue
        if line.startswith('- '):
            if item:
                out[section].append(item.rstrip('\n'))
            item = line[2:]
        elif item is not None:
            item += '\n' + line
    if section and item:
        out[section].append(item.rstrip('\n'))
    return out


FULL_ROW = re.compile(
    r'^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|')


def numeric_flags():
    """key → колонка «числовое?» поставки.

    Это авторитетный признак конкатенации, и он не выводится из словаря:
    поставка № 5 сознательно выдала ключи на ФРАГМЕНТЫ, которые DOM собрал
    из частей, чтобы мост заработал немедленно. После этого «фрагмент есть
    в словаре целым значением» перестало отличать целую строку от куска —
    отличает только пометка автора поставки.
    """
    out = {}
    for src in SOURCES:
        if not src.exists():
            continue
        for line in src.read_text(encoding='utf-8').split('\n'):
            m = FULL_ROW.match(line)
            if not m or m.group(1) == 'key':
                continue
            out[m.group(1)] = unescape(m.group(5))
    return out


SPACE_KINDS = '\u202f\u00a0\u2009'
FLATTEN = str.maketrans({ch: ' ' for ch in SPACE_KINDS})


def source_files():
    files = []
    for p in sorted(SRC.rglob('*')):
        if p.suffix not in ('.tsx', '.ts', '.json') or not p.is_file():
            continue
        # Сам словарь — не место рендера: адрес в нём ничего не говорит о том,
        # где строка попадает на экран, и маскирует отсутствие адреса.
        if p.name == 'generated.ts':
            continue
        raw = p.read_text(encoding='utf-8')
        files.append((p, raw.translate(FLATTEN)))
    return files


def locate(fragment, files):
    """Адреса вхождения фрагмента в исходник.

    Сопоставление идёт по тексту с приведёнными пробелами, цитата — по
    исходному. Перевод посимвольный, поэтому смещения не сдвигаются и номер
    строки остаётся верным. Без этого литерал с `NNBSP` внутри
    (`Regelsatz RS{U+202F}2026.2`) не находился, и адрес честно существующей
    строки выглядел отсутствующим — то есть невидимый символ порождал
    выдуманную причину «собрано в рантайме».
    """
    hits = []
    needle = fragment.strip().translate(FLATTEN)
    if len(needle) < 4:
        return hits
    for path, text in files:
        idx = text.find(needle)
        if idx < 0:
            continue
        line = text.count('\n', 0, idx) + 1
        hits.append(f'{path.relative_to(ROOT)}:{line}')
    return hits


# Места сборки, найденные чтением. Автоматически они не находятся по
# построению: точного литерала нет, строку складывает шаблон. Таблица живёт
# здесь, а не в отчёте, потому что отчёт перезаписывается — дописанное руками
# в порождаемый файл исчезает при первом же прогоне.
MANUAL_SITES = {
    '. Die Preiswirkung erscheint': (
        'src/screens/OptionChapter.tsx:302',
        'JSX: `{MARK} · {DERIVED_LABEL}` и следом узел, начинающийся с точки'),
    'Gebäudedaten DEMO-B-A bestätigt': (
        'src/screens/ChapterBuildings.tsx:288 · src/state/store.ts:1507',
        'шаблон с id здания — ДВА места, одна фраза: экран и подпись события '
        'журнала; перевести надо оба одной правкой, иначе журнал останется '
        'немецким при английском экране'),
    'Opportunities · sortiert nach Reihenfolge': (
        'src/screens/OpportunityList.tsx:152',
        '`{shown.length} von {items.length} Opportunities · …` — два числа '
        'перед текстом'),
    'Sehr geehrte Damen und Herren': (
        'src/screens/S5Export.tsx:62',
        'конкатенация двух литералов через `+` с `\\n\\n`'),
    'bauseits; im indikativen Angebot': (
        'src/fixtures/derived-prototype.json:519',
        'ДАННЫЕ, а не хром: `basis` производного значения по D-22; знак ⚙ '
        'приписывается при показе'),
    'Werte extrahiert · Regelsatz': (
        'src/components/DocumentAnalysis.tsx:58',
        'шаблон `Werte extrahiert · Regelsatz RS${NNBSP}2026.2`: узкий пробел '
        'подставляется выражением, поэтому целой строки в файле нет вовсе'),
    '§2 nicht bestätigt.': (
        'src/screens/S5Export.tsx:76',
        'часть длинной строки `ValidationIssue offen: … §2 nicht bestätigt — '
        '…`, разрезанной переносом в исходнике'),
}


def manual_site(fragment):
    for prefix, site in MANUAL_SITES.items():
        if fragment.startswith(prefix):
            return site
    return None


def main():
    de_dict, _, _ = merge()
    values = set(de_dict.values())
    by_value = {v: k for k, v in de_dict.items()}
    files = source_files()

    report = REPORT.read_text(encoding='utf-8')
    groups = fragments(report)
    wired = next((v for k, v in groups.items() if HEADING_WIRED in k), [])
    missing = next((v for k, v in groups.items() if HEADING_MISSING in k), [])

    numeric = numeric_flags()
    CAUSE_FIXTURE = 'данные фикстуры (D-13) — не работа по хрому'
    CAUSE_CONCAT = 'конкатенация с числом — нужен целый ключ (правило 36)'
    CAUSE_WRAP = 'обёртка `tx()` — строка целая, ключ есть'
    CAUSE_NOSRC = 'литерала в исходнике нет — строка собрана в рантайме'
    CAUSE_ORPHAN = 'вне словаря'

    rows = []
    for frag in wired:
        # Схлопывать пробелы можно только ОБЫЧНЫЕ: `str.split()` считает
        # разделителем и U+202F, и восстановление обычным пробелом превращало
        # цитату немецкого фрагмента в нарушение правила 7 внутри отчёта о
        # нарушениях. Свой же линтер это и поймал.
        one = re.sub(r'[ \t\n\r]+', ' ', frag).strip()
        hits = locate(frag, files)
        key = by_value.get(frag.strip())
        num = (numeric.get(key, '') or '').strip().lower()
        is_numeric = num.startswith('да')
        fixture_only = bool(hits) and all('/fixtures/' in h for h in hits)
        if key is None:
            parent = next((v for v in values
                           if len(v) > len(frag.strip()) and frag.strip() in v), None)
            cause = CAUSE_ORPHAN
            action = (f'словарь держит строку «{parent[:50]}…» целиком — '
                      'переводить надо её' if parent else
                      'строка объявлена переводимой, но её нет в словаре — '
                      'проверить замер')
        elif fixture_only:
            cause = CAUSE_FIXTURE
            action = ('язык артефакта, а не интерфейса (D-13): ключом не чинится, '
                      f'хотя поставка выдала `{key}`')
        elif is_numeric:
            cause = CAUSE_CONCAT
            action = (f'целый ключ с подстановкой вместо частей · поставка '
                      f'помечает «{numeric[key]}» · есть `{key}` на кусок — '
                      'это мост, а не решение')
        elif not hits:
            cause = CAUSE_NOSRC
            site = manual_site(one)
            if site:
                hits = [site[0]]
                action = f'{site[1]} · ключ `{key}`'
            else:
                action = (f'найти место сборки: точного литерала в `src` нет · '
                          f'ключ `{key}`')
        else:
            cause = CAUSE_WRAP
            action = f'обернуть в `tx()` · ключ `{key}`'
        rows.append((one, cause, action, hits))

    n_wrap = sum(1 for r in rows if r[1] == CAUSE_WRAP)
    n_concat = sum(1 for r in rows if r[1] == CAUSE_CONCAT)
    n_fixture = sum(1 for r in rows if r[1] == CAUSE_FIXTURE)
    n_nosrc = sum(1 for r in rows if r[1] == CAUSE_NOSRC)
    n_orphan = sum(1 for r in rows if r[1] == CAUSE_ORPHAN)
    n_whole = n_wrap
    located = sum(1 for r in rows if r[3])

    nn = ' '
    lines = [
        '# Остаток EN — адресный список работ',
        '',
        f'Сгенерировано `tools/i18n_worklist.py` из `{REPORT.relative_to(ROOT)}`.',
        'Замер по DOM отвечает «сколько», этот файл — «где и почему».',
        'Классификация машинная: принадлежность фрагмента словарю целым',
        'значением или частью значения проверяется по тому же слиянию поставок,',
        'из которого собирается `src/i18n/generated.ts`.',
        '',
        f'**Всего в остатке {len(wired) + len(missing)}** ·'
        f' обёртка `tx()` хватит: {n_wrap}'
        f' · целый ключ с числом: {n_concat}'
        f' · данные фикстур D-13: {n_fixture}'
        f' · собрано в рантайме: {n_nosrc}'
        f' · вне словаря: {n_orphan}'
        f' · ждут копирайта: {len(missing)}',
        '',
        f'Адрес в исходнике найден у {located} из {len(rows)}: остальные'
        ' собираются из частей и точным литералом в коде не существуют —'
        ' это и есть признак конкатенации, а не пропуска поиска.',
        '',
        '## Работы в `src` — по причине, а не по алфавиту',
        '',
    ]
    for cause in (CAUSE_CONCAT, CAUSE_NOSRC, CAUSE_WRAP, CAUSE_FIXTURE,
                  CAUSE_ORPHAN):
        sel = [r for r in rows if r[1] == cause]
        if not sel:
            continue
        lines += [f'### {cause} — {len(sel)}', '',
                  '| фрагмент | адрес | что делать |', '|---|---|---|']
        for one, _, action, hits in sorted(sel):
            addr = ' · '.join(hits[:3]) if hits else '—'
            cell = one.replace('|', '\\|')
            lines.append(f'| {cell[:90]} | {addr} | {action} |')
        lines.append('')

    if missing:
        lines += ['## Перевода нет — в поставку копирайта', '']
        for frag in sorted(missing):
            lines.append('- ' + re.sub(r'[ \t\n\r]+', ' ', frag).strip())
        lines.append('')

    lines += [
        '## Как это читать',
        '',
        'Строка «обёртка `tx()`» — работа на одну правку: словарь держит',
        'перевод целиком, и место рендера просто не спрашивает его.',
        '',
        f'«Целый ключ с числом» дороже и правкой на месте не закрывается. Ключ',
        f'на кусок в словаре есть — поставка выдала его сознательно, чтобы мост',
        f'заработал немедленно, — но правило{nn}36 запрещает собирать текст',
        f'конкатенацией, и подставлять число обязан форматтер по локали. Взять',
        f'здесь `tx()` значило бы закрыть остаток числом, оставив нарушение.',
        '',
        '«Собрано в рантайме» — точного литерала в `src` нет: строку сложила',
        'логика. Места сборки найдены чтением и объявлены таблицей в самом',
        'скрипте (`MANUAL_SITES`), а не дописаны в этот файл: дописанное руками',
        'в порождаемый файл исчезает при первом же прогоне. Там, где адреса',
        'нет и в таблице, он не подставляется — угаданный адрес хуже',
        'отсутствующего.',
        '',
        'Фрагменты фикстур сюда попадают потому, что DOM их видит, но работой',
        'по хрому они не являются: язык артефакта и язык интерфейса — разные',
        'настройки (D-13), и переводить имя демонстрационного проекта ключом',
        'значило бы стереть эту границу.',
    ]
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'остаток {len(wired) + len(missing)} · tx() {n_wrap} · '
          f'целый ключ с числом {n_concat} · фикстуры {n_fixture} · '
          f'в рантайме {n_nosrc} · вне словаря {n_orphan} · '
          f'копирайт {len(missing)} → {OUT.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
