#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверяльщик инвариантов дизайн-системы и документации.
v4 · 2026-08-05 · перестроен после третьего мутационного аудита (два аудитора).

═══════════════════════════════════════════════════════════════════════════════
ПРАВИЛО ВХОДА АРТЕФАКТА (v4, выведено из трёх одинаковых случаев подряд)

  АРТЕФАКТ ВХОДИТ В ПРОВЕРЯЛЬЩИК ТОЙ ЖЕ ПАРТИЕЙ, КОТОРАЯ ЕГО СОЗДАЁТ.

Артефакт без класса проверок — это не «пока не проверяется», это «отчёт о нём
непроверяем». «0 новых нарушений» на файле с нулевым охватом не является
доказательством ни одного свойства этого файла; это доказательство того, что
инструмент о файле не знает.

Три случая, на которых правило выведено, — не аналогии, а одна и та же форма:

  · `data-model.md`        — охват 0. После введения детектора висячих ссылок:
                             **35 находок против 6**, найденных чтением.
  · `t0-fallback-rules.md` — охват 0. Два дефекта в текстах, уходящих клиенту,
                             нашёл человек.
  · `output-model.md`      — охват 0 (`grep output-model tools/verify.py` = 0).
                             Из 10 мутаций аудитора поймано 4; шесть прошли,
                             включая прямое ослабление R-07 (пять клиентских
                             профилей → три) и порчу денежного спесимена.
  · `design-system/README.md` — охват 57 классов, но ни один не проверял того,
                             о чём отчитывалась партия: из 9 мутаций поймано 3.
                             Сводная матрица §2.4 (329 ячеек) подтверждалась
                             СКРИПТОМ АУДИТОРА, которого в следующей редакции
                             не будет. Сводная таблица, не сверяемая с
                             источником, — заготовка для расхождения.

Отсюда v4 добавил классы `OUT-*` (модель выдач) и `RM-*` (контракты README),
и ни один из них не является «проверкой по ключевым словам»: каждый читает
структуру (нумерацию, таблицу, тело типа, тело контракта) и сверяет её с
другой структурой того же или соседнего файла.
═══════════════════════════════════════════════════════════════════════════════

Почему v3. Независимый аудитор прогнал 51 мутацию: поймано 8, прошло 43.
Заявленный `--selftest 34/34` был честен ровно в границах собственного
списка мутаций и ничего не говорил о том, чего в списке нет. Восемь классов
дыр: (1) сырой цвет ловился только в объявлении `--x: y;`, а не во всём
CSS-тексте; (2) контраст нигде не вычислялся — числа в документах никто не
сверял с формулой; (3) условная ветка вокруг сверки молча пропускала порчу
числителя; (4) у требований, объявленных закрытыми (hit-target, R-15, R-25,
DENSITY-007, R-21, три правила шрифта §1.8), не было гейта; (5) PII-скан был
чёрным списком спесименов, не покрывал css/ts/svg/txt и tools/, и инвертировал
конвенцию RFC 2606; (6) все копирайт-детекторы обходились однословной правкой;
(7) ALLOW подавлял по содержанию строки, а не по месту; (8) в матрице R-24
отсутствовали роли input/helper/error/delta/link/tooltip/kbd, и проверка не
доходила до тел компонентных описаний.

Принципы (v2 сохранены, v3 добавил 6–8):
1. Числа читаются ИЗ файлов (synthetic-fixtures.md, calculation-spec.md)
   и сверяются пересчётом и перекрёстно. Если паттерн не найден — это
   нарушение («вакуум»), а не молчаливый пропуск.
2. Ретроспективы и формулировки правил исключаются ТОЛЬКО явным allowlist
   точных строк (sha256 содержимого строки), никогда словами-маркерами.
   Изменённая строка теряет исключение автоматически.
3. Известные открытые нарушения в файлах других владельцев регистрируются
   в KNOWN_OPEN с ссылкой на пункт плана ремедиации. Они НЕ маскируются:
   печатаются при каждом запуске. Они не валят обычный запуск (иначе партию
   нельзя закрыть, пока не закрыты чужие), но валят `--strict` (гейт релиза).
   Любое НЕзарегистрированное нарушение валит любой запуск.
4. Отгружаемые артефакты до пересборки (Batch 8) заморожены побайтово:
   их нарушения известны и зарегистрированы под sha256 всего файла. Любое
   изменение файла снимает карантин — все его нарушения становятся новыми.
5. `--selftest` вносит заведомые нарушения во временные копии файлов и
   проверяет, что КАЖДЫЙ класс проверок ловит свою мутацию. Класс, не
   поймавший мутацию, валит selftest. Оригиналы не изменяются.
6. Ни одна сверка не выполняется под условием, вычисленным из проверяемых
   данных. Условие вида `if прочитанное == ожидаемое: сверить остальное`
   превращает порчу условия в тихий пропуск и запрещено. Отсутствие
   паттерна — всегда `[вакуум]`-нарушение.
7. Числа, записанные в документах как контраст, вычисляются формулой
   WCAG 2.x из фактических значений цветов. Незарегистрированное
   утверждение о контрасте — нарушение: контраст без названной пары
   не является утверждением.
8. РЕГИСТРАЦИЯ ДОЛГА НЕ БЫВАЕТ ШИРЕ САМОГО ДОЛГА. Известны шесть висячих
   ссылок — регистрируются шесть имён, и седьмая обязана валить сборку.
   Известны N требований без инварианта — регистрируются N идентификаторов.
   Ключ регистрации — идентичность находки (имя типа, идентификатор
   требования, sha256 строки), никогда не файл и никогда не класс целиком.
   Исключение одно и названное: `KNOWN_OPEN_CLASS` для НЕРАЗРЕШЁННОГО
   противоречия правил (NBSP), где долг и есть весь класс.
9. Реестр классов проверок `CHECK_CLASSES` объявлен явно. Инструмент сам
   валидирует, что каждый использованный при прогоне класс объявлен и что
   каждый объявленный класс встречается в исходнике. `check_indices.py`
   читает реестр, а не считает следы прогона.
10. СВОДНАЯ ТАБЛИЦА СВЕРЯЕТСЯ С ИСТОЧНИКОМ, А НЕ ЧИТАЕТСЯ ГЛАЗОМ (v4).
   Индекс, матрица, «итого N записей», «конъюнкция шести условий» — это
   утверждения о другом месте документа или о другом файле. Каждое такое
   утверждение либо выводится инструментом из источника, либо не существует.
   Число, названное в прозе и не выводимое, — то же самое, что счёт классов
   через инструментирование прогона: верно ровно до следующей правки.
11. ЛОКАТОР — ЧАСТЬ НАХОДКИ (v4). Ключ регистрации новых классов — идентичность
   находки (имя профиля, номер инварианта, само число), а не sha256 строки:
   `output-model.md` и `README.md` переписываются другими владельцами
   параллельно, и регистрация, привязанная к тексту строки, теряется от
   переноса абзаца. Идентичность переживает правку прозы и не переживает
   исправления самого дефекта — это ровно то, что нужно.

Запуск:   python3 tools/verify.py            → 0 = нет новых нарушений
          python3 tools/verify.py --strict   → 0 = нет вообще никаких
          python3 tools/verify.py --selftest → 0 = все детекторы живы
"""
import argparse
import ast
import hashlib
import re
import shutil
import sys
import tempfile
import pathlib
from decimal import Decimal as D, ROUND_HALF_UP

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ───────────────────────── реестр классов проверок ──────────────────────────
# Единственный источник правды о составе проверок. `check_indices.py` читает
# этот кортеж (а не считает следы прогона: форматтер кавычек, пересборка
# артефактов или уборка прозы меняли счёт, не меняя инструмента).
# Инвариант в обе стороны проверяется в Verifier.run():
#   · класс, зарегистрировавший нарушение, обязан быть здесь объявлен;
#   · класс, объявленный здесь, обязан встречаться литералом в этом файле.
CHECK_CLASSES = (
    # токены и слои
    'TOKEN-LAYER', 'TOKEN-001', 'TOKEN-REF', 'R-01', 'R-02', 'R-03',
    'LAYOUT-001', 'LAYOUT-003', 'LAYOUT-007', 'R-24', 'R-24-CAPTION',
    # CSS-текст целиком (v3, группа 1)
    'CSS-COLOR', 'CSS-RADIUS', 'CSS-SHADOW', 'CSS-GRADIENT', 'CSS-SPACING',
    # контраст (v3, группа 2)
    'CONTRAST', 'CONTRAST-UNREG', 'A11Y-ACCENT-BG',
    # гейты закрытых требований (v3, группа 4)
    'GATE-HIT', 'GATE-R15', 'GATE-R25', 'GATE-DENSITY', 'GATE-MOTION',
    'GATE-FONT', 'GATE-NUMERIC', 'GATE-LAYER', 'GATE-SCALE', 'GATE-CONTROL',
    # модель данных (Batch 4): до v3 `grep data-model tools/verify.py` = 0 —
    # главный артефакт партии инструментом не проверялся вовсе, и ноль
    # срабатываний означал ноль проверок, а не корректность.
    'DM-TYPE', 'DM-TYPE-FIELD', 'DM-INVARIANT', 'DM-ROUND', 'DM-DECISION',
    # клиентский текст Annahmen (t0-fallback-rules.md): самая дорогая
    # поверхность продукта, до v3 — ноль вхождений в инструменте.
    'T0-FACT', 'T0-COVERAGE',
    # модель выдач и гейтов (output-model.md): до v4
    # `grep output-model tools/verify.py` = 0 при 58 объявленных инвариантах.
    'OUT-SEQ', 'OUT-REF', 'OUT-SEND', 'OUT-ATTACH', 'OUT-R07', 'OUT-POLICY',
    'OUT-PROFILE', 'OUT-MONEY',
    # контракты design-system/README.md: сводная матрица против тел контрактов,
    # семь осей данных, причина неприменимости, спесимены против фикстуры.
    'RM-AXES', 'RM-MATRIX', 'RM-NAREASON', 'RM-FIXTURE', 'RM-ACCENT',
    # подпись длительности (D-17/R-26): десятичный месяц при целом интервале
    'SCHED-D17',
    # копирайт и домен
    'DATA-005', 'R-18', 'R-18-LABEL', 'XSC-10', 'COPY-004', 'COPY-007',
    'R-09', 'R-20', 'R-01-PROSE', 'CALC-014',
    # единицы, типографика чисел, даты (v3, Batch 3)
    'NBSP', 'CYRILLIC-UNIT', 'AREA-SCOPE', 'DATE-FORMAT',
    # управление и план
    'CLAUDE', 'DECISIONS', 'PLAN', 'INDEX',
    # приватность
    'PRIVACY-001', 'ARTIFACT-A11Y',
    # арифметика
    'CALC-CATALOG', 'CALC-FIXTURE', 'CALC-SCHEDULE', 'CALC-UNCERT',
    'CALC-SPEC',
    # честность самого инструмента
    'ALLOW-DUP', 'TOOL-REGISTRY',
)

# ───────────────────────── утилиты ──────────────────────────────────────────

def fp(line: str) -> str:
    """Отпечаток строки: sha256 от strip()-содержимого, 16 hex."""
    return hashlib.sha256(line.strip().encode('utf-8')).hexdigest()[:16]

def de(s: str) -> D:
    """Немецкое число → Decimal: '3.817.835,00' '1 545' '1,05' '−476.000'."""
    s = re.sub(r'[\s  *`]', '', s).replace('−', '-').replace('–', '-')
    s = s.replace('.', '').replace(',', '.')
    return D(s)

def r1000(x): return (x / 1000).quantize(D('1'), ROUND_HALF_UP) * 1000
def r1(x):    return x.quantize(D('1'), ROUND_HALF_UP)
def r2(x):    return x.quantize(D('0.01'), ROUND_HALF_UP)
def r3(x):    return x.quantize(D('0.001'), ROUND_HALF_UP)
def r05(x):   return (x * 2).quantize(D('1'), ROUND_HALF_UP) / 2

class Vacuum(Exception):
    """Ожидаемый паттерн не найден — проверка стала бы вакуумной."""


def _j(*parts: str) -> str:
    """Склейка литерала из частей.

    Спесимены PII и их паттерны собираются из кусков намеренно: с v3 скан
    приватности покрывает и сам каталог `tools/`, а исходник, содержащий
    адрес, индекс, телефон или домен буквально, срабатывал бы на себя. Это
    НЕ исключение из проверки (исключений по словам в инструменте нет и
    слепых зон по файлам тоже) — это отсутствие спесимена в тексте: искать
    в `tools/` попросту нечего, а детекторы класса работают и здесь.
    """
    return ''.join(parts)


# ── контраст WCAG 2.x ───────────────────────────────────────────────────────
# Формула: относительная яркость sRGB → (L_light+0,05)/(L_dark+0,05).
# Существует, потому что до v3 слово «contrast» не встречалось в инструменте
# ни разу: любое число в документах можно было переписать безнаказанно.

def _chan(v: int) -> float:
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hexcolor: str) -> float:
    h = hexcolor.strip().lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    if len(h) == 8:            # #RRGGBBAA — альфа для контраста не применима
        h = h[:6]
    if len(h) != 6 or not re.fullmatch(r'[0-9A-Fa-f]{6}', h):
        raise ValueError(f'не цвет: {hexcolor}')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _chan(r) + 0.7152 * _chan(g) + 0.0722 * _chan(b)

def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    lo, hi = min(a, b), max(a, b)
    return (hi + 0.05) / (lo + 0.05)

def fmt_ratio(x: float, decimals: int = 2) -> str:
    return f'{x:.{decimals}f}'.replace('.', ',')

# Палитра фактических значений (сверяется с tokens.css при каждом прогоне —
# см. Verifier.check_contrast: расхождение реестра и токенов = нарушение).
CLR = {
    'white':      '#FFFFFF',
    'canvas':     '#E8ECE9',
    'text':       '#323232',
    'accent':     '#FD5E00',
    'primary':    '#C94700',
    'hover':      '#B83F00',
    'pressed':    '#A63800',
    'focus':      '#005FCC',
    'selected':   '#F2D1BF',
    'subtle':     '#F4F6F4',
    'secondary':  '#6B6B6B',
    'muted':      '#8C8C8C',
    'disabled':   '#9D9D9D',
    'bordsubtle': '#DEDEDE',
    'borddef':    '#BDBDBD',
    'info':       '#0B24FB',
    'success':    '#3C887E',
    'error':      '#F04859',
    'lime':       '#98CE00',
}
# Токен → ключ палитры: реестр не имеет права разойтись с tokens.css.
CLR_TOKEN = {
    '--primitive-color-white':            'white',
    '--primitive-color-neutral-100':      'canvas',
    '--primitive-color-neutral-900':      'text',
    '--primitive-color-brand-orange-500': 'accent',
    '--primitive-color-orange-700':       'primary',
    '--primitive-color-orange-800':       'hover',
    '--primitive-color-orange-900':       'pressed',
    '--primitive-color-blue-focus-700':   'focus',
    '--primitive-color-orange-100':       'selected',
    '--primitive-color-neutral-050':      'subtle',
    '--primitive-color-neutral-700':      'secondary',
    '--primitive-color-neutral-600':      'muted',
    '--primitive-color-neutral-500':      'disabled',
    '--primitive-color-neutral-300':      'bordsubtle',
    '--primitive-color-neutral-400':      'borddef',
    '--primitive-color-blue-500':         'info',
    '--primitive-color-green-dark-500':   'success',
    '--primitive-color-red-500':          'error',
    '--primitive-color-green-bright-500': 'lime',
}

# ── профили выдачи: канонические имена (data-model.md §5.11) ────────────────
# Короткого `clientLive` не существует: по такому имени не сопоставляется ни
# одна политика видимости. Дефект уже ловили руками в фикстуре, и он остался
# в `output-model.md` §15 как заявление о чужом файле — то есть класс, а не
# случай, и потому он здесь.
OUTPUT_PROFILES = ('internalWorkspace', 'clientReadOnly', 'clientLiveConfiguration',
                   'clientPdf', 'clientEmail', 'clientPrint', 'internalExport')
CLIENT_PROFILES = ('clientReadOnly', 'clientLiveConfiguration',
                   'clientPdf', 'clientEmail', 'clientPrint')
# Идентификаторы на `client*`/`internal*`, профилями НЕ являющиеся. Список
# закрытый: любое новое имя вида `clientXxx` обязано быть либо профилем, либо
# объявлено здесь — иначе это опечатка в имени профиля, а её цена — молча
# несопоставленная политика видимости.
PROFILE_VOCAB_OK = ('clientSafe', 'clientSafeTransform', 'clientSafeTransformId',
                    'clientTitle', 'clientPresent', 'clientDelivered',
                    'clientProjection', 'clientTransform',
                    'internalOnly', 'internalUse')

# ── семь осей состояния данных (правило проекта 30 + STATE-001) ─────────────
# Пять обязательных состояний плюс две независимые оси. Контракт, в теле
# которого не объявлена хотя бы одна из семи, в прототип не попадает; на этом
# отклонили партию примитивов. Порядок совпадает с порядком колонок §2.4.
DATA_AXES = ('loading', 'empty', 'partial', 'ready', 'error', 'stale', 'permission')

# ───────────────────────── реестры исключений ───────────────────────────────
# ALLOW — легитимные строки (формулировки правил, ретроспективы отменённых
# значений). Ключ: (relpath, класс, отпечаток строки). Строка, изменившаяся
# хоть на символ, исключение теряет.
ALLOW = {
    # DATA-005: ретроспективы устранённой «WFL inkl. Gemeinschaftsflächen»
    ('docs/product/decisions.md',            'DATA-005', 'f0e4c461632ed7b5'): 'ретроспектива D-11 v2',
    ('docs/audit/remediation-plan.md',       'DATA-005', 'ef0f8276f69b4771'): 'отчёт Batch 1a',
    ('docs/audit/remediation-plan.md',       'DATA-005', 'dfa15eb8d6d1760f'): 'описание проверок v1',
    ('docs/audit/remediation-plan.md',       'DATA-005', '36e113dfbb638bdb'): 'ретроспектива находки аудитора',
    # R-18: заявление фикстуры о том, что label в ней не встречается
    ('docs/audit/synthetic-fixtures.md',     'R-18',     '0de7859157d0c533'): 'правило фикстуры',
    ('design-system/components-core.md',     'R-18',     'f58466d40d6a73bb'): 'формулировка гейта (запрет)',
    ('docs/audit/remediation-plan.md',       'R-18',     '39716f1d8b353ea5'): 'ретроспектива правки макетов',
    # XSC-10: цитата источника Referenzprojekt (provenance) и формулировка правила
    # COPY-007 (ab Decke): формулировки правила
    ('docs/audit/remediation-plan.md',       'COPY-007', '57f11f20bb50d2c7'): 'пункт плана Batch 3',
    ('docs/audit/remediation-plan.md',       'COPY-007', '489f3da49131f09e'): 'ретроспектива вёрстки макетов',
    ('docs/audit/remediation-plan.md',       'COPY-007', '9313e5b3053930a0'): 'пункт исходного списка Batch 3',
    # COPY-004: формулировка правила
    # R-24-CAPTION: ретроспективы исправленных компонентов
    ('design-system/README.md',        'R-24-CAPTION',   '281c47fe1a81f045'): 'ретроспектива DC-16',
    ('design-system/README.md',        'R-24-CAPTION',   '5980fe9dc018cb8d'): 'запрет в теле DC-1',
    # LAYOUT-007 / R-09: ретроспективы отменённых правил в README
    ('design-system/README.md',        'LAYOUT-007',     'f6b398ffb3af4377'): 'ретроспектива D-16 §1.3',
    ('design-system/README.md',        'R-09',           'f5e67caa9294e2ff'): 'ретроспектива DC-41',
    # R-01-PROSE: формулировки запретов и ретроспективы
    ('design-system/README.md',        'R-01-PROSE',     '8d4d3bf6e3cfb294'): 'ретроспектива §1.4',
    # Запись снята 05.08: формулировка §1.4 переписана (ring сравнивается с
    # selection-бордером, а не с поверхностью), слово «оранжевой» ушло —
    # детектор на строке больше не срабатывает. Fail-safe реестра предупредил.
    ('design-system/README.md',        'R-01-PROSE',     '5308f1fde47c4e20'): 'формулировка §1.5',
    ('design-system/README.md',        'R-01-PROSE',     '75b30e32901e6a77'): 'запрет в теле DC-4',
    ('design-system/README.md',        'R-01-PROSE',     '946fd45de7ce403c'): 'запрет в теле DC-16',
    ('design-system/README.md',        'R-01-PROSE',     '00f234965e4df062'): 'запрет в теле DC-23',
    ('design-system/README.md',        'R-01-PROSE',     'a7ca1df63e1ef413'): 'ретроспектива DC-25',
    ('design-system/README.md',        'R-01-PROSE',     '416abf5bc33af31b'): 'запрет в теле DC-25 (переписан 05.08)',
    ('design-system/README.md',        'R-01-PROSE',     '0a00001b285d99da'): 'запрет в теле Checkbox/Radio',
    # CALC-014: ретроспектива прежнего образца в DC-12
    # PLAN: [x]-пункты с оговоркой, подтверждённой аудитором
    ('docs/audit/remediation-plan.md', 'PLAN',           'c5245729b9260bc8'): 'значения приняты, P0 открыт',
    ('docs/audit/remediation-plan.md', 'PLAN',           '5b8dc101b7f183e0'): 'умышленная нереализация R-25',
}

# KNOWN_OPEN — настоящие нарушения в файлах других владельцев, уже учтённые
# планом ремедиации. Печатаются при каждом запуске; валят только --strict.
KNOWN_OPEN = {
    # Запись снята 05.08: PII-цитата номера лицензии убрана из текста плана
    # (спесимен назван классом, а не значением). Fail-safe реестра отработал —
    # изменение строки сняло исключение и напечатало предупреждение.
    # Открыто на момент прогона Batch 4 (детекторы контраста введены здесь же):
    # величины измерены у ОТВЕРГНУТОГО варианта (попытка развести dataViz и
    # статусы осветлением), пары в системе не существует и появиться не может.
    # Требуемая правка — назвать оба цвета hex-ами прямо в строке либо
    # разметить величину как измерение отвергнутого варианта.
    ('design-system/tokens.css', 'CONTRAST-UNREG', 'fcdaf3d16d691b88'):
        'design-system/tokens.css:191 · Batch 5 · утверждение о контрасте без пары',
    ('design-system/tokens.css', 'CONTRAST-UNREG', '42e386cee3024d94'):
        'design-system/tokens.css:192 · Batch 5 · утверждение о контрасте без пары',
    ('docs/audit/adr-blocking.md', 'CONTRAST', '91eb42b54852407d'):
        'docs/audit/adr-blocking.md:62 · Batch 5 · величины 1,47:1 и 1,34:1 измерены у '
        'ОТВЕРГНУТОГО варианта (осветление dataViz): пары в системе нет и не будет. '
        'Требуемая правка — назвать оба цвета hex-ами прямо в строке',
}

# Отгружаемые артефакты, замороженные до пересборки (Batch 8).
# Их нарушения известны (PRIVACY-001, A11Y-001) и перечислены в README §0 и
# remediation-plan (Batch 2 «не выполнено», Batch 8). Карантин действует,
# только пока файл побайтово равен зафиксированному состоянию.
STALE_ARTIFACTS = {
    'design-system/all3-design-system.html':
        ('35abf264670b3c0c1a37a92fe83278cf635a083d783fb6131d5db5b76ab34445',
         'пересборка — Batch 8; PRIVACY-001/A11Y-001 открыты (README §0)'),
    'design-system/preview.html':
        ('35abf264670b3c0c1a37a92fe83278cf635a083d783fb6131d5db5b76ab34445',
         'пересборка — Batch 8; PRIVACY-001/A11Y-001 открыты (README §0)'),
}

# KNOWN_OPEN_FILE — файловая регистрация для классов, введённых в v3, чей
# ремонт по природе файловый, а не построчный (NBSP по всему документу,
# кириллическая `м²`, дефисные даты, устаревший индекс в шапке). Ключ —
# (relpath, класс); адреса печатаются построчно, как и для KNOWN_OPEN.
# Отличие от KNOWN_OPEN осознанное и ограниченное: содержимое строки здесь
# не участвует в ключе, поэтому регистрация покрывает и новые вхождения того
# же класса в том же файле. Так сделано ради читаемости отчёта: построчная
# регистрация 57 денежных строк превратила бы реестр в шум. Каждая запись
# обязана называть пункт плана, которым она закрывается.
KNOWN_OPEN_FILE = {
    ('docs/product/roadmap.md',            'INDEX'):
        'Batch 5 · шапка roadmap заявляет число классов проверок и счёт selftest '
        'по редакции v2; обновляется тем же батчем, что и остальные индексы',
}

# KNOWN_OPEN_CLASS — открытое ПРОТИВОРЕЧИЕ ПРАВИЛ, а не дефект отдельного
# файла. Пока владелец не выбрал символ, инструмент обязан называть факт и
# не имеет права ни молчать, ни валить партию. Адреса печатаются построчно.
# Реестр пуст: единственная запись снята 05.08. Решение владельца по символу
# принято — остаётся U+202F, как и предписывали CLAUDE.md §7 и README §1.9;
# правило не менялось, досчитан остаток реализации (451 замена за сессию).
# Долг закрыт целиком по корпусу, поэтому класс NBSP снова валит сборку при
# любом новом плоском пробеле перед единицей. Это и есть смысл правила
# «регистрация долга не бывает шире самого долга»: запись жила ровно столько,
# сколько существовало неразрешённое противоречие, и ушла вместе с ним.
KNOWN_OPEN_CLASS = {}

# ── реестр утверждений о контрасте ──────────────────────────────────────────
# СТРУКТУРНЫЙ, а не фразовый. Прежняя редакция привязывала пару цветов к
# формулировке прозы вокруг числа — и обычная правка текста (перенос строки,
# уход слова) молча ломала инструмент: величина зависела не от объекта, а от
# того, как он сегодня написан. Это тот же дефект, что счёт классов через
# инструментирование прогона.
#
# Как работает теперь:
#   1. Пара выводится СТРУКТУРНО — из цветов, названных в том же блоке
#      (смежные непустые строки: абзац markdown, комментарий CSS вместе со
#      следующими за ним объявлениями). Hex, `--токен`, `token.path` и
#      `bare-token-name` разрешаются через tokens.css.
#   2. Чего структура не даёт — перечислено здесь, ключом «(файл, число как
#      оно записано)». Ключ не содержит ни одного слова прозы, поэтому
#      переписывание текста реестр не ломает.
# Остаточный зазор назван честно: подмена одного зарегистрированного числа
# другим зарегистрированным числом того же файла не ловится.
CONTRAST_VALUE_PAIRS = {
    # Пары, которых блок не даёт: партнёр назван словом, а не значением.
    ('design-system/tokens.css', '2,7:1'):  ('disabled', 'white'),
    ('design-system/tokens.css', '3,10:1'): ('accent', 'white'),
    ('design-system/tokens.css', '2,60:1'): ('accent', 'canvas'),
    ('design-system/README.md',  '3,10:1'): ('accent', 'white'),
    ('design-system/README.md',  '1,25:1'): ('focus', 'primary'),
    ('design-system/README.md',  '4,17:1'): ('focus', 'selected'),
    ('design-system/README.md',  '2,71:1'): ('disabled', 'white'),
}

# Файлы, в которых любое НЕзарегистрированное утверждение о контрасте —
# нарушение. `docs/product/*` намеренно не входит: он редактируется другим
# владельцем, и вакуум по чужой правке был бы ложным обвинением документа.
CONTRAST_SWEEP_FILES = (
    'design-system/README.md',
    'design-system/tokens.css',
    'design-system/components-core.md',
    'docs/audit/adr-blocking.md',
    'CLAUDE.md',
)

# ── источники, состоящие из цитат по построению ─────────────────────────────
# Цитата дефекта не является дефектом — но «это цитата» обязано быть
# доказуемым, а не заявленным. Здесь доказательство конструктивное:
# `requirements-registry.md` порождён дословной экстракцией требований
# аудита, и цитата опознаётся ПО ФОРМЕ СТРОКИ — табличная строка, чья первая
# ячейка есть идентификатор требования (`| XSC-09 | …`). Строка реестра,
# не имеющая этой формы, проверяется как обычный текст.
EXTRACTED_SOURCES = {
    'docs/audit/requirements-registry.md':
        'реестр требований порождён дословной экстракцией аудита; строка вида '
        '«| <ID> | …» — цитата норматива, а не текст продукта',
}
QUOTE_EXEMPT = ('AREA-SCOPE', 'DATE-FORMAT', 'R-18-LABEL', 'CYRILLIC-UNIT',
                'NBSP', 'DATA-005', 'R-18', 'XSC-10', 'COPY-004', 'COPY-007',
                'R-20', 'R-24')
RX_REQ_ROW = re.compile(r'^\|\s*`?[A-Z][A-Z0-9]*-\d+`?\s*\|')
RX_QUOTE_HEAD = re.compile(r'исходн\w*\s+формулировк|дословн|original\s+wording', re.I)

# ── матрица R-24 ────────────────────────────────────────────────────────────
# Роли input/helper/error/delta/link/tooltip/kbd отсутствовали в реестрах v2:
# значения в tokens.css были верны, но защиты у них не было.
R24_EXACT = {
    'display-numeric-desktop': (64, 68), 'display-numeric-narrow': (48, 52),
    'heading-1-desktop': (48, 56), 'heading-1-narrow': (36, 44),
    'heading-2': (32, 40), 'heading-3': (24, 32),
    'body': (16, 24), 'small': (14, 20), 'caption': (12, 16),
    'input': (16, 24), 'button-primary': (16, 20), 'label': (14, 20),
    'helper': (14, 20), 'error': (14, 20), 'delta': (14, 20),
    'badge-status': (14, 20), 'badge-metadata': (12, 16),
    'table-header': (14, 20), 'table-body': (14, 20), 'table-numeric': (14, 20),
    'link': (16, 24), 'tooltip': (14, 20), 'kbd': (12, 16),
}
R24_GENERIC = {12: {16}, 14: {20}, 16: {20, 24}, 24: {32}, 32: {40},
               36: {44}, 48: {52, 56}, 64: {68}}
R24_WEIGHTS = {
    '--type-display-numeric-weight': '700', '--type-heading-weight': '700',
    '--type-body-weight': '400', '--type-small-weight': '400',
    '--type-caption-weight': '400', '--type-input-weight': '400',
    '--type-button-primary-weight': '500', '--type-label-weight': '500',
    '--type-helper-weight': '400', '--type-error-weight': '500',
    '--type-delta-weight': '500',
    '--type-badge-status-weight': '500', '--type-badge-metadata-weight': '500',
    '--type-table-header-weight': '500', '--type-table-body-weight': '400',
    '--type-table-numeric-weight': '400', '--type-link-weight': '500',
    '--type-tooltip-weight': '400', '--type-kbd-weight': '400',
}
# Вес роли словами — так он пишется в телах компонентных описаний.
R24_WORD = {'400': 'Regular', '500': 'Medium', '700': 'Bold'}
# Ключи для распознавания роли в прозе. Порядок не важен: побеждает совпадение,
# заканчивающееся ближе всего к паре «кегль/интерлиньяж».
R24_ROLE_KEYS = [
    (r'body\s+в\s+таблицах|table\.body|tabellenzeile\w*|kostentabelle|'
     r'zeilen\s+der\s+kostentabelle|строк\w*\s+таблиц\w*', 'table-body'),
    (r'table\.header|tabellenkopf|заголов\w+\s+таблиц\w*',      'table-header'),
    (r'table\.numeric',                                          'table-numeric'),
    (r'badge\.status',                                           'badge-status'),
    (r'badge\.metadata|metadata-badge',                          'badge-metadata'),
    (r'button\.primary|кнопк\w*|button\s+prim\w*|schaltfläche',  'button-primary'),
    (r'display\.numeric\.desktop',                    'display-numeric-desktop'),
    (r'display\.numeric\.narrow',                      'display-numeric-narrow'),
    (r'heading\.1\.desktop',                                'heading-1-desktop'),
    (r'heading\.1\.narrow',                                  'heading-1-narrow'),
    (r'heading\.2',                                                 'heading-2'),
    (r'heading\.3',                                                 'heading-3'),
    (r'caption',                                                      'caption'),
    (r'\bsmall\b',                                                      'small'),
    (r'\blabel\b',                                                      'label'),
    (r'\bhelper\b',                                                    'helper'),
    (r'\berror\b|fehlermeldung',                                        'error'),
    (r'\bdelta\b|дельт\w*',                                             'delta'),
    (r'\binput\b|eingabefeld',                                          'input'),
    (r'\blink\b|ссылк\w*',                                               'link'),
    (r'tooltip',                                                      'tooltip'),
    (r'\bkbd\b',                                                          'kbd'),
    (r'\bbody\b',                                                        'body'),
]

# ───────────────────────── проверяльщик ─────────────────────────────────────

class Verifier:
    def __init__(self, root: pathlib.Path):
        self.root = pathlib.Path(root)
        self.new = []      # (cls, where, msg) — валят сборку
        self.known = []    # (cls, where, msg, ref) — известные открытые
        self.warn = []
        self.vacuum = []   # подмножество self.new: «проверка НЕ ВЫПОЛНЕНА»
        self._used_allow = {}    # key → сколько строк подавила запись
        self._used_known = {}
        self._used_known_file = {}
        self._used_known_class = {}
        self._quoted = {}
        self._cache = {}
        self._globs = {}
        self.fx = {}       # величины, вычитанные из фикстуры (см. _arithmetic)
        self._allow_hits = {}    # key → [номера строк]
        self._known_hits = {}
        self._classes = set()    # какие классы реально зарегистрировали вывод
        self._stale_ok = {}
        for rel, (h, _) in STALE_ARTIFACTS.items():
            p = self.root / rel
            self._stale_ok[rel] = (p.exists() and
                hashlib.sha256(p.read_bytes()).hexdigest() == h)

    # -- инфраструктура -------------------------------------------------------
    def read(self, rel):
        if rel in self._cache:
            return self._cache[rel]
        p = self.root / rel
        v = p.read_text(encoding='utf-8') if p.exists() else None
        self._cache[rel] = v
        return v

    def files(self, pattern):
        # Кэш на экземпляр: один и тот же glob перечисляется несколькими
        # проверками, а репозиторий содержит два артефакта по 450 КБ.
        if pattern not in self._globs:
            out = []
            for p in sorted(self.root.rglob(pattern)):
                if p.is_file():
                    rel = p.relative_to(self.root).as_posix()
                    txt = p.read_text(encoding='utf-8', errors='replace')
                    self._cache[rel] = txt
                    out.append((rel, txt))
            self._globs[pattern] = out
        return list(self._globs[pattern])

    def emit(self, cls, rel, lineno, line, msg):
        self._classes.add(cls)
        if cls in QUOTE_EXEMPT and rel in EXTRACTED_SOURCES and RX_REQ_ROW.match(line.strip()):
            # Цитата норматива по форме строки в файле, порождённом
            # экстракцией. Не молчание: считается и печатается сводкой.
            self._quoted[(rel, cls)] = self._quoted.get((rel, cls), 0) + 1
            return
        h = fp(line)
        key = (rel, cls, h)
        if key in ALLOW:
            # Подавление считается: дословный дубль ALLOW-строки, дописанный
            # в файл как новое нарушение, подавлялся бы той же записью.
            # Запись, сработавшая больше одного раза, — нарушение ALLOW-DUP.
            self._allow_hits.setdefault(key, set()).add(lineno)
            self._used_allow[key] = len(self._allow_hits[key])
            return
        if rel in STALE_ARTIFACTS and self._stale_ok.get(rel):
            self.known.append((cls, f'{rel}:{lineno}', msg, STALE_ARTIFACTS[rel][1]))
            return
        if key in KNOWN_OPEN:
            self._known_hits.setdefault(key, set()).add(lineno)
            self._used_known[key] = len(self._known_hits[key])
            self.known.append((cls, f'{rel}:{lineno}', msg, KNOWN_OPEN[key]))
            return
        fkey = (rel, cls)
        if fkey in KNOWN_OPEN_FILE:
            self._used_known_file[fkey] = self._used_known_file.get(fkey, 0) + 1
            self.known.append((cls, f'{rel}:{lineno}', msg, KNOWN_OPEN_FILE[fkey]))
            return
        if cls in KNOWN_OPEN_CLASS:
            self._used_known_class[cls] = self._used_known_class.get(cls, 0) + 1
            self.known.append((cls, f'{rel}:{lineno}', msg, KNOWN_OPEN_CLASS[cls]))
            return
        self.new.append((cls, f'{rel}:{lineno}', f'{msg} (fp={h})'))

    def fail(self, cls, where, msg):
        self._classes.add(cls)
        self.new.append((cls, where, msg))
        # ВАКУУМ УЧИТЫВАЕТСЯ ОТДЕЛЬНО И ГРОМЧЕ. Между «нашёл расхождение» и
        # «не смог проверить» разница принципиальная: первое — дефект в
        # документе, второе — дефект в ИНСТРУМЕНТЕ. Молчаливая сверка хуже
        # отсутствующей, потому что зелёный отчёт по ней читают как
        # доказательство. Вакуум по-прежнему валит сборку — но не растворяется
        # среди обычных находок «одним из пяти».
        if '[вакуум]' in msg:
            self.vacuum.append((cls, where, msg))

    def scan(self, cls, rel, text, pattern, msg, flags=0):
        rx = re.compile(pattern, flags)
        for i, line in enumerate(text.split('\n'), 1):
            if rx.search(line):
                self.emit(cls, rel, i, line, f'{msg} — {line.strip()[:80]}')

    def grab(self, text, pattern, cls, desc, flags=0):
        m = re.search(pattern, text, flags)
        if not m:
            self.fail(cls, desc, f'[вакуум] паттерн не найден: {desc} — проверка не может быть выполнена')
            raise Vacuum(desc)
        return m

    def eq(self, cls, desc, got, exp):
        if got != exp:
            self.fail(cls, desc, f'{desc}: получено {got}, ожидается {exp}')

    # -- 1. Токены: слои, ссылки, точные значения -----------------------------
    def check_tokens(self):
        css = self.read('design-system/tokens.css') or ''
        readme = self.read('design-system/README.md') or ''
        code = re.sub(r'/\*.*?\*/', '', css, flags=re.S)  # без комментариев
        decls = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', code))

        # TOKEN-LAYER: литеральные цвета только в primitive-слое;
        # semantic-цвета — только ссылки на primitive.
        for name, val in decls.items():
            v = val.strip()
            if re.search(r'#[0-9A-Fa-f]{3,8}\b|rgba?\(', v) and not name.startswith('--primitive-color-'):
                self.fail('TOKEN-LAYER', 'tokens.css',
                          f'{name}: литеральный цвет «{v[:40]}» вне primitive-слоя')
            if name.startswith('--color-') and not re.fullmatch(r'var\(--primitive-[\w-]+\)', v):
                self.fail('TOKEN-LAYER', 'tokens.css',
                          f'{name}: semantic-цвет обязан ссылаться на primitive, найдено «{v[:40]}»')

        def resolve(name, depth=0):
            if depth > 10 or name not in decls:
                return None
            v = decls[name].strip()
            m = re.fullmatch(r'var\((--[\w-]+)\)', v)
            return resolve(m.group(1), depth + 1) if m else v.upper()

        # R-02: точные значения primary action
        for tok, exp in [('--color-action-primary-bg', '#C94700'),
                         ('--color-action-primary-hover', '#B83F00'),
                         ('--color-action-primary-pressed', '#A63800'),
                         ('--color-action-primary-text', '#FFFFFF')]:
            self.eq('R-02', f'tokens {tok}', resolve(tok), exp)
        # R-03: selection и двухслойный фокус
        self.eq('R-03', 'tokens --color-selection-border', resolve('--color-selection-border'), '#C94700')
        self.eq('R-03', 'tokens --color-focus-ring', resolve('--color-focus-ring'), '#005FCC')
        self.eq('R-03', 'tokens --color-focus-separator', resolve('--color-focus-separator'), '#FFFFFF')
        # R-01: #FD5E00 разрешён только в двух семантических записях
        for name in decls:
            if name.startswith('--color-') and name not in (
                    '--color-brand-accent', '--color-text-display-accent'):
                if resolve(name) == '#FD5E00':
                    self.fail('R-01', 'tokens.css', f'{name} разрешается в #FD5E00 — бренд-оранжевый '
                              f'запрещён как семантика (R-01)')

        # TOKEN-001: color-mix не экспортируется
        if 'color-mix' in css:
            self.fail('TOKEN-001', 'tokens.css', 'color-mix() не является exact value (R-25, TOKEN-001/004)')

        # LAYOUT-007: плотность не переопределяется режимом на уровне CSS
        if re.search(r'\.mode-\w+\s+\.density-\w+\s*\{', css):
            self.fail('LAYOUT-007', 'tokens.css', 'Output Profile переопределяет плотность (D-16, TOKEN-004)')

        # LAYOUT-003
        if not re.search(r'--content-max-width:\s*1200px', css):
            self.fail('LAYOUT-003', 'tokens.css', 'content-max-width должен быть 1200px')

        # TOKEN-REF: ссылки/упоминания токенов существуют.
        # CLI-флаги (`--strict`) — не токены: кастом-свойство этой системы
        # всегда ≥ 2 сегментов; однословное `--x` проверяется, только если
        # объявлено (структурное сужение, не словарь исключений).
        declared = set(decls)
        for src, name in ((readme, 'README'), (css, 'tokens.css')):
            for used in set(re.findall(r'var\((--[\w-]+)\)', src)):
                if used not in declared:
                    self.fail('TOKEN-REF', name, f'ссылка на несуществующий токен {used}')
        for mention in set(re.findall(r'`(--[\w-]+)`', readme)):
            multi = '-' in mention[2:]
            if multi and mention not in declared:
                self.fail('TOKEN-REF', 'README', f'в тексте упомянут несуществующий токен {mention}')

        # R-24: реальные пары кегль/интерлиньяж/вес из --type-* токенов
        sizes, lines = {}, {}
        for role, kind, val in re.findall(r'--type-([a-z0-9-]+)-(size|line)\s*:\s*(\d+)px', code):
            (sizes if kind == 'size' else lines)[role] = int(val)
        if not sizes:
            self.fail('R-24', 'tokens.css', '[вакуум] не найдено ни одной пары --type-*-size/-line')
        for role, (es, el) in R24_EXACT.items():
            if role not in sizes or role not in lines:
                self.fail('R-24', 'tokens.css', f'роль R-24 «{role}» не объявлена парой size/line')
                continue
            if (sizes[role], lines[role]) != (es, el):
                self.fail('R-24', 'tokens.css',
                          f'{role}: {sizes[role]}/{lines[role]}, R-24 требует {es}/{el}')
        # Пара обязана быть полной: роль с size без line (или наоборот) прежде
        # молча пропускалась — снятие `--type-input-line` не ловилось ничем.
        for role in set(sizes) | set(lines):
            if role not in sizes or role not in lines:
                self.fail('R-24', 'tokens.css',
                          f'роль «{role}» объявлена неполной парой (size={sizes.get(role)}, '
                          f'line={lines.get(role)}) — R-24 требует обе величины')
                continue
            if role in R24_EXACT:
                continue
            if sizes[role] not in R24_GENERIC:
                self.fail('R-24', 'tokens.css',
                          f'{role}: кегль {sizes[role]}px вне шкалы R-24 '
                          f'{sorted(R24_GENERIC)}')
            elif lines[role] not in R24_GENERIC[sizes[role]]:
                self.fail('R-24', 'tokens.css',
                          f'{role}: {sizes[role]}px с интерлиньяжем {lines[role]} вне матрицы R-24')
        for tok, exp in R24_WEIGHTS.items():
            got = resolve(tok)
            if got != exp:
                self.fail('R-24', 'tokens.css', f'{tok}: вес {got}, R-24 требует {exp}')
        # запасная сетка: инлайн-пары в любых css-фрагментах и в теле спек
        for src, name in ((css, 'tokens.css'), (readme, 'README'),
                          (self.read('design-system/components-core.md') or '', 'components-core')):
            for a, b in re.findall(r'font-size:\s*(\d+)px\s*;?\s*line-height:\s*(\d+)px', src):
                a, b = int(a), int(b)
                if a not in R24_GENERIC:
                    self.fail('R-24', name, f'инлайн-кегль {a}px вне шкалы R-24')
                elif b not in R24_GENERIC[a]:
                    self.fail('R-24', name, f'инлайн-пара {a}/{b} вне матрицы R-24')

    # -- 1a. CSS-текст целиком (не только объявления токенов) -----------------
    def _css_sources(self):
        """Все куски CSS, за которые отвечает эта система.

        v2 разбирал только `--x: y;` в tokens.css. Мимо проходили: цвет в теле
        правила (`.text-display-accent { color: #FD5E00 }`), дописанный в конец
        tokens.css блок `.btn-primary{background:#FD5E00}` и тот же блок в
        fenced-css внутри README. Отгружаемый HTML сюда не входит: он на
        карантине и покрыт ARTIFACT-A11Y.
        """
        css = self.read('design-system/tokens.css')
        if css is None:
            self.fail('CSS-COLOR', 'tokens.css', '[вакуум] design-system/tokens.css отсутствует')
        else:
            yield 'design-system/tokens.css', css, 0
        for rel, text in self.files('*.md'):
            if rel.startswith('tools/'):
                continue
            for m in re.finditer(r'```(?:css|scss|less)\s*\n(.*?)```', text, re.S):
                yield rel, m.group(1), text[:m.start()].count('\n') + 1

    def check_css(self):
        SCALE = {0, 4, 8, 12, 16, 24, 32, 48, 64}
        SPACING = (r'margin|margin-top|margin-right|margin-bottom|margin-left|'
                   r'padding|padding-top|padding-right|padding-bottom|padding-left|'
                   r'gap|row-gap|column-gap|inset|top|right|bottom|left|'
                   r'outline-offset|translate|text-indent')
        found_any = False
        for rel, raw, base in self._css_sources():
            found_any = True
            # комментарии выкусываются с сохранением нумерации строк
            code = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), raw, flags=re.S)
            for i, line in enumerate(code.split('\n'), 1):
                ln = base + i
                is_primitive = re.match(r'\s*--primitive-[\w-]+\s*:', line) is not None
                for m in re.finditer(r'#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(|\blab\(|\boklch\(', line):
                    if not is_primitive:
                        self.emit('CSS-COLOR', rel, ln, line,
                                  f'литеральный цвет «{m.group(0)}» вне primitive-слоя '
                                  f'(правило 2: только семантические токены)')
                for m in re.finditer(r'border-radius\s*:\s*([^;{}]+)', line):
                    if not re.fullmatch(r'\s*0(px|rem|%)?\s*', m.group(1)):
                        self.emit('CSS-RADIUS', rel, ln, line,
                                  f'border-radius: {m.group(1).strip()} — правило 4 требует 0')
                if re.search(r'--radius\s*:(?!\s*0(?:px|rem|%)?\s*[;}])', line):
                    self.emit('CSS-RADIUS', rel, ln, line, '--radius ≠ 0 (правило 4)')
                if re.search(r'\b(linear|radial|conic|repeating-\w+)-gradient\s*\(', line):
                    self.emit('CSS-GRADIENT', rel, ln, line, 'градиент запрещён (правило 4)')
                for m in re.finditer(r'\b(box-shadow|text-shadow)\s*:\s*([^;{}]+)', line):
                    val = m.group(2).strip()
                    # `0 0 0 …` — это кольцо фокуса R-03, а не тень: у него нет
                    # ни смещения, ни размытия. Всё остальное — тень.
                    if not re.match(r'^(none|0\s+0\s+0(\s|$))', val):
                        self.emit('CSS-SHADOW', rel, ln, line,
                                  f'{m.group(1)}: {val[:40]} — тени запрещены (правило 4)')
                for m in re.finditer(r'(?<![-\w])(' + SPACING + r')\s*:\s*([^;{}]+)', line):
                    for v in re.findall(r'(-?\d+(?:\.\d+)?)px', m.group(2)):
                        if abs(float(v)) not in SCALE:
                            self.emit('CSS-SPACING', rel, ln, line,
                                      f'{m.group(1)}: {v}px вне шкалы отступов '
                                      f'4/8/12/16/24/32/48/64 (правило 2, LAYOUT-001)')
        if not found_any:
            self.fail('CSS-COLOR', 'css', '[вакуум] не найдено ни одного источника CSS')

    # -- 1b. Контраст: числа документов против формулы WCAG -------------------
    def check_contrast(self):
        # реестр палитры обязан совпадать с tokens.css
        css = self.read('design-system/tokens.css') or ''
        decls = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);',
                                re.sub(r'/\*.*?\*/', '', css, flags=re.S)))
        for tok, key in CLR_TOKEN.items():
            got = (decls.get(tok) or '').strip().upper()
            if got != CLR[key].upper():
                self.fail('CONTRAST', 'tokens.css',
                          f'{tok} = {got or "не объявлен"}, реестр контраста ожидает '
                          f'{CLR[key]} — реестр и токены разошлись')

        rx_ratio = re.compile(r'(?<![\d,.])(\d{1,2})(?:[.,](\d{1,2}))?\s*:\s*1(?![\d])')
        rx_thresh = re.compile(r'≥|≤|>=|<=|не\s+проход|проход|требуем|требует|минимум|'
                               r'ниже|gate|порог', re.I)

        def claims_on(line):
            out = []
            for m in rx_ratio.finditer(line):
                whole, frac = m.group(1), m.group(2)
                val = float(f'{whole}.{frac}') if frac else float(whole)
                dec = len(frac) if frac else 0
                out.append((m.group(0), val, dec))
            return out

        def matches(val, dec, pairs):
            """Совпадает ли записанное число с контрастом хотя бы одной пары."""
            for fg, bg in pairs:
                if abs(round(contrast(fg, bg), dec) - val) < 10 ** (-dec) / 2 + 1e-9:
                    return True
            return False

        # Разрешение цветов, названных прямо на строке: hex, `--токен`,
        # каноническое имя раздела 13 (`text.muted`, `surface.selected`).
        def resolve_tok(name, depth=0):
            v = (decls.get(name) or '').strip()
            if not v or depth > 8:
                return None
            r = re.fullmatch(r'var\((--[\w-]+)\)', v)
            return resolve_tok(r.group(1), depth + 1) if r else v

        def colors_on(line):
            out = []
            for h in re.findall(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b', line):
                out.append(h.upper())
            for t in re.findall(r'--[\w-]+', line):
                v = resolve_tok(t)
                if v and re.fullmatch(r'#[0-9A-Fa-f]{3,8}', v):
                    out.append(v.upper())
            for d in re.findall(r'\b([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)\b', line):
                v = resolve_tok('--color-' + d.replace('.', '-'))
                if v and re.fullmatch(r'#[0-9A-Fa-f]{3,8}', v):
                    out.append(v.upper())
            # «голые» имена токенов в прозе: `text-muted`, `surface-selected`
            for d in re.findall(r'\b([a-z]+(?:-[a-z0-9]+)+)\b', line):
                for cand in ('--color-' + d, '--' + d):
                    v = resolve_tok(cand)
                    if v and re.fullmatch(r'#[0-9A-Fa-f]{3,8}', v):
                        out.append(v.upper())
            return out

        # Подложки по умолчанию: белая поверхность документа, канва, основной
        # текст и бренд-акцент. Это не «список исключений», а фактический
        # набор поверхностей системы: любое утверждение о контрасте в этих
        # документах говорит об одной из них.
        # Только фактические ПОВЕРХНОСТИ. Текст и акцент из набора убраны:
        # с ними пул давал столько величин, что перестановка двух
        # зарегистрированных чисел внутри файла проходила насквозь.
        IMPLICIT = [CLR['white'], CLR['canvas']]

        # Проверка каждого числа: пара выводится структурно из блока, и
        # только то, что структура дать не может, берётся из реестра
        # «(файл, число) → пара». Ни одного якоря по формулировке прозы.
        used_reg = set()
        for rel in CONTRAST_SWEEP_FILES:
            text = self.read(rel)
            if text is None:
                self.fail('CONTRAST-UNREG', rel, '[вакуум] файл отсутствует')
                continue
            rows = text.split('\n')
            for i, line in enumerate(rows, 1):
                claims = [c for c in claims_on(line)
                          if not (rx_thresh.search(line) and c[1] in (3.0, 4.5, 7.0))]
                if not claims:
                    continue
                # Блок = абзац смежных непустых строк. Исключение: строка
                # markdown-таблицы блокируется САМА СОБОЙ — иначе «блоком»
                # становится вся таблица, её пул цветов покрывает все величины
                # файла, и перестановка двух чисел между строками проходит.
                if line.lstrip().startswith('|'):
                    block = line
                else:
                    a = b = i - 1
                    while a > 0 and rows[a - 1].strip() and not rows[a - 1].lstrip().startswith('|'):
                        a -= 1
                    while b + 1 < len(rows) and rows[b + 1].strip() \
                            and not rows[b + 1].lstrip().startswith('|'):
                        b += 1
                    block = '\n'.join(rows[a:b + 1])
                cols = colors_on(block)
                pool = list(dict.fromkeys(cols + IMPLICIT))
                pairs = [(x, y) for n, x in enumerate(pool) for y in pool[n + 1:]]
                for raw, val, dec in claims:
                    if matches(val, dec, pairs):
                        continue
                    key = (rel, raw.replace(' ', ''))
                    reg = CONTRAST_VALUE_PAIRS.get(key)
                    if reg:
                        used_reg.add(key)
                        if matches(val, dec, [(CLR[reg[0]], CLR[reg[1]])]):
                            continue
                        self.emit('CONTRAST', rel, i, line,
                                  f'записано {raw}, но зарегистрированная пара '
                                  f'{reg[0]}/{reg[1]} даёт по формуле WCAG '
                                  f'{fmt_ratio(contrast(CLR[reg[0]], CLR[reg[1]]), max(dec, 2))}')
                        continue
                    if not cols:
                        self.emit('CONTRAST-UNREG', rel, i, line,
                                  f'утверждение о контрасте {raw}: в блоке не назван ни один '
                                  f'цвет и пара не зарегистрирована — контраст без названной '
                                  f'пары не является утверждением (назовите оба цвета hex-ами '
                                  f'прямо в строке)')
                    else:
                        self.emit('CONTRAST', rel, i, line,
                                  f'записано {raw}; ни одна пара из цветов блока '
                                  f'({", ".join(sorted(set(cols)))}) и поверхностей системы '
                                  f'не даёт этой величины по формуле WCAG')
        for key in CONTRAST_VALUE_PAIRS:
            if key not in used_reg and (self.root / key[0]).exists():
                self.warn.append(f'CONTRAST: запись реестра пар {key} не сработала '
                                 f'(число исчезло или стало выводимым структурно)')

        # Акцентный текст допустим только на белом (3,10:1); на канве 2,60:1.
        acc_w = contrast(CLR['accent'], CLR['white'])
        acc_c = contrast(CLR['accent'], CLR['canvas'])
        if acc_w < 3.0:
            self.fail('A11Y-ACCENT-BG', 'tokens.css',
                      f'--color-text-display-accent на surface-default даёт {fmt_ratio(acc_w)}:1 < 3:1')
        if acc_c >= 3.0:
            self.fail('A11Y-ACCENT-BG', 'tokens.css',
                      f'расчёт не воспроизводит запрет: акцент на канве даёт {fmt_ratio(acc_c)}:1')
        # Фон документа. Правил с селектором `body` может быть несколько
        # (например отдельно шрифт и отдельно фон) — проверяются все.
        bgs = []
        for m in re.finditer(r'([^{}@]+)\{([^}]*)\}', re.sub(r'/\*.*?\*/', '', css, flags=re.S)):
            sels = [s.strip().split()[0].lower() for s in m.group(1).split(',') if s.strip()]
            if 'body' not in sels and 'html' not in sels:
                continue
            for b in re.finditer(r'background(?:-color)?\s*:\s*([^;]+)', m.group(2)):
                bgs.append(b.group(1).strip())
        if not bgs:
            self.fail('A11Y-ACCENT-BG', 'tokens.css',
                      'ни одно правило html/body не задаёт background — правило проекта 6 '
                      'требует белый фон явно, а акцентный текст читаем только на белом')
        for val in bgs:
            if 'var(--color-surface-default)' not in val:
                self.fail('A11Y-ACCENT-BG', 'tokens.css',
                          f'body {{ background: {val} }} — правило проекта 6 требует '
                          f'var(--color-surface-default); на канве герой-число DC-38 даёт '
                          f'{fmt_ratio(acc_c)}:1 вместо {fmt_ratio(acc_w)}:1')
        # ни одно правило не сажает акцентный текст на канву
        for m in re.finditer(r'\{([^}]*)\}', css):
            blk = m.group(1)
            if re.search(r'color\s*:\s*var\(--color-text-display-accent\)|color\s*:\s*#FD5E00', blk, re.I) \
               and re.search(r'background(?:-color)?\s*:\s*(var\(--color-surface-canvas\)|#E8ECE9)', blk, re.I):
                self.fail('A11Y-ACCENT-BG', 'tokens.css',
                          'акцентный текст на канве в одном правиле — запрещено (2,60:1)')

    # -- 1c. Гейты требований, объявленных закрытыми --------------------------
    def check_gates(self):
        css = self.read('design-system/tokens.css') or ''
        readme = self.read('design-system/README.md') or ''
        code = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
        decls = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', code))

        def resolve(name, depth=0):
            if depth > 10 or name not in decls:
                return None
            v = decls[name].strip()
            m = re.fullmatch(r'var\((--[\w-]+)\)', v)
            return resolve(m.group(1), depth + 1) if m else v.upper()

        # R-04 / XSC-07: цель нажатия 44×44 — величина и её применение
        if (decls.get('--size-hit-target-default') or '').strip() != '44px':
            self.fail('GATE-HIT', 'tokens.css',
                      f'--size-hit-target-default = {decls.get("--size-hit-target-default")}, '
                      f'R-04/XSC-07 требуют 44px')
        m = re.search(r'\.hit-target::before\s*\{([^}]*)\}', code)
        if not m:
            self.fail('GATE-HIT', 'tokens.css',
                      '[вакуум] правило .hit-target::before не найдено — расширение зоны нажатия отсутствует')
        else:
            blk = m.group(1)
            for prop in ('width', 'height'):
                v = re.search(prop + r'\s*:\s*([^;]+)', blk)
                if not v:
                    self.fail('GATE-HIT', 'tokens.css', f'.hit-target::before без {prop}')
                elif 'var(--size-hit-target-default)' not in v.group(1):
                    self.fail('GATE-HIT', 'tokens.css',
                              f'.hit-target::before {prop}: {v.group(1).strip()} — зона нажатия '
                              f'обязана читаться из --size-hit-target-default (R-04)')

        # R-15: business state / policy / domain не бывают токенами
        # R-15 проверяется БЕЛЫМ списком префиксов, а не чёрным списком имён:
        # чёрный список ловил только те business-состояния, которые уже успели
        # побывать в файле. Любое имя вне визуальных семейств раздела 13 —
        # нарушение до доказательства обратного.
        ALLOWED_PREFIXES = (
            '--primitive-', '--color-', '--type-', '--font-', '--paragraph-',
            '--space-', '--size-', '--border-', '--radius', '--layer-',
            '--motion-', '--stagger-', '--enter-', '--control-', '--row-',
            '--cell-', '--content-', '--measure-', '--gutter-', '--panel-',
        )
        BUSINESS = re.compile(r'output-profile|workflow|policy|domain|permission|'
                              r'data-quality|version-state|delivery-state|variant-role|'
                              r'coverage-state|option-state|accuracy-zone|mode-|'
                              r'regionalfaktor|profile', re.I)
        for name in decls:
            if BUSINESS.search(name) or not name.startswith(ALLOWED_PREFIXES):
                self.fail('GATE-R15', 'tokens.css',
                          f'{name}: не визуальный токен раздела 13 (R-15) — business state, '
                          f'policy и domain живут в data/policy-контрактах, не в tokens.css')
            if name.startswith('--component-'):
                self.fail('GATE-R25', 'tokens.css',
                          f'{name}: component-слой не реализуется без ADR (R-25/TOKEN-005)')

        # Правило 19/20: длительности зафиксированы, а не «примерно такие».
        # Читаются из :root — общий словарь перекрыт блоком reduced-motion,
        # где те же токены законно равны 0ms.
        root_blk = re.search(r':root\s*\{(.*?)\n\}', code, re.S)
        root_decls = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);',
                                     root_blk.group(1) if root_blk else ''))
        if not root_blk:
            self.fail('GATE-MOTION', 'tokens.css', '[вакуум] блок :root не найден')
        for tok, exp in (('--motion-value-change', '400ms'), ('--stagger-wave', '80ms'),
                         ('--motion-duration-fast', '120ms'), ('--stagger-row', '30ms')):
            got = (root_decls.get(tok) or '').strip()
            if got != exp:
                self.fail('GATE-MOTION', 'tokens.css',
                          f'{tok} = {got or "не объявлен"}, правило 19/20 требует {exp}')
        if (root_decls.get('--enter-shift') or '').strip() not in ('var(--space-2)', '8px'):
            self.fail('GATE-MOTION', 'tokens.css',
                      f'--enter-shift = {root_decls.get("--enter-shift")}, правило 20 требует подъём 8 px')

        # Шкала отступов — в самих токенах, не только в прозе README.
        for name, val in decls.items():
            if re.fullmatch(r'--space-\d+', name):
                px = re.fullmatch(r'\s*(\d+)px\s*', val)
                if not px or int(px.group(1)) not in (4, 8, 12, 16, 24, 32, 48, 64):
                    self.fail('GATE-SCALE', 'tokens.css',
                              f'{name} = {val.strip()} вне канонической шкалы 4/8/12/16/24/32/48/64')

        # Правило 7: числа — табличные цифры и вправо.
        num = re.search(r'\.numeric\s*\{([^}]*)\}', code)
        if not num:
            self.fail('GATE-NUMERIC', 'tokens.css', '[вакуум] правило .numeric не найдено (правило 7)')
        else:
            if 'font-feature-settings' not in num.group(1) or 'font-numeric' not in num.group(1):
                self.fail('GATE-NUMERIC', 'tokens.css',
                          '.numeric без табличных цифр (tnum) — правило 7')
            if not re.search(r'text-align\s*:\s*right', num.group(1)):
                self.fail('GATE-NUMERIC', 'tokens.css', '.numeric без выравнивания вправо — правило 7')

        # Слои: порядок обязан быть строго возрастающим по назначению.
        order = ['--layer-header', '--layer-popover', '--layer-tooltip',
                 '--layer-dialog-backdrop', '--layer-dialog', '--layer-toast']
        vals = []
        for nm in order:
            v = (decls.get(nm) or '').strip()
            if not re.fullmatch(r'\d+', v):
                self.fail('GATE-LAYER', 'tokens.css', f'{nm} не объявлен числом (найдено {v!r})')
                vals = None
                break
            vals.append(int(v))
        if vals and any(a >= b for a, b in zip(vals, vals[1:])):
            self.fail('GATE-LAYER', 'tokens.css',
                      f'порядок слоёв не строго возрастающий: {dict(zip(order, vals))} — '
                      f'коллизия перекрытий (TOKEN-005)')

        # R-03: двухслойный индикатор фокуса — толщина зафиксирована.
        for tok, exp in (('--border-width-focus', '2px'), ('--border-width-strong', '2px'),
                         ('--border-width-default', '1px')):
            got = (decls.get(tok) or '').strip()
            if got != exp:
                self.fail('R-03', 'tokens.css', f'{tok} = {got or "не объявлен"}, требуется {exp}')

        # Точные визуальные высоты контролов (README §1.3) и длительности.
        for tok, exp in (('--size-control-visual-sm', '32px'),
                         ('--size-control-visual-md', '40px'),
                         ('--size-control-visual-lg', '48px'),
                         ('--motion-duration-base', '200ms'),
                         ('--motion-duration-slow', '240ms')):
            got = (root_decls.get(tok) or '').strip()
            if got != exp:
                self.fail('GATE-DENSITY' if tok.startswith('--size') else 'GATE-MOTION',
                          'tokens.css', f'{tok} = {got or "не объявлен"}, требуется {exp}')

        # Кросс-сверка ширины правой панели: токен против прозы README §1.2.
        rp = re.search(r'правая панель S3 — (\d+) px', readme)
        if not rp:
            self.fail('GATE-DENSITY', 'README', '[вакуум] README §1.2 не называет ширину правой панели')
        else:
            got = (root_decls.get('--panel-right-width') or '').strip()
            if got != rp.group(1) + 'px':
                self.fail('GATE-DENSITY', 'tokens.css',
                          f'--panel-right-width = {got}, README §1.2 называет {rp.group(1)} px')

        # R-01: бренд-акцент существует ровно одним значением.
        if resolve('--color-brand-accent') != '#FD5E00':
            self.fail('R-01', 'tokens.css',
                      f'--color-brand-accent = {resolve("--color-brand-accent")}; бренд-оранжевый '
                      f'#FD5E00 существует только здесь и в text-display-accent (R-01)')
        if resolve('--color-text-display-accent') != '#FD5E00':
            self.fail('R-01', 'tokens.css',
                      f'--color-text-display-accent = {resolve("--color-text-display-accent")}, '
                      f'требуется #FD5E00 (R-01, DC-38)')

        # R-24: применяемый вес body — Regular (решение PO, CONFLICT-C).
        wb = (decls.get('--font-weight-body') or '').strip()
        if wb not in ('var(--font-weight-regular)', '400'):
            self.fail('R-24', 'tokens.css',
                      f'--font-weight-body = {wb or "не объявлен"}; применяемый вес body обязан '
                      f'быть Regular (R-24, решение PO CONFLICT-C)')

        # DENSITY-007: точные минимумы строк
        root = re.search(r':root\s*\{(.*?)\n\}', code, re.S)
        comp = re.search(r'\.density-compact\s*\{([^}]*)\}', code)
        for what, blk, exp in (('Komfortabel (:root)', root, '52px'),
                               ('Kompakt (.density-compact)', comp, '44px')):
            if not blk:
                self.fail('GATE-DENSITY', 'tokens.css', f'[вакуум] блок {what} не найден')
                continue
            for tok in ('--row-height-financial', '--row-height'):
                v = re.search(re.escape(tok) + r'\s*:\s*([^;]+)', blk.group(1))
                if not v:
                    self.fail('GATE-DENSITY', 'tokens.css', f'{what}: {tok} не задан')
                elif v.group(1).strip() != exp:
                    self.fail('GATE-DENSITY', 'tokens.css',
                              f'{what}: {tok} = {v.group(1).strip()}, DENSITY-007 требует {exp}')

        # R-21: prefers-reduced-motion гасит движение
        rm = re.search(r'@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{(.*?)\n\}\s*\n',
                       css, re.S)
        if not rm:
            self.fail('GATE-MOTION', 'tokens.css',
                      '[вакуум] @media (prefers-reduced-motion: reduce) отсутствует (R-21, правило 21)')
        else:
            zeroed = set(re.findall(r'(--[\w-]+)\s*:\s*0m?s', rm.group(1)))
            for need in ('--motion-duration-fast', '--motion-duration-base',
                         '--motion-duration-slow', '--motion-value-change',
                         '--motion-emphasis', '--stagger-row', '--stagger-wave'):
                if need in decls and need not in zeroed:
                    self.fail('GATE-MOTION', 'tokens.css',
                              f'{need} не обнуляется при prefers-reduced-motion (R-21)')

        # §1.8: три обязательных правила подключения шрифта
        fam = {}
        for m in re.finditer(r'([^{}@]+)\{([^}]*)\}', code):
            sel, blk = m.group(1).strip(), m.group(2)
            if re.search(r'(?<![-\w])font-family\s*:', blk):
                for part in re.split(r',', sel):
                    fam[part.strip().split()[0].lower() if part.strip() else ''] = True
        for need in ('html', 'body'):
            if need not in fam:
                self.fail('GATE-FONT', 'tokens.css',
                          f'font-family не объявлен на `{need}` (README §1.8 правило 1: внешний reset '
                          f'на body перебьёт наследование от html)')
        for need in ('input', 'select', 'textarea', 'button', 'kbd'):
            if need not in fam:
                self.fail('GATE-FONT', 'tokens.css',
                          f'font-family не объявлен на `{need}` — элементы форм шрифт не наследуют (§1.8)')
        faces = re.findall(r'@font-face\s*\{([^}]*)\}', code)
        if not faces:
            self.fail('GATE-FONT', 'tokens.css', '[вакуум] ни одного @font-face')
        for blk in faces:
            for u in re.findall(r'url\(\s*([^)]*)\)', blk):
                if not re.match(r'''^\s*['"]''', u):
                    self.fail('GATE-FONT', 'tokens.css',
                              f'url({u.strip()[:40]}) без кавычек (§1.8 правило 2)')
            d = re.search(r'font-display\s*:\s*([\w-]+)', blk)
            if not d:
                self.fail('GATE-FONT', 'tokens.css', '@font-face без font-display (§1.8 правило 3)')
            elif d.group(1).strip() != 'block':
                self.fail('GATE-FONT', 'tokens.css',
                          f'font-display: {d.group(1)} — §1.8 правило 3 требует block')

    # -- 1d. R-24 в телах компонентных описаний -------------------------------
    def check_r24_prose(self):
        # `(44/32 px)` — это высоты строк, не типографика: пара с единицей px
        # к матрице R-24 отношения не имеет.
        rx = re.compile(r'(?<![\d/])(\d{2})\s*/\s*(\d{2})(?!\d)(?!\s*(?:px|%|м|m))'
                        r'(?:\s*\**\s*(Bold|Medium|Regular))?')
        for rel in ('design-system/README.md', 'design-system/components-core.md'):
            text = self.read(rel)
            if text is None:
                self.fail('R-24', rel, '[вакуум] файл отсутствует')
                continue
            for i, line in enumerate(text.split('\n'), 1):
                for m in rx.finditer(line):
                    size, lh = int(m.group(1)), int(m.group(2))
                    weight = m.group(3)
                    prefix = line[max(0, m.start() - 34):m.start()].lower()
                    role, best = None, -1
                    for pat, name in R24_ROLE_KEYS:
                        for k in re.finditer(pat, prefix):
                            if k.end() > best:
                                best, role = k.end(), name
                    if role:
                        es, el = R24_EXACT[role]
                        if (size, lh) != (es, el):
                            self.emit('R-24', rel, i, line,
                                      f'роль «{role}» набрана {size}/{lh}, R-24 требует {es}/{el}')
                        ew = R24_WORD.get(R24_WEIGHTS.get(f'--type-{role}-weight')
                                          or R24_WEIGHTS.get('--type-heading-weight'))
                        if weight and role in R24_EXACT and f'--type-{role}-weight' in R24_WEIGHTS \
                           and weight != ew:
                            self.emit('R-24', rel, i, line,
                                      f'роль «{role}» набрана {weight}, R-24 требует {ew}')
                    else:
                        if size not in R24_GENERIC:
                            self.emit('R-24', rel, i, line,
                                      f'кегль {size}px вне шкалы R-24')
                        elif lh not in R24_GENERIC[size]:
                            self.emit('R-24', rel, i, line,
                                      f'пара {size}/{lh} вне матрицы R-24')

    # -- 1e. Единицы, NBSP, площади, даты, полный label -----------------------
    def check_units(self):
        SEP = {' ': 'U+0020 (обычный пробел)',
               ' ': 'U+00A0 (неразрывный)',
               ' ': 'U+202F (узкий неразрывный)',
               ' ': 'U+2009 (узкий, разрывный)'}
        REQUIRED = ' '
        nbsp_rx = re.compile(r'(\d)([    ])(€|%|m²|m2|Monate|Wochen|WE)(?![\w])')
        cyr_rx = re.compile(r'[мМ]²|[мМ]2(?![\w])')
        date_hyphen = re.compile(r'(?<![\d-])\d{2}-\d{2}-\d{4}(?![\d-])')
        date_short = re.compile(r'(?<![\d.])\d{2}\.\d{2}\.\d{2}(?!\d)')
        area_rx = re.compile(
            r'€\s*/\s*m²\s*[`*]*\s*(WFL|NUF|BGF)(?![\w-])'
            r'(?!\s*[`*]*\s*(?:nach\s+WoFlV|nach\s+DIN\s*277|oberirdisch|unterirdisch|'
            r'R\s*\+\s*S|\(R\)|UG\b|R\b))')
        # `Anteil an Zwischensumme` — самостоятельный корректный label
        # (COSTTABLE-002, динамический заголовок процентной колонки).
        # Полный label требуется только там, где слово стоит ПОДПИСЬЮ ИТОГА,
        # то есть в строке с денежной величиной.
        zwi_rx = re.compile(r'(?<!Anteil an )Zwischensumme(?!\s+der\s+kalkulierten\s+Positionen)')
        money_rx = re.compile(r'\d[\d.\u00a0\u202f]{2,}|€')
        seen_units = False
        for glob in ('*.md', '*.json'):
            for rel, text in self.files(glob):
                if rel.startswith('tools/'):
                    continue
                seen_units = True
                # NBSP агрегируется по (файл, фактический разделитель): в
                # документе их сотни, построчный реестр превратился бы в шум.
                # Сообщение НАЗЫВАЕТ фактический символ — противоречие
                # CLAUDE.md §7 / README §1.9 (предписан U+202F) против
                # фактических U+0020/U+00A0 не решается инструментом, оно
                # зарегистрировано как открытое (KNOWN_OPEN_FILE).
                # Псевдокод формул (fenced-блок) — определение ставки, а не
                # отображаемая клиенту метрика: знаменатель там появляется при
                # применении к площади. AREA-SCOPE внутрь блоков не заходит;
                # остальные классы заходят (ASCII-макеты — это UI-копия).
                fenced, inside = set(), False
                for i, line in enumerate(text.split('\n'), 1):
                    if line.lstrip().startswith('```'):
                        inside = not inside
                        fenced.add(i)
                    elif inside:
                        fenced.add(i)
                agg = {}
                for i, line in enumerate(text.split('\n'), 1):
                    for m in nbsp_rx.finditer(line):
                        ch = m.group(2)
                        if ch == REQUIRED:
                            continue
                        agg.setdefault(ch, []).append((i, line, m.group(0)))
                for ch, rows in sorted(agg.items()):
                    i, line, sample = rows[0]
                    where = ', '.join(str(r[0]) for r in rows[:6]) + ('…' if len(rows) > 6 else '')
                    self.emit('NBSP', rel, i, line,
                              f'{len(rows)} мест: число и единица разделены {SEP[ch]}, '
                              f'CLAUDE.md §7 и README §1.9 предписывают U+202F (узкий '
                              f'неразрывный). Пример «{sample}». Строки: {where}. '
                              f'ПРОТИВОРЕЧИЕ ПРАВИЛА И ФАКТА НЕ РАЗРЕШЕНО — решение владельца')
                for i, line in enumerate(text.split('\n'), 1):
                    for m in cyr_rx.finditer(line):
                        self.emit('CYRILLIC-UNIT', rel, i, line,
                                  f'кириллическая «{m.group(0)}» в латинской единице — читается '
                                  f'как единица, не является ею')
                    for m in date_hyphen.finditer(line):
                        self.emit('DATE-FORMAT', rel, i, line,
                                  f'дата «{m.group(0)}» дефисами (анти-паттерн XSC-09); '
                                  f'немецкий формат — 14.05.2027, машинное значение — ISO')
                    for m in date_short.finditer(line):
                        self.emit('DATE-FORMAT', rel, i, line,
                                  f'двузначный год в «{m.group(0)}» (XSC-09)')
                    for m in (() if i in fenced else area_rx.finditer(line)):
                        self.emit('AREA-SCOPE', rel, i, line,
                                  f'«€/m² {m.group(1)}» без нормативного типа и scope — требуется '
                                  f'`nach WoFlV` / `nach DIN 277` / `oberirdisch` / `R+S` '
                                  f'(правило 33/39, R-11)')
                    for m in (zwi_rx.finditer(line) if money_rx.search(line) else ()):
                        self.emit('R-18-LABEL', rel, i, line,
                                  'усечённое «Zwischensumme»; R-18/COPY-008 требуют полный label '
                                  '«Zwischensumme der kalkulierten Positionen»')
        if not seen_units:
            self.fail('NBSP', 'repo', '[вакуум] не найдено ни одного документа для проверки единиц')

    # -- 2. README: копирайт и роли -------------------------------------------
    def check_readme(self):
        rel = 'design-system/README.md'
        readme = self.read(rel) or ''
        # пред-R-24 пары
        for bad in ('14/19', '16/21'):
            if bad in readme:
                self.fail('R-24', rel, f'пред-R-24 пара {bad} осталась в тексте')
        # числовые герои не набираются ролью heading.1
        self.scan('R-24', rel, readme, r'(€/m²|Bauzeit|Gesamt)[^|\n]*\|\s*48/56',
                  'число набрано ролью heading.1 (48/56); для чисел только 64/68 и 48/52')
        # шкала отступов
        m = re.search(r'База \*\*8 px\*\*[^\n]*?((?:\d+\s*·\s*)+\d+)', readme)
        if m:
            vals = {v.strip() for v in re.split(r'[·,]', m.group(1)) if v.strip()}
            for v in sorted(vals - {'4', '8', '12', '16', '24', '32', '48', '64'}):
                self.fail('LAYOUT-001', rel, f'значение {v} px вне канонической шкалы')
        else:
            self.fail('LAYOUT-001', rel, '[вакуум] строка шкалы отступов не найдена')
        # LAYOUT-003
        for src_rel in (rel, 'docs/product/screen-map.md'):
            src = self.read(src_rel) or ''
            if '1600 px' in src or '1600px' in src:
                self.fail('LAYOUT-003', src_rel, 'осталось 1600 px, требуется 1200 px')
        # положительное утверждение: величина названа, а не только не-запрещена
        if not re.search(r'Контент ограничен \*\*1200 px\*\*', readme):
            self.fail('LAYOUT-003', rel,
                      'README §1.2 не называет ограничение контента 1200 px (LAYOUT-003)')
        # DC-38: строка героя №1 обязана быть набрана 64/68 — проверяется
        # сама строка, а не наличие подстроки где-нибудь в файле.
        hero = [l for l in readme.split('\n')
                if l.lstrip().startswith('|') and 'Gesamt netto' in l
                and re.search(r'\d{2}\s*/\s*\d{2}', l)]
        if not hero:
            self.fail('R-24', rel, '[вакуум] строка героя DC-38 «Gesamt netto … NN/NN» не найдена')
        for l in hero:
            pair = re.search(r'(\d{2})\s*/\s*(\d{2})', l)
            if (int(pair.group(1)), int(pair.group(2))) != (64, 68):
                self.fail('R-24', rel,
                          f'DC-38: герой №1 набран {pair.group(1)}/{pair.group(2)}, правило 31 '
                          f'и R-24 требуют 64/68 (единственный оранжевый, display.numeric.desktop)')
        # R-24-CAPTION: caption для запрещённых ролей (RU+EN словарь ролей,
        # исключения — только точные строки из ALLOW)
        cap = re.compile(r'(caption|подпись)\s*1?2\s*(px)?\s*(Regular|/16)', re.I)
        ban = re.compile(r'(source|источник|scope|status|статус|blocker|блокер|конфликт|'
                         r'происхожден|workflow|знаменател|допущени|исключени|ошибк|error|'
                         r'assumption|exclusion)', re.I)
        for i, line in enumerate(readme.split('\n'), 1):
            if cap.search(line) and ban.search(line):
                self.emit('R-24-CAPTION', rel, i, line,
                          f'caption для запрещённой роли — {line.strip()[:70]}')
        # R-01-PROSE: оранжевый как семантика в прозе.
        # Слово «orange» больше не обязательно: обход шёл через имя токена
        # (`--color-brand-accent`), немецкое «Aktionsfarbe» и голый hex.
        trig = re.compile(r'(оранжев|(?<![-\w])orange(?![-\w])|brand-accent|brand\.accent|'
                          r'Aktionsfarbe|#FD5E00|orange-500)', re.I)
        role = re.compile(r'(selected|selection|выделен|статус|status|warning|фокус|focus|'
                          r'checked|чек|бар\b|действ|action)', re.I)
        for i, line in enumerate(readme.split('\n'), 1):
            if trig.search(line) and role.search(line):
                self.emit('R-01-PROSE', rel, i, line,
                          f'оранжевый рядом с семантической ролью — {line.strip()[:70]}')
        # R-20: percentage readiness. Слово «кольцо» перестало быть условием —
        # запрещён сам процент готовности, каким бы виджетом он ни рисовался.
        for src_rel in (rel, 'docs/product/screen-map.md', 'docs/product/decisions.md',
                        'docs/product/guidance-system.md', 'docs/product/product-brief.md',
                        'design-system/components-core.md', 'CLAUDE.md'):
            src = self.read(src_rel) or ''
            self.scan('R-20', src_rel, src, r'(Bereitschafts-Ring|кольцо готовности)',
                      'готовность как кольцо/процент запрещена (R-20/READY-001)')
            for i, line in enumerate(src.split('\n'), 1):
                if re.search(r'(Bereitschaft|готовност)', line, re.I) and \
                   re.search(r'\d{1,3}\s*[  ]?%', line):
                    self.emit('R-20', src_rel, i, line,
                              'процент готовности (READY-001/R-20): score запрещён независимо '
                              f'от виджета — {line.strip()[:70]}')
        # R-09: фиксированный e-mail-флоу присутствует, одноклик отсутствует
        if 'Compose → Preflight → Confirm & Send → Delivery status' not in readme:
            self.fail('R-09', rel, 'DC-41 не описывает фиксированный флоу '
                      '«Compose → Preflight → Confirm & Send → Delivery status» (EMAIL-001)')
        self.scan('R-09', rel, readme, r'«Senden»\s*→\s*`offer\.emailed`',
                  'одноклик-отправка без preflight (R-09/EMAIL-001)')
        # CALC-014: label сессионной дельты
        if 'Preisänderung gegenüber' not in readme:
            self.fail('CALC-014', rel, 'DC-12 не задаёт label «Preisänderung gegenüber <Vergleichsbasis>»')
        self.scan('CALC-014', rel, readme, r'Änderungen\s*·\s*\+',
                  'сессионная дельта без baseline/расшифровки (CALC-014)')

    # -- 2b. Контракты README: матрица против тел, семь осей, причины ---------
    RX_CONTRACT_HEAD = re.compile(r'^###\s+(?:(DC-\d+)\s*·\s*)?`([A-Za-z][A-Za-z0-9]*)`')
    RX_AXIS_DECL = re.compile(r'`(' + '|'.join(DATA_AXES) + r')`\s*(?:—|–|-)\s')
    RX_NAR = re.compile(r'notApplicableReason:\s*(.*?)(?=`[a-zA-Z]+`\s*(?:—|–|/)|\Z)', re.S)

    def _contracts(self, readme, rows):
        """[(dc, имя, первая строка, тело)] для каждого контракта §2.6.

        Границы берутся структурно: от `### 2.6` до `### 2.7`, контракт — от
        своего заголовка до следующего. Отсутствие границ — вакуум.
        """
        try:
            a = next(i for i, l in enumerate(rows) if l.startswith('### 2.6'))
            b = next(i for i, l in enumerate(rows) if l.startswith('### 2.7'))
        except StopIteration:
            return None
        heads = []
        for i in range(a, b):
            m = self.RX_CONTRACT_HEAD.match(rows[i])
            if m:
                heads.append((i, m.group(1) or '', m.group(2)))
        heads.append((b, '', ''))
        out = []
        for k in range(len(heads) - 1):
            i, dc, name = heads[k]
            out.append((dc, name, i + 1, '\n'.join(rows[i:heads[k + 1][0]])))
        return out

    def _state_block(self, body, label):
        m = re.search(r'\*\*Состояния\s*—\s*' + label + r'[^*]*\*\*(.*?)(?=\n\*\*[А-ЯA-Z])',
                      body, re.S)
        return m.group(1) if m else None

    def check_readme_contracts(self):
        rel = 'design-system/README.md'
        readme = self.read(rel) or ''
        rows = readme.split('\n')
        contracts = self._contracts(readme, rows)
        if not contracts:
            self.fail('RM-AXES', rel, '[вакуум] раздел контрактов §2.6…§2.7 не найден — '
                                      'ни один контракт не проверяется')
            return
        if len(contracts) < 40:
            self.fail('RM-AXES', rel, f'[вакуум] в §2.6 распознано {len(contracts)} контрактов; '
                                      f'реестр §2.2 объявляет 45 доменных плюс два '
                                      f'документационных — парсер потерял границы')

        # --- матрица §2.4 как ДАННЫЕ, а не как проза -------------------------
        try:
            ms = next(i for i, l in enumerate(rows) if l.startswith('### 2.4'))
            me = next(i for i, l in enumerate(rows) if l.startswith('### 2.5'))
        except StopIteration:
            self.fail('RM-MATRIX', rel, '[вакуум] матрица §2.4 не найдена')
            return
        matrix, mat_line = {}, {}
        for i in range(ms, me):
            line = rows[i]
            if not line.startswith('|'):
                continue
            cells = [c.strip() for c in line.strip('|').split('|')]
            if len(cells) != len(DATA_AXES) + 1 or cells[1] not in ('●', '○'):
                continue
            m = re.match(r'^(?:(DC-\d+)\s+)?`([A-Za-z][A-Za-z0-9]*)`', cells[0])
            if not m:
                self.emit('RM-MATRIX', rel, i + 1, f'RM-MATRIX:row-{i}',
                          f'строка матрицы §2.4 не называет компонент распознаваемо: '
                          f'«{cells[0][:40]}»')
                continue
            key = (m.group(1) or '', m.group(2))
            if key in matrix:
                self.emit('RM-MATRIX', rel, i + 1, f'RM-MATRIX:dup-{key[1]}',
                          f'компонент {key[1]} встречается в матрице §2.4 дважды')
            matrix[key] = cells[1:]
            mat_line[key] = i + 1
        if len(matrix) < 40:
            self.fail('RM-MATRIX', rel, f'[вакуум] в матрице §2.4 распознано {len(matrix)} строк '
                                        f'— парсер потерял таблицу, сверка стала бы вакуумной')
            return

        bodies = {}
        for dc, name, ln, body in contracts:
            key = (dc, name)
            bodies[key] = (ln, body)
            blk = self._state_block(body, 'данные')
            if blk is None:
                self.emit('RM-AXES', rel, ln, f'RM-AXES:noblock-{dc or name}',
                          f'{dc or name} `{name}`: блок «Состояния — данные» отсутствует — '
                          f'компонент без пяти состояний плюс двух осей в прототип '
                          f'не попадает (правило проекта 30, STATE-001)')
                continue
            decl = {}
            for m in self.RX_AXIS_DECL.finditer(blk):
                decl.setdefault(m.group(1), m.start())
            for axis in DATA_AXES:
                if axis not in decl:
                    self.emit('RM-AXES', rel, ln, f'RM-AXES:{dc or name}.{axis}',
                              f'{dc or name} `{name}`: ось `{axis}` не объявлена в теле '
                              f'контракта. Семь осей — `{" · ".join(DATA_AXES)}` — '
                              f'обязательны каждая (правило проекта 30, STATE-001)')
            # сегменты: от объявления оси до объявления следующей
            order = sorted(decl.items(), key=lambda x: x[1])
            segs = {}
            for idx, (axis, pos) in enumerate(order):
                nxt = order[idx + 1][1] if idx + 1 < len(order) else len(blk)
                segs[axis] = blk[pos:nxt]
            # --- матрица против тела: каждая ячейка выводится, а не заявляется
            if key not in matrix:
                self.emit('RM-MATRIX', rel, ln, f'RM-MATRIX:missing-{dc or name}',
                          f'{dc or name} `{name}` имеет контракт, но отсутствует строкой '
                          f'в матрице §2.4 — индекс не покрывает источник')
            else:
                cells = matrix[key]
                for idx, axis in enumerate(DATA_AXES):
                    if axis not in segs:
                        continue
                    want = '○' if 'notApplicableReason' in segs[axis] else '●'
                    if cells[idx] != want:
                        self.emit('RM-MATRIX', rel, mat_line[key],
                                  f'RM-MATRIX:{dc or name}.{axis}',
                                  f'матрица §2.4 ставит {cells[idx]} для {dc or name} `{name}` '
                                  f'по оси `{axis}`, а тело контракта (строка {ln}) объявляет '
                                  f'{want}: {"причина неприменимости" if want == "○" else "живое состояние"}. '
                                  f'Сводная таблица, не сверяемая с источником, — заготовка '
                                  f'для расхождения (§2.3: «`○` действителен ровно настолько, '
                                  f'насколько в контракте стоит названная причина»)')
            # --- причина неприменимости несёт причину, а не слово ------------
            self._reasons(rel, dc or name, name, ln, segs.items(), 'данные', 12, 3)
            blk_i = self._state_block(body, 'взаимодействие')
            if blk_i is None:
                self.emit('RM-AXES', rel, ln, f'RM-AXES:nointeraction-{dc or name}',
                          f'{dc or name} `{name}`: блок «Состояния — взаимодействие» '
                          f'отсутствует — вторая ось STATE-001 не документирована')
            else:
                self._reasons(rel, dc or name, name, ln,
                              [('взаимодействие', blk_i)], 'взаимодействие', 10, 2)

        for key, cells in sorted(matrix.items()):
            if key not in bodies:
                self.emit('RM-MATRIX', rel, mat_line[key], f'RM-MATRIX:orphan-{key[1]}',
                          f'матрица §2.4 объявляет состояния для {key[0] or key[1]} '
                          f'`{key[1]}`, у которого нет контракта в §2.6 — индекс утверждает '
                          f'о том, чего нет')

        # --- акцентный оранжевый только на `--color-surface-default` ---------
        # Подложка — часть условия R-01, а не контекст: на канве та же краска
        # даёт 2,60:1. Перенос героя на канву прошёл, потому что README нигде
        # не связывал акцент с поверхностью машинно.
        acc = contrast(CLR['accent'], CLR['white'])
        canv = contrast(CLR['accent'], CLR['canvas'])
        for dc, name, ln, body in contracts:
            mt = re.search(r'\*\*Токены:\*\*(.*?)(?=\n\*\*[А-ЯA-Z]|\Z)', body, re.S)
            if not mt or '--color-text-display-accent' not in mt.group(1):
                continue
            toks = mt.group(1)
            # позиция акцента и ближайшая поверхность в том же перечислении
            near = toks[toks.index('--color-text-display-accent'):][:220]
            if '--color-surface-canvas' in near:
                self.emit('RM-ACCENT', rel, ln, f'RM-ACCENT:{dc or name}',
                          f'{dc or name} `{name}`: акцентный текст объявлен на '
                          f'`--color-surface-canvas` — {fmt_ratio(canv)}:1, ниже порога R-01 '
                          f'(3:1). Допустима только `--color-surface-default` '
                          f'({fmt_ratio(acc)}:1); подложка — часть условия, а не контекст')
            elif '--color-surface-default' not in near:
                self.emit('RM-ACCENT', rel, ln, f'RM-ACCENT:unbound-{dc or name}',
                          f'{dc or name} `{name}`: `--color-text-display-accent` перечислен '
                          f'без названной поверхности. Акцент без подложки не является '
                          f'утверждением: {fmt_ratio(acc)}:1 на `surface-default` против '
                          f'{fmt_ratio(canv)}:1 на `surface-canvas` (R-01)')
        # запрет обязан остаться сформулированным, а не только соблюдаться
        if not re.search(r'акцентн\w+\s+геро\w+\s+на\s+поверхности\s*`?--color-surface-canvas',
                         readme):
            self.fail('RM-ACCENT', rel,
                      'README не формулирует запрет акцентного героя на '
                      '`--color-surface-canvas` — правило, которое соблюдается, но не '
                      'записано, восстанавливается первой же правкой')

    def _reasons(self, rel, who, name, ln, blocks, axis_label, min_chars, min_words):
        """`notApplicableReason` несёт причину, а не слово.

        Порог измерен по файлу: у оси данных самая короткая причина — 49 знаков
        и 6 слов, у оси взаимодействия — 20 знаков и 3 слова. Пороги ниже
        измеренных минимумов с запасом, поэтому ловят `notApplicableReason: нет`
        и не спорят с законной краткой формулировкой.
        """
        for axis, seg in blocks:
            for m in self.RX_NAR.finditer(seg):
                why = re.sub(r'\s+', ' ', m.group(1)).strip().strip('·').strip()
                words = [w for w in re.split(r'[\s·]+', why) if len(w) > 1]
                if len(why) >= min_chars and len(words) >= min_words:
                    continue
                self.emit('RM-NAREASON', rel, ln, f'RM-NAREASON:{who}.{axis_label}.{axis}',
                          f'{who} `{name}`, ось {axis_label} `{axis}`: '
                          f'`notApplicableReason: {why[:40]}` — {len(why)} знаков, '
                          f'{len(words)} слов. Запись без текста причины состояние не '
                          f'объявляет; это тот самый пропуск, из-за которого отклонили '
                          f'партию примитивов (§2.3)')

    # -- 2c. Числа README сводятся с фикстурой и несут провенанс --------------
    def check_readme_numbers(self):
        rel = 'design-system/README.md'
        readme = self.read(rel) or ''
        rows = readme.split('\n')
        self._specimens('RM-FIXTURE', rel, readme)
        self._sched_d17(rel, readme)
        if not self.fx:
            return
        # скидка считается от ТОЧНОГО итога, никогда от отображаемого
        rab = self.fx['rabatt']
        mult = 1 - rab / 100
        for i, line in enumerate(rows, 1):
            for m in re.finditer(r'`?Rabatt\s*([\d,]+)\s*%`?[^\n]{0,80}?'
                                 r'итога\s*`?([\d.,]+)\s*€', line):
                if de(m.group(1)) != rab:
                    self.emit('RM-FIXTURE', rel, i, 'RM-FIXTURE:rabatt-rate',
                              f'README называет Rabatt {m.group(1)} %, фикстура — {rab} %')
                base = de(m.group(2))
                if base != self.fx['A']:
                    self.emit('RM-FIXTURE', rel, i, f'RM-FIXTURE:rabatt-base-{m.group(2)}',
                              f'база скидки {m.group(2)} € не равна ТОЧНОМУ итогу '
                              f'{self.fx["A"]} €: CALC-007 и инвариант 14.1 запрещают '
                              f'участие отображаемых значений во внутренних расчётах '
                              f'(округлённая база завышает цену)')
                    continue
                mres = re.search(r'даёт\s*`?([\d.,]+)\s*€', line)
                if mres and de(mres.group(1)) != base * mult:
                    self.emit('RM-FIXTURE', rel, i, 'RM-FIXTURE:rabatt-product',
                              f'{base} × {mult} = {base * mult}, README пишет {mres.group(1)}')
        # Агрегация комплекса — от СУММ, никогда как среднее из средних
        # (правило проекта 39). Якорь структурный и нормативный: подписи
        # `Σ BGF oberirdisch` и `Σ BGF R+S` заданы правилом, а не вёрсткой,
        # поэтому переформатирование абзаца проверку не ломает. Знаменатель
        # обязан совпадать с подписью — складывать надземную и подземную
        # площадь под подписью «oberirdisch» запрещено (DATA-001).
        for label, exp in (('oberirdisch', self.fx['sum_ober']),
                           (r'R\+S', self.fx['sum_rs'])):
            hits = list(re.finditer(r'Σ\s*BGF\s*(?:\*\*)?' + label + r'(?:\*\*)?\s*'
                                    r'([\d.]+(?:,\d+)?)\s*[  ]?m²', readme))
            if not hits:
                self.fail('RM-FIXTURE', rel,
                          f'[вакуум] README не называет `Σ BGF {label} <N> m²` ни разу — '
                          f'агрегация комплекса не проверяется (правило проекта 39)')
                continue
            for m in hits:
                got = de(m.group(1))
                if got == exp:
                    continue
                self.emit('RM-FIXTURE', rel, readme[:m.start()].count('\n') + 1,
                          f'RM-FIXTURE:agg-{label}-{m.group(1)}',
                          f'`Σ BGF {label}` = {m.group(1)} m², фикстура даёт {exp} m² '
                          f'(сумма зданий, проверенная классом CALC-FIXTURE) — удельные '
                          f'величины считаются от сумм, знаменатель обязан совпадать '
                          f'с подписью (правило проекта 39, DATA-001)')
        # провенанс: денежный блок обязан называть прогон или сценарий фикстуры
        contracts = self._contracts(readme, rows) or []
        for dc, name, ln, body in contracts:
            if not (self.RX_MONEY.search(body) or self.RX_RATE.search(body)):
                continue
            if not re.search(r'DEMO-(?:SC|RUN)-\d+', body):
                self.emit('RM-FIXTURE', rel, ln, f'RM-FIXTURE-PROV:{dc or name}',
                          f'{dc or name} `{name}` показывает денежные или удельные величины, '
                          f'но не называет ни `scenarioId` (`DEMO-SC-nn`), ни '
                          f'`calculationRunId` (`DEMO-RUN-nnnn`) — §2.1 требует провенанс '
                          f'у любого денежного, площадного, ставочного и срочного блока '
                          f'(CALC-002, XSC-05)')

    # -- 3. Копирайт-инварианты по всем документам ----------------------------
    def check_copy(self):
        # Каждый паттерн переписан после того, как аудитор обошёл все восемь
        # однословной правкой: скобка, дефис, артикль, предлог.
        # `*.json` теперь проходит те же проверки: до v3 туда ходил только
        # XSC-10, и живая UI-строка `ab Decke` в каталоге параметров
        # проходила насквозь.
        rules = [
            ('DATA-005', r'WFL[\s*_`(\[]*inkl', 'живое «WFL inkl. …» (DATA-005)'),
            ('R-18', r'Gesamt netto(?!\s*[`*]*\s*·\s*[^\s|`*])',
             'тотал без непустого Declared Pricing Scope (R-18)'),
            ('XSC-10', r'KfW[\s\-*_·]*(40|55)(?![\d])',
             'термин программы вместо EH-стандарта в UI-копии (XSC-10)'),
            ('COPY-007', r'\bab[\s*_]+(?:der[\s*_]+|die[\s*_]+|OK[\s*_]+)?Decke\b(?!\s+über\s+UG)',
             'сокращение «ab Decke» запрещено (раздел 1.4 аудита, COPY-007)'),
            ('COPY-004', r'Genauigkeit[^\n±]{0,20}±|Genauigkeits?[\s-]*(Badge|Anzeige|Wert)',
             'термин «Genauigkeit ±» запрещён; production-термин Schätzunsicherheit (COPY-004)'),
        ]
        for glob in ('*.md', '*.json'):
            for rel, text in self.files(glob):
                if rel.startswith('tools/'):
                    continue
                for cls, pat, msg in rules:
                    self.scan(cls, rel, text, pat, msg)
        # LAYOUT-007: плотность привязана к режиму (DE/ASCII/RU написания)
        for rel in ('design-system/README.md', 'CLAUDE.md'):
            text = self.read(rel) or ''
            for i, line in enumerate(text.split('\n'), 1):
                low = line.lower()
                if ('praesentation' in low or 'präsentation' in low or 'презентац' in low
                        or 'клиентск' in low):
                    if re.search(r'(только|физически не может|запрещ\w*|ausschließlich|'
                                 r'ausschliesslich|nur|niemals|kann nicht|erzwing\w*)'
                                 r'[\s\w*_`«»„“]{0,12}?'
                                 r'(comfortable|komfortabel|compact|kompakt)', low):
                        self.emit('LAYOUT-007', rel, i, line,
                                  f'плотность привязана к режиму — {line.strip()[:70]}')

    # -- 3a. Правило 22: интерактивное — настоящий контрол -------------------
    def check_controls(self):
        rx = re.compile(r'<(span|div|p|li|a(?![\w-])[^>]*?(?<!href=)\s)[^>]*\bon(click|keydown|keyup)\s*=', re.I)
        for glob in ('*.md', '*.html'):
            for rel, text in self.files(glob):
                if rel.startswith('tools/'):
                    continue
                for i, line in enumerate(text.split('\n'), 1):
                    for m in rx.finditer(line):
                        self.emit('GATE-CONTROL', rel, i, line,
                                  f'«{m.group(0)[:40]}» — правило 22 требует настоящий контрол '
                                  f'(<button>), не обработчик на неинтерактивном элементе')

    # -- 3b. Модель данных: docs/product/data-model.md ------------------------
    def check_data_model(self):
        """Механически проверяемое в модели данных.

        Аудитор нашёл шесть висячих ссылок на типы чтением; это ровно тот же
        класс, что висячие ссылки на токены, и он проверяется машиной.
        """
        rel = 'docs/product/data-model.md'
        dm = self.read(rel)
        if dm is None:
            self.fail('DM-TYPE', rel, '[вакуум] docs/product/data-model.md отсутствует')
            return
        blocks = [(m.group(1), dm[:m.start()].count('\n') + 1)
                  for m in re.finditer(r'```ts\s*\n(.*?)```', dm, re.S)]
        if not blocks:
            self.fail('DM-TYPE', rel, '[вакуум] в модели нет ни одного ts-блока — типы не объявлены')
            return
        defined, generics = set(), set()
        for body, _off in blocks:
            defined |= set(re.findall(r'^\s*(?:export\s+)?(?:interface|type|enum|class)\s+([A-Z][A-Za-z0-9_]*)',
                                      body, re.M))
            defined |= set(re.findall(r'^\s*([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\{', body, re.M))
            for g in re.findall(r'<([A-Z][A-Za-z0-9_,\s]*)>', body):
                generics |= {x.strip() for x in g.split(',') if x.strip()}
        # Встроенные типы TypeScript и обозначения внешних стандартов —
        # структурно: они не объявляются моделью и не могут быть висячими.
        BUILTIN = {'Array', 'Record', 'Partial', 'Readonly', 'Pick', 'Omit', 'Map', 'Set',
                   'Date', 'Promise', 'String', 'Number', 'Boolean', 'Object', 'JSON'}
        dangling = {}
        for body, off in blocks:
            for i, line in enumerate(body.split('\n')):
                for m in re.finditer(r'(?::|=|\||<|extends|,)\s*([A-Z][A-Za-z0-9_]*)', line):
                    nm = m.group(1)
                    if (nm in defined or nm in BUILTIN or nm in generics
                            or len(nm) <= 2 or re.search(r'Ids?$', nm)):
                        continue          # `*Id` — непрозрачный идентификатор по конвенции
                    dangling.setdefault(nm, off + i)
        # Отпечаток берётся от ИМЕНИ типа, а не от строки: строка модели
        # переезжает при любой правке выше, а имя — устойчивая идентичность
        # находки. Регистрация выдана каждому имени отдельно, поэтому новая
        # висячая ссылка — новое нарушение, а не «уже известное».
        for nm, ln in sorted(dangling.items(), key=lambda x: x[1]):
            self.emit('DM-TYPE', rel, ln, f'DM-TYPE:{nm}',
                      f'ссылка на необъявленный тип {nm} (модель ссылается, но не определяет)')
        # `Type.field`, названные по имени в тексте: тип обязан существовать
        pairs = set(re.findall(r'`([A-Z][A-Za-z0-9]+)\.([a-z][A-Za-z0-9]*)`', dm))
        pairs |= set(re.findall(r'`([A-Z][A-Za-z0-9]+)\.([a-z][A-Za-z0-9]*)`',
                               self.read('docs/audit/requirements-registry.md') or ''))
        if not pairs:
            self.fail('DM-TYPE-FIELD', rel,
                      '[вакуум] ни одной ссылки вида `Type.field` — проверка непроверяема')
        for ty, fld in sorted(pairs):
            if ty not in defined:
                lineno = next((i for i, l in enumerate(dm.split('\n'), 1)
                               if f'`{ty}.{fld}`' in l), 1)
                self.emit('DM-TYPE-FIELD', rel, lineno, f'DM-TYPE-FIELD:{ty}.{fld}',
                          f'норматив/модель называет `{ty}.{fld}`, но тип {ty} в модели не объявлен')
        # §9: каждый P0 из охвата партии обязан быть упомянут инвариантом
        plan = self.read('docs/audit/remediation-plan.md') or ''
        mb = re.search(r'^## Batch 4[^\n]*\n(.*?)(?=\n## |\Z)', plan, re.S | re.M)
        m9 = re.search(r'^##\s*9\.\s*Инварианты(.*?)(?=\n##\s|\Z)', dm, re.S | re.M)
        if not mb:
            self.fail('DM-INVARIANT', 'remediation-plan.md',
                      '[вакуум] секция «Batch 4» в плане не найдена — охват партии неизвестен')
        elif not m9:
            self.fail('DM-INVARIANT', rel, '[вакуум] раздел «9. Инварианты» в модели не найден')
        else:
            scope_line = re.search(r'Закрывает:\s*(.+)', mb.group(1))
            if not scope_line:
                self.fail('DM-INVARIANT', 'remediation-plan.md',
                          '[вакуум] в секции Batch 4 нет строки «Закрывает: …»')
            else:
                want = set()
                for fam, a, b in re.findall(r'([A-Z][A-Z0-9]*)-(\d{3})\s*[…\-–/]+\s*(?:[A-Z]+-)?(\d{1,3})',
                                            scope_line.group(1)):
                    for n in range(int(a), int(b) + 1):
                        want.add(f'{fam}-{n:03d}')
                want |= set(re.findall(r'\b([A-Z][A-Z0-9]*-\d{3})\b', scope_line.group(1)))
                have = set(re.findall(r'\b([A-Z][A-Z0-9]*-\d{3})\b', m9.group(1)))
                missing = sorted(want - have)
                if missing:
                    ln = dm[:m9.start()].count('\n') + 1
                    self.emit('DM-INVARIANT', rel, ln,
                              'DM-INVARIANT:' + ','.join(missing),
                              f'§9 не содержит инварианта ни для одного из требований охвата '
                              f'Batch 4: {", ".join(missing)} — заявленное покрытие не подтверждено')
        # Кросс-сверка правил округления между двумя артефактами партии
        sp = self.read('docs/product/calculation-spec.md') or ''
        tbl = re.search(r'\|\s*Величина\s*\|[^\n]*Префикс[^\n]*\|\n\|[-\s|]+\|\n((?:\|[^\n]*\n)+)', sp)
        if not tbl:
            self.fail('DM-ROUND', 'calculation-spec.md',
                      '[вакуум] таблица правил округления с колонкой «Префикс ≈» не найдена')
        else:
            for row in tbl.group(1).strip().split('\n'):
                cells = [c.strip() for c in row.strip('|').split('|')]
                if len(cells) < 4:
                    continue
                if 'если показ' not in cells[3]:
                    ln = sp[:tbl.start()].count('\n') + 1
                    self.fail('DM-ROUND', f'calculation-spec.md:{ln}',
                              f'строка «{cells[0]}»: префикс ≈ задан как «{cells[3][:40]}»; '
                              f'data-model.md требует префикс при любом расхождении показа '
                              f'с точным значением (CALC-007) — противоречие между артефактами')
        if '≈' not in dm or not re.search(r'префикс\s*`?≈', dm):
            self.fail('DM-ROUND', rel,
                      'модель не формулирует правило префикса `≈` (CALC-007)')
        # Ссылки на решения: заявление обязано называть номер, номер — существовать
        dec = self.read('docs/product/decisions.md') or ''
        heads = set(re.findall(r'^##\s*D-(\d+)', dec, re.M))
        # Заявление «зафиксировано в decisions.md» проверяется по СМЕЖНОСТИ:
        # глагол-утверждение обязан стоять рядом с самой ссылкой, иначе любое
        # упоминание файла в перечислении становилось ложным срабатыванием.
        claim = re.compile(r'(?:зафиксирован\w*|реш(?:ено|ён\w*|ена|ены)|принят\w*|согласно|'
                           r'по решению|основание)[^.\n]{0,40}`?[\w/.-]*decisions\.md|'
                           r'decisions\.md`?[^.\n]{0,40}(?:зафиксирован\w*|принят\w*|'
                           r'основание|решением)', re.I)
        for r, text in self.files('*.md'):
            if r.startswith('tools/'):
                continue
            for i, line in enumerate(text.split('\n'), 1):
                if 'decisions.md' not in line:
                    continue
                nums = re.findall(r'D-(\d+)', line)
                if not nums:
                    if claim.search(line):
                        self.emit('DM-DECISION', r, i, line,
                                  'ссылка на `decisions.md` как на основание без номера решения — '
                                  'проверить утверждение невозможно')
                    continue
                for n in nums:
                    if n.lstrip('0').zfill(2) not in {h.lstrip('0').zfill(2) for h in heads}:
                        self.emit('DM-DECISION', r, i, line,
                                  f'ссылка на решение D-{n}, которого нет в decisions.md '
                                  f'(есть D-{min(heads, key=int)}…D-{max(heads, key=int)})')

    # -- 3c. Annahmen: текст, уходящий клиенту --------------------------------
    def check_annahmen(self):
        """`docs/product/t0-fallback-rules.md` — источник текстов Annahmen.

        Клиентская поверхность дороже всех остальных, а до v3 инструмент не
        знал об этом файле вовсе. Два дефекта нашёл человек: класс здания
        объявлялся клиенту выведенным из этажности (CALC-004) и покрытие
        KG 500 объявлялось `nicht enthalten` при фактическом `unknown`
        (R-18/CALC-006). Оба проверяемы структурно.
        """
        rel = 'docs/product/t0-fallback-rules.md'
        txt = self.read(rel)
        if txt is None:
            self.fail('T0-FACT', rel, '[вакуум] источник текстов Annahmen отсутствует')
            return
        rows = txt.split('\n')
        # разбивка на секции `### …`
        heads = [i for i, l in enumerate(rows) if l.startswith('### ')] + [len(rows)]
        if len(heads) < 2:
            self.fail('T0-FACT', rel, '[вакуум] в файле нет секций `### …` — Annahmen не локализуемы')
        annahmen_seen = 0
        for a, b in zip(heads, heads[1:]):
            sec = rows[a:b]
            body = '\n'.join(sec)
            needs_check = 'Prüfung erforderlich' in body
            for k, line in enumerate(sec):
                if '**Annahme:**' not in line:
                    continue
                annahmen_seen += 1
                ln = a + k + 1
                # (1) выведение класса из этажности — прямое нарушение CALC-004
                if re.search(r'(ergibt sich|abgeleitet|folgt|bestimmt|ermittelt)[^.]{0,60}'
                             r'Geschoss|Geschoss\w*[^.]{0,60}'
                             r'(ergibt sich|abgeleitet|folgt|bestimmt)', line) \
                   and re.search(r'Gebäudeklasse|\bGK\b', line):
                    self.emit('T0-FACT', rel, ln, line,
                              'Annahme объявляет Gebäudeklasse выведенной из этажности; '
                              'CALC-004: этажность — только триггер проверки, не доказательство')
                # (2) значение с `Prüfung erforderlich` подаётся как факт
                if needs_check and re.search(r'Gebäudeklasse|\bGK\b', line) and \
                   not re.search(r'nicht bestätigt|Prüfauslöser|noch offen|unbestätigt|'
                                 r'kein Nachweis', line):
                    self.emit('T0-FACT', rel, ln, line,
                              'секция помечена `Prüfung erforderlich`, но Annahme не называет '
                              'значение неподтверждённым — клиенту сообщается факт вместо гипотезы')
        if not annahmen_seen:
            self.fail('T0-FACT', rel, '[вакуум] ни одного блока `**Annahme:**` не найдено')
        # (3) состояние покрытия в Annahme обязано совпадать с фикстурой
        fx = self.read('docs/audit/synthetic-fixtures.md') or ''
        mstate = re.search(r'KG 500[^\n]*?coverage\s*`(\w+)`', fx)
        if not mstate:
            self.fail('T0-COVERAGE', 'synthetic-fixtures.md',
                      '[вакуум] фикстура не объявляет coverage для KG 500 — сверять не с чем')
        else:
            state = mstate.group(1)
            hits = 0
            for i, line in enumerate(rows, 1):
                for m in re.finditer(r'Kostengruppe\s*500', line):
                    hits += 1
                    clause = line[m.start():m.start() + 320]
                    undecided = re.search(r'keine\s+Deckungsentscheidung|weder\s+eingeschlossen'
                                          r'\s+noch\s+ausgeschlossen|unbewertet', clause)
                    decided = re.search(r'nicht\s+enthalten|ausgeschlossen(?!\b\s*und)|'
                                        r'\bist\s+enthalten|eingeschlossen(?!\s+noch)', clause)
                    if state == 'unknown' and (decided and not undecided):
                        self.emit('T0-COVERAGE', rel, i, line,
                                  f'Annahme объявляет покрытие KG 500 решённым, фикстура даёт '
                                  f'coverage `{state}` (R-18/CALC-006): пока состояние неизвестно, '
                                  f'оффер несёт Zwischensumme, а не решение о включении')
                    if state == 'unknown' and not undecided and not decided:
                        self.emit('T0-COVERAGE', rel, i, line,
                                  'Annahme упоминает KG 500, но не называет состояние покрытия')
            if not hits:
                self.fail('T0-COVERAGE', rel,
                          '[вакуум] Annahmen не упоминают Kostengruppe 500 — состояние покрытия '
                          'клиенту не сообщается вовсе (R-18/CALC-006)')

    # -- 3d. Модель выдач, видимости и гейтов --------------------------------
    RU_NUM = {'одного': 1, 'одного условия': 1, 'двух': 2, 'трёх': 3, 'трех': 3,
              'четырёх': 4, 'четырех': 4, 'пяти': 5, 'шести': 6, 'семи': 7,
              'восьми': 8, 'девяти': 9, 'десяти': 10,
              'один': 1, 'два': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6,
              'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10}

    def check_output_model(self):
        """`docs/product/output-model.md` — 58 инвариантов, охват до v4 был ноль.

        Из десяти мутаций аудитора прошли шесть. Все шесть — структурные:
        нумерация инвариантов, число условий в определении против числа,
        названного инвариантом, состав обязательных полей типа, число
        клиентских профилей в матрице блокировки, связка политики и
        сериализации, денежный спесимен против фикстуры. Ни одна не требует
        понимания текста — только сверки структуры со структурой.
        """
        rel = 'docs/product/output-model.md'
        txt = self.read(rel)
        if txt is None:
            self.fail('OUT-SEQ', rel, '[вакуум] docs/product/output-model.md отсутствует — '
                                      'артефакт партии Batch 6 инструментом не проверяется')
            return
        rows = txt.split('\n')

        # (1) OUT-SEQ: непрерывность и совпадение порядкового номера с меткой.
        # Мутация `OUT-30 → OUT-31` даёт одновременно дубль и пропуск.
        items = []
        for i, line in enumerate(rows, 1):
            m = re.match(r'^\s*(\d+)\.\s+\*\*OUT-(\d+)\.\*\*', line)
            if m:
                items.append((int(m.group(1)), int(m.group(2)), i, line))
        if not items:
            self.fail('OUT-SEQ', rel, '[вакуум] ни одного инварианта вида `nn. **OUT-nn.**` '
                                      'не найдено — §14 не проверяем')
        seen_lbl, seen_ord = {}, {}
        for ordn, lbl, ln, line in items:
            if ordn != lbl:
                self.emit('OUT-SEQ', rel, ln, f'OUT-SEQ:ord{ordn}/lbl{lbl}',
                          f'порядковый номер {ordn} не совпадает с меткой OUT-{lbl:02d} — '
                          f'ссылка «output-model OUT-{lbl:02d}» указывает не на этот пункт')
            for reg, key, what in ((seen_lbl, lbl, 'метка OUT'), (seen_ord, ordn, 'порядковый номер')):
                if key in reg:
                    self.emit('OUT-SEQ', rel, ln, f'OUT-SEQ:dup-{what}-{key}',
                              f'{what} {key} встречается второй раз (первый — строка {reg[key]})')
                else:
                    reg[key] = ln
        if items:
            lbls = sorted(seen_lbl)
            for n in range(1, max(lbls) + 1):
                if n not in seen_lbl:
                    self.emit('OUT-SEQ', rel, items[0][2], f'OUT-SEQ:gap-{n}',
                              f'в нумерации инвариантов пропущен OUT-{n:02d} '
                              f'(объявлены 1…{max(lbls)}, фактически {len(lbls)} штук)')
            # OUT-REF: ссылка на инвариант, которого нет
            for r2_, t2 in self.files('*.md'):
                if r2_.startswith('tools/'):
                    continue
                for i, line in enumerate(t2.split('\n'), 1):
                    for m in re.finditer(r'\bOUT-(\d{1,3})\b', line):
                        n = int(m.group(1))
                        if n not in seen_lbl:
                            self.emit('OUT-REF', r2_, i, f'OUT-REF:OUT-{n}',
                                      f'ссылка на инвариант OUT-{n:02d}, которого нет в '
                                      f'output-model.md §14 (объявлены OUT-01…OUT-{max(lbls):02d})')

        # (2) OUT-SEND: `sendEnabled` — конъюнкция N условий. Число, названное
        # в определении §9.3, число строк его таблицы и число, названное
        # инвариантом OUT-36, обязаны совпадать. Снятие одного условия из
        # таблицы прошло молча: инвариант продолжал говорить «шести».
        m = re.search(r'`sendEnabled`\s*—\s*конъюнкция\s+([а-яё]+)\s+услови', txt)
        if not m:
            self.fail('OUT-SEND', rel, '[вакуум] §9.3 не формулирует `sendEnabled` как '
                                       'конъюнкцию названного числа условий')
        else:
            declared = self.RU_NUM.get(m.group(1).lower())
            ln_def = txt[:m.start()].count('\n') + 1
            if declared is None:
                self.emit('OUT-SEND', rel, ln_def, 'OUT-SEND:числительное',
                          f'число условий записано словом «{m.group(1)}», которое инструмент '
                          f'не умеет прочитать — утверждение непроверяемо')
            else:
                # таблица условий: строки `| N | … | … |` сразу после определения
                tail = txt[m.end():]
                cut = re.search(r'\n###\s', tail)
                block = tail[:cut.start()] if cut else tail
                nums = [int(x) for x in re.findall(r'^\|\s*(\d+)\s*\|', block, re.M)]
                if not nums:
                    self.fail('OUT-SEND', rel, '[вакуум] таблица условий §9.3 не распознана')
                else:
                    if nums != list(range(1, len(nums) + 1)):
                        self.emit('OUT-SEND', rel, ln_def, 'OUT-SEND:нумерация-таблицы',
                                  f'условия §9.3 пронумерованы {nums} — ожидалась '
                                  f'непрерывная 1…{len(nums)}')
                    if len(nums) != declared:
                        self.emit('OUT-SEND', rel, ln_def, 'OUT-SEND:число-условий',
                                  f'§9.3 называет конъюнкцию {declared} условий, а таблица '
                                  f'содержит {len(nums)} — одно из двух неверно, и кнопка '
                                  f'отправки открывается по неполному набору (EMAIL-001)')
                    mi = re.search(r'\*\*OUT-36\.\*\*[^\n]*конъюнкции\s+([а-яё]+)\s+услови', txt)
                    if not mi:
                        self.fail('OUT-SEND', rel, '[вакуум] OUT-36 не называет число условий '
                                                   '`sendEnabled` — инвариант непроверяем')
                    else:
                        inv = self.RU_NUM.get(mi.group(1).lower())
                        if inv != len(nums):
                            self.emit('OUT-SEND', rel, txt[:mi.start()].count('\n') + 1,
                                      'OUT-SEND:инвариант-против-таблицы',
                                      f'OUT-36 требует конъюнкцию {mi.group(1)} ({inv}) условий, '
                                      f'таблица §9.3 содержит {len(nums)} — инвариант '
                                      f'отчитывается о том, чего в определении нет')

        # (3) OUT-ATTACH: обязательные носители `AttachmentPreflightItem`.
        # Удаление `contentHash` прошло: тип потерял идентичность вложения,
        # а OUT-43 продолжал её требовать.
        NEED = {
            'clientTitle':             'клиентское название (EMAIL-006)',
            'source':                  'неизменяемая ссылка на версию (EMAIL-002)',
            'contentHash':             'хеш байтов — идентичность вложения (EMAIL-002)',
            'generatedAt':             '«когда это посчитано» (EMAIL-002)',
            'visibilityClassification': 'клиентская безопасность (EMAIL-002, R-17)',
            'stalenessState':          'цена в файле = цена в теле (STALE-001)',
            'calculationBindings':     'какой прогон отвечает за числа (§6.2)',
        }
        mt = re.search(r'AttachmentPreflightItem\s*\{(.*?)\n\}', txt, re.S)
        if not mt:
            self.fail('OUT-ATTACH', rel, '[вакуум] тип `AttachmentPreflightItem` не объявлен — '
                                         'OUT-43 требует его состав')
        else:
            body = mt.group(1)
            ln = txt[:mt.start()].count('\n') + 1
            fields = set(re.findall(r'^\s*([a-z][A-Za-z0-9]*)\??\s*:', body, re.M))
            for f, why in sorted(NEED.items()):
                if f not in fields:
                    self.emit('OUT-ATTACH', rel, ln, f'OUT-ATTACH:{f}',
                              f'`AttachmentPreflightItem` не несёт `{f}` — {why}; '
                              f'OUT-43 требует все семь носителей')
                # каждый носитель обязан быть обоснован таблицей §10.1
                elif f'`{f}`' not in txt.split('### 10.1')[-1][:4000]:
                    self.emit('OUT-ATTACH', rel, ln, f'OUT-ATTACH:justify-{f}',
                              f'`{f}` объявлен в типе, но не назван в таблице обоснований '
                              f'§10.1 «Поле · Зачем именно оно · Требование»')
            # снапшот вложения существует только для клиент-безопасного (OUT-48)
            ms = re.search(r'AttachmentSnapshot\s*\{(.*?)\n\}', txt, re.S)
            if not ms:
                self.fail('OUT-ATTACH', rel, '[вакуум] тип `AttachmentSnapshot` не объявлен')
            elif not re.search(r'visibilityClassification\s*:\s*"clientSafe"\s*;', ms.group(1)):
                self.emit('OUT-ATTACH', rel, txt[:ms.start()].count('\n') + 1,
                          'OUT-ATTACH:snapshot-union',
                          '`AttachmentSnapshot.visibilityClassification` перестал быть union '
                          'из одного значения `"clientSafe"` — у внутреннего файла появился '
                          'путь в снапшот (OUT-48)')

        # (4) OUT-R07: матрица блокировки называет ВСЕ пять клиентских профилей.
        # Ослабление до трёх прошло — это прямое ослабление R-07.
        n_client = len(CLIENT_PROFILES)
        mm = re.search(r'^\|\s*Категория при[^\n]*\n\|[-\s|]+\|\n((?:\|[^\n]*\n)+)', txt, re.M)
        if not mm:
            self.fail('OUT-R07', rel, '[вакуум] матрица блокировки §7.2 не распознана — '
                                      'R-07 не проверяется')
        else:
            base = txt[:mm.start(1)].count('\n') + 1
            hard = ('compliance', 'scope', 'financial', 'stale', 'privacy', 'security')
            got_rows = 0
            for k, row in enumerate(mm.group(1).strip().split('\n')):
                cells = [c.strip() for c in row.strip('|').split('|')]
                if len(cells) < 2:
                    continue
                cats = set(re.findall(r'`([a-zA-Z]+)`', cells[0]))
                if not (cats & set(hard)):
                    continue
                got_rows += 1
                mw = re.search(r'(?:ровно\s+)?(?:все\s+)?([а-яё]+)\s+клиентск', cells[1])
                if not mw:
                    self.emit('OUT-R07', rel, base + k, 'OUT-R07:' + '+'.join(sorted(cats)),
                              f'строка матрицы блокировки «{cells[0][:40]}» не называет число '
                              f'заблокированных клиентских профилей — R-07 требует все {n_client}')
                    continue
                got = self.RU_NUM.get(mw.group(1).lower())
                if got != n_client:
                    self.emit('OUT-R07', rel, base + k, 'OUT-R07:' + '+'.join(sorted(cats)),
                              f'строка «{cells[0][:40]}» блокирует {mw.group(1)} ({got}) '
                              f'клиентских профилей вместо всех {n_client} — прямое ослабление '
                              f'R-07 (открытый Material Blocker блокирует все клиентские '
                              f'профили без исключения)')
            if got_rows < 3:
                self.fail('OUT-R07', rel, f'[вакуум] в матрице §7.2 найдено {got_rows} строк '
                                          f'жёстких категорий из ожидаемых ≥ 3 '
                                          f'(compliance/scope/financial · stale · privacy/security)')

        # (5) OUT-POLICY: `allowed = false` → `serialization = "omit"`.
        # Разрыв связки означает, что запрещённое поле вправе сериализоваться.
        # Правила формы §5.1 и инвариант OUT-10 проверяются РАЗДЕЛЬНО: связка
        # формулируется в обоих местах, и глобальный поиск по файлу означал,
        # что порча одного из двух покрывается вторым.
        ms51 = re.search(r'^###\s*5\.1\.(.*?)(?=^###\s)', txt, re.S | re.M)
        if not ms51:
            self.fail('OUT-POLICY', rel, '[вакуум] раздел §5.1 «Тип политики» не найден — '
                                         'правила формы FieldOutputPolicy не проверяются')
        else:
            s51 = ms51.group(1)
            ln51 = txt[:ms51.start()].count('\n') + 1
            rx_bind = re.compile(r'`allowed\s*=\s*false`[^\n]{0,60}?требует[^\n]{0,60}?'
                                 r'`serialization\s*=\s*"omit"`')
            if not rx_bind.search(s51):
                self.emit('OUT-POLICY', rel, ln51, 'OUT-POLICY:§5.1-false→omit',
                          '§5.1 не связывает `allowed = false` с `serialization = "omit"`: '
                          'без этой связки запрещённое политикой поле вправе '
                          'сериализоваться (SECURITY-001)')
            if not re.search(r'`allowed\s*=\s*true`[^\n]{0,40}запрещает[^\n]{0,20}`?omit`?', s51):
                self.emit('OUT-POLICY', rel, ln51, 'OUT-POLICY:§5.1-true≠omit',
                          '§5.1 не запрещает `omit` при `allowed = true` — политика вправе '
                          'молча опустить разрешённое поле')
        mi = re.search(r'\*\*OUT-10\.\*\*([^\n]*)', txt)
        if not mi:
            self.fail('OUT-POLICY', rel, '[вакуум] инвариант OUT-10 не найден')
        elif not ('allowed = false' in mi.group(1) and '"omit"' in mi.group(1)):
            self.emit('OUT-POLICY', rel, txt[:mi.start()].count('\n') + 1,
                      'OUT-POLICY:OUT-10',
                      'OUT-10 перестал называть обе стороны связки '
                      '(`allowed = false` → `serialization = "omit"`)')
        # проекция физически не несёт `omit`
        if not re.search(r'"omit"\s*сюда\s*не\s*попадает|//\s*"omit"', txt):
            self.emit('OUT-POLICY', rel, 1, 'OUT-POLICY:projection-omit',
                      '`ProjectedField.serialization` не объявляет, что `"omit"` в проекцию '
                      'не попадает — опущенное поле снова получает представимое состояние')

        # (6) OUT-PROFILE: канонические имена профилей.
        vocab = set(OUTPUT_PROFILES) | set(PROFILE_VOCAB_OK)
        fx = self.read('docs/audit/synthetic-fixtures.md') or ''
        for name in sorted(set(re.findall(r'\b((?:client|internal)[A-Z][A-Za-z]*)', txt))):
            if name in vocab:
                continue
            ln = next((i for i, l in enumerate(rows, 1) if name in l), 1)
            extra = ''
            if name not in fx:
                extra = (f' Заявление о фикстуре устарело: `synthetic-fixtures.md` имени '
                         f'`{name}` не содержит — сверять надо с файлом, а не с памятью.')
            self.emit('OUT-PROFILE', rel, ln, f'OUT-PROFILE:{name}',
                      f'имя `{name}` не является каноническим профилем выдачи '
                      f'(data-model.md §5.11 объявляет {", ".join(OUTPUT_PROFILES)}): '
                      f'по неканоническому имени не сопоставляется ни одна политика '
                      f'видимости.{extra}')
        for p in CLIENT_PROFILES:
            if not re.search(r'###\s*3\.\d+\.\s*`?' + p, txt):
                self.emit('OUT-PROFILE', rel, 1, f'OUT-PROFILE:missing-{p}',
                          f'§3 «Пять клиентских профилей поимённо» не содержит секции '
                          f'профиля `{p}` — профиль без описания политики не имеет')

        # (7) OUT-MONEY: денежные и удельные спесимены §7.3/§9.7 против фикстуры
        # в Decimal. Порча округления (`≈ 5.824.000` при точном `5.822.936,00`)
        # прошла: в файле не было ни одной проверки арифметики.
        self._specimens('OUT-MONEY', rel, txt)

        # (8) SCHED-D17: десятичный месяц при целом календарном интервале
        self._sched_d17(rel, txt)

    # -- 3e. Спесимены денег и площадей против фикстуры -----------------------
    RX_MONEY = re.compile(r'(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d+)?)\s*[  ]?(?:€(?!/)|Euro\b)')
    RX_RATE = re.compile(r'(?<![\d.,])(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*[  ]?€/m²')

    def _specimens(self, cls, rel, txt):
        """Каждое денежное и удельное число документа сводится с фикстурой.

        Допустимое множество строится ИЗ `synthetic-fixtures.md` (см. конец
        `_arithmetic`), а не из констант инструмента: иначе проверка сверяла бы
        собственные ожидания с собственными константами. Отсутствие множества
        (фикстура не разобрана) — вакуум, а не молчаливый пропуск.
        """
        if not self.fx:
            self.fail(cls, rel, '[вакуум] величины фикстуры не вычислены — '
                                'сверять спесимены не с чем')
            return
        for i, line in enumerate(txt.split('\n'), 1):
            for rx, pool, what in ((self.RX_RATE, self.fx['rates'], 'удельная величина'),
                                   (self.RX_MONEY, self.fx['exact'] | self.fx['disp'], 'сумма')):
                for m in rx.finditer(line):
                    try:
                        val = de(m.group(1))
                    except Exception:
                        continue
                    if val in pool:
                        continue
                    self.emit(cls, rel, i, f'{cls}:{m.group(1)}',
                              f'{what} {m.group(1)} не сводится ни с одной величиной '
                              f'синтетической фикстуры и её производными (правило проекта 32: '
                              f'число, не сходящееся с собственной фикстурой, — '
                              f'release-blocker)')

    RX_WHOLE_MONTH = re.compile(r'(?<![\d,])(\d{1,3}),0\s*[  ]?Monate?\b')

    def _sched_d17(self, rel, txt):
        """D-17: целый календарный интервал подписывается `n Monate` без `,0`.

        Область — продуктовые и дизайн-документы: там число является
        СПЕСИМЕНОМ, который уйдёт клиенту. Корпус `docs/audit/` цитирует
        формулировку отклонения (`7,0 Monate` в плане и реестре требований) —
        это текст решения, а не подпись длительности.
        """
        for m in self.RX_WHOLE_MONTH.finditer(txt):
            ln = txt[:m.start()].count('\n') + 1
            self.emit('SCHED-D17', rel, ln, f'SCHED-D17:{m.group(1)},0',
                      f'подпись `{m.group(0).strip()}`: D-17 требует целое '
                      f'`{m.group(1)} Monate` там, где интервал является целым числом '
                      f'календарных месяцев; десятичный перевод создаёт ложную точность '
                      f'(R-26). Отклонение сужено до случая несовпадающих дней месяца')

    # -- 4. CLAUDE.md и decisions.md: отменённые правила ----------------------
    def check_governance(self):
        claude = self.read('CLAUDE.md') or ''
        for pat, why in [(r'hit-зону 32 px', 'R-04 требует 44×44'),
                         (r'9 типов', 'D-11 v2: четыре типизированные оси'),
                         (r'Bezugsfläche\s*=\s*Σ\s*WFL', 'R-11 запрещает WFL+NUF как клиентскую метрику')]:
            if re.search(pat, claude):
                self.fail('CLAUDE', 'CLAUDE.md', f'действует отменённое правило ({why})')
        # Присутствие неприкосновенных инвариантов (M-1/M-3/M-4, D-08).
        for need, why in [
                (r'`bestätigt`-значения и Festlegungen никогда не перезаписываются',
                 'M-1/D-08: повторный анализ не перезаписывает подтверждённое'),
                (r'Отправленный вариант — неизменяемый снапшот', 'M-3'),
                (r'Данные не могут измениться без события', 'M-4')]:
            if not re.search(need, claude):
                self.fail('CLAUDE', 'CLAUDE.md',
                          f'снят инвариант: «{need[:48]}…» ({why})')
        # Порог крупного текста для бренд-оранжевого выводится из контраста
        # 3,10:1 (проходит только large text) — величина не произвольная.
        m = re.search(r'#FD5E00[^\n]*?≥\s*(\d+)\s*px', claude)
        if not m:
            self.fail('CLAUDE', 'CLAUDE.md',
                      '[вакуум] правило 5 не называет порог кегля для #FD5E00')
        elif m.group(1) != '24':
            self.fail('CLAUDE', 'CLAUDE.md',
                      f'порог оранжевого текста {m.group(1)} px; при контрасте '
                      f'{fmt_ratio(contrast(CLR["accent"], CLR["white"]))}:1 WCAG допускает '
                      f'только large text — ≥ 24 px Regular (или ≥ 18,67 px Bold)')
        decisions = self.read('docs/product/decisions.md') or ''
        for bad, why in [(r'\*\*D-11\*\* Gebäudetyp — первая ось \(9 типов', 'D-11 отменён v2'),
                         (r'\*\*D-14\*\* комплексы зданий, Bezugsfläche WFL\+NUF', 'D-14 отменён v2')]:
            if re.search(bad, decisions):
                self.fail('DECISIONS', 'decisions.md', f'индекс описывает отменённую версию ({why})')

    # -- 5. План: отметка против текста ---------------------------------------
    def check_plan(self):
        rel = 'docs/audit/remediation-plan.md'
        plan = self.read(rel) or ''
        neg = re.compile(r'(не выполнен|не подтвержд|не реализован|не начат|перенос\w*|'
                         r'сдвин\w*|отложен|остаётся откры|ожидает вердикта|частично|'
                         r'не сделан|не закрыт|позже|следующ\w+\s+(квартал|батч|batch)|'
                         r'до Batch\s*\d|в Batch\s*\d)', re.I)
        done = re.compile(r'(?<!не )(выполнено|сделано|закрыто|принято аудитором)\b', re.I)
        for i, line in enumerate(plan.split('\n'), 1):
            if line.lstrip().startswith('- [x]') and neg.search(line):
                self.emit('PLAN', rel, i, line,
                          f'пункт помечен [x], но текст говорит об обратном — {line.strip()[:80]}')
            if line.lstrip().startswith('- [ ]') and done.search(line):
                self.emit('PLAN', rel, i, line,
                          f'пункт помечен [ ], но текст заявляет выполнение — {line.strip()[:80]}')
            if re.search(r'A11Y-001\s+закрыт(?!ым)', line) and not line.lstrip().startswith('>'):
                self.emit('PLAN', rel, i, line, 'живое утверждение о закрытии A11Y-001')

    # -- 6. PII / артефакты ----------------------------------------------------
    def check_privacy(self):
        """PII: детекторы КЛАССА, а не список известных спесименов.

        v2 был чёрным списком: любое новое имя, адрес, IBAN или телефон
        проходил насквозь, как и обфускация `t.mueller [at] …`, как и та же
        PII, переложенная в `.css`, `.ts`, `.svg` или в сам каталог `tools/`.
        Конвенция RFC 2606 была инвертирована: `…@example.org` считался
        production-доменом, а `…@zbi.example` — безопасным.
        """
        email_rx = re.compile(r'[\w.+-]+@([\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,})')
        # RFC 2606 / RFC 6761: зарезервированы под документацию и тесты.
        SAFE_DOM = ('example.com', 'example.org', 'example.net',
                    'test', 'invalid', 'localhost')

        def safe(dom):
            dom = dom.lower()
            return (dom == 'example' or dom.endswith('.example')
                    or dom in SAFE_DOM
                    or any(dom.endswith('.' + d) for d in SAFE_DOM))

        # Зарезервированное пространство документации — то же по смыслу, что
        # RFC 2606 для доменов, только для немецких адресов и имён:
        # Muster* / Beispiel* / Example* не бывают настоящими. Это структурная
        # конвенция, а не список слов-исключений: она объявлена здесь и
        # применяется только к попаданию детектора КЛАССА, не к спесименам.
        DOC_NAMESPACE = re.compile(r'muster|beispiel|example', re.I)
        # Детекторы класса. Ловят то, чего в списке спесименов нет и быть
        # не может: любой немецкий IBAN, любой телефон, любой индекс+город,
        # любую улицу с номером дома, любую обфускацию адреса скобками.
        klass = [
            ('IBAN', re.compile(r'\bDE\d{2}[ ]?(?:\d{4}[ ]?){4}\d{2}\b|\bDE\d{20}\b')),
            ('немецкий телефон', re.compile(
                r'\+\s?49[\s\-/().]*\d[\d\s\-/().]{6,}|'
                r'(?:Tel|Telefon|Mobil|Fax|Handy)\.?\s*:?\s*\+?\d[\d\s\-/().]{6,}')),
            ('индекс + город', re.compile(r'(?<!\d)\d{5}\s+[A-ZÄÖÜ][a-zäöüß]{2,}')),
            ('улица + номер дома', re.compile(
                r'[A-ZÄÖÜ][a-zäöüß]+(?:stra(?:ß|ss)e|str\.|weg|allee|platz|gasse|ring)\s*\d{1,4}\b')),
            ('обфускация адреса', re.compile(
                r'[A-Za-z0-9._+-]+\s*(?:\[|\()\s*at\s*(?:\]|\))\s*[A-Za-z0-9.-]+'
                r'\s*(?:(?:\[|\()\s*dot\s*(?:\]|\))|\.)\s*[A-Za-z]{2,}', re.I)),
        ]
        # Остаточный список известных спесименов страхует значения, у которых
        # класса нет (project-ID, номер заказа, фамилия). Собран из частей —
        # см. _j(): скан покрывает и tools/, а исходник со спесименом внутри
        # срабатывал бы на себя.
        pii_pats = [_j('Pank', 'stra'), r'Parkstra\w*e\s*5\d', _j('Beethoven', 'str'),
                    r'\b' + _j('Z', 'BI') + r'\b',
                    r'colophon-order-\d+', r'[Oo]rder\s*49043', r'\bGER-\d{5}\b',
                    r'M\.\s*Weber']
        spec_pats = [r'1[\s.  ]969,67', r'3[\s.  ]682[\s.  ]000',
                     r'1[\s.  ]685,49', r'665,75']  # реальные спесимены — только design-system/*
        seen = False
        for glob in ('*.md', '*.json', '*.html', '*.css', '*.ts', '*.tsx',
                     '*.svg', '*.txt', '*.py'):
            for rel, text in self.files(glob):
                seen = True
                own_tool = rel.startswith('tools/')
                for i, line in enumerate(text.split('\n'), 1):
                    for m in email_rx.finditer(line):
                        if not safe(m.group(1)):
                            self.emit('PRIVACY-001', rel, i, line,
                                      f'e-mail с production-доменом «{m.group(0)}» '
                                      f'(RFC 2606: безопасны example.com/.org/.net и *.example)')
                    for name, rx in klass:
                        for m in rx.finditer(line):
                            if DOC_NAMESPACE.search(m.group(0)):
                                continue   # зарезервированное имя документации
                            self.emit('PRIVACY-001', rel, i, line,
                                      f'PII класса «{name}»: {m.group(0)[:40]}')
                    if own_tool:
                        # В самом инструменте список спесименов не применяется:
                        # он и есть список спесименов. Детекторы класса выше
                        # работают и здесь, поэтому реальная PII не пройдёт.
                        continue
                    for pat in pii_pats:
                        if re.search(pat, line):
                            self.emit('PRIVACY-001', rel, i, line,
                                      f'production-like значение по паттерну «{pat}»')
                    if rel.startswith('design-system/'):
                        for pat in spec_pats:
                            if re.search(pat, line):
                                self.emit('PRIVACY-001', rel, i, line,
                                          'реальный спесимен (ставка/площадь) вне синтетической фикстуры')
        if not seen:
            self.fail('PRIVACY-001', 'repo', '[вакуум] PII-скан не нашёл ни одного файла')
        # A11Y-001 в отгружаемом HTML: пред-ремедиационные цвета
        for rel, text in self.files('*.html'):
            for i, line in enumerate(text.split('\n'), 1):
                if re.search(r'#(?:FD5E00|fd5e00|E05400|e05400)', line):
                    self.emit('ARTIFACT-A11Y', rel, i, line,
                              'пред-ремедиационный цвет действия в отгружаемом HTML (A11Y-001)')

    # -- 7. Арифметика: фикстура + каталог, всё из файлов ----------------------
    def _pair_after(self, cls, desc, tail, expect):
        """Пара «точное значение · показ» после знака `=` — по СТРУКТУРЕ.

        CALC-007 требует хранить точное значение и показывать округлённое с
        префиксом `≈`. Структура, на которую опирается разбор: до первого `€`
        стоят одно или два числа; последнее — показ, предыдущее (если есть) —
        точное. Слова «точно», «показ», «нетто», их порядок, разметка и
        переносы строк не участвуют: именно привязка к формулировке дважды за
        сессию превращала сверку в вакуум.
        """
        m = re.search(r'(≈)?\s*\+?\s*([\d][\d.]*(?:,\d+)?)\s*[  ]?€', tail)
        if not m:
            self.fail(cls, desc, f'[вакуум] {desc}: после формулы нет величины со знаком € — '
                                 f'сверить показ не с чем')
            return
        shown = de(m.group(2))
        nums = re.findall(r'(?<![\d.,])([\d][\d.]*(?:,\d+)?)', tail[:m.start()])
        exact = de(nums[-1]) if nums else None
        if exact is None:
            self.emit(cls, 'docs/product/calculation-spec.md', 1, f'{cls}:{desc}:no-exact',
                      f'{desc}: назван только показ {m.group(2)} € без точного значения — '
                      f'CALC-007 требует хранить и показывать точное рядом')
        else:
            self.eq(cls, f'{desc}: точное значение', exact, expect)
            self.eq(cls, f'{desc}: показ (до 1.000 €)', shown, r1000(exact))
            if shown != exact and not m.group(1):
                self.emit(cls, 'docs/product/calculation-spec.md', 1,
                          f'{cls}:{desc}:no-prefix',
                          f'{desc}: показ {m.group(2)} отличается от точного {exact}, '
                          f'но префикс `≈` отсутствует (CALC-007)')
        self.eq(cls, f'{desc}: показ = округление ожидаемого', shown, r1000(expect))

    def check_arithmetic(self):
        try:
            self._arithmetic()
        except Vacuum:
            pass

    def _arithmetic(self):
        fx = self.read('docs/audit/synthetic-fixtures.md') or ''
        sp = self.read('docs/product/calculation-spec.md') or ''
        C, F, S, U = 'CALC-CATALOG', 'CALC-FIXTURE', 'CALC-SCHEDULE', 'CALC-UNCERT'

        # каталог фикстуры
        k_fx = de(self.grab(fx, r'K_base\s*=\s*([\d.\s]+?)\s*€', C, 'фикстура: K_base').group(1))
        g = self.grab(fx, r'F_gk:\s*GK\s*1–3\s*=\s*([\d,]+)\s*·\s*GK\s*4\s*=\s*([\d,]+)\s*·\s*GK\s*5\s*=\s*([\d,]+)',
                      C, 'фикстура: строка F_gk')
        gk13_fx, gk4_fx, gk5_fx = de(g.group(1)), de(g.group(2)), de(g.group(3))
        g = self.grab(fx, r'F_energie:\s*EH\s*55\s*=\s*([\d,]+)\s*·\s*EH\s*40\s*=\s*([\d,]+)',
                      C, 'фикстура: строка F_energie')
        eh55_fx, eh40_fx = de(g.group(1)), de(g.group(2))
        buero_fx = de(self.grab(fx, r'F_form_büro\s*=\s*([\d,]+)', C, 'фикстура: F_form_büro').group(1))
        g = self.grab(fx, r'UG vollausbau \+ TG\s*=\s*([\d.\s]+?)\s*\+\s*([\d.\s]+?)\s*=\s*([\d.\s]+?)\s*€',
                      C, 'фикстура: ставка UG')
        ug_a, ug_b, ug_rate = de(g.group(1)), de(g.group(2)), de(g.group(3))
        self.eq(C, 'фикстура: UG-сумма 1.100+90', ug_a + ug_b, ug_rate)
        g = self.grab(fx, r'F_gk_zeit:\s*GK\s*3\s*=\s*([\d,]+)\s*·\s*GK\s*4\s*=\s*([\d,]+)\s*·\s*GK\s*5\s*=\s*([\d,]+)',
                      C, 'фикстура: строка F_gk_zeit')
        gk4z_fx, gk5z_fx = de(g.group(2)), de(g.group(3))
        g = self.grab(fx, r'F_form_zeit:\s*MFH\s*=\s*([\d,]+)\s*·\s*Büro\s*=\s*([\d,]+)',
                      C, 'фикстура: строка F_form_zeit')
        mfhz_fx, bueroz_fx = de(g.group(1)), de(g.group(2))

        # каталог calculation-spec
        k_sp = de(self.grab(sp, r'K_base[^=\n]*=\s*([\d\s.]+?)\s*€', C, 'спека: K_base').group(1))
        g = self.grab(sp, r'GK ⚙\s*\|\s*GK\s*1–3\s*([\d,]+)\s*·\s*GK\s*4\s*([\d,]+)\s*·\s*GK\s*5\s*([\d,]+)',
                      C, 'спека: строка GK')
        gk13_sp, gk4_sp, gk5_sp = de(g.group(1)), de(g.group(2)), de(g.group(3))
        g = self.grab(sp, r'GEG\s*1,00\s*·\s*EH\s*55\s*([\d,]+)\s*·\s*EH\s*40\s*([\d,]+)',
                      C, 'спека: строка Energiestandard')
        eh55_sp, eh40_sp = de(g.group(1)), de(g.group(2))
        buero_sp = de(self.grab(sp, r'Büro\s*([\d,]+)\s*·\s*Gewerbe', C, 'спека: Büro в Gebäudetyp').group(1))
        ugv_sp = de(self.grab(sp, r'UG vollausbau ⚙\s*\|\s*([\d\s.]+?)\s*€', C, 'спека: UG vollausbau').group(1))
        tg_sp = de(self.grab(sp, r'Tiefgarage-Zuschlag ⚙\s*\|\s*\+\s*([\d\s.]+?)\s*€', C, 'спека: TG-Zuschlag').group(1))
        g = self.grab(sp, r'F_gk_zeit:\s*GK1\s*[\d,]+\s*·\s*GK2\s*[\d,]+\s*·\s*GK3\s*([\d,]+)\s*·\s*GK4\s*([\d,]+)\s*·\s*GK5\s*([\d,]+)',
                      C, 'спека: строка F_gk_zeit')
        gk4z_sp, gk5z_sp = de(g.group(2)), de(g.group(3))
        mfhz_sp = de(self.grab(sp, r'F_typ_zeit:[^\n]*MFH\s*([\d,]+)', S, 'спека: MFH zeit').group(1))
        plan_sp = de(self.grab(sp, r'planung\((\d+)', S, 'спека: planung(n)').group(1))
        stag_sp = de(self.grab(sp, r'stagger\((\d+)', S, 'спека: stagger(n)').group(1))

        # перекрёстная сверка каталогов (мутация «GK 4 = 1,00 → 1,05» ловится здесь)
        for desc, a, b in [('K_base', k_fx, k_sp), ('F_gk 1–3', gk13_fx, gk13_sp),
                           ('F_gk4 (стоимость)', gk4_fx, gk4_sp), ('F_gk5 (стоимость)', gk5_fx, gk5_sp),
                           ('F_eh55', eh55_fx, eh55_sp), ('F_eh40', eh40_fx, eh40_sp),
                           ('F_form_büro', buero_fx, buero_sp), ('ставка UG vollausbau', ug_a, ugv_sp),
                           ('TG-Zuschlag', ug_b, tg_sp), ('F_gk4_zeit', gk4z_fx, gk4z_sp),
                           ('F_gk5_zeit', gk5z_fx, gk5z_sp), ('F_mfh_zeit', mfhz_fx, mfhz_sp)]:
            if a != b:
                self.fail(C, f'каталог: {desc}', f'фикстура {a} ≠ calculation-spec {b}')

        # площади
        def area(label, col):
            m = self.grab(fx, r'\|\s*' + label + r'\s*\|\s*([\d.,—-]+)(?:\s*m²)?\s*\|\s*([\d.,—-]+)(?:\s*m²)?\s*\|',
                          F, f'фикстура: площадь {label}')
            return de(m.group(col))
        bgf_a = area('BGF oberirdisch', 1); bgf_b = area('BGF oberirdisch', 2)
        ug_area = area('BGF unterirdisch', 1)
        rs_a = area(r'BGF R\+S', 1); rs_b = area(r'BGF R\+S', 2)
        wfl = area('WFL nach WoFlV', 1); nuf = area('NUF nach DIN 277', 2)
        we = de(self.grab(fx, r'\|\s*Wohneinheiten\s*\|\s*(\d+)\s*\|', F, 'фикстура: WE').group(1))
        self.eq(F, 'BGF R+S Haus A = ober + UG', rs_a, bgf_a + ug_area)
        self.eq(F, 'BGF R+S Haus B = ober', rs_b, bgf_b)

        # Haus A: строки драйверов
        g = self.grab(fx, r'\|\s*Basis:\s*([\d.,]+)\s*×\s*([\d.]+)\s*\|\s*([\d.,]+)\s*\|', F, 'фикстура: строка Basis')
        self.eq(F, 'Basis = BGF_A × K_base (входы строки)', (de(g.group(1)), de(g.group(2))), (bgf_a, k_fx))
        basis = de(g.group(3))
        self.eq(F, 'Basis-произведение', basis, bgf_a * k_fx)
        g = self.grab(fx, r'\|\s*Gebäudeklasse 5 \(×\s*([\d,]+)\)\s*\|\s*\+\s*([\d.,]+)\s*\|\s*≈\s*([\d.,]+)\s*€', F, 'фикстура: строка GK 5')
        self.eq(F, 'фактор строки GK5 = каталожному', de(g.group(1)), gk5_fx)
        gk_add = de(g.group(2))
        self.eq(F, 'вклад GK 5', gk_add, basis * (gk5_fx - 1))
        self.eq(F, 'отображение вклада GK 5', de(g.group(3)), r1000(gk_add))
        g = self.grab(fx, r'\|\s*Energiestandard EH 55 \(×\s*([\d,]+)\)\s*\|\s*\+\s*([\d.,]+)\s*\|\s*≈\s*([\d.,]+)\s*€', F, 'фикстура: строка EH 55')
        self.eq(F, 'фактор строки EH55 = каталожному', de(g.group(1)), eh55_fx)
        eh_add = de(g.group(2))
        self.eq(F, 'вклад EH 55', eh_add, (basis + gk_add) * (eh55_fx - 1))
        g = self.grab(fx, r'\|\s*Untergeschoss inkl\. Tiefgarage \(([\d.,]+)\s*×\s*([\d.,]+)\)\s*\|\s*\+\s*([\d.,]+)\s*\|', F, 'фикстура: строка UG')
        self.eq(F, 'входы строки UG', (de(g.group(1)), de(g.group(2))), (ug_area, ug_rate))
        ug_add = de(g.group(3))
        self.eq(F, 'вклад UG', ug_add, ug_area * ug_rate)
        g = self.grab(fx, r'\|\s*\*\*Zwischensumme der kalkulierten Positionen\*\*\s*\|\s*\*\*([\d.,]+)\*\*\s*\|\s*\*\*≈\s*([\d.,]+)\s*€\*\*\s*\|', F, 'фикстура: итог Haus A')
        A = de(g.group(1))
        self.eq(F, 'итог Haus A = сумма драйверов', A, basis + gk_add + eh_add + ug_add)
        self.eq(F, 'итог Haus A = формула', A, bgf_a * k_fx * gk5_fx * eh55_fx + ug_area * ug_rate)
        self.eq(F, 'отображение итога Haus A', de(g.group(2)), r1000(A))
        g = self.grab(fx, r'`([\d.,]+)\s*\+\s*([\d.,]+)\s*\+\s*([\d.,]+)\s*\+\s*([\d.,]+)\s*=\s*([\d.,]+)`', F, 'фикстура: строка сверки драйверов')
        vals = [de(g.group(i)) for i in range(1, 6)]
        self.eq(F, 'сверка драйверов', sum(vals[:4]), vals[4])
        self.eq(F, 'сверка драйверов = итогу', vals[4], A)

        # KG-разбивка
        g = self.grab(fx, r'vereinfacht (\d+)/(\d+)/(\d+)', F, 'фикстура: доли KG')
        s3, s4, s7 = (de(g.group(i)) / 100 for i in range(1, 4))
        self.eq(F, 'доли KG дают 100 %', s3 + s4 + s7, D('1'))
        g = self.grab(fx, r'KG 300 `([\d.,]+)` → ≈ `([\d.,]+)` · KG 400 `([\d.,]+)` → ≈ `([\d.,]+)` · KG 700 `([\d.,]+)` → ≈ `([\d.,]+)`', F, 'фикстура: строки KG')
        kg3, kg3d, kg4, kg4d, kg7, kg7d = (de(g.group(i)) for i in range(1, 7))
        self.eq(F, 'KG 300 точное', kg3, A * s3)
        self.eq(F, 'KG 400 точное', kg4, A * s4)
        self.eq(F, 'KG 700 точное', kg7, A * s7)
        self.eq(F, 'KG сумма = итог', kg3 + kg4 + kg7, A)
        for d, e, n in ((kg3d, kg3, '300'), (kg4d, kg4, '400'), (kg7d, kg7, '700')):
            self.eq(F, f'KG {n} отображение', d, r1000(e))

        # удельные Haus A
        def rate(pattern, num, den, has2dp=True):
            m = self.grab(fx, pattern, F, f'фикстура: удельная {pattern[:40]}')
            disp = de(m.group(1))
            self.eq(F, f'числитель удельной ({pattern[:30]})', de(m.group(2)), num)
            self.eq(F, f'знаменатель удельной ({pattern[:30]})', de(m.group(3)), den)
            if has2dp:
                self.eq(F, f'точное 2dp ({pattern[:30]})', de(m.group(4)), r2(num / den))
            self.eq(F, f'отображение удельной ({pattern[:30]})', disp, r1(num / den))
        rate(r'`≈\s*([\d.,]+)\s*€/m² WFL nach WoFlV`\s*—\s*`([\d.,]+)\s*/\s*([\d.,]+)`\s*=\s*([\d.,]+)', A, wfl)
        rate(r'`≈\s*([\d.,]+)\s*€/m² BGF R\+S`\s*—\s*`([\d.,]+)\s*/\s*([\d.,]+)`\s*=\s*([\d.,]+)', A, rs_a)
        rate(r'`≈\s*([\d.,]+)\s*€/m² BGF oberirdisch`\s*—\s*`([\d.,]+)\s*/\s*([\d.,]+)`\s*=\s*([\d.,]+)', A, bgf_a)
        m = self.grab(fx, r'`≈\s*([\d.,]+)\s*€ je Wohneinheit`\s*—\s*`([\d.,]+)\s*/\s*(\d+)`', F, 'фикстура: € je WE')
        self.eq(F, '€ je WE входы', (de(m.group(2)), de(m.group(3))), (A, we))
        self.eq(F, '€ je WE отображение', de(m.group(1)), r1(A / we))

        # Regionalfaktor: «дал бы ≈ X € на блок Bauwerk»
        m = self.grab(fx, r'Regionalfaktor `Musterland` ([\d,]+)[^\n]*дал бы ≈\s*([\d.,]+)\s*€', F, 'фикстура: строка Regionalfaktor')
        reg = de(m.group(1))
        self.eq(F, 'эффект Regionalfaktor', de(m.group(2)), r1000(A * (reg - 1)))

        # EH 40
        m = self.grab(fx, r'`([\d.,]+)\s*×\s*([\d,]+)\s*\+\s*([\d.,]+)\s*=\s*([\d.,]+)`\s*→\s*≈\s*`([\d.,]+)\s*€`\s*·\s*дельта к Basis `\+\s*([\d.,]+)`\s*→\s*≈\s*\*\*\+\s*([\d.,]+)\s*€\s*\(\+\s*([\d.,]+)\s*%\)\*\*\s*·\s*`≈\s*([\d.,]+)\s*€/m² WFL(?: nach WoFlV)?`', F, 'фикстура: строка EH 40')
        sub, f40, add, tot40 = de(m.group(1)), de(m.group(2)), de(m.group(3)), de(m.group(4))
        self.eq(F, 'EH40: база = Basis×GK5', sub, basis * gk5_fx)
        self.eq(F, 'EH40: фактор = каталожному', f40, eh40_fx)
        self.eq(F, 'EH40: добавка = UG', add, ug_add)
        self.eq(F, 'EH40: произведение', tot40, sub * f40 + add)
        self.eq(F, 'EH40: отображение', de(m.group(5)), r1000(tot40))
        self.eq(F, 'EH40: точная дельта', de(m.group(6)), tot40 - A)
        self.eq(F, 'EH40: отображение дельты', de(m.group(7)), r1000(tot40 - A))
        self.eq(F, 'EH40: процент дельты', de(m.group(8)), r2((tot40 - A) / A * 100))
        self.eq(F, 'EH40: €/m² WFL', de(m.group(9)), r1(tot40 / wfl))
        m = self.grab(fx, r'KG точные: `([\d.,]+)\s*/\s*([\d.,]+)\s*/\s*([\d.,]+)`', F, 'фикстура: KG EH40')
        self.eq(F, 'EH40 KG 300', de(m.group(1)), tot40 * s3)
        self.eq(F, 'EH40 KG 400', de(m.group(2)), tot40 * s4)
        self.eq(F, 'EH40 KG 700', de(m.group(3)), tot40 * s7)

        # Ohne UG
        m = self.grab(fx, r'`([\d.,]+)\s*[−-]\s*([\d.,]+)\s*=\s*([\d.,]+)`\s*→\s*≈\s*`([\d.,]+)\s*€`\s*·\s*дельта \*\*[−-]\s*([\d.,]+)\s*€\*\*\s*·\s*`≈\s*([\d.,]+)\s*€/m² WFL(?: nach WoFlV)?`', F, 'фикстура: строка Ohne UG')
        self.eq(F, 'OhneUG: уменьшаемое = итог A', de(m.group(1)), A)
        self.eq(F, 'OhneUG: вычитаемое = вклад UG', de(m.group(2)), ug_add)
        noug = de(m.group(3))
        self.eq(F, 'OhneUG: разность', noug, A - ug_add)
        self.eq(F, 'OhneUG: отображение', de(m.group(4)), r1000(noug))
        self.eq(F, 'OhneUG: дельта', de(m.group(5)), ug_add)
        self.eq(F, 'OhneUG: €/m² WFL', de(m.group(6)), r1(noug / wfl))

        # Haus B
        m = self.grab(fx, r'`([\d.,]+)\s*×\s*([\d.]+)\s*×\s*([\d,]+)\s*\(Form Büro\)\s*×\s*([\d,]+)\s*\(GK 4\)\s*×\s*([\d,]+)\s*\(EH 55\)\s*=\s*([\d.,]+)`\s*→\s*≈\s*\*\*([\d.,]+)\s*€\*\*', F, 'фикстура: строка Haus B')
        ins = (de(m.group(1)), de(m.group(2)), de(m.group(3)), de(m.group(4)), de(m.group(5)))
        self.eq(F, 'Haus B: входы = каталогу', ins, (bgf_b, k_fx, buero_fx, gk4_fx, eh55_fx))
        B = de(m.group(6))
        self.eq(F, 'Haus B: произведение', B, bgf_b * k_fx * buero_fx * gk4_fx * eh55_fx)
        self.eq(F, 'Haus B: отображение', de(m.group(7)), r1000(B))
        rate(r'`≈\s*([\d.,]+)\s*€/m² NUF nach DIN 277`\s*—\s*`([\d.,]+)\s*/\s*([\d.,]+)`\s*=\s*([\d.,]+)', B, nuf)
        # Строк «€/m² BGF oberirdisch» в фикстуре две — Haus A и Haus B.
        # Прежде выбор нужной делался условием `if числитель == B:` — при порче
        # числителя проверка молча пропускалась вместо провала (нарушение
        # принципа 1 и 6). Теперь строка выбирается ПОЗИЦИЕЙ (последняя),
        # а числитель сверяется безусловно.
        rx_ober = re.compile(r'`≈\s*([\d.,]+)\s*€/m² BGF oberirdisch`\s*—\s*'
                             r'`([\d.,]+)\s*/\s*([\d.,]+)`\s*=\s*([\d.,]+)\n')
        ober_rows = list(rx_ober.finditer(fx))
        if len(ober_rows) < 2:
            self.fail(F, 'фикстура: €/m² BGF Haus B',
                      f'[вакуум] ожидались две строки «€/m² BGF oberirdisch» '
                      f'(Haus A и Haus B), найдено {len(ober_rows)}')
        else:
            m = ober_rows[-1]
            self.eq(F, 'Haus B €/m² BGF: числитель', de(m.group(2)), B)
            self.eq(F, 'Haus B €/m² BGF: знаменатель', de(m.group(3)), bgf_b)
            self.eq(F, 'Haus B €/m² BGF: 2dp', de(m.group(4)), r2(B / bgf_b))
            self.eq(F, 'Haus B €/m² BGF: отображение', de(m.group(1)), r1(B / bgf_b))

        # Komplex
        m = self.grab(fx, r'\|\s*Zwischensumme der kalkulierten Positionen\s*\|\s*([\d.,]+)\s*\|\s*≈\s*([\d.,]+)\s*€\s*\|', F, 'фикстура: итог Komplex')
        G = de(m.group(1))
        self.eq(F, 'Komplex = A + B', G, A + B)
        self.eq(F, 'Komplex отображение', de(m.group(2)), r1000(G))
        m = self.grab(fx, r'\|\s*Σ BGF \*\*oberirdisch\*\*\s*\|\s*([\d.,]+)\s*m²', F, 'фикстура: Σ BGF ober')
        sum_ober = de(m.group(1))
        self.eq(F, 'Σ BGF ober = A + B', sum_ober, bgf_a + bgf_b)
        m = self.grab(fx, r'\|\s*Σ BGF \*\*R\+S\*\*[^|]*\|\s*([\d.,]+)\s*m²', F, 'фикстура: Σ BGF R+S')
        sum_rs = de(m.group(1))
        self.eq(F, 'Σ BGF R+S', sum_rs, rs_a + rs_b)
        m = self.grab(fx, r'\*\*≈\s*([\d.,]+)\s*€/m² BGF oberirdisch\*\*[^|]*\|\s*([\d.,]+)\s*/\s*([\d.,]+)\s*=\s*([\d.,]+)\s*\|', F, 'фикстура: клиентская база Komplex')
        self.eq(F, 'Komplex €/m² ober: числитель', de(m.group(2)), G)
        self.eq(F, 'Komplex €/m² ober: знаменатель', de(m.group(3)), sum_ober)
        self.eq(F, 'Komplex €/m² ober: 2dp', de(m.group(4)), r2(G / sum_ober))
        self.eq(F, 'Komplex €/m² ober: отображение', de(m.group(1)), r1(G / sum_ober))
        m = self.grab(fx, r'`≈\s*([\d.,]+)\s*€/m² BGF R\+S`[^|]*\|\s*([\d.,]+)\s*/\s*([\d.,]+)\s*=\s*([\d.,]+)\s*\|', F, 'фикстура: вторичная ставка Komplex')
        self.eq(F, 'Komplex €/m² R+S: числитель', de(m.group(2)), G)
        self.eq(F, 'Komplex €/m² R+S: знаменатель', de(m.group(3)), sum_rs)
        self.eq(F, 'Komplex €/m² R+S: 2dp', de(m.group(4)), r2(G / sum_rs))
        self.eq(F, 'Komplex €/m² R+S: отображение', de(m.group(1)), r1(G / sum_rs))
        m = self.grab(fx, r'Interne Bezugsgröße[^|]*\|\s*([\d.,]+)\s*m²[^|·]*·\s*([\d.,]+)\s*/\s*([\d.,]+)\s*=\s*\*\*([\d.,]+)\*\*\s*\|\s*≈\s*([\d.,]+)\s*€/m²', F, 'фикстура: Interne Bezugsgröße')
        ib = de(m.group(1))
        self.eq(F, 'Interne Bezugsgröße = WFL + NUF', ib, wfl + nuf)
        self.eq(F, 'Interne: числитель', de(m.group(2)), G)
        self.eq(F, 'Interne: знаменатель', de(m.group(3)), ib)
        self.eq(F, 'Interne: 2dp', de(m.group(4)), r2(G / ib))
        self.eq(F, 'Interne: отображение', de(m.group(5)), r1(G / ib))

        # скидка
        rab = de(self.grab(fx, r'Rabatt\s*([\d,]+)\s*%', F, 'фикстура: ставка Rabatt').group(1))
        m = self.grab(fx, r'`([\d.,]+)\s*×\s*([\d,]+)\s*=\s*([\d.,]+)`\s*→\s*отображение\s*`≈\s*([\d.,]+)\s*€`[^\n]*exakter Rechenwert\s*([\d.,]+)\s*€', F, 'фикстура: строка скидки')
        self.eq(F, 'скидка: база = точный итог A', de(m.group(1)), A)
        self.eq(F, 'скидка: множитель = 1 − Rabatt', de(m.group(2)), 1 - rab / 100)
        exact = de(m.group(3))
        self.eq(F, 'скидка: произведение', exact, A * (1 - rab / 100))
        self.eq(F, 'скидка: отображение', de(m.group(4)), r1000(exact))
        self.eq(F, 'скидка: exakter Rechenwert совпадает', de(m.group(5)), exact)

        # сроки — один ScheduleModel
        m = self.grab(fx, r'\|\s*Planung\s*\|[^|]*\|[^|]*\|\s*([\d,]+)\s*Monate', S, 'фикстура: строка Planung')
        planung = de(m.group(1))
        self.eq(S, 'Planung = planung(n) из спеки', planung, plan_sp)
        m = self.grab(fx, r'\|\s*Haus A\s*\|[^|]*\|[^|]*\|\s*([\d,]+)\s*Monate ab OKBP\s*\|\s*`\(5 \+ ([\d.,]+)/([\d.,]+)\)\s*×\s*([\d,]+)\s*\(Form MFH\)\s*×\s*([\d,]+)\s*\(GK 5 Zeit\)`\s*=\s*([\d,]+)\s*→\s*([\d,]+)', S, 'фикстура: Bauzeit Haus A')
        d_a = de(m.group(1))
        raw = (5 + de(m.group(2)) / de(m.group(3))) * de(m.group(4)) * de(m.group(5))
        self.eq(S, 'Haus A: формула использует каталожные факторы', (de(m.group(4)), de(m.group(5))), (mfhz_fx, gk5z_fx))
        self.eq(S, 'Haus A: BGF-числитель формулы', de(m.group(2)), bgf_a - 1000)
        self.eq(S, 'Haus A: сырой срок 3dp', de(m.group(6)), r3(raw))
        self.eq(S, 'Haus A: округление к 0,5', de(m.group(7)), r05(raw))
        self.eq(S, 'Haus A: отображаемая длительность', d_a, r05(raw))
        m = self.grab(fx, r'\|\s*Haus B\s*\|[^|]*\|[^|]*\|\s*([\d,]+)\s*Monate ab OKBP\s*\|\s*`\(5 \+ ([\d.,]+)/([\d.,]+)\)\s*×\s*([\d,]+)\s*\(Form Büro\)\s*×\s*([\d,]+)\s*\(GK 4 Zeit\)`\s*=\s*([\d,]+)\s*→\s*([\d,]+)[^|]*Staffelstart \+ (\d+)', S, 'фикстура: Bauzeit Haus B')
        d_b = de(m.group(1))
        raw_b = (5 + de(m.group(2)) / de(m.group(3))) * de(m.group(4)) * de(m.group(5))
        self.eq(S, 'Haus B: формула использует каталожные факторы', (de(m.group(4)), de(m.group(5))), (bueroz_fx, gk4z_fx))
        self.eq(S, 'Haus B: BGF-числитель формулы', de(m.group(2)), bgf_b - 1000)
        self.eq(S, 'Haus B: сырой срок 3dp', de(m.group(6)), r3(raw_b))
        self.eq(S, 'Haus B: округление к 0,5', de(m.group(7)), r05(raw_b))
        self.eq(S, 'Haus B: отображаемая длительность', d_b, r05(raw_b))
        stag = de(m.group(8))
        self.eq(S, 'Staffelstart = stagger(n) из спеки', stag, stag_sp)
        m = self.grab(fx, r'\|\s*\*\*Projekt\*\*\s*\|[^|]*\|[^|]*\|\s*\*\*([\d,]+)\s*Monate\*\*', S, 'фикстура: строка Projekt')
        self.eq(S, 'Projekt = max(start+dauer)', de(m.group(1)),
                max(planung + d_a, planung + stag + d_b))

        # неопределённость в процентных пунктах
        pts = re.findall(r'\|\s*`±\s*(\d+)\s*%`\s*\|', fx)
        deltas = re.findall(r'`[−-](\d+)`\s*процентн', fx)
        if len(pts) < 3 or len(deltas) < 2:
            self.fail(U, 'фикстура', '[вакуум] таблица Schätzunsicherheit не распознана')
        else:
            u = [D(p) for p in pts[:3]]
            d = [D(x) for x in deltas[:2]]
            self.eq(U, 'сужение шаг 1', u[0] - d[0], u[1])
            self.eq(U, 'сужение шаг 2', u[1] - d[1], u[2])
            # безусловно: отсутствие строки «Итого» — вакуум, не пропуск
            m = self.grab(fx, r'Итого `[−-](\d+)`', U, 'фикстура: итоговое сужение')
            self.eq(U, 'итоговое сужение', D(m.group(1)), u[0] - u[2])

        # ── публикация фикстурных величин для сверки ЦИТАТ в других файлах ──
        # До v4 инструмент разбирал арифметику ВНУТРИ `synthetic-fixtures.md`
        # и не проверял, что `README.md` и `output-model.md` цитируют её верно.
        # Прошли: скидка от округлённой базы и несводимый тотал `≈ 5.900.000 €`.
        # Множества строятся ИЗ фикстуры (не из констант инструмента), поэтому
        # правка фикстуры автоматически перестраивает допустимый набор.
        exact_set = {basis, gk_add, eh_add, ug_add, A, kg3, kg4, kg7,
                     tot40, tot40 - A, noug, A - noug, B, G, exact,
                     A - exact, r1000(A * (reg - 1))}
        disp = {r1000(x) for x in exact_set} | {r1(x) for x in exact_set}
        disp |= {D('1000'), kg3d + kg4d + kg7d}
        # Удельные: пары (числитель, знаменатель) — ровно те, что использует
        # фикстура. Знаменатель обязан называть норматив, поэтому пары именные.
        pairs = [(A, wfl), (A, rs_a), (A, bgf_a), (A, we), (tot40, wfl), (noug, wfl),
                 (B, nuf), (B, bgf_b), (G, sum_ober), (G, sum_rs), (G, ib)]
        rates = {r1(n / d) for n, d in pairs} | {r2(n / d) for n, d in pairs}
        rates |= {k_fx, ug_rate, ug_a, ug_b}          # ставки каталога
        # Дельта удельной величины при одном знаменателе (WFL) — законный
        # спесимен `rateDelta`; считается от точных 2dp, как требует CALC-007.
        wfl_rates = [r2(x / wfl) for x in (A, tot40, noug)]
        for a_ in wfl_rates:
            for b_ in wfl_rates:
                if a_ == b_:
                    continue
                rates |= {r1(abs(a_ - b_)), r2(abs(a_ - b_))}
        # та же дельта, посчитанная как «дельта денег / знаменатель» — обе
        # формы законны и обе встречаются в контрактах (`476.000 / 1.500,00`)
        for d_ in (tot40 - A, A - noug, ug_add, gk_add, eh_add):
            rates |= {r1(abs(d_) / wfl), r2(abs(d_) / wfl)}
        areas = {wfl, nuf, bgf_a, bgf_b, rs_a, rs_b, ug_area, sum_ober, sum_rs, ib}
        self.fx = {
            'exact': exact_set, 'disp': disp, 'rates': rates, 'areas': areas,
            'A': A, 'B': B, 'G': G, 'wfl': wfl, 'nuf': nuf, 'ib': ib,
            'bgf_a': bgf_a, 'bgf_b': bgf_b, 'rs_a': rs_a, 'rs_b': rs_b,
            'sum_ober': sum_ober, 'sum_rs': sum_rs, 'rabatt': rab,
            'discount_exact': exact,
        }
        # Публикация стоит ВЫШЕ контрольного примера §6 намеренно: `grab` там
        # умеет бросить `Vacuum`, и при прежнем порядке одна изменившаяся
        # формулировка в calculation-spec обнуляла бы сверку спесименов в двух
        # других файлах — молча, вакуумом вместо находки.

        # ── контрольный пример calculation-spec §6 (Referenzprojekt R-01) ────
        # Разбор СТРУКТУРНЫЙ, не по формулировке. Прежняя редакция ждала
        # `= **<число> €`; вердикт аудитора по CALC-007 добавил в ту же строку
        # точное значение и префикс (`= точно 3.681.809,272225, показ
        # **≈ 3.682.000 € нетто**`) — и сверка ДЕНЕГ перестала выполняться
        # целиком: `grab` бросал вакуум, `self.fx` не строился, и два самых
        # дорогих класса (`RM-FIXTURE`, `OUT-MONEY`) печатали «не смог
        # проверить» вместо сверки. Это второй случай за сессию: привязка
        # к словам вместо привязки к структуре.
        # Структура, на которую можно опираться: цепочка множителей, знак `=`,
        # затем одно или два числа, последнее из которых стоит перед `€`.
        # Слова «точно», «показ», «нетто», их порядок и разметка не участвуют.
        row = self.grab(sp, r'^\|\s*Referenzprojekt R-01\s*\|([^\n]*)$', 'CALC-SPEC',
                        'спека: строка Referenzprojekt R-01', re.M).group(1)
        mf = self.grab(row, r'([\d.,]+)\s*×\s*([\d.,]+)\s*×\s*([\d,]+)\s*×\s*([\d,]+)\s*\+\s*'
                            r'([\d.,]+)\s*×\s*([\d.,]+)\s*=',
                       'CALC-SPEC', 'спека: формула Bauwerk в R-01')
        f = [de(mf.group(i)) for i in range(1, 7)]
        bauwerk = f[0] * f[1] * f[2] * f[3] + f[4] * f[5]
        self.eq('CALC-SPEC', 'R-01: факторы каталожные', (f[1], f[2], f[3], f[5]),
                (k_sp, gk5_sp, eh55_sp, ugv_sp + tg_sp))
        self._pair_after('CALC-SPEC', 'R-01: Bauwerk', row[mf.end():], bauwerk)
        mb = self.grab(row, r'Berlin\s*([\d,]+)', 'CALC-SPEC', 'спека: регфактор Berlin в R-01')
        self._pair_after('CALC-SPEC', 'R-01: эффект регфактора', row[mb.end():],
                         bauwerk * (de(mb.group(1)) - 1))
        # Срок: структура — база `5 + (BGF − 1.000)/N`, множители через `×`,
        # сырое значение после `=`, целая подпись перед `Monate`.
        mz = self.grab(row, r'Bauzeit:([^|]*?)(\d+(?:,\d+)?)\s*[  ]?Monate',
                       'CALC-SPEC', 'спека: Bauzeit R-01')
        seg, label = mz.group(1), de(mz.group(2))
        m2 = self.grab(seg, r'5\s*\+\s*\(?\s*([\d.,]+)\s*[−–-]\s*([\d.,]+)\s*\)?\s*/\s*([\d.,]+)',
                       'CALC-SPEC', 'спека: база срока R-01')
        facs = [de(x) for x in re.findall(r'×\s*([\d,]+)', seg)]
        if not facs:
            self.fail('CALC-SPEC', 'спека: Bauzeit R-01',
                      '[вакуум] в формуле срока R-01 нет ни одного множителя `× N`')
            facs = [D('1')]
        raw_z = 5 + (de(m2.group(1)) - de(m2.group(2))) / de(m2.group(3))
        for x in facs:
            raw_z *= x
        self.eq('CALC-SPEC', 'R-01: BGF в формуле срока = BGF расчёта', de(m2.group(1)), f[0])
        if gk5z_sp not in facs:
            self.fail('CALC-SPEC', 'спека: Bauzeit R-01',
                      f'формула срока R-01 использует множители {facs}; каталожного фактора '
                      f'GK 5 ({gk5z_sp}) среди них нет')
        mr = re.search(r'=\s*([\d,]+)', seg)
        if not mr:
            self.fail('CALC-SPEC', 'спека: Bauzeit R-01',
                      '[вакуум] сырое значение срока R-01 (после `=`) не найдено')
        elif abs(de(mr.group(1)) - raw_z) >= D('0.000001'):
            self.fail('CALC-SPEC', 'спека: Bauzeit R-01',
                      f'сырой срок записан {mr.group(1)}, формула даёт {raw_z}')
        self.eq('CALC-SPEC', 'R-01: округление к 0,5 и целая подпись (D-17)',
                label, r05(raw_z))

    # -- 8. Индексы в шапках документов (tools/check_indices.py) --------------
    def check_index(self):
        """Гейт устаревших индексов. Вызов реален, а не заявлен в докстринге.

        `check_indices.py` до v3 утверждал «Вызывается из tools/verify.py»,
        при том что `grep check_indices tools/verify.py` давал ноль.
        """
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                '_all3_check_indices', pathlib.Path(__file__).resolve().parent / 'check_indices.py')
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            findings = mod.run(self.root)
        except Exception as exc:                       # инструмент сломан
            self.fail('INDEX', 'tools/check_indices.py',
                      f'гейт индексов не выполнен — инструмент сломан: {exc!r}')
            return
        for rel, lineno, msg in findings:
            text = self.read(rel) or ''
            rows = text.split('\n')
            line = rows[lineno - 1] if 0 < lineno <= len(rows) else ''
            self.emit('INDEX', rel, lineno, line, msg)

    # -- 9. Честность самого инструмента --------------------------------------
    def check_tool_registry(self):
        src = pathlib.Path(__file__).resolve().read_text(encoding='utf-8')
        declared = set(CHECK_CLASSES)
        if len(declared) != len(CHECK_CLASSES):
            self.fail('TOOL-REGISTRY', 'CHECK_CLASSES', 'реестр содержит дубликаты имён')
        for cls in sorted(self._classes):
            if cls not in declared:
                self.fail('TOOL-REGISTRY', 'CHECK_CLASSES',
                          f'класс «{cls}» зарегистрировал вывод, но не объявлен в CHECK_CLASSES')
        body = src.split('CHECK_CLASSES = (', 1)[-1].split(')\n', 1)[-1]
        for cls in declared:
            if f"'{cls}'" not in body and f'"{cls}"' not in body:
                self.fail('TOOL-REGISTRY', 'CHECK_CLASSES',
                          f'класс «{cls}» объявлен в реестре, но нигде не используется')

    # -- запуск ----------------------------------------------------------------
    def run(self):
        self.check_tokens()
        self.check_css()
        self.check_contrast()
        self.check_gates()
        self.check_r24_prose()
        self.check_units()
        self.check_readme()
        self.check_copy()
        self.check_controls()
        self.check_data_model()
        self.check_annahmen()
        self.check_governance()
        self.check_plan()
        self.check_privacy()
        # Арифметика идёт ПЕРЕД проверками цитат: она публикует величины
        # фикстуры, с которыми сводятся спесимены README и output-model.
        self.check_arithmetic()
        self.check_output_model()
        self.check_readme_contracts()
        self.check_readme_numbers()
        self.check_index()
        # ALLOW подавляет по МЕСТУ, а не по содержанию: дословный дубль
        # allow-строки, дописанный как новое нарушение, подавлялся бы той же
        # записью. Запись, сработавшая больше одного раза, — нарушение.
        for key, n in sorted(self._used_allow.items()):
            if n > 1:
                self.fail('ALLOW-DUP', f'{key[0]}',
                          f'ALLOW-запись {key[1]}/{key[2]} подавила {n} РАЗНЫХ строк '
                          f'(строки {sorted(self._allow_hits[key])}) — исключение выдано одной строке, '
                          f'а не содержимому; дубль обязан быть виден')
        for key, n in sorted(self._used_known.items()):
            if n > 1:
                self.fail('ALLOW-DUP', f'{key[0]}',
                          f'KNOWN_OPEN-запись {key[1]}/{key[2]} покрыла {n} РАЗНЫХ строк '
                          f'(строки {sorted(self._known_hits[key])}) — регистрация выдана одной строке')
        # неиспользованные записи реестров — предупреждение (уборка)
        for key in ALLOW:
            if key not in self._used_allow and (self.root / key[0]).exists():
                self.warn.append(f'allowlist-запись не сработала (строка изменилась/исчезла?): {key}')
        for key in KNOWN_OPEN:
            if key not in self._used_known and (self.root / key[0]).exists():
                self.warn.append(f'KNOWN_OPEN-запись не сработала (нарушение исправлено?): {key}')
        for key in KNOWN_OPEN_FILE:
            if key not in self._used_known_file and (self.root / key[0]).exists():
                self.warn.append(f'KNOWN_OPEN_FILE-запись не сработала (класс закрыт в файле?): {key}')
        for (rel, cls), n in sorted(self._quoted.items()):
            self.warn.append(f'цитата норматива по построению: {rel} · {cls} · {n} строк '
                             f'вида «| <ID> | …» — {EXTRACTED_SOURCES[rel]}')
        for cls in KNOWN_OPEN_CLASS:
            if cls not in self._used_known_class:
                self.warn.append(f'KNOWN_OPEN_CLASS-запись не сработала (класс закрыт целиком?): {cls}')
        self.check_tool_registry()
        return self


# ───────────────────────── selftest ─────────────────────────────────────────

def _bump_control_total(text: str) -> str:
    """Порча контрольного итога §6 независимо от разделителей разрядов."""
    new, n = re.subn(r'(=\s*\*\*)3([\s.\u00a0\u202f]?)682([\s.\u00a0\u202f]?)000',
                     r'\g<1>3\g<2>692\g<3>000', text, count=1)
    if not n:
        raise AssertionError('контрольный итог 3 682 000 не найден')
    return new


def _bump_nuf_rate(text: str) -> str:
    """Порча удельной ставки NUF независимо от пробела перед знаком евро."""
    new, n = re.subn(r'≈\s*2\.089(\s*)€/m² NUF', r'≈ 2.189\g<1>€/m² NUF', text, count=1)
    if not n:
        raise AssertionError('ставка 2.089 €/m² NUF не найдена')
    return new



def _sub(pattern, repl, flags=0, count=1):
    """Мутация регуляркой. Существует потому, что `output-model.md` и README
    переписываются другими владельцами параллельно: мутация, привязанная к
    дословной строке, становится «неприменимой» от переноса абзаца, и selftest
    молча терял бы класс. Неприменимость по-прежнему валит selftest —
    но теперь только когда исчезла сама КОНСТРУКЦИЯ, а не её вёрстка."""
    def go(text: str) -> str:
        new, n = re.subn(pattern, repl, text, count=count, flags=flags)
        if not n:
            raise AssertionError(f'конструкция не найдена: {pattern[:60]}')
        return new
    return go


def _drop_line(pattern, flags=0):
    """Удаление первой строки, подходящей под шаблон (снятие условия/поля)."""
    def go(text: str) -> str:
        rows = text.split('\n')
        rx = re.compile(pattern, flags)
        for i, line in enumerate(rows):
            if rx.search(line):
                return '\n'.join(rows[:i] + rows[i + 1:])
        raise AssertionError(f'строка не найдена: {pattern[:60]}')
    return go


def _insert_contract(text: str) -> str:
    """Вставка контракта с денежным спесименом без провенанса перед §2.7."""
    marker = '### 2.7'
    if marker not in text:
        raise AssertionError('раздел §2.7 не найден — границы §2.6 неизвестны')
    block = (
        '### DC-99 · `LeakMetricTile` — Leck-Kachel\n\n'
        '**Анатомия:** `root` → `value`.\n\n'
        '**Состояния — взаимодействие:** `default` · `hover` · `focus` · `pressed` ·\n'
        '`selected` — notApplicableReason: плитка не является выбором из набора ·\n'
        '`disabled` / `readOnly` — notApplicableReason: плитка ничего не редактирует.\n\n'
        '**Состояния — данные:**\n'
        '`loading` — считается · `empty` — данных нет · `partial` — часть входов ·\n'
        '`ready` — готово: `≈ 3.818.000 €` · `error` — упало · `stale` — устарело ·\n'
        '`permission` — роли недоступно.\n\n'
        '**Токены:** `--color-text-primary`.\n\n---\n\n')
    return text.replace(marker, block + marker, 1)


def _dup_allowed_line(text: str) -> str:
    """Дословный дубль строки, исключённой ALLOW, дописанный как новый пункт.

    Аудитор показал: ALLOW подавлял по содержанию строки, поэтому дубль
    исключённой строки подавлялся той же записью. Мутация воспроизводит это
    буквально — берётся первая же строка файла, чей отпечаток есть в ALLOW.
    """
    rows = text.split('\n')
    for line in rows:
        for (rel, cls, h) in ALLOW:
            if rel.endswith('remediation-plan.md') and fp(line) == h and line.strip():
                return text + '\n' + line + '\n'
    raise AssertionError('в файле не найдено ни одной ALLOW-строки для дубля')



MUTATIONS = [
    # (описание, файл, старое → новое ИЛИ append, ожидаемые классы (любой из))
    ('R-01/R-02: сырой hex в action-токене', 'design-system/tokens.css',
     ('--color-action-primary-bg:     var(--primitive-color-orange-700);',
      '--color-action-primary-bg:     #FD5E00;'), {'R-02', 'TOKEN-LAYER'}),
    ('R-01: selection → бренд-оранжевый через var()', 'design-system/tokens.css',
     ('--color-selection-border: var(--primitive-color-orange-700);',
      '--color-selection-border: var(--primitive-color-brand-orange-500);'), {'R-01', 'R-03'}),
    ('R-03: подмена focus-ring', 'design-system/tokens.css',
     ('--color-focus-ring:       var(--primitive-color-blue-focus-700);',
      '--color-focus-ring:       var(--primitive-color-blue-500);'), {'R-03'}),
    ('R-24: порча --type-body-line 24 → 21', 'design-system/tokens.css',
     ('--type-body-line:   24px', '--type-body-line:   21px'), {'R-24'}),
    ('TOKEN-LAYER: литеральный rgba в semantic', 'design-system/tokens.css',
     ('--color-surface-overlay:  var(--primitive-color-neutral-950-a48);',
      '--color-surface-overlay:  rgba(31, 31, 31, .48);'), {'TOKEN-LAYER'}),
    ('LAYOUT-003: контейнер 1600', 'design-system/tokens.css',
     ('--content-max-width: 1200px;', '--content-max-width: 1600px;'), {'LAYOUT-003'}),
    ('TOKEN-REF: висячий токен в README', 'design-system/README.md',
     'Компонент использует `--motion-standard` для входа.', {'TOKEN-REF'}),
    ('R-24: герой набран 48/56', 'design-system/README.md',
     '| €/m² WFL | 48/56 Bold | чёрный |', {'R-24'}),
    ('R-24-CAPTION: русская формулировка', 'design-system/README.md',
     'подпись источника — caption 12/16 Regular.', {'R-24-CAPTION'}),
    ('DATA-005: живое WFL inkl.', 'design-system/README.md',
     'Карточка zeigt WFL inkl. Gemeinschaftsflächen.', {'DATA-005'}),
    ('R-18: голый Gesamt netto', 'design-system/README.md',
     'Заголовок столбца: Gesamt netto (ohne Scope).', {'R-18'}),
    ('LAYOUT-007: немецкое написание Präsentation', 'design-system/README.md',
     'В **Präsentation** плотность только comfortable.', {'LAYOUT-007'}),
    ('XSC-10: KfW 55 в UI-копии', 'design-system/README.md',
     'Beispiel: Energiestandard KfW 55 → EH 40.', {'XSC-10'}),
    ('COPY-004: Genauigkeit ±', 'design-system/README.md',
     'Badge zeigt Genauigkeit ±19 %.', {'COPY-004'}),
    ('COPY-007: ab Decke', 'design-system/README.md',
     'Scope: Leistungsbeginn ab Decke.', {'COPY-007'}),
    ('R-20: кольцо готовности', 'design-system/README.md',
     'На карточке — кольцо готовности 82 %.', {'R-20'}),
    ('R-01-PROSE: оранжевый как selected', 'design-system/README.md',
     'Плитка: selected бордер 2 px orange.', {'R-01-PROSE'}),
    ('R-09: одноклик вместо флоу', 'design-system/README.md',
     ('`Compose → Preflight → Confirm & Send → Delivery status`',
      'CTA «Senden» одним кликом'), {'R-09'}),
    ('CALC-014: label дельты удалён', 'design-system/README.md',
     ('Preisänderung gegenüber', 'Gesamtänderung gegenüber'), {'CALC-014'}),
    ('CALC-CATALOG: порча GK 4 в фикстуре', 'docs/audit/synthetic-fixtures.md',
     ('GK 4 = 1,00', 'GK 4 = 1,05'), {'CALC-CATALOG', 'CALC-FIXTURE'}),
    ('CALC-CATALOG: порча GK 4 в спеке', 'docs/product/calculation-spec.md',
     ('GK 4 1,00', 'GK 4 1,05'), {'CALC-CATALOG'}),
    ('CALC-SPEC: порча контрольного итога', 'docs/product/calculation-spec.md',
     _bump_control_total, {'CALC-SPEC'}),
    ('CALC-FIXTURE: порча ставки 2.089', 'docs/audit/synthetic-fixtures.md',
     _bump_nuf_rate, {'CALC-FIXTURE'}),
    ('CALC-FIXTURE: порча итога Haus A', 'docs/audit/synthetic-fixtures.md',
     ('**3.817.835,00**', '**3.817.935,00**'), {'CALC-FIXTURE'}),
    ('CALC-FIXTURE: порча KG 300', 'docs/audit/synthetic-fixtures.md',
     ('2.672.484,50', '2.673.484,50'), {'CALC-FIXTURE'}),
    ('CALC-FIXTURE: порча клиентской базы 1.820', 'docs/audit/synthetic-fixtures.md',
     ('= 1.819,67', '= 1.891,67'), {'CALC-FIXTURE'}),
    ('CALC-FIXTURE: порча базы скидки', 'docs/audit/synthetic-fixtures.md',
     ('× 0,97 = 3.703.299,95', '× 0,96 = 3.703.299,95'), {'CALC-FIXTURE'}),
    ('CALC-SCHEDULE: порча округления Bauzeit', 'docs/audit/synthetic-fixtures.md',
     ('= 7,283 → 7,5', '= 7,283 → 8,0'), {'CALC-SCHEDULE'}),
    ('CALC-SCHEDULE: порча каталога сроков', 'docs/audit/synthetic-fixtures.md',
     ('GK 5 = 1,15', 'GK 5 = 1,10'), {'CALC-CATALOG', 'CALC-SCHEDULE'}),
    ('CALC-UNCERT: порча цепочки ±', 'docs/audit/synthetic-fixtures.md',
     ('| `± 17\u202f%` |', '| `± 16\u202f%` |'), {'CALC-UNCERT'}),
    ('PLAN: [x] с переносом в будущий батч', 'docs/audit/remediation-plan.md',
     '- [x] EMAIL-001 закрыт — отложено до Batch 9', {'PLAN'}),
    ('PLAN: [ ] с заявлением о выполнении', 'docs/audit/remediation-plan.md',
     '- [ ] Пересборка превью — выполнено', {'PLAN'}),
    ('PRIVACY: e-mail с гасителем .example в строке', 'design-system/README.md',
     'Kontakt: m.tester@' + _j('zbi', '.de') + ' (заменён на .example)', {'PRIVACY-001'}),
    ('PRIVACY: новый e-mail в отгружаемом HTML (карантин снят)', 'design-system/preview.html',
     '<div>x.new@' + _j('zbi', '.de') + '</div>', {'PRIVACY-001'}),

    # ─────────── v3: по одной мутации на каждую закрытую дыру ───────────
    # Группа 1 — сырой цвет и запрещённый CSS во ВСЁМ тексте, не только в
    # объявлении токена.
    ('CSS-COLOR: hex в теле правила', 'design-system/tokens.css',
     ('color: var(--color-text-display-accent);', 'color: #FD5E00;'), {'CSS-COLOR'}),
    ('CSS-COLOR: дописанный блок кнопки в tokens.css', 'design-system/tokens.css',
     '.btn-primary{background:#FD5E00;border:1px solid #E05400}', {'CSS-COLOR'}),
    ('CSS-COLOR: тот же блок в fenced-css внутри README', 'design-system/README.md',
     '```css\n.btn-primary{background:#FD5E00;border:1px solid #E05400}\n```', {'CSS-COLOR'}),
    ('CSS-RADIUS: скругление в правиле', 'design-system/tokens.css',
     '.card{border-radius:4px}', {'CSS-RADIUS'}),
    ('CSS-RADIUS: --radius ≠ 0', 'design-system/tokens.css',
     ('--radius: 0;', '--radius: 2px;'), {'CSS-RADIUS'}),
    ('CSS-GRADIENT: градиент', 'design-system/tokens.css',
     '.hero{background:linear-gradient(180deg,#FFFFFF,#E8ECE9)}', {'CSS-GRADIENT', 'CSS-COLOR'}),
    ('CSS-SHADOW: настоящая тень', 'design-system/tokens.css',
     '.panel{box-shadow:0 2px 8px rgba(0,0,0,.2)}', {'CSS-SHADOW'}),
    ('CSS-SPACING: px вне шкалы отступов', 'design-system/tokens.css',
     '.toolbar{padding:10px 18px}', {'CSS-SPACING'}),

    # Группа 2 — контраст вычисляется, а не переписывается.
    ('CONTRAST: подмена 3,10:1 → 4,55:1 в tokens.css', 'design-system/tokens.css',
     ('(белый): 3,10:1, проходит R-01.', '(белый): 4,55:1, проходит R-01.'), {'CONTRAST'}),
    ('CONTRAST: выдуманное разрешение оранжевого в README', 'design-system/README.md',
     '`#FD5E00` als Aktionsfarbe zulässig, Kontrast 4,60:1.', {'CONTRAST'}),
    ('CONTRAST: порча табличного значения в adr-blocking', 'docs/audit/adr-blocking.md',
     ('контраст ✓ 12,82:1 на белом', 'контраст ✓ 11,82:1 на белом'), {'CONTRAST'}),
    ('A11Y-ACCENT-BG: канва как фон документа', 'design-system/tokens.css',
     ('background: var(--color-surface-default); margin: 0;',
      'background: var(--color-surface-canvas); margin: 0;'), {'A11Y-ACCENT-BG'}),
    ('A11Y-ACCENT-BG: акцентный текст на канве в одном правиле', 'design-system/tokens.css',
     '.hero-accent{color:var(--color-text-display-accent);background:var(--color-surface-canvas)}',
     {'A11Y-ACCENT-BG'}),

    # Группа 3 — условная ветка вокруг сверки.
    ('CALC-FIXTURE: порча числителя Haus B (прежде ветка молча пропускала)',
     'docs/audit/synthetic-fixtures.md',
     ('`2.005.101 / 1.200,00` = 1.670,92', '`2.005.111 / 1.200,00` = 1.670,92'),
     {'CALC-FIXTURE'}),

    # Группа 4 — гейты требований, объявленных закрытыми.
    ('GATE-HIT: 44 → 32 в токене зоны нажатия', 'design-system/tokens.css',
     ('--size-hit-target-default:        44px;', '--size-hit-target-default:        32px;'),
     {'GATE-HIT'}),
    ('GATE-HIT: жёсткие 32×32 в .hit-target::before', 'design-system/tokens.css',
     ('width: var(--size-hit-target-default); height: var(--size-hit-target-default);',
      'width: 32px; height: 32px;'), {'GATE-HIT'}),
    ('GATE-R15: business state возвращён в токены', 'design-system/tokens.css',
     ('  --radius: 0;', '  --color-output-profile-client: var(--primitive-color-white);\n  --radius: 0;'),
     {'GATE-R15'}),
    ('GATE-R25: выдуманный component-слой', 'design-system/tokens.css',
     ('  --radius: 0;', '  --component-button-bg: var(--primitive-color-orange-700);\n  --radius: 0;'),
     {'GATE-R25'}),
    ('GATE-DENSITY: 52 → 32 в строке финансовых данных', 'design-system/tokens.css',
     ('--row-height-financial: 52px;', '--row-height-financial: 32px;'), {'GATE-DENSITY'}),
    ('GATE-MOTION: снят prefers-reduced-motion', 'design-system/tokens.css',
     ('@media (prefers-reduced-motion: reduce)', '@media (min-width: 1px)'), {'GATE-MOTION'}),
    ('GATE-FONT: font-family снят с html', 'design-system/tokens.css',
     ('html, body { font-family: var(--font-family); color: var(--color-text-primary); }',
      'body { font-family: var(--font-family); color: var(--color-text-primary); }'),
     {'GATE-FONT'}),
    ('GATE-FONT: font-family снят с элементов форм', 'design-system/tokens.css',
     ('input, select, textarea, button, kbd { font-family: var(--font-family); }',
      '/* форм-контролы наследуют сами */'), {'GATE-FONT'}),
    ('GATE-FONT: url() без кавычек', 'design-system/tokens.css',
     ("url('./fonts/visuelt-regular-pro.woff2')", 'url(./fonts/visuelt-regular-pro.woff2)'),
     {'GATE-FONT'}),
    ('GATE-FONT: font-display: swap вместо block', 'design-system/tokens.css',
     ('font-weight: 400; font-style: normal; font-display: block;',
      'font-weight: 400; font-style: normal; font-display: swap;'), {'GATE-FONT'}),

    # Группа 5 — PII как класс, а не как список известных значений.
    ('PII: полный набор класса в .md', 'docs/product/screen-map.md',
     'Kontakt: Dr. Klaus Bergmann · ' + _j('Wilhelm', 'straße') + ' 42, ' + _j('101', '17 Berlin')
     + ' · ' + _j('IBAN DE', '89370400440532013000') + ' · Tel. ' + _j('+49 ', '30 227-51234'),
     {'PRIVACY-001'}),
    ('PII: обфускация адреса скобками', 'docs/product/screen-map.md',
     'Kontakt: t.mueller ' + _j('[a', 't] ') + _j('zbi-immobilien', '.de'), {'PRIVACY-001'}),
    ('PII: тот же адрес в .css', 'design-system/tokens.css',
     '/* Ansprechpartner: ' + _j('Wilhelm', 'straße') + ' 42, ' + _j('101', '17 Berlin') + ' */',
     {'PRIVACY-001'}),
    ('PII: тот же адрес в .ts', 'design-system/contact.ts',
     "export const owner = '" + _j('Wilhelm', 'straße') + ' 42, ' + _j('101', '17 Berlin') + "';",
     {'PRIVACY-001'}),
    ('PII: тот же адрес в .svg', 'design-system/contact.svg',
     '<svg><text>' + _j('Wilhelm', 'straße') + ' 42, ' + _j('101', '17 Berlin') + '</text></svg>',
     {'PRIVACY-001'}),
    ('PII: production-домен без спесимена в списке', 'docs/product/screen-map.md',
     'Kontakt: t.mueller@' + _j('zbi-immobilien', '.de'), {'PRIVACY-001'}),
    ('RFC 2606 (негативная): example.org не является production-доменом',
     'docs/product/screen-map.md', 'Kontakt: k.bergmann@example.org', None),
    ('RFC 2606 (негативная): *.example не является production-доменом',
     'docs/product/screen-map.md', 'Kontakt: t.mueller@zbi.example', None),

    # Группа 6 — копирайт-детекторы против однословной правки.
    ('DATA-005: скобка вместо пробела', 'design-system/README.md',
     'Karte zeigt WFL **(**inkl. Gemeinschaftsflächen).', {'DATA-005'}),
    ('R-18: пустой scope после разделителя', 'design-system/README.md',
     'Spaltenkopf: Gesamt netto · ', {'R-18'}),
    ('XSC-10: дефис внутри термина программы', 'design-system/README.md',
     'Beispiel: Energiestandard KfW**-**55 im UI.', {'XSC-10'}),
    ('COPY-007: артикль внутри сокращения', 'design-system/README.md',
     'Scope: Leistungsbeginn ab **der** Decke.', {'COPY-007'}),
    ('COPY-004: предлог внутри термина', 'design-system/README.md',
     'Badge zeigt Genauigkeit **von** ± 19 %.', {'COPY-004'}),
    ('R-01-PROSE: оранжевый через имя токена, без слова orange', 'design-system/README.md',
     'Plättchen: selected — Rahmen 2 px in `--color-brand-accent`.', {'R-01-PROSE'}),
    ('LAYOUT-007: немецкое «ausschließlich»', 'design-system/README.md',
     'In der **Präsentation** ausschließlich Komfortabel.', {'LAYOUT-007'}),
    ('R-20: процент готовности без слова «кольцо»', 'design-system/README.md',
     'Karte zeigt Bereitschaft: 82 %.', {'R-20'}),

    # Группа 7 — ALLOW подавляет по месту, а не по содержанию.
    ('ALLOW-DUP: дословный дубль allow-строки как новый пункт', 'docs/audit/remediation-plan.md',
     _dup_allowed_line, {'ALLOW-DUP'}),

    # Группа 8 — пробелы гейта R-24.
    ('R-24: --type-input-line 24 → 20', 'design-system/tokens.css',
     ('--type-input-line:  24px', '--type-input-line:  20px'), {'R-24'}),
    ('R-24: --type-error-weight Medium → Regular', 'design-system/tokens.css',
     ('--type-error-weight:           var(--font-weight-medium);',
      '--type-error-weight:           var(--font-weight-regular);'), {'R-24'}),
    ('R-24: строки таблицы набраны caption', 'design-system/components-core.md',
     'Zeilen der Kostentabelle: 12/16 Regular.', {'R-24'}),
    ('R-24: кнопка набрана Bold', 'design-system/components-core.md',
     'Button primär 16/20 Bold.', {'R-24'}),
    ('R-24: инлайн-пара вне шкалы', 'design-system/components-core.md',
     'Stil: font-size:18px; line-height:26px;', {'R-24'}),

    # Новые классы, затребованные вердиктом по Batch 3.
    ('NBSP: обычный пробел между числом и единицей', 'design-system/README.md',
     'Beispiel: Gesamt 3.818.000 € netto.', {'NBSP'}, 'known'),
    ('CYRILLIC-UNIT: кириллическая м² в латинской единице', 'design-system/README.md',
     'Fläche: 120 м² WFL nach WoFlV.', {'CYRILLIC-UNIT'}),
    ('AREA-SCOPE: удельная ставка без норматива', 'design-system/README.md',
     'Leitkennzahl: 2.545 €/m² WFL.', {'AREA-SCOPE'}),
    ('DATE-FORMAT: дефисная дата', 'design-system/README.md',
     'Termin: 14-05-2027.', {'DATE-FORMAT'}),
    ('DATE-FORMAT: двузначный год', 'design-system/README.md',
     'Termin: 14.05.27.', {'DATE-FORMAT'}),
    ('R-18-LABEL: усечённый label итога', 'design-system/README.md',
     '| Zwischensumme | ≈ 3.818.000 € |', {'R-18-LABEL'}),
    ('R-18-LABEL (негативная): `Anteil an Zwischensumme` — корректный label',
     'design-system/README.md', '| Anteil an Zwischensumme | 12,5 % · 3.818.000 € |', None),
    ('check_copy в *.json: живая UI-строка `ab Decke`', 'docs/product/parameters-t0-t1.json',
     '{"_leak": {"de": "Bau ab Decke, im UG nur Ausbau"}}', {'COPY-007'}),

    # Индексы и честность инструмента.
    ('INDEX: устаревший диапазон решений в шапке', 'design-system/README.md',
     'Решения D-01…D-99 — полный список.', {'INDEX'}),

    # ─── дыры, найденные собственными мутациями сверх задания (закрыты) ───
    ('GATE-R15 (белый список): выдуманный business-токен', 'design-system/tokens.css',
     ('  --radius: 0;', '  --regionalfaktor-default: on;\n  --radius: 0;'), {'GATE-R15'}),
    ('GATE-MOTION: счёт чисел 400 → 900 мс (правило 19)', 'design-system/tokens.css',
     ('--motion-value-change: 400ms;', '--motion-value-change: 900ms;'), {'GATE-MOTION'}),
    ('GATE-MOTION: шаг волны 80 → 200 мс (правило 19)', 'design-system/tokens.css',
     ('--stagger-wave: 80ms;', '--stagger-wave: 200ms;'), {'GATE-MOTION'}),
    ('GATE-SCALE: --space-5 24 → 20px', 'design-system/tokens.css',
     ('--space-5: 24px;', '--space-5: 20px;'), {'GATE-SCALE'}),
    ('GATE-NUMERIC: .numeric потерял tnum и выравнивание', 'design-system/tokens.css',
     ('.numeric { font-feature-settings: var(--font-numeric); text-align: right; }',
      '.numeric { text-align: left; }'), {'GATE-NUMERIC'}),
    ('GATE-LAYER: коллизия слоёв toast 110 → 5', 'design-system/tokens.css',
     ('--layer-toast:         110;', '--layer-toast:         5;'), {'GATE-LAYER'}),
    ('R-03: толщина фокус-бордера 2 → 1px', 'design-system/tokens.css',
     ('--border-width-focus:   2px;', '--border-width-focus:   1px;'), {'R-03'}),
    ('R-24: применяемый вес body → Medium', 'design-system/tokens.css',
     ('--font-weight-body:    var(--font-weight-regular);',
      '--font-weight-body:    var(--font-weight-medium);'), {'R-24'}),
    ('R-24: герой DC-38 набран 48/52 вместо 64/68', 'design-system/README.md',
     ('| 64/68 Bold |', '| 48/52 Bold |'), {'R-24'}),
    ('LAYOUT-003: контейнер 1200 → 1000 px в прозе', 'design-system/README.md',
     ('Контент ограничен **1200 px**', 'Контент ограничен **1000 px**'), {'LAYOUT-003'}),
    ('PLAN: [x] со словом «перенесено»', 'docs/audit/remediation-plan.md',
     '- [x] EMAIL-001 закрыт — перенесено на следующий квартал', {'PLAN'}),
    ('CONTRAST: перестановка двух зарегистрированных величин', 'docs/audit/adr-blocking.md',
     ('**3,36:1 — не проходит 4,5:1**', '**2,71:1 — не проходит 4,5:1**'), {'CONTRAST'}),
    ('CONTRAST-UNREG: величина без пары', 'CLAUDE.md',
     'Kontrast 9,99:1 gemessen.', {'CONTRAST-UNREG'}),
    ('TOKEN-001: color-mix в токенах', 'design-system/tokens.css',
     '.x{color:color-mix(in srgb, var(--color-text-primary) 50%, transparent)}',
     {'TOKEN-001', 'CSS-COLOR'}),
    ('LAYOUT-001: 96 px вернулось в шкалу отступов README', 'design-system/README.md',
     ('`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`', '`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`'),
     {'LAYOUT-001'}),
    ('CLAUDE: возврат отменённого правила hit-зоны', 'CLAUDE.md',
     'Прежнее правило требовало hit-зону 32 px.', {'CLAUDE'}),
    ('DECISIONS: индекс описывает отменённую версию D-11', 'docs/product/decisions.md',
     '| **D-11** Gebäudetyp — первая ось (9 типов) | принято |', {'DECISIONS', 'CLAUDE'}),

    # ─── модель данных (Batch 4) ───
    ('DM-TYPE: новая висячая ссылка на тип', 'docs/product/data-model.md',
     '```ts\nLeakEntity { id: ProjectId; ghost: NirgendsDefinierterTyp }\n```', {'DM-TYPE'}),
    ('DM-TYPE-FIELD: норматив называет несуществующий тип', 'docs/product/data-model.md',
     'Требование CALC-099 ссылается на `NirgendsTyp.someField`.', {'DM-TYPE-FIELD'}),
    ('DM-INVARIANT: в охват партии добавлено требование без инварианта',
     'docs/audit/remediation-plan.md',
     ('Закрывает: **DATA-001', 'Закрывает: **CALC-099, DATA-001'), {'DM-INVARIANT'}),
    ('DM-ROUND: спека снимает префикс ≈ со срока', 'docs/product/calculation-spec.md',
     ('| Срок | целый месяц, если интервал целый; иначе 0,5 месяца | «к ближайшему» | '
      'если показ ≠ точного; рядом обязательна абсолютная дата |',
      '| Срок | целый месяц, если интервал целый; иначе 0,5 месяца | «к ближайшему» | '
      'не требуется; рядом обязательна абсолютная дата |'), {'DM-ROUND'}),
    ('DM-DECISION: ссылка на решение, которого нет', 'docs/product/data-model.md',
     'Зафиксировано в `decisions.md` **D-99**.', {'DM-DECISION'}),
    ('DM-DECISION: заявление без номера решения', 'docs/product/data-model.md',
     'Основание — `decisions.md`, там всё описано.', {'DM-DECISION'}),

    # ─── клиентский текст Annahmen ───
    ('T0-FACT: класс здания объявлен клиенту выведенным из этажности (CALC-004)',
     'docs/product/t0-fallback-rules.md',
     '### 99. Leak-Sektion\n\n| Vollgeschosse ≥ 5 | `GK 5` | `Prüfung erforderlich` |\n\n'
     '> **Annahme:** Die Gebäudeklasse ergibt sich aus der Geschossanzahl.', {'T0-FACT'}),
    ('T0-COVERAGE: покрытие KG 500 объявлено решённым при фактическом unknown',
     'docs/product/t0-fallback-rules.md',
     '> **Annahme:** Die Kostengruppe 500 ist nicht enthalten.', {'T0-COVERAGE'}),

    # ─────────── v4 · модель выдач (docs/product/output-model.md) ───────────
    # До v4 охват файла был ноль: 58 объявленных инвариантов, ни одной проверки.
    # По одной мутации на каждую закрытую дыру совместного списка двух аудиторов.
    ('OUT-SEQ: метка OUT-30 переписана в OUT-31 (дубль + пропуск)',
     'docs/product/output-model.md',
     _sub(r'\*\*OUT-30\.\*\*', '**OUT-31.**'), {'OUT-SEQ'}),
    ('OUT-SEQ: порядковый номер разошёлся с меткой', 'docs/product/output-model.md',
     _sub(r'^7\.\s+\*\*OUT-07\.\*\*', '8. **OUT-07.**', re.M), {'OUT-SEQ'}),
    ('OUT-REF: ссылка на инвариант, которого нет', 'docs/product/output-model.md',
     'Приёмка описана инвариантом `OUT-99`.', {'OUT-REF'}),
    ('OUT-SEND: из таблицы §9.3 снято одно условие', 'docs/product/output-model.md',
     _drop_line(r'^\|\s*6\s*\|.*EMAIL-011'), {'OUT-SEND'}),
    ('OUT-SEND: определение называет пять условий вместо шести',
     'docs/product/output-model.md',
     _sub(r'конъюнкция шести услови', 'конъюнкция пяти услови'), {'OUT-SEND'}),
    ('OUT-SEND: инвариант OUT-36 разошёлся с определением',
     'docs/product/output-model.md',
     _sub(r'(\*\*OUT-36\.\*\*[^\n]*?конъюнкции )шести', r'\g<1>пяти'), {'OUT-SEND'}),
    ('OUT-ATTACH: у AttachmentPreflightItem удалён contentHash',
     'docs/product/output-model.md',
     _drop_line(r'^\s*contentHash:\s*string;\s*//\s*хеш байтов'), {'OUT-ATTACH'}),
    ('OUT-ATTACH: union снапшота вложения расширен', 'docs/product/output-model.md',
     _sub(r'visibilityClassification:\s*"clientSafe";',
          'visibilityClassification: "clientSafe" | "unclassified";'), {'OUT-ATTACH'}),
    ('OUT-R07: матрица блокировки ослаблена до трёх клиентских профилей',
     'docs/product/output-model.md',
     _sub(r'\*\*ровно все пять клиентских\*\*', '**ровно три клиентских**'), {'OUT-R07'}),
    ('OUT-POLICY: разорвана связка allowed=false → serialization="omit"',
     'docs/product/output-model.md',
     _sub(r'`allowed = false` требует `serialization = "omit"`',
          '`allowed = false` допускает любую сериализацию'), {'OUT-POLICY'}),
    ('OUT-MONEY: порча округления тотала комплекса (≈ 5.824.000 при 5.822.936,00)',
     'docs/product/output-model.md',
     _sub(r'5\.823\.000', '5.824.000'), {'OUT-MONEY'}),
    ('OUT-MONEY: порча клиентской базы сравнения', 'docs/product/output-model.md',
     _sub(r'1\.820\s*€/m² BGF oberirdisch', '1.850 €/m² BGF oberirdisch'), {'OUT-MONEY'}),
    ('OUT-PROFILE: короткое имя профиля clientLive', 'docs/product/output-model.md',
     'Заблокированы `clientReadOnly · clientLive · clientPdf`.', {'OUT-PROFILE'}),
    ('OUT-PROFILE: секция профиля исчезла из §3', 'docs/product/output-model.md',
     _sub(r'### 3\.5\. `clientPrint`', '### 3.5. `clientDruck`'), {'OUT-PROFILE'}),
    ('SCHED-D17: десятичный месяц при целом интервале', 'docs/product/output-model.md',
     'Срок проекта — 12,0 Monate.', {'SCHED-D17'}),

    # ─────────── v4 · контракты design-system/README.md ───────────
    ('RM-AXES: из тела контракта DC-38 удалена ось stale (STATE-001)',
     'design-system/README.md',
     _sub(r'`stale` — вход, правило, снапшот', '`veraltet` — вход, правило, снапшот'),
     {'RM-AXES'}),
    ('RM-AXES: у контракта снят весь блок «Состояния — данные»',
     'design-system/README.md',
     _sub(r'\*\*Состояния — данные:\*\*\n`loading` — очередь загружается',
          '**Zustände:**\n`loading` — очередь загружается'), {'RM-AXES'}),
    ('RM-MATRIX: одна ячейка матрицы §2.4 разошлась с телом контракта',
     'design-system/README.md',
     _sub(r'^\| DC-38 `KeyMetricsGrid` \| ● \| ●', '| DC-38 `KeyMetricsGrid` | ○ | ●', re.M),
     {'RM-MATRIX'}),
    ('RM-MATRIX: из матрицы §2.4 исчезла строка контракта', 'design-system/README.md',
     _drop_line(r'^\| DC-44 `CostDriverBreakdown` \|'), {'RM-MATRIX'}),
    ('RM-NAREASON: причина неприменимости заменена словом', 'design-system/README.md',
     _sub(r'notApplicableReason: пустой призрак[^·]*·', 'notApplicableReason: нет ·'),
     {'RM-NAREASON'}),
    ('RM-FIXTURE: база скидки взята от округлённого итога (CALC-007)',
     'design-system/README.md',
     _sub(r'итога\s*`3\.817\.835,00 €`', 'итога `3.818.000 €`'), {'RM-FIXTURE'}),
    ('RM-FIXTURE: несводимый тотал в прозе', 'design-system/README.md',
     'Beispiel: Gesamtsumme ≈ 5.900.000 € netto.', {'RM-FIXTURE'}),
    ('RM-FIXTURE: агрегация комплекса под подписью oberirdisch включила UG (DATA-001)',
     'design-system/README.md',
     _sub(r'Σ BGF oberirdisch 3\.200,00', 'Σ BGF oberirdisch 3.600,00'), {'RM-FIXTURE'}),
    ('RM-FIXTURE: денежный блок без scenarioId и calculationRunId',
     'design-system/README.md', _insert_contract, {'RM-FIXTURE'}),
    ('RM-ACCENT: акцентный герой перенесён на канву (2,60:1)',
     'design-system/README.md',
     _sub(r'\(только герой №1, только на\n`--color-surface-default`\)',
          '(только герой №1, только на\n`--color-surface-canvas`)'), {'RM-ACCENT'}),
    ('RM-ACCENT: акцент перечислён без названной поверхности',
     'design-system/README.md',
     _sub(r'`--color-text-display-accent` \(только герой №1, только на\n'
          r'`--color-surface-default`\)', '`--color-text-display-accent`'), {'RM-ACCENT'}),
    ('RM-ACCENT: снята формулировка запрета акцента на канве',
     'design-system/README.md',
     _sub(r'- акцентный герой на поверхности `--color-surface-canvas`:',
          '- герой на поверхности `--color-surface-subtle`:'), {'RM-ACCENT'}),

    # ─────────── v4 · индекс открытых ADR ───────────
    ('INDEX: README цитирует устаревшее число открытых ADR', 'design-system/README.md',
     'По TOKEN-005 открыты 34 блокирующих ADR.', {'INDEX'}),
    ('INDEX: итог реестра ADR разошёлся с собственным составом',
     'docs/audit/adr-blocking.md',
     _sub(r'\*\*51 открытый ADR\*\* \(34 из разделов 1–3',
          '**52 открытый ADR** (35 из разделов 1–3'), {'INDEX'}),
    ('INDEX: раздел реестра ADR заявляет не своё число записей',
     'docs/audit/adr-blocking.md',
     _sub(r'^## 1\. Цвет — 23 записи', '## 1. Цвет — 24 записи', re.M), {'INDEX'}),
]

def selftest():
    print('SELFTEST: копирую репозиторий во временный каталог и порчу копии…')
    failures = []
    with tempfile.TemporaryDirectory(prefix='all3-verify-selftest-') as tmp:
        tmp = pathlib.Path(tmp)
        base = tmp / 'clean'
        base.mkdir()
        for rel in ['CLAUDE.md']:
            shutil.copy2(ROOT / rel, base / rel)
        for d in ['design-system', 'docs']:
            shutil.copytree(ROOT / d, base / d,
                            ignore=shutil.ignore_patterns('*.png', '*.woff2', 'fonts'))
        # 0. чистая копия обязана давать 0 новых нарушений
        v0 = Verifier(base).run()
        if v0.new:
            failures.append(('база', f'чистая копия даёт {len(v0.new)} новых нарушений: '
                             + '; '.join(f'[{c}] {w}: {m[:60]}' for c, w, m in v0.new[:5])))
        for idx, entry in enumerate(MUTATIONS):
            desc, rel, mut, expect = entry[0], entry[1], entry[2], entry[3]
            where = entry[4] if len(entry) > 4 else 'new'
            case = tmp / f'case{idx}'
            shutil.copytree(base, case)
            p = case / rel
            text = p.read_text(encoding='utf-8') if p.exists() else ''
            if callable(mut):
                try:
                    p.write_text(mut(text), encoding='utf-8')
                except AssertionError as exc:
                    failures.append((desc, f'мутация неприменима: {exc}'))
                    shutil.rmtree(case)
                    continue
            elif isinstance(mut, tuple):
                old, new_s = mut
                if old not in text:
                    failures.append((desc, f'мутация неприменима: «{old[:50]}» не найдено в {rel}'))
                    shutil.rmtree(case)
                    continue
                p.write_text(text.replace(old, new_s, 1), encoding='utf-8')
            else:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text((text + '\n' if text else '') + mut + '\n', encoding='utf-8')
            v = Verifier(case).run()
            got_new = {c for c, _, _ in v.new}
            got_known = {c for c, _, _, _ in v.known}
            if expect is None:
                # негативная мутация: инструмент обязан промолчать
                if got_new:
                    failures.append((desc, f'ложное срабатывание: {sorted(got_new)}'))
            elif where == 'known':
                if not (got_known & expect):
                    failures.append((desc, f'мутация НЕ зарегистрирована; ожидались {sorted(expect)} '
                                           f'среди известных открытых, получено {sorted(got_known)}'))
            elif not (got_new & expect):
                failures.append((desc, f'мутация НЕ поймана; ожидались {sorted(expect)}, '
                                       f'новые классы: {sorted(got_new)}'))
            shutil.rmtree(case)
        # Структурная проба TOOL-REGISTRY: класс, не объявленный в реестре,
        # обязан валить прогон. Файлами это не мутируется — проверяется прямо.
        probe = Verifier(base)
        probe.fail('НЕЗАРЕГИСТРИРОВАННЫЙ-КЛАСС', 'проба', 'проверка двусторонности реестра')
        probe.check_tool_registry()
        if not any(c == 'TOOL-REGISTRY' for c, _, _ in probe.new):
            failures.append(('TOOL-REGISTRY (структурная проба)',
                             'необъявленный класс не свалил прогон — реестр не двусторонний'))
    print(f'SELFTEST: {len(MUTATIONS)} мутаций, поймано {len(MUTATIONS) - sum(1 for d, _ in failures if d not in ("база", "TOOL-REGISTRY (структурная проба)"))}')
    if failures:
        for desc, msg in failures:
            print(f'  ✗ {desc}: {msg}')
        print('SELFTEST: ПРОВАЛ — есть слепые классы проверок.')
        return 2
    print('SELFTEST: каждый класс проверок ловит свою мутацию. Оригиналы не тронуты.')
    return 0


# ───────────────────────── main ─────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description='Проверяльщик инвариантов All3 Sales Platform')
    ap.add_argument('--strict', action='store_true',
                    help='известные открытые нарушения тоже валят сборку (гейт релиза)')
    ap.add_argument('--selftest', action='store_true',
                    help='мутационная самопроверка детекторов на временных копиях')
    args = ap.parse_args()

    if args.selftest:
        sys.exit(selftest())

    v = Verifier(ROOT).run()
    bar = '=' * 72
    print(f'{bar}\nПРОВЕРКА ИНВАРИАНТОВ · новых нарушений: {len(v.new)} · '
          f'из них ПРОВЕРОК НЕ ВЫПОЛНЕНО: {len(v.vacuum)} · '
          f'известных открытых: {len(v.known)} · предупреждений: {len(v.warn)}\n{bar}')
    if v.vacuum:
        # Отдельная секция и первой: это дефект инструмента, а не документа.
        print('\n' + '‼' * 36)
        print('ПРОВЕРКА НЕ ВЫПОЛНЕНА — инструмент не смог сверить, а не сверил и не нашёл.')
        print('Это дефект ИНСТРУМЕНТА: молчаливая сверка хуже отсутствующей, потому что')
        print('зелёный отчёт по ней читают как доказательство. Починить паттерн, не документ.')
        print('‼' * 36)
        for c, w, m in v.vacuum:
            print(f'  ‼ [{c}] {w} — {m}')
    other = [x for x in v.new if x not in v.vacuum]
    if other:
        print('\nНОВЫЕ НАРУШЕНИЯ (валят сборку):')
        for cls in sorted({c for c, _, _ in other}):
            print(f'\n[{cls}]')
            for c, w, m in other:
                if c == cls:
                    print(f'  ✗ {w} — {m}')
    if v.known:
        print('\n⚠ ИЗВЕСТНЫЕ ОТКРЫТЫЕ НАРУШЕНИЯ — зарегистрированы, НЕ замаскированы;')
        print('  отслеживаются планом ремедиации, валят запуск с --strict:')
        for c, w, m, ref in v.known:
            print(f'  ! [{c}] {w} — {m[:90]}\n      → {ref}')
    for w in v.warn:
        print(f'  ⚠ {w}')
    if not v.new and not v.known:
        print('\n✓ Все инварианты выполнены, открытых нарушений нет.')
    elif not v.new:
        print(f'\n✓ Новых нарушений нет. {len(v.known)} известных открытых — см. выше.')
    sys.exit(1 if (v.new or (args.strict and v.known)) else 0)

if __name__ == '__main__':
    main()
