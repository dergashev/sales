#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Инвариант против ASCII-транслитерации умлаутов в клиентском немецком тексте.

Класс дефекта (аудит-ремедиация Task 05, F-19/F-39): единственные два
репозитория клиентского немецкого текста — ручной словарь `de` в
`src/i18n/index.ts` и сгенерированный `GENERATED_DE` в `src/i18n/generated.ts`
(машинная сборка `tools/build_i18n.py` из поставок Codex
`docs/audit/verdicts/content/i18n-en-*.md`). Поставка однажды содержала
немецкий текст без умлаутов (ae/oe/ue вместо ä/ö/ü, ss вместо ß в словах,
где короткое написание всегда неверно — «weissgrau», «hiesse») — ни одна
существовавшая проверка это не ловила, потому что ни одна не читала
содержимое словарей. Следующая поставка того же формата может повторить
дефект на НОВЫХ ключах; эта проверка ловит его раньше сборки.

Слово — не строка целиком: и ae/oe/ue, и ss легитимно встречаются в
правильном немецком («manuell», «aktuell», «neue», «Dauer», «Mauerwerk»,
«Quelle», «Visuelt» — имя шрифта; «müssen»/«dass»/«Wasser»/«Klasse» — «ss»
там никогда не «ß»). Проверка размечает КАЖДОЕ слово словарной строки:

  · `LOCALE_ASCII_SS_WORDS` — закрытый список ASCII-форм, которые НИКОГДА
    не бывают верными («weiss», «strasse», «aussen» — «weiß»/«straße»/
    «außen» пишутся через ß без исключений в современном немецком);
  · всё остальное слово с «ae»/«oe»/«ue» — подозрение на транслитерацию
    умлаута, если слово не входит в `LOCALE_ASCII_ALLOWLIST` (проверенные
    настоящие немецкие слова, где эти буквы — не транслитерация).

Список исключений — тот же принцип, что ALLOW/KNOWN_OPEN в `tools/verify.py`:
открытый, растёт по факту обоснованного ложного срабатывания, а не строится
заранее из непроверенных слов.

Идентификаторы (`customerValue`, `clientSafe`, `ValidationIssue`) не
проверяются: camelCase/PascalCase — признак программного имени, а не
немецкой прозы, и им владеет другой класс дефекта (F-29), не этот.

Вызывается как отдельный шаг `npm run verify`:
`python3 tools/check_i18n_ascii.py`.
"""
import argparse
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

DICTS = (
    ('src/i18n/index.ts', 'de',
     r"^const de = \{(.*?)\n\} as const"),
    ('src/i18n/generated.ts', 'GENERATED_DE',
     r"export const GENERATED_DE: Record<string, string> = \{(.*?)\n\} as const"),
)

ROW_RX = re.compile(r"^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',\s*$")
WORD_RX = re.compile(r"[A-Za-zÄÖÜäöüß]+")
# camelCase/PascalCase-переход внутри слова — программный идентификатор,
# не немецкая проза (см. докстринг).
IDENTIFIER_RX = re.compile(r'[a-zäöüß][A-ZÄÖÜ]')

# Проверенные настоящие немецкие слова, где «ae»/«oe»/«ue» — не
# транслитерация умлаута, а обычные соседние буквы. Только словарные формы,
# фактически встречающиеся в `de`/`GENERATED_DE` сегодня, плюс их рутинные
# словоформы того же корня — не новые, непроверенные слова.
LOCALE_ASCII_ALLOWLIST = frozenset({
    'aktuell', 'aktuelle', 'aktuellem', 'aktuellen', 'aktueller', 'aktuelles',
    'neu', 'neue', 'neuen', 'neuer', 'neues',
    # VR3-01: routine comparative forms of the already-verified 'neu'.
    'neuere', 'neuerem', 'neueren', 'neuerer', 'neueres',
    'manuell',
    # VR3-01: routine inflected forms of the already-verified 'manuell'.
    'manuelle', 'manuellem', 'manuellen', 'manueller', 'manuelles',
    'dauer', 'dauerhaft', 'dauergrundlage',
    'feuer', 'feuerwiderstand',
    'mauer', 'mauerwerk', 'verblendmauerwerk',
    'quelle', 'quellen', 'quellenreferenzen', 'quellenwert', 'quellwert',
    # VR3-01: same compound family as 'quellenreferenzen'/'quellenwert'.
    'quellenzuordnung',
    'visuelt',  # Schriftname (Eigenname), keine Transliteration
    'zuerst',
})

# ASCII-Schreibweisen, die im heutigen Deutsch NIE korrekt sind — «ss» statt
# «ß» nach langem Vokal/Diphthong ist hier eindeutig, anders als bei kurzem
# Vokal («dass», «muss», «Wasser», «Klasse»), wo «ss» das einzig richtige
# ist. Deshalb ist das eine geschlossene Liste konkreter Wortformen, keine
# allgemeine Regel über «ss».
LOCALE_ASCII_SS_WORDS = frozenset({
    'weiss', 'weisse', 'weissen', 'weisser', 'weisses', 'weissgrau',
    'gross', 'grosse', 'grossen', 'grosser', 'grosses',
    'aussen', 'aussenanlagen', 'aussenwand', 'aussenwaende',
    'strasse', 'strassen',
    'fuss', 'fussboden', 'fusswege',
    'spass',
    'massnahme', 'massnahmen',
    'hiess', 'hiesse', 'heissen', 'heisst', 'heisse',
    'schliessen', 'schliesst', 'schliesslich',
})


def _unescape(value: str) -> str:
    return (value.replace("\\'", "'")
                 .replace('\\n', ' ')
                 .replace('\\\\', '\\'))


def run(root=ROOT):
    """→ [(relpath, lineno, слово, сообщение)]. Пустой файл/словарь — вакуум."""
    root = pathlib.Path(root)
    findings = []
    for rel, dict_name, pattern in DICTS:
        p = root / rel
        if not p.exists():
            findings.append((rel, 1, '', f'[вакуум] файл отсутствует — словарь {dict_name} не проверяется'))
            continue
        text = p.read_text(encoding='utf-8')
        m = re.search(pattern, text, re.S | re.M)
        if not m:
            findings.append((rel, 1, '', f'[вакуум] объект {dict_name} не найден — словарь не проверяется'))
            continue
        body = m.group(1)
        body_offset = text[:m.start(1)].count('\n')
        seen_row = False
        for i, line in enumerate(body.split('\n'), 1):
            row = ROW_RX.match(line)
            if not row:
                continue
            seen_row = True
            value = _unescape(re.sub(r'\{[^}]*\}', ' ', row.group(2)))
            lineno = body_offset + i
            for word in WORD_RX.findall(value):
                if IDENTIFIER_RX.search(word):
                    continue
                lw = word.lower()
                if lw in LOCALE_ASCII_SS_WORDS:
                    findings.append((rel, lineno, word,
                                      f'ключ «{row.group(1)}»: «{word}» — ASCII-написание вместо «ß» '
                                      f'(правило 10, F-19)'))
                elif re.search(r'ae|oe|ue', lw) and lw not in LOCALE_ASCII_ALLOWLIST:
                    findings.append((rel, lineno, word,
                                      f'ключ «{row.group(1)}»: «{word}» — похоже на ASCII-транслитерацию '
                                      f'умлаута (ae/oe/ue вместо ä/ö/ü); правило 10, F-19. Настоящее '
                                      f'слово без умлаута → добавь его в LOCALE_ASCII_ALLOWLIST в '
                                      f'tools/check_i18n_ascii.py'))
        if not seen_row:
            findings.append((rel, 1, '', f'[вакуум] в {dict_name} не распознано ни одной строки словаря'))
    return findings


def main():
    ap = argparse.ArgumentParser(
        description='ASCII-транслитерация умлаутов в клиентских словарях DE (F-19)')
    ap.parse_args()
    findings = run()
    for rel, lineno, _word, msg in findings:
        print(f'  ✗ {rel}:{lineno} — {msg}')
    if not findings:
        print('  ✓ ни один словарь DE не содержит ASCII-транслитерацию умлаута/ß')
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())
