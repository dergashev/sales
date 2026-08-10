#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Независимая проверка поставки синтетического сценария 2 (`DEMO-0002`).

Зачем отдельный скрипт, а не глаза. Контрольные величины поставки станут
юнит-тестом движка: расхождение движка с ними будет release-блокером ровно
так же, как для первого сценария (правило проекта 32). Значит, ошибка в самой
поставке превращается в тест, который требует от движка неверного ответа, —
и обнаружится тогда, когда исправлять придётся уже не таблицу, а фикстуру,
тест и, возможно, движок.

Принцип тот же, что у `build_fixtures.py`, и он важнее самого скрипта:
**входы берутся из поставки, производные вычисляются здесь заново из каталога
источников правды и сверяются с тем, что поставка объявляет.** Ни одно число
не переписывается из таблицы «Control values» в ожидание — иначе проверка
доказывала бы только то, что документ равен себе.

Каталог берётся НЕ из таблицы `Catalog inputs` поставки (это её собственное
утверждение), а из санкционированных источников:
  · `docs/audit/synthetic-fixtures.md` §5 — ставки и множители;
  · `docs/product/calculation-spec.md` §1/§2/§4 — формулы, f_S, ставки UG,
    правила округления и подписи.
Таблица `Catalog inputs` при этом тоже проверяется — на согласие с ними.

Отдельный раздел проверяет НЕ поставку, а готовность движка её выразить:
сценарий вводит величины (BGF S, `ab_decke`, `hasParking`), которых в
`src/engine/calculate.ts` сегодня нет. Интеграция фикстуры до закрытия этих
пробелов дала бы юнит-тест, падающий не из-за арифметики, а из-за отсутствия
входа. Раздел читает `src/**`, ничего в нём не меняя.

Запуск: python3 tools/check_scenario2.py [путь-к-поставке]
Путь-аргумент нужен мутационному самотесту (`--selftest`): детектор, который
никогда не видел подделанного числа, доказывает только собственное молчание.
Код возврата: 0 — расхождений нет; 1 — есть.
"""
import pathlib
import re
import sys
from decimal import Decimal as D, ROUND_HALF_UP, getcontext

getcontext().prec = 40

ROOT = pathlib.Path(__file__).resolve().parent.parent
DELIVERY_DEFAULT = ROOT / 'docs/audit/verdicts/content/scenario-2-260807.md'
DELIVERY = DELIVERY_DEFAULT
FIXTURES = ROOT / 'docs/audit/synthetic-fixtures.md'
SPEC = ROOT / 'docs/product/calculation-spec.md'
ENGINE = ROOT / 'src/engine/calculate.ts'

NNBSP = ' '
SPACES = '   '

findings = []
blockers = []
checked = []


def ok(what):
    checked.append(what)


def bad(code, what):
    """Расхождение ПОСТАВКИ с пересчётом — правится в поставке."""
    findings.append((code, what))


def blocker(code, what):
    """Поставка верна, но интегрировать её сегодня нельзя — правится в `src`."""
    blockers.append((code, what))


def norm(text):
    for ch in SPACES:
        text = text.replace(ch, ' ')
    return text


def de(s):
    """Немецкое число → Decimal. '2.939.814,00' → 2939814.00"""
    s = str(s)
    for ch in SPACES:
        s = s.replace(ch, '')
    for junk in ('€', 'm²', '%', '≈', '/', 'Monate', '"', '`'):
        s = s.replace(junk, '')
    # Некоторые ячейки поставки набраны СУММОЙ слагаемых («1.220,00 + 2.500,00»):
    # это форма записи, а не другая величина, и разбирать её надо здесь, а не
    # обходить особым случаем на каждом вызове.
    if '+' in s:
        return sum((de(p) for p in s.split('+')), D(0))
    s = s.replace('.', '').replace(',', '.').strip()
    return D(s)


def fmt_de(x, decimals=0):
    s = f'{x:.{decimals}f}'
    neg = s.startswith('-')
    if neg:
        s = s[1:]
    whole, _, frac = s.partition('.')
    groups = []
    while len(whole) > 3:
        groups.insert(0, whole[-3:])
        whole = whole[:-3]
    groups.insert(0, whole)
    out = '.'.join(groups)
    if frac:
        out += ',' + frac
    return ('-' if neg else '') + out


def r(x, step):
    """Округление к ближайшему шагу, половина вверх (CALC-007)."""
    return (D(x) / D(step)).quantize(D('1'), ROUND_HALF_UP) * D(step)


def q12(x):
    """Хранимая точность поставки — 12 знаков после запятой."""
    return D(x).quantize(D('1.000000000000'), ROUND_HALF_UP)


def as_declared(computed, declared_cell):
    """Пересчёт, приведённый к точности, с которой величина ОБЪЯВЛЕНА.

    Сравнивать 9,276667 с 9,27666666… как с разными числами значило бы
    находить дефект там, где документ просто округлил показ до шести знаков.
    Точность берётся из самой ячейки, а не назначается скриптом.
    """
    s = str(declared_cell)
    dec = len(s.split(',')[1]) if ',' in s else 0
    step = D(1).scaleb(-dec)
    return D(computed).quantize(step, ROUND_HALF_UP)


def flat(s):
    """Все виды пробелов → обычный. Для сравнения ТЕКСТА подписи.

    Разделитель проверяется отдельным правилом (7) на сыром тексте: если
    сравнивать подписи посимвольно, каждое расхождение пробела маскировало бы
    расхождение смысла, а найти надо оба, и по отдельности.
    """
    for ch in SPACES:
        s = s.replace(ch, ' ')
    return re.sub(r'\s+', ' ', s).strip()


def eval_expr(expr):
    """Немецкое арифметическое выражение поставки → Decimal.

    Нужно, чтобы проверять не только результат, но и формулу: верный ответ,
    полученный по неверному выражению, — тот же дефект, только тише. Поддержаны
    `+`, `×` и скобки — больше в поставке не встречается.
    """
    e = flat(expr).strip('`').strip()
    if e.startswith('(') and e.endswith(')') and e.count('(') == 1:
        e = e[1:-1]

    def split_top(s, sep):
        parts, depth, cur = [], 0, ''
        for ch in s:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            if ch == sep and depth == 0:
                parts.append(cur)
                cur = ''
            else:
                cur += ch
        parts.append(cur)
        return parts

    plus = split_top(e, '+')
    if len(plus) > 1:
        return sum((eval_expr(p) for p in plus), D(0))
    times = split_top(e, '×')
    if len(times) > 1:
        out = D(1)
        for p in times:
            out *= eval_expr(p)
        return out
    return de(e)


# ── разбор markdown-таблиц ────────────────────────────────────────────────
def tables(path):
    """{заголовок раздела: [список строк-словарей]} — по первой таблице раздела."""
    out = {}
    section = None
    header = None
    rows = None
    for line in norm(path.read_text(encoding='utf-8')).splitlines():
        if line.startswith('## '):
            if section and rows is not None and section not in out:
                out[section] = rows
            section = line[3:].strip()
            header, rows = None, None
            continue
        if line.startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if header is None:
                header = cells
                rows = []
                continue
            if set(''.join(cells)) <= set('-: '):
                continue
            rows.append(dict(zip(header, cells)))
        elif line.strip() == '' and header is not None and section not in out:
            out[section] = rows
            header, rows = None, None
    if section and rows is not None and section not in out:
        out[section] = rows
    return out


def cell(v):
    return v.strip().strip('`')


# ── каталог из источников правды ──────────────────────────────────────────
def catalog():
    fx = norm(FIXTURES.read_text(encoding='utf-8'))
    sp = norm(SPEC.read_text(encoding='utf-8'))

    def grab(text, pattern, what, group=1):
        m = re.search(pattern, text)
        if not m:
            raise SystemExit(f'каталог: не найдено — {what} ({pattern!r})')
        return de(m.group(group))

    gk = re.search(r'F_gk: GK 1–3 = ([\d,]+) · GK 4 = ([\d,]+) · GK 5 = ([\d,]+)', fx)
    eh = re.search(r'F_energie: EH 55 = ([\d,]+) · EH 40 = ([\d,]+)', fx)
    gkz = re.search(r'F_gk_zeit: GK 3 = ([\d,]+) · GK 4 = ([\d,]+) · GK 5 = ([\d,]+)', fx)
    fz = re.search(r'F_form_zeit: MFH = ([\d,]+) · Büro = ([\d,]+)', fx)
    if not all((gk, eh, gkz, fz)):
        raise SystemExit('каталог: строка множителей не найдена в synthetic-fixtures.md §5')

    cat = {
        'K_BASE': grab(fx, r'K_base = ([\d.]+) €/m² BGF R oberirdisch', 'K_base'),
        'F_S': grab(sp, r'f_S = ([\d,]+) — площади S', 'f_S'),
        'F_GK_4': de(gk.group(2)),
        'F_GK_5': de(gk.group(3)),
        'F_ENERGY_GEG': grab(sp, r'Energiestandard ⚙ \| GEG ([\d,]+)', 'GEG'),
        'F_ENERGY_EH_55': de(eh.group(1)),
        'F_ENERGY_EH_40': de(eh.group(2)),
        'F_FORM_MFH': grab(sp, r'MFH ([\d,]+) · Mischnutzung', 'F_form MFH'),
        'F_USAGE_BUERO': grab(fx, r'F_form_büro = ([\d,]+)', 'F_usage Büro'),
        'RATE_UG_VOLLAUSBAU': grab(sp, r'UG vollausbau ⚙ \| ([\d.]+) €/m² BGF UG', 'UG vollausbau'),
        'RATE_UG_AB_DECKE': grab(sp, r'UG ab_decke ⚙ \| ([\d.]+) €/m² BGF UG', 'UG ab_decke'),
        'RATE_TG': grab(sp, r'Tiefgarage-Zuschlag ⚙ \| \+ ([\d.]+) €/m² BGF UG', 'TG-Zuschlag'),
        'F_REGION': D('1.00'),
        'F_TIME_MFH': de(fz.group(1)),
        'F_TIME_BUERO': de(fz.group(2)),
        'F_TIME_GK_4': de(gkz.group(2)),
        'F_TIME_GK_5': de(gkz.group(3)),
        'PLANNING_MONTHS': D('3'),
        'STAGGER_MONTHS': D('3'),
        'MIN_MONTHS': D('3'),
    }
    ok(f'каталог собран из источников правды ({len(cat)} величин)')
    return cat


# ── даты ──────────────────────────────────────────────────────────────────
def add_months(iso, months):
    """Конец = начало + округлённая длительность; половина месяца = 15 дней."""
    import datetime
    y, m, d = (int(x) for x in iso.split('-'))
    whole = int(D(months))
    half = D(months) - whole
    m0 = m - 1 + whole
    y2, m2 = y + m0 // 12, m0 % 12 + 1
    dt = datetime.date(y2, m2, d)
    if half == D('0.5'):
        dt += datetime.timedelta(days=15)
    elif half != 0:
        raise SystemExit(f'длительность не кратна 0,5: {months}')
    return dt.isoformat()


def whole_calendar_months(a, b):
    ay, am, ad = (int(x) for x in a.split('-'))
    by, bm, bd = (int(x) for x in b.split('-'))
    if ad != bd:
        return None
    n = (by - ay) * 12 + (bm - am)
    return n if n > 0 else None


def main():
    global findings, blockers, checked
    findings, blockers, checked = [], [], []
    if not DELIVERY.exists():
        raise SystemExit(f'поставка не найдена: {DELIVERY}')
    t = tables(DELIVERY)
    cat = catalog()

    # ── A. таблица «Catalog inputs» против источников правды ──────────────
    declared = {cell(row['parameterId']): row for row in t['Catalog inputs']}
    for pid, expected in cat.items():
        if pid in ('MIN_MONTHS',):
            continue
        if pid not in declared:
            bad('CAT-MISSING', f'{pid} не объявлен в таблице Catalog inputs поставки')
            continue
        got = de(declared[pid]['value'])
        if got != expected:
            bad('CAT-VALUE',
                f'{pid}: поставка объявляет {got}, источник правды даёт {expected}')
        else:
            ok(f'каталог согласован: {pid} = {expected}')
    for pid in declared:
        if pid not in cat:
            bad('CAT-EXTRA', f'{pid} объявлен поставкой, но в источниках правды не найден')

    # ── входы сценария ────────────────────────────────────────────────────
    bld = {cell(r_['buildingId']): r_ for r_ in t['Buildings']}
    seg = {cell(r_['segmentId']): r_ for r_ in t['Usage segments']}

    GK = {'GK_4': cat['F_GK_4'], 'GK_5': cat['F_GK_5']}
    GKZ = {'GK_4': cat['F_TIME_GK_4'], 'GK_5': cat['F_TIME_GK_5']}
    EH = {'GEG': cat['F_ENERGY_GEG'], 'EH_55': cat['F_ENERGY_EH_55'],
          'EH_40': cat['F_ENERGY_EH_40']}
    # Ось назначения принадлежит сегменту (D-11 v2, правило 33); множитель
    # берётся оттуда, а не из строки здания. Значение, не принадлежащее оси
    # формы, даёт здесь НЕЙТРАЛЬ: это и есть проверяемое утверждение — при
    # таком чтении арифметика поставки сходится до копейки, а значит 1,05
    # применён один раз, с сегмента.
    FORM = {'MFH': cat['F_FORM_MFH']}
    FORMZ = {'MFH': cat['F_TIME_MFH'], 'BUERO': cat['F_TIME_BUERO']}

    def usage_factor(bid):
        for s in seg.values():
            if cell(s['buildingId']) == bid:
                return de(s['usageFactor'])
        raise SystemExit(f'у здания {bid} нет сегмента — множитель назначения неоткуда взять')

    # ── A2. оси классификации (D-11 v2, правило 33) ───────────────────────
    # `Gebäudeform` — уровень Building и только первые три строки таблицы
    # множителей; `Nutzungsart` живёт на сегменте. Значение назначения,
    # поставленное в колонку формы, объявляет ось дважды и приглашает
    # применить множитель дважды — при том, что арифметика применяет его
    # ровно один раз. Пересчёт ниже берёт множитель с СЕГМЕНТА и сходится с
    # поставкой до копейки: значит, неверна подпись оси, а не число.
    FORM_AXIS = {'MFH', 'EFH_ZFH', 'DH_REH'}
    for bid, b in bld.items():
        form = cell(b['gebaeudeform'])
        if form not in FORM_AXIS:
            seg_of = [cell(s['nutzungsart']) for s in seg.values()
                      if cell(s['buildingId']) == bid]
            bad('AXIS-D11',
                f'{bid}: `gebaeudeform` = {form}, но это Nutzungsart, а не '
                f'Gebäudeform (D-11 v2, правило 33). Та же ось уже объявлена на '
                f'сегменте ({", ".join(seg_of)}), и множитель 1,05 применён один '
                f'раз — двойное объявление приглашает применить его дважды')
    if not any(c == 'AXIS-D11' for c, _ in findings):
        ok('оси классификации: Gebäudeform на здании, Nutzungsart на сегменте')

    # ── A3. провенанс расчётных прогонов ──────────────────────────────────
    ident = t['Scenario identity'][0]
    declared_runs = {cell(ident['calculationRunId'])}
    referenced = {cell(row['calculationRunId']) for row in t['Control values']}
    orphan = sorted(referenced - declared_runs)
    if orphan:
        bad('RUN-UNDECLARED',
            f'контрольные величины ссылаются на прогоны {", ".join(orphan)}, '
            f'у которых нет строки идентичности: ни runPurpose, ни calculatedAt, '
            f'ни rulesetVersion. Величина без объявленного прогона непрослеживаема, '
            f'а итог `DEMO2-CTRL-04` сложен из величин ЧУЖИХ прогонов')
    else:
        ok(f'все прогоны контрольных величин объявлены ({len(referenced)})')

    # ── B. стоимостная арифметика ─────────────────────────────────────────
    costs = {cell(r_['componentId']): r_ for r_ in t['Cost arithmetic from `K_base`']}
    subtotal = {}
    for bid, b in bld.items():
        gk = cell(b['gebaeudeklasse'])
        eh = cell(b['energiestandard'])
        form = cell(b['gebaeudeform'])
        r_above = de(b['bgfRAbove'])
        s_above = de(b['bgfSAbove'])
        below = de(b['bgfRBelow'])
        parking = cell(b['hasParking']) == 'true'
        ugmode = cell(b['untergeschoss'])

        mult = FORM.get(form, D(1)) * usage_factor(bid) * GK[gk] * EH[eh]
        comp_r = r_above * cat['K_BASE'] * mult
        comp_s = s_above * cat['K_BASE'] * mult * cat['F_S']
        if ugmode == 'vollausbau':
            rate = cat['RATE_UG_VOLLAUSBAU'] + (cat['RATE_TG'] if parking else D(0))
        elif ugmode == 'ab_decke':
            rate = cat['RATE_UG_AB_DECKE'] + (cat['RATE_TG'] if parking else D(0))
        else:
            rate = D(0)
        comp_ug = below * rate
        total = (comp_r + comp_s + comp_ug) * cat['F_REGION']
        subtotal[bid] = total

        letter = bid.split('-')[-1]
        for suffix, computed, need in (
            ('R', comp_r, True),
            ('S', comp_s, True),
            ('UG', comp_ug, comp_ug != 0),
            ('TOTAL', total, True),
        ):
            key = f'DEMO2-COST-{letter}-{suffix}'
            if not need:
                if key in costs:
                    bad('COST-EXTRA', f'{key}: строка есть, а величина нулевая')
                continue
            if key not in costs:
                bad('COST-MISSING', f'{key}: строка отсутствует в поставке')
                continue
            got = de(costs[key]['exact'])
            if got != computed:
                bad('COST-VALUE',
                    f'{key}: поставка {fmt_de(got, 2)}, пересчёт {fmt_de(computed, 2)} '
                    f'(Δ {fmt_de(got - computed, 2)} €)')
            else:
                ok(f'{key} = {fmt_de(computed, 2)} €')
            # Выражение обязано ДАВАТЬ свой результат: верный ответ по
            # неверной формуле — тот же дефект, только тише.
            expr = costs[key]['expression']
            if eval_expr(expr) != computed:
                bad('COST-EXPR', f'{key}: выражение «{flat(expr)}» даёт '
                                 f'{fmt_de(eval_expr(expr), 2)}, а строка объявляет '
                                 f'{fmt_de(computed, 2)} €')

    complex_total = sum(subtotal.values(), D(0))
    key = 'DEMO2-COST-COMPLEX'
    if de(costs[key]['exact']) != complex_total:
        bad('COST-VALUE', f'{key}: поставка {costs[key]["exact"]}, '
                          f'пересчёт {fmt_de(complex_total, 2)} €')
    else:
        ok(f'{key} = {fmt_de(complex_total, 2)} € (сумма трёх зданий)')

    # ── C. срок ───────────────────────────────────────────────────────────
    sch = {cell(r_['metricId']): r_ for r_ in t['Schedule']}
    epoch = cell(sch['DEMO2-SCH-PLANNING']['startDate'])
    exact_dur, rounded_dur, ends = {}, {}, {}
    for mid, row in sch.items():
        if cell(row['kind']) != 'buildingExecution':
            continue
        bid = cell(row['buildingId'])
        b = bld[bid]
        bgf_above = de(b['bgfRAbove']) + de(b['bgfSAbove'])
        if bgf_above != de(row['bgfAbove']):
            bad('SCH-BGF', f'{mid}: bgfAbove {row["bgfAbove"]} ≠ BGF R + BGF S '
                           f'= {fmt_de(bgf_above, 2)} m²')
        ff = FORMZ.get(cell(b['gebaeudeform']), D(1))
        gf = GKZ[cell(b['gebaeudeklasse'])]
        if ff != de(row['formFactorTime']):
            bad('SCH-FACTOR', f'{mid}: formFactorTime {row["formFactorTime"]} ≠ {ff}')
        if gf != de(row['classFactorTime']):
            bad('SCH-FACTOR', f'{mid}: classFactorTime {row["classFactorTime"]} ≠ {gf}')
        raw = (D(5) + (bgf_above - 1000) / 750) * ff * gf
        dur = max(raw, cat['MIN_MONTHS'])
        exact_dur[bid] = dur
        if as_declared(dur, row['exactMonths']) != de(row['exactMonths']):
            bad('SCH-EXACT', f'{mid}: exactMonths {row["exactMonths"]}, '
                             f'пересчёт {as_declared(dur, row["exactMonths"])}')
        else:
            ok(f'{mid}: модельная длительность {row["exactMonths"]} мес.')
        rd = r(dur, '0.5')
        rounded_dur[bid] = rd
        if rd != de(row['roundedMonths']):
            bad('SCH-ROUND', f'{mid}: roundedMonths {row["roundedMonths"]}, '
                             f'округление {rd}')
        start = add_months(epoch, cat['PLANNING_MONTHS'] + de(row['startOffsetMonths']))
        if start != cell(row['startDate']):
            bad('SCH-START', f'{mid}: startDate {row["startDate"]}, '
                             f'epoch + Planung + Versatz = {start}')
        end = add_months(start, rd)
        ends[bid] = end
        if end != cell(row['endDate']):
            bad('SCH-END', f'{mid}: endDate {row["endDate"]}, '
                           f'начало + округлённая длительность = {end}')
        else:
            ok(f'{mid}: {start} → {end}')
        # Подпись выводится из ДАТ, а не из округлённого числа (D-17).
        whole = whole_calendar_months(start, end)
        policy = 'wholeCalendarMonthsElseDays' if whole is not None else 'halfMonthRounded'
        prefix = '' if whole is not None else ('≈' if rd != dur else '')
        if policy != cell(row['displayPolicy']):
            bad('SCH-POLICY', f'{mid}: displayPolicy {row["displayPolicy"]}, выводится {policy}')
        if prefix != cell(row['prefix']).strip('"'):
            bad('SCH-PREFIX', f'{mid}: prefix {row["prefix"]}, выводится «{prefix}»')

    # Проект: max(start + dauer) по ТОЧНЫМ длительностям — правило 39 и
    # инвариант 14.1 (округлённое значение есть показ и во внутренний счёт
    # не входит). Дата конца, наоборот, берётся из округлённой (§4).
    proj = sch['DEMO2-SCH-PROJECT']
    proj_exact = max(cat['PLANNING_MONTHS'] + de(sch[m]['startOffsetMonths']) + exact_dur[cell(sch[m]['buildingId'])]
                     for m in sch if cell(sch[m]['kind']) == 'buildingExecution')
    proj_rounded_source = max(cat['PLANNING_MONTHS'] + de(sch[m]['startOffsetMonths']) + rounded_dur[cell(sch[m]['buildingId'])]
                              for m in sch if cell(sch[m]['kind']) == 'buildingExecution')
    proj_sum = cat['PLANNING_MONTHS'] + sum(exact_dur.values(), D(0))
    if as_declared(proj_exact, proj['exactMonths']) != de(proj['exactMonths']):
        detail = ''
        if de(proj['exactMonths']) == proj_rounded_source:
            detail = (' — объявленная величина получена из ОКРУГЛЁННЫХ длительностей '
                      'зданий, а округлённое есть показ и во внутренний счёт не входит '
                      '(CALC-007, инвариант 14.1)')
        bad('SCH-PROJECT-EXACT',
            f'DEMO2-SCH-PROJECT: exactMonths {proj["exactMonths"]}, '
            f'max(start + точная длительность) = '
            f'{as_declared(proj_exact, proj["exactMonths"])}{detail}')
    else:
        ok(f'срок комплекса: точный {as_declared(proj_exact, proj["exactMonths"])} мес.')
    if as_declared(proj_sum, proj['exactMonths']) == de(proj['exactMonths']):
        bad('SCH-PROJECT-SUM', 'срок комплекса равен СУММЕ длительностей — правило 39 '
                               'требует max(start + dauer)')
    proj_rounded = r(proj_exact, '0.5')
    if proj_rounded != de(proj['roundedMonths']):
        bad('SCH-PROJECT-ROUND', f'DEMO2-SCH-PROJECT: roundedMonths {proj["roundedMonths"]}, '
                                 f'округление точного = {proj_rounded}')
    proj_end = max(ends.values())
    if proj_end != cell(proj['endDate']):
        bad('SCH-PROJECT-END', f'DEMO2-SCH-PROJECT: endDate {proj["endDate"]}, '
                               f'max(конец зданий) = {proj_end}')
    else:
        ok(f'конец комплекса = max(конец зданий) = {proj_end}')
    # Подпись строки комплекса выводится теми же правилами, что и у зданий.
    # Она проверяется отдельно от величины: строка, где `exactMonths` равен
    # округлённому, обязана идти БЕЗ префикса — и если префикс объявлен, то
    # строка противоречит сама себе независимо от того, какое из двух чтений
    # «длительности комплекса» считать верным.
    proj_whole = whole_calendar_months(cell(proj['startDate']), cell(proj['endDate']))
    proj_policy = ('wholeCalendarMonthsElseDays' if proj_whole is not None
                   else 'halfMonthRounded')
    if proj_policy != cell(proj['displayPolicy']):
        bad('SCH-POLICY', f'DEMO2-SCH-PROJECT: displayPolicy {proj["displayPolicy"]}, '
                          f'выводится {proj_policy}')
    # Префикс движок выводит как «округлённое ≠ точного». Проверяются ДВА
    # чтения: по пересчитанному точному сроку и по тому, который объявлен.
    # Расхождение между ними и есть доказательство, что неверна величина, а
    # не подпись: подпись `≈` верна, а `exactMonths`, при котором она была бы
    # запрещена, — нет.
    proj_prefix = '' if proj_whole is not None else (
        '≈' if proj_rounded != proj_exact else '')
    prefix_if_declared = '' if proj_whole is not None else (
        '≈' if de(proj['roundedMonths']) != de(proj['exactMonths']) else '')
    if proj_prefix != cell(proj['prefix']).strip('"'):
        bad('SCH-PREFIX', f'DEMO2-SCH-PROJECT: prefix {proj["prefix"]}, '
                          f'выводится «{proj_prefix}»')
    elif prefix_if_declared != proj_prefix:
        bad('SCH-PREFIX-SELF',
            f'DEMO2-SCH-PROJECT: prefix `{proj_prefix}` верен по существу, но из '
            f'ОБЪЯВЛЕННЫХ в этой же строке exactMonths {proj["exactMonths"]} и '
            f'roundedMonths {proj["roundedMonths"]} движок вывел бы '
            f'«{prefix_if_declared}» — строка противоречит сама себе, и чинить '
            f'надо величину, а не подпись')
    # Строка комплекса несёт входы формулы, которые к ней НЕ применяются.
    try:
        trap_inputs = (de(proj['bgfAbove']), de(proj['formFactorTime']),
                       de(proj['classFactorTime']))
    except Exception:
        trap_inputs = None
        ok('строка комплекса не несёт входов формулы длительности')
    if trap_inputs and any(trap_inputs):
        formula_if_applied = (D(5) + (trap_inputs[0] - 1000) / 750) \
            * trap_inputs[1] * trap_inputs[2]
        if r(formula_if_applied, '0.5') != de(proj['roundedMonths']):
            bad('SCH-PROJECT-TRAP',
                f'строка комплекса несёт bgfAbove {proj["bgfAbove"]} и множители, по '
                f'которым формула длительности даёт '
                f'{fmt_de(r(formula_if_applied, "0.5"), 1)} мес. вместо '
                f'{proj["roundedMonths"]}. К комплексу формула НЕ применяется '
                f'(правило 39: max(start + dauer)), а колонки приглашают её '
                f'применить — тот же класс, что смешение стоимостной и срочной '
                f'таблиц множителей')

    # ── D. контрольные величины ───────────────────────────────────────────
    ctrl = {cell(r_['controlId']): r_ for r_ in t['Control values']}
    expect = {}
    for bid, letter in ((b, b.split('-')[-1]) for b in bld):
        expect[letter] = subtotal[bid]

    def check_money(cid, computed):
        row = ctrl[cid]
        got = de(row['storedExact'])
        if got != computed:
            bad('CTRL-VALUE', f'{cid}: поставка {row["storedExact"]}, '
                              f'пересчёт {fmt_de(computed, 2)} €')
            return
        disp_expected = fmt_de(r(computed, '1000'), 0)
        prefix = '≈ ' if r(computed, '1000') != computed else ''
        want = f'{prefix}{disp_expected} €'
        if flat(row['display']) != want:
            bad('CTRL-DISPLAY', f'{cid}: показ «{flat(row["display"])}», по CALC-007 «{want}»')
        else:
            ok(f'{cid}: {fmt_de(computed, 2)} € → «{flat(row["display"])}»')

    check_money('DEMO2-CTRL-01', subtotal['DEMO2-B-A'])
    check_money('DEMO2-CTRL-02', subtotal['DEMO2-B-B'])
    check_money('DEMO2-CTRL-03', subtotal['DEMO2-B-C'])
    check_money('DEMO2-CTRL-04', complex_total)

    def check_rate(cid, numerator, denominator, unit_label):
        row = ctrl[cid]
        if de(row['denominator']) != denominator:
            bad('CTRL-DENOM', f'{cid}: знаменатель {row["denominator"]}, '
                              f'пересчёт {fmt_de(denominator, 2)} m²')
        rate = numerator / denominator
        got = de(row['storedExact'])
        if q12(rate) != q12(got):
            bad('CTRL-VALUE', f'{cid}: поставка {row["storedExact"]}, '
                              f'пересчёт {q12(rate)} €/m²')
            return
        # Правило 32: удельная × площадь обязана вернуть числитель.
        back = q12(rate) * denominator
        if abs(back - numerator) > D('0.000001') * denominator:
            bad('CTRL-ROUNDTRIP', f'{cid}: удельная × площадь = {fmt_de(back, 2)} ≠ '
                                  f'{fmt_de(numerator, 2)} €')
        rounded = r(rate, '1')
        prefix = '≈ ' if rounded != rate else ''
        disp = f'{prefix}{fmt_de(rounded, 0)} €/m² {unit_label}'
        if flat(row['display']) != disp:
            bad('CTRL-DISPLAY', f'{cid}: показ «{flat(row["display"])}», ожидается «{disp}»')
        else:
            ok(f'{cid}: {q12(rate)} €/m² → «{flat(row["display"])}»')
        return rate

    a1 = check_rate('DEMO2-CTRL-05', subtotal['DEMO2-B-A'], de(seg['DEMO2-S-A1']['denominator']),
                    'WFL nach WoFlV')
    b1 = check_rate('DEMO2-CTRL-06', subtotal['DEMO2-B-B'], de(seg['DEMO2-S-B1']['denominator']),
                    'WFL nach WoFlV')
    check_rate('DEMO2-CTRL-07', subtotal['DEMO2-B-C'], de(seg['DEMO2-S-C1']['denominator']),
               'NUF nach DIN 277')

    wohnen_cost = subtotal['DEMO2-B-A'] + subtotal['DEMO2-B-B']
    wohnen_area = de(seg['DEMO2-S-A1']['denominator']) + de(seg['DEMO2-S-B1']['denominator'])
    agg = check_rate('DEMO2-CTRL-08', wohnen_cost, wohnen_area, 'WFL nach WoFlV')
    # Правило 39 «от сумм, никогда как среднее из средних» — проверка с зубами:
    # среднее обязано ОТЛИЧАТЬСЯ, иначе проверка ничего не доказывает.
    if agg is not None and a1 is not None and b1 is not None:
        mean = (a1 + b1) / 2
        if q12(mean) == q12(agg):
            bad('AGG-TOOTHLESS', 'DEMO2-CTRL-08: среднее из средних совпало с агрегатом — '
                                 'фикстура не отличает правило 39 от его нарушения')
        else:
            ok(f'правило 39 различимо: среднее из средних {q12(mean)} ≠ агрегат {q12(agg)}')

    above = sum(de(b['bgfRAbove']) + de(b['bgfSAbove']) for b in bld.values())
    below = sum(de(b['bgfRBelow']) + de(b['bgfSBelow']) for b in bld.values())
    check_rate('DEMO2-CTRL-09', complex_total, above, 'BGF oberirdisch')
    if de(ctrl['DEMO2-CTRL-09']['denominator']) == above + below:
        bad('DATA-001', 'DEMO2-CTRL-09: знаменатель включает подземную площадь '
                        'под подписью «oberirdisch»')
    else:
        ok(f'DATA-001: знаменатель «oberirdisch» = {fmt_de(above, 2)} m², '
           f'подземные {fmt_de(below, 2)} m² исключены')

    row10 = ctrl['DEMO2-CTRL-10']
    if de(row10['storedExact']) != proj_rounded:
        bad('CTRL-VALUE', f'DEMO2-CTRL-10: поставка {row10["storedExact"]}, '
                          f'округление точного срока {proj_rounded}')
    dd, mm, yy = proj_end.split('-')[::-1]
    want10 = f'{proj_prefix}{" " if proj_prefix else ""}{fmt_de(proj_rounded, 1)} Monate · {dd}.{mm}.{yy}'
    if flat(row10['display']) != want10:
        bad('CTRL-DISPLAY', f'DEMO2-CTRL-10: показ «{flat(row10["display"])}», '
                            f'ожидается «{want10}»')
    else:
        ok(f'DEMO2-CTRL-10: «{flat(row10["display"])}» (D-17: абсолютная дата рядом)')

    # ── E. инварианты выдачи ──────────────────────────────────────────────
    cov = {cell(r_['costGroup']): r_ for r_ in t['Coverage']}
    unknown = sorted(g for g, r_ in cov.items() if cell(r_['state']) == 'unknown')
    comp = t['Completeness control'][0]
    if sorted(cell(comp['unknownGroups']).split(',')) != unknown:
        bad('COV-LIST', f'unknownGroups {comp["unknownGroups"]} ≠ '
                        f'{",".join(unknown)} по таблице Coverage')
    if int(cell(comp['unknownCount'])) != len(unknown):
        bad('COV-COUNT', f'unknownCount {comp["unknownCount"]} ≠ {len(unknown)}')
    want_label = ('Zwischensumme der kalkulierten Positionen' if unknown
                  else 'Gesamt netto · Grundleistung All3')
    if cell(comp['totalLabel']) != want_label:
        bad('R-18', f'totalLabel «{comp["totalLabel"]}», при {len(unknown)} '
                    f'неизвестных группах требуется «{want_label}»')
    else:
        ok(f'правило 16/31 и R-18: подпись «{want_label}»')
    if re.search(r'\bGesamt\b(?!\s+netto\s·)', cell(comp['totalLabel'])):
        bad('R-18', 'в подписи итога стоит неквалифицированное «Gesamt»')

    # Колонка объявлена точной суммой — значит обязана ею быть. Доли 70/22/8
    # вычислимы от итога, поэтому исправление здесь — не спор о названии
    # колонки, а подстановка величин, которые скрипт тут же и называет.
    SPLIT = {'KG_300': D('0.70'), 'KG_400': D('0.22'), 'KG_700': D('0.08')}
    tokens = {g: cell(row['pricedAmountExact']) for g, row in cov.items()
              if cell(row['pricedAmountExact']).startswith('allocation_')}
    if tokens:
        amounts = {g: complex_total * SPLIT[g] for g in tokens if g in SPLIT}
        if sum(amounts.values(), D(0)) != complex_total:
            bad('COV-SPLIT', 'доли 70/22/8 не складываются в итог')
        bad('COV-TYPE',
            'колонка `pricedAmountExact` у ' + ', '.join(sorted(tokens)) + ' несёт '
            'долю, а не сумму (' + ', '.join(f'{g}: {tokens[g]}' for g in sorted(tokens))
            + '). Колонка, названная точной суммой и не являющаяся ею, непроверяема '
            'машиной; величины вычислимы от итога и равны '
            + ' · '.join(f'{g} = {fmt_de(amounts[g], 3).rstrip("0").rstrip(",")} €'
                         for g in sorted(amounts))
            + ' (сумма сходится с итогом)')
    else:
        ok('покрытие: все точные суммы объявлены суммами')

    body = norm(DELIVERY.read_text(encoding='utf-8'))
    if re.search(r'WFL\s*\+\s*NUF|Σ\s*WFL\s*\+\s*Σ\s*NUF', body):
        if 'Interne Bezugsgröße' not in body:
            bad('R-11', 'объединённая WFL + NUF встречается без пометки '
                        '«Interne Bezugsgröße»')
    else:
        ok('R-11: объединённой WFL + NUF в поставке нет')

    # Правило 7: разделитель числа и единицы — только U+202F.
    raw = DELIVERY.read_text(encoding='utf-8')
    for m in re.finditer(r'\d[   ](€|m²|%|Monate)', raw):
        bad('U202F', f'разделитель не U+202F: «{m.group(0)!r}»')
    ok('правило 7: разделитель числа и единицы — U+202F')

    # Столкновения идентификаторов с первым сценарием.
    demo1 = (ROOT / 'src/fixtures/demo-0001.json').read_text(encoding='utf-8')
    ids = set(re.findall(r'`(DEMO2-[A-Z0-9-]+)`', raw))
    clash = sorted(i for i in ids if i in demo1)
    if clash:
        bad('ID-CLASH', f'идентификаторы пересекаются с DEMO-0001: {clash}')
    else:
        ok(f'{len(ids)} идентификаторов сценария 2, пересечений с DEMO-0001 нет')

    # ── F. готовность движка выразить сценарий ────────────────────────────
    # ── E2. заголовок вердикта — это утверждение, и оно проверяется ───────
    verdict = ROOT / 'docs/audit/verdicts/codex-scenario-2-260807.md'
    if verdict.exists():
        head = norm(verdict.read_text(encoding='utf-8')).splitlines()[0]
        claims = {
            'зданий': (len(bld), r'зданий (\d+)'),
            'контрольных величин': (len(ctrl), r'контрольных величин (\d+)'),
            'множителей вне каталога': (
                sum(1 for c, _ in findings if c.startswith('CAT-')),
                r'множителей вне каталога: (\d+)'),
            'конфликтов с DEMO-0001': (
                sum(1 for c, _ in findings if c == 'ID-CLASH'),
                r'конфликтов с DEMO-0001: (\d+)'),
        }
        for what, (actual, pattern) in claims.items():
            m = re.search(pattern, head)
            if not m:
                bad('HEAD-MISSING', f'заголовок вердикта не называет «{what}»')
            elif int(m.group(1)) != actual:
                bad('HEAD-CLAIM', f'заголовок вердикта: {what} = {m.group(1)}, '
                                  f'проверка даёт {actual}')
        if not any(c.startswith('HEAD-') for c, _ in findings):
            ok('заголовок вердикта сходится с проверкой по всем четырём числам')

    eng = ENGINE.read_text(encoding='utf-8')
    if any(de(b['bgfSAbove']) != 0 for b in bld.values()) and 'bgfS' not in eng:
        blocker('ENGINE-BGF-S',
                'сценарий назначает BGF S (считается по f_S = 0,40 от ставки R), а '
                '`BuildingInput` знает одну `bgfAboveGround` и множит её на полную '
                'ставку. Сегодня выразить сценарий движок не может: подача 1.700 '
                'даёт зданию A 2.705.295 € вместо 2.939.814 €')
    if 'ab_decke' in {cell(b['untergeschoss']) for b in bld.values()} \
            and "=== 'ab_decke'" not in eng:
        blocker('ENGINE-AB-DECKE',
                "сценарий содержит `ab_decke`, а ветка UG в `calculate.ts` покрывает "
                "только `vollausbau`: остальные режимы молча дают 0 €. Здание с "
                "подвалом и нулевой его стоимостью — запрещённый ноль (правило 16)")
    if 'hasParking' in eng and 'b.hasParking' not in eng:
        blocker('ENGINE-PARKING',
                '`hasParking` объявлен во входе, но движком не читается: надбавка '
                'зашита в единственную ставку `vollausbauMitTiefgarage` = 1.190. '
                'Здание A (vollausbau БЕЗ паркинга) посчиталось бы по 1.190 вместо '
                '1.100 — на 27.000 € дороже')
    if not blockers:
        ok('движок выражает сценарий: BGF S, режимы UG и паркинг читаются')

    # ── отчёт ─────────────────────────────────────────────────────────────
    print(f'СЦЕНАРИЙ 2 · проверок пройдено: {len(checked)} · '
          f'расхождений поставки: {len(findings)} · '
          f'блокеров интеграции: {len(blockers)}')
    print()
    if findings:
        print('РАСХОЖДЕНИЯ ПОСТАВКИ (правятся в поставке, зона Codex)')
        for code, what in findings:
            print(f'  ✗ {code}: {what}')
        print()
    if blockers:
        print('БЛОКЕРЫ ИНТЕГРАЦИИ (поставка верна, правится `src`, зона Claude)')
        for code, what in blockers:
            print(f'  ⛔ {code}: {what}')
        print()
    for c in checked:
        print(f'  ✓ {c}')
    return 1 if (findings or blockers) else 0


def selftest():
    """Мутационный самотест: каждая подделка обязана быть поймана.

    Проверка идёт в ОБЕ стороны: подделка ловится, а немутированный файл в тех
    же условиях даёт тот же набор находок, что и обычный запуск. Детектор,
    ловящий всё подряд, бесполезен ровно так же, как молчащий.
    """
    global DELIVERY
    import tempfile
    original = DELIVERY_DEFAULT.read_text(encoding='utf-8')
    base = run_quiet(DELIVERY_DEFAULT)
    mutations = [
        ('COST-VALUE', '2.546.160,00', '2.546.161,00', 'стоимость BGF R здания A'),
        ('COST-EXPR', '1.600,00 × 1.545,00', '1.601,00 × 1.545,00', 'выражение BGF R'),
        ('CAT-VALUE', '| `F_S` | 0,40 |', '| `F_S` | 0,45 |', 'ставка f_S в каталоге'),
        ('CTRL-VALUE', '2.409,683606557377', '2.409,683606557378', 'удельная сегмента A1'),
        ('CTRL-DISPLAY', '≈\u202f2.940.000\u202f€', '≈\u202f2.941.000\u202f€',
         'показ итога здания A'),
        ('CTRL-DENOM', '| 1.220,00\u202fm² | `WFL_WOFLV`', '| 1.230,00\u202fm² | `WFL_WOFLV`',
         'знаменатель контрольной величины'),
        ('SCH-END', '`2028-11-01` | 1.700,00', '`2028-12-01` | 1.700,00',
         'дата конца здания A'),
        ('SCH-FACTOR', '| 1,00 | 1,05 | 6,230000', '| 1,00 | 1,15 | 6,230000',
         'срочный множитель класса'),
        ('R-18', 'Zwischensumme der kalkulierten Positionen |',
         'Gesamt netto · Grundleistung All3 |', 'подпись итога при пробеле'),
        ('COV-COUNT', '| `KG_500,KG_600` | 2 |', '| `KG_500,KG_600` | 3 |',
         'число неизвестных групп'),
        ('U202F', '2.939.814,00\u202f€', '2.939.814,00 €', 'разделитель числа и единицы'),
        ('DATA-001', '`1.700,00 + 3.300,00 + 1.300,00`\u202fm² | `BGF_ABOVE_GROUND`',
         '`1.700,00 + 3.300,00 + 1.300,00 + 500,00`\u202fm² | `BGF_ABOVE_GROUND`',
         'подземная площадь под подписью oberirdisch'),
        ('AXIS-D11', '| Haus A | `true` | `MFH` |', '| Haus A | `true` | `HOTEL` |',
         'значение оси назначения в колонке формы'),
    ]
    # Лечащие мутации: применяем предложенное исправление и требуем, чтобы
    # находка ИСЧЕЗЛА. Без этой стороны отчёт предлагал бы правки, ни одна из
    # которых не проверена на то, что она чинит названное.
    healings = [
        ('SCH-PROJECT-EXACT', [('| 15,500000 | 15,5 |', '| 15,276667 | 15,5 |')],
         'точный срок комплекса из точных длительностей'),
        ('SCH-PREFIX-SELF', [('| 15,500000 | 15,5 |', '| 15,276667 | 15,5 |')],
         'та же правка снимает и самопротиворечие подписи'),
        ('RUN-UNDECLARED', [('`DEMO2-RUN-0001`', '`DEMO2-RUN-0004`'),
                            ('`DEMO2-RUN-0002`', '`DEMO2-RUN-0004`'),
                            ('`DEMO2-RUN-0003`', '`DEMO2-RUN-0004`')],
         'все контрольные величины одного объявленного прогона'),
        ('COV-TYPE', [('`allocation_70pct`', '7.427.601,58\u202f€'),
                      ('`allocation_22pct`', '2.334.389,068\u202f€'),
                      ('`allocation_8pct`', '848.868,752\u202f€')],
         'доли заменены вычисленными суммами'),
    ]
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / 'mutated.md'
        for code, old, new, what in mutations:
            if old not in original:
                failures.append(f'{code}: якорь мутации не найден — «{old}»')
                continue
            path.write_text(original.replace(old, new, 1), encoding='utf-8')
            codes = run_quiet(path)
            if code not in codes:
                failures.append(f'{code}: подделка «{what}» НЕ поймана '
                                f'(поймано: {sorted(set(codes)) or "ничего"})')
        for code, pairs, what in healings:
            if code not in base:
                failures.append(f'{code}: лечить нечего — находки нет на исходнике')
                continue
            text = original
            for old, new in pairs:
                if old not in text:
                    failures.append(f'{code}: якорь лечения не найден — «{old}»')
                    text = None
                    break
                text = text.replace(old, new)
            if text is None:
                continue
            path.write_text(text, encoding='utf-8')
            codes = run_quiet(path)
            if code in codes:
                failures.append(f'{code}: исправление «{what}» находку НЕ сняло')
    print(f'САМОТЕСТ: подделок {len(mutations)} · исправлений {len(healings)} · '
          f'не сработало {len(failures)} · '
          f'находок на неизменённой поставке {len(base)}')
    for f in failures:
        print(f'  ✗ {f}')
    return 1 if failures else 0


def run_quiet(path):
    """Прогон по указанному файлу; возвращает коды находок, ничего не печатая."""
    global DELIVERY
    import contextlib
    import io
    prev = DELIVERY
    DELIVERY = path
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            main()
        return [c for c, _ in findings]
    finally:
        DELIVERY = prev


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    if len(sys.argv) > 1:
        DELIVERY = pathlib.Path(sys.argv[1])
    sys.exit(main())
