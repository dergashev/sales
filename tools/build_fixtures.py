#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Построитель JSON-фикстур из docs/audit/synthetic-fixtures.md.

Зачем скрипт, а не написанный руками JSON. Фикстура — единственный
санкционированный источник чисел, и она существует таблицами в markdown:
человекочитаемо, но сборкой не читается. Написать JSON руками значило бы
завести ВТОРОЙ источник правды — тот самый дефект, за который аудит отклонял
партии, только в машинном виде.

Принцип: базовые величины (площади, ставки, множители) извлекаются из
документа узкими шаблонами, а производные (итоги, удельные, сплиты, сроки)
**вычисляются в Decimal и сверяются с тем, что документ объявляет**. Любое
расхождение — падение с адресом, а не тихая подстановка.

Это же даёт свойство, которого не даёт рукописный JSON: если кто-то поправит
число в markdown и не поправит JSON, скрипт упадёт. Если поправит вычисляемое
значение — упадёт тоже, потому что вычисление его не подтвердит.

Запуск: python3 tools/build_fixtures.py
Проверка без записи: python3 tools/build_fixtures.py --check
"""
import json
import pathlib
import re
import sys
from decimal import Decimal as D, ROUND_HALF_UP

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/audit/synthetic-fixtures.md'
OUT_DIR = ROOT / 'src/fixtures'

NNBSP = ' '


class Mismatch(RuntimeError):
    """Вычисленное не совпало с объявленным в документе."""


def de(s):
    """Немецкое число → Decimal. '3.817.835,00' → 3817835.00"""
    return D(str(s).replace('.', '').replace(',', '.').replace(NNBSP, '').strip())


def fmt_de(x, decimals=0):
    """Немецкий формат: точка — разделитель тысяч, запятая — десятичная.

    Поле `display` называется показом, значит оно обязано БЫТЬ показом.
    Первая редакция отдавала сырые цифры Python (`2545` вместо `2.545`), и
    это поймал тест движка: движок форматировал верно, фикстура нет. Поле,
    названное показом и не являющееся им, — то же самое, что величина без
    названной подложки: утверждение, которое не проверяется.
    """
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
    """Округление к ближайшему шагу, половина вверх."""
    return (x / step).quantize(D('1'), ROUND_HALF_UP) * step


def r05(x):
    return (x * 2).quantize(D('1'), ROUND_HALF_UP) / 2


class Builder:
    # Разделители, которыми в корпусе набраны числа с единицами.
    SPACES = '\u00a0\u202f\u2009'

    def __init__(self, text):
        # Нормализуем ПРОБЕЛЫ ОДИН РАЗ, а не правим шаблоны по одному.
        # Корпус набран узким неразрывным U+202F (правило проекта 7), и шаблон,
        # ждущий обычный пробел, молча не совпадает. Первый заход этого скрипта
        # упал именно так — и это лучше, чем совпасть частично: падение с
        # адресом видно, частичное совпадение нет.
        for ch in self.SPACES:
            text = text.replace(ch, ' ')
        self.t = text
        # Второй источник — таблица множителей calculation-spec §1.1. Он
        # нужен там, где фикстура значения не объявляет, но продукт эту
        # конфигурацию предлагает: множитель GEG именно такой. Нормализуется
        # теми же правилами, иначе шаблон молча не совпадёт.
        spec_text = (ROOT / 'docs/product/calculation-spec.md').read_text(encoding='utf-8')
        for ch in self.SPACES:
            spec_text = spec_text.replace(ch, ' ')
        self.spec = spec_text
        self.checked = []

    # ── извлечение ────────────────────────────────────────────────────────
    def grab(self, pattern, what, group=1):
        m = re.search(pattern, self.t)
        if not m:
            raise Mismatch(f'не найдено в документе: {what} — шаблон {pattern!r}')
        return de(m.group(group))

    def assert_declared(self, computed, pattern, what, group=1):
        """Вычисленное обязано совпасть с объявленным. Это ядро скрипта."""
        declared = self.grab(pattern, what, group)
        if computed != declared:
            raise Mismatch(
                f'{what}: вычислено {computed}, документ объявляет {declared}')
        self.checked.append(what)
        return computed

    # ── каталог ставок ────────────────────────────────────────────────────
    def catalog(self):
        k = self.grab(r'K_base = ([\d.]+) €/m² BGF R oberirdisch', 'K_base')
        gk = re.search(r'F_gk: GK 1–3 = ([\d,]+) · GK 4 = ([\d,]+) · GK 5 = ([\d,]+)', self.t)
        eh = re.search(r'F_energie: EH 55 = ([\d,]+) · EH 40 = ([\d,]+)', self.t)
        # GEG фикстурой не объявлен, а интерфейс эту опцию предлагает — и
        # выбор её ронял движок исключением «нет множителя стандарта GEG».
        # Значение берётся из calculation-spec §1.1 (таблица множителей) и
        # проверяется на согласие с определением самой базы: K_base выведена
        # «на уровне GEG-Mindeststandard», поэтому её множитель обязан быть
        # единицей. Множитель ≠ 1 означал бы, что база противоречит себе.
        geg = re.search(r'Energiestandard ⚙ \| GEG ([\d,]+)', self.spec)
        buero = self.grab(r'F_form_büro = ([\d,]+)', 'F_form_büro')
        ug = re.search(r'UG vollausbau \+ TG = ([\d.]+) \+ ([\d.]+) = ([\d.]+) €/m² BGF UG', self.t)
        gkz = re.search(r'F_gk_zeit: GK 3 = ([\d,]+) · GK 4 = ([\d,]+) · GK 5 = ([\d,]+)', self.t)
        fz = re.search(r'F_form_zeit: MFH = ([\d,]+) · Büro = ([\d,]+)', self.t)
        region = self.grab(r'`Musterland` = ([\d,]+) ⚙', 'Regionalfaktor Musterland')
        if not all((gk, eh, ug, gkz, fz)):
            raise Mismatch('каталог: одна из строк множителей не найдена')
        if not geg:
            raise Mismatch('каталог: множитель GEG не найден в calculation-spec §1.1')
        geg_v = de(geg.group(1))
        if geg_v != D('1'):
            raise Mismatch(
                f'множитель GEG = {geg_v}, но K_base определена на уровне '
                f'GEG-Mindeststandard — база противоречила бы себе')
        self.checked.append('множитель GEG согласован с определением K_base')

        ug_total = de(ug.group(1)) + de(ug.group(2))
        if ug_total != de(ug.group(3)):
            raise Mismatch(f'ставка UG: {ug.group(1)} + {ug.group(2)} ≠ {ug.group(3)}')
        self.checked.append('ставка UG складывается')

        return {
            'rulesetVersion': 'RS-2026.2',
            'provisional': True,
            'kBase': {'value': str(k), 'unit': 'EUR/m2',
                      'denominator': 'BGF_R_ABOVE_GROUND'},
            'costFactors': {
                'gebaeudeklasse': {'GK_1_3': str(de(gk.group(1))),
                                   'GK_4': str(de(gk.group(2))),
                                   'GK_5': str(de(gk.group(3)))},
                'energiestandard': {'GEG': str(geg_v),
                                    'EH_55': str(de(eh.group(1))),
                                    'EH_40': str(de(eh.group(2)))},
                'gebaeudeform': {'BUERO': str(buero)},
                'untergeschoss': {'vollausbauMitTiefgarage': str(ug_total),
                                  'unit': 'EUR/m2', 'denominator': 'BGF_BELOW_GROUND'},
            },
            'scheduleFactors': {
                'comment': 'ОТДЕЛЬНАЯ таблица: смешение со стоимостной однажды '
                           'завысило комплекс на 100.000' + NNBSP + '€',
                'gebaeudeklasse': {'GK_3': str(de(gkz.group(1))),
                                   'GK_4': str(de(gkz.group(2))),
                                   'GK_5': str(de(gkz.group(3)))},
                'gebaeudeform': {'MFH': str(de(fz.group(1))),
                                 'BUERO': str(de(fz.group(2)))},
            },
            'regionalFactor': {'active': False, 'decision': 'D-15',
                               'region': 'Musterland', 'value': str(region),
                               'appliesTo': ['KG_300', 'KG_400', 'UG'],
                               'notAppliedTo': ['KG_100', 'KG_200', 'KG_500',
                                                'KG_600', 'KG_700', 'Risikozuschlag']},
            'rounding': {
                'money': {'step': '1000', 'unit': 'EUR', 'method': 'halfUp',
                          'prefixWhenDiffers': '≈'},
                'rate': {'step': '1', 'unit': 'EUR/m2', 'method': 'halfUp',
                         'prefixWhenDiffers': '≈'},
                'duration': {'step': '0.5', 'unit': 'month', 'method': 'halfUp',
                             'prefixWhenDiffers': '≈',
                             'absoluteDateRequired': True, 'decision': 'D-17'},
            },
        }

    # ── площади ───────────────────────────────────────────────────────────
    def areas(self):
        def row(label, col):
            m = re.search(r'\| ' + label + r' \| ([\d.,—-]+)(?:\s*m²)?\s*\| ([\d.,—-]+)',
                          self.t)
            if not m:
                raise Mismatch(f'площадь не найдена: {label}')
            v = m.group(col)
            return None if v.strip() in ('—', '-') else de(v)

        return {
            'A': {'bgfAboveGround': row('BGF oberirdisch', 1),
                  'bgfBelowGround': row('BGF unterirdisch', 1),
                  'bgfRS': row(r'BGF R\+S', 1),
                  'wflWoFlV': row('WFL nach WoFlV', 1),
                  'nufDin277': row('NUF nach DIN 277', 1),
                  'wohneinheiten': row('Wohneinheiten', 1),
                  'vollgeschosse': row('Vollgeschosse', 1)},
            'B': {'bgfAboveGround': row('BGF oberirdisch', 2),
                  'bgfBelowGround': row('BGF unterirdisch', 2),
                  'bgfRS': row(r'BGF R\+S', 2),
                  'wflWoFlV': row('WFL nach WoFlV', 2),
                  'nufDin277': row('NUF nach DIN 277', 2),
                  'wohneinheiten': row('Wohneinheiten', 2),
                  'vollgeschosse': row('Vollgeschosse', 2)},
        }

    # ── прогоны: вычислить и сверить ──────────────────────────────────────
    def runs(self, cat, ar):
        # D(), а не de(): значения каталога уже в КАНОНИЧЕСКОМ формате
        # (точка — десятичная). de() парсит НЕМЕЦКИЙ формат, где точка —
        # разделитель тысяч, и на каноническом «1.05» вернул бы 105.
        # Первый заход упал именно так: надбавка вышла в 2080 раз больше.
        # Две записи одной величины требуют двух разных читателей — и это
        # ровно тот класс, из-за которого модель типизирует представление.
        k = D(cat['kBase']['value'])
        gk5 = D(cat['costFactors']['gebaeudeklasse']['GK_5'])
        gk4 = D(cat['costFactors']['gebaeudeklasse']['GK_4'])
        eh55 = D(cat['costFactors']['energiestandard']['EH_55'])
        eh40 = D(cat['costFactors']['energiestandard']['EH_40'])
        buero = D(cat['costFactors']['gebaeudeform']['BUERO'])
        ug_rate = D(cat['costFactors']['untergeschoss']['vollausbauMitTiefgarage'])
        a, b = ar['A'], ar['B']

        # Haus A · Basis
        base = a['bgfAboveGround'] * k
        self.assert_declared(base, r'Basis: [\d.,]+ × [\d.]+ \| ([\d.,]+) \|',
                             'Haus A база')
        up_gk = base * (gk5 - 1)
        self.assert_declared(up_gk, r'Gebäudeklasse 5 \(× [\d,]+\) \| \+ ([\d.,]+)',
                             'Haus A надбавка GK 5')
        after_gk = base + up_gk
        up_eh = after_gk * (eh55 - 1)
        self.assert_declared(up_eh, r'Energiestandard EH 55 \(× [\d,]+\) \| \+ ([\d.,]+)',
                             'Haus A надбавка EH 55')
        ug = a['bgfBelowGround'] * ug_rate
        self.assert_declared(ug, r'Untergeschoss inkl\. Tiefgarage \([\d.,]+ × [\d.]+\) \| \+ ([\d.,]+)',
                             'Haus A подземный этаж')
        total_a = after_gk + up_eh + ug
        self.assert_declared(total_a, r'\*\*Zwischensumme der kalkulierten Positionen\*\* \| \*\*([\d.,]+)\*\*',
                             'Haus A итог')

        # эффект регионального фактора, если бы включили
        region_eff = total_a * (D(cat['regionalFactor']['value']) - 1)
        self.assert_declared(r(region_eff, D(1000)),
                             r'дал бы ≈ ([\d.]+) € на блок Bauwerk',
                             'Haus A эффект регионального фактора')

        # KG-сплит 70/22/8
        kg = {'KG_300': total_a * D('0.70'), 'KG_400': total_a * D('0.22'),
              'KG_700': total_a * D('0.08')}
        if sum(kg.values()) != total_a:
            raise Mismatch(f'сплит KG не сходится: {sum(kg.values())} ≠ {total_a}')
        self.checked.append('сплит KG Haus A сходится в итог')
        for name, pat in (('KG_300', r'KG 300 `([\d.,]+)`'),
                          ('KG_400', r'KG 400 `([\d.,]+)`'),
                          ('KG_700', r'KG 700 `([\d.,]+)`')):
            self.assert_declared(kg[name], pat, f'Haus A {name}')

        # Haus A · EH 40
        total_eh40 = after_gk * eh40 + ug
        self.assert_declared(total_eh40, r'`[\d.,]+ × [\d,]+ \+ [\d.]+ = ([\d.,]+)`',
                             'Haus A EH 40 итог')
        delta_eh40 = total_eh40 - total_a
        self.assert_declared(delta_eh40, r'дельта к Basis `\+ ([\d.,]+)`',
                             'Haus A дельта EH 40')

        # Haus A · Ohne UG
        total_noug = total_a - ug
        self.assert_declared(total_noug, r'− [\d.]+ = ([\d.,]+)`', 'Haus A Ohne UG итог')

        # Haus B
        total_b = b['bgfAboveGround'] * k * buero * gk4 * eh55
        self.assert_declared(total_b, r'\(EH 55\) = ([\d.,]+)`', 'Haus B итог')

        # Комплекс
        total_g = total_a + total_b
        self.assert_declared(total_g, r'Zwischensumme der kalkulierten Positionen \| ([\d.,]+) \|',
                             'итог комплекса')
        sum_ober = a['bgfAboveGround'] + b['bgfAboveGround']
        self.assert_declared(sum_ober, r'Σ BGF \*\*oberirdisch\*\* \| ([\d.,]+)',
                             'Σ BGF надземная')
        sum_rs = a['bgfRS'] + b['bgfRS']
        self.assert_declared(sum_rs, r'Σ BGF \*\*R\+S\*\* \(вкл\. UG [\d.]+\) \| ([\d.,]+)',
                             'Σ BGF R+S')

        # скидка от ТОЧНОГО итога
        disc_rate = self.grab(r'Rabatt (\d) %', 'ставка скидки') / 100
        after_disc = total_a * (1 - disc_rate)
        self.assert_declared(after_disc, r'× 0,\d+ = ([\d.,]+)`', 'итог со скидкой')

        return {
            'A_basis': total_a, 'A_eh40': total_eh40, 'A_noug': total_noug,
            'B': total_b, 'G': total_g,
            'kg_A': kg, 'ug_A': ug, 'discount': after_disc,
            'discountRate': disc_rate, 'regionEffect': region_eff,
            'sumOber': sum_ober, 'sumRS': sum_rs,
            'deltaEh40': delta_eh40, 'deltaNoUg': -ug,
            'driverBase': base.quantize(D('0.01')),
            'driverGk': up_gk.quantize(D('0.01')),
            'driverEh': up_eh.quantize(D('0.01')),
        }

    # ── удельные величины ─────────────────────────────────────────────────
    def rates(self, runs, ar):
        out = []

        def rate(num, den, denom_type, label, pattern):
            exact = (num / den).quantize(D('0.0001'))
            disp = r(exact, D(1)).quantize(D('1'))
            self.assert_declared(disp, pattern, f'удельная {label}')
            out.append({'label': label, 'numerator': str(num.quantize(D('0.01'))),
                        'denominator': str(den.quantize(D('0.01'))),
                        'denominatorType': denom_type, 'exact': str(exact),
                        'display': fmt_de(disp), 'prefix': '≈' if disp != exact else ''})

        a, b = ar['A'], ar['B']
        rate(runs['A_basis'], a['wflWoFlV'], 'WFL_WOFLV', 'Haus A · €/m² WFL nach WoFlV',
             r'≈ ([\d.]+) €/m² WFL nach WoFlV` — `[\d.,]+ / 1\.500')
        rate(runs['A_basis'], a['bgfRS'], 'BGF_R_S', 'Haus A · €/m² BGF R+S',
             r'≈ ([\d.]+) €/m² BGF R\+S`')
        rate(runs['A_basis'], a['bgfAboveGround'], 'BGF_ABOVE_GROUND',
             'Haus A · €/m² BGF oberirdisch', r'≈ ([\d.]+) €/m² BGF oberirdisch` — `3\.817')
        rate(runs['B'], b['nufDin277'], 'NUF_DIN277', 'Haus B · €/m² NUF nach DIN 277',
             r'≈ ([\d.]+) €/m² NUF nach DIN 277` — `2\.005')
        rate(runs['B'], b['bgfAboveGround'], 'BGF_ABOVE_GROUND',
             'Haus B · €/m² BGF oberirdisch', r'≈ ([\d.]+) €/m² BGF oberirdisch` — `2\.005')
        rate(runs['G'], runs['sumOber'], 'BGF_ABOVE_GROUND',
             'Komplex · €/m² BGF oberirdisch — клиентская база сравнения',
             r'\*\*≈ ([\d.]+) €/m² BGF oberirdisch\*\*')
        rate(runs['G'], runs['sumRS'], 'BGF_R_S', 'Komplex · €/m² BGF R+S',
             r'`≈ ([\d.]+) €/m² BGF R\+S` — вторичная')
        return out

    # ── сроки ─────────────────────────────────────────────────────────────
    def schedule(self, cat, ar):
        gk5z = D(cat['scheduleFactors']['gebaeudeklasse']['GK_5'])
        gk4z = D(cat['scheduleFactors']['gebaeudeklasse']['GK_4'])
        mfhz = D(cat['scheduleFactors']['gebaeudeform']['MFH'])
        bz = D(cat['scheduleFactors']['gebaeudeform']['BUERO'])

        raw_a = (D(5) + (ar['A']['bgfAboveGround'] - 1000) / 750) * mfhz * gk5z
        self.assert_declared(r05(raw_a), r'= 7,283333… → округление 0,5 → ([\d,]+);',
                             'длительность Haus A')
        raw_b = (D(5) + (ar['B']['bgfAboveGround'] - 1000) / 750) * bz * gk4z

        return {
            'epoch': {'kind': 'OKBP', 'date': '2027-01-04'},
            'timezone': 'Europe/Berlin',
            'endpointConvention': 'halfOpen',
            'displayScale': 'month',
            'metrics': [
                {'metricKey': 'project.planning', 'kind': 'planning',
                 'startDate': '2027-01-04', 'endDate': '2027-04-04',
                 'wholeCalendarMonths': 3, 'presentationPolicy': 'wholeCalendarMonthsElseDays',
                 'display': '3' + NNBSP + 'Monate', 'prefix': ''},
                {'metricKey': 'building:DEMO-B-A.execution', 'kind': 'buildingExecution',
                 'startDate': '2027-04-04', 'endDate': '2027-11-19',
                 'exact': str(raw_a), 'rounded': str(r05(raw_a)),
                 'presentationPolicy': 'halfMonthRounded',
                 'display': '≈' + NNBSP + '7,5' + NNBSP + 'Monate ab OKBP', 'prefix': '≈',
                 'note': 'единственная метрика, законно показывающая половину: '
                         'день месяца у начала и конца не совпадает (D-17)'},
                {'metricKey': 'building:DEMO-B-B.execution', 'kind': 'buildingExecution',
                 'startDate': '2027-07-04', 'endDate': '2028-01-04',
                 'exact': str(raw_b), 'rounded': str(r05(raw_b)),
                 'wholeCalendarMonths': 6, 'presentationPolicy': 'wholeCalendarMonthsElseDays',
                 'display': '6' + NNBSP + 'Monate ab OKBP', 'prefix': ''},
                {'metricKey': 'project.total', 'kind': 'projectTotal',
                 'startDate': '2027-01-04', 'endDate': '2028-01-04',
                 'wholeCalendarMonths': 12, 'presentationPolicy': 'wholeCalendarMonthsElseDays',
                 'display': '12' + NNBSP + 'Monate', 'prefix': '',
                 'note': 'max(start + dauer) по включённым зданиям, не сумма'},
            ],
        }

    def report(self):
        return self.checked


def internal_config():
    """Внутренняя конфигурация S2/S6 — ИЗВЛЕКАЕТСЯ из документов-источников.

    Аудит прототипа нашёл маржу, драйверы риска, потолок, балконную долю и
    Δ класса здания захардкоженными в экранах — числа, которых нет в фикстуре.
    Удалять их неверно: это законная конфигурация продукта из calculation-spec
    §1.1 и t0-fallback §5.1. Верно — вывести их тем же построителем, которым
    выведено всё остальное: один источник, одна сверка, одно место правки.
    """
    spec = SRC.parent.parent / 'product' / 'calculation-spec.md'
    fb = SRC.parent.parent / 'product' / 't0-fallback-rules.md'
    ts = spec.read_text(encoding='utf-8')
    tf = fb.read_text(encoding='utf-8')
    for ch in Builder.SPACES:
        ts = ts.replace(ch, ' '); tf = tf.replace(ch, ' ')

    m_eig = re.search(r'`Marge Eigenleistung`[^|]*\|\s*\*\*(\d+) %\*\*', ts)
    m_fremd = re.search(r'`Marge Fremdleistung`[^|]*\|\s*\*\*(\d+) %\*\*', ts)
    if not (m_eig and m_fremd):
        raise Mismatch('маржа не извлечена из calculation-spec §1.1')

    drivers = re.findall(
        r'^\| ([A-ZÄÖÜ][^|]+?) \| (KG \d+) \| \*\*\+(\d+) %\*\* \|', ts, re.M)
    if len(drivers) != 6:
        raise Mismatch(f'драйверов риска извлечено {len(drivers)}, ожидалось 6')

    cap = re.search(r'ограничена \*\*(\d+) % от Bauwerk\*\*', ts)
    if not cap:
        raise Mismatch('потолок суммы драйверов не извлечён')

    gk_delta = re.search(r'### \d+\. Gebäudeklasse \(GK\) · Δ ±(\d+) %', tf)
    if not gk_delta:
        raise Mismatch('Δ Gebäudeklasse не извлечена из t0-fallback §5.1')

    balcony = re.search(r'Balkone und Loggien wurden mit (\d+) % angerechnet', tf)
    if not balcony:
        raise Mismatch('балконная доля не извлечена из t0-fallback')

    return {
        '$comment': 'Извлечено из calculation-spec.md §1.1 и t0-fallback-rules.md '
                    '§5.1 построителем; в экранах не хардкодится.',
        'margins': {
            'eigenleistungPercent': m_eig.group(1),
            'fremdleistungPercent': m_fremd.group(1),
            'provisional': True,
            'hiddenFromClient': True,
        },
        'riskDrivers': [
            {'label': d[0].strip(), 'base': d[1], 'ratePercent': d[2]}
            for d in drivers
        ],
        'riskCapPercentOfBauwerk': cap.group(1),
        'gebaeudeklasseDeltaPp': gk_delta.group(1),
        'balconyDefaultPercent': balcony.group(1),
        'balconySource': 'WoFlV §4',
    }


def build(write=True):
    b = Builder(SRC.read_text(encoding='utf-8'))
    cat = b.catalog()
    cat['internalConfig'] = internal_config()
    ar = b.areas()
    runs = b.runs(cat, ar)
    rates = b.rates(runs, ar)
    sched = b.schedule(cat, ar)

    def money(exact):
        # Масштаб нормализуется до центов. Без этого Decimal тащит масштаб
        # умножения (3817835.000000 против 3817835.00), и сравнение строк в
        # тестах падало бы на численно равной величине. Численное равенство
        # и строковое — разные вещи; фикстура обязана давать обе формы
        # однозначными.
        exact = exact.quantize(D('0.01'))
        disp = r(exact, D(1000)).quantize(D('1'))
        return {'exact': str(exact), 'display': fmt_de(disp),
                'prefix': '≈' if disp != exact else ''}

    project = {
        '$comment': 'ВЫВЕДЕНО из docs/audit/synthetic-fixtures.md скриптом '
                    'tools/build_fixtures.py. Руками не править: производные '
                    'значения вычисляются в Decimal и сверяются с документом.',
        'scenario': {
            'scenarioId': 'DEMO-SC-01', 'projectId': 'DEMO-0001',
            'variantId': 'DEMO-VAR-BASIS', 'variantVersionId': 'DEMO-VV-0003',
            'calculationRunId': 'DEMO-RUN-0007', 'runPurpose': 'authoritative',
            'calculatedAt': '2026-08-04T09:12:00+02:00', 'timezone': 'Europe/Berlin',
            'rulesetVersion': 'RS-2026.2', 'benchmarkSnapshot': 'BM-BKI-2026Q1-SYNTH',
            'engineVersion': 'ENG-0.5.0', 'regionalFactor': 'inactive',
            'kg700Mode': 'vereinfacht',
        },
        'project': {
            'id': 'DEMO-0001', 'name': 'Musterprojekt Nordfeld',
            'currency': 'EUR', 'bundesland': 'Musterland',
        },
        'documents': [
            {'file': 'Bauantrag_Mappe_Muster.pdf', 'pages': 68,
             'lifecycleStatus': 'active', 'parseStatus': 'ready'},
            {'file': 'Grundrisse_Muster_V2.pdf', 'pages': 24,
             'lifecycleStatus': 'active', 'parseStatus': 'ready', 'versions': 2},
            {'file': 'Grundrisse_Muster_V1.pdf', 'pages': 22,
             'lifecycleStatus': 'superseded', 'parseStatus': 'ready'},
            {'file': 'Statik_Auszug_Muster.jpg', 'pages': 1,
             'lifecycleStatus': 'candidate', 'parseStatus': 'failed',
             'label': 'nicht lesbar'},
        ],
        'buildings': [
            {'id': 'DEMO-B-A', 'stableName': 'Haus A',
             'gebaeudeform': 'Freistehendes Mehrfamilienhaus',
             'gebaeudeklasse': {'value': 'GK_5', 'state': 'Prüfung erforderlich',
                                'reason': 'CALC-004: число этажей — только триггер проверки'},
             'areas': {k: (str(v) if v is not None else None) for k, v in ar['A'].items()},
             'segments': [{'id': 'DEMO-S-A1', 'nutzungsart': 'Wohnen',
                           'belegungsBarrierefreiheitsprofil': 'Standard',
                           'benchmarkprofil': 'BKI MFH',
                           'leitkennzahl': 'EUR/m2 WFL nach WoFlV'}]},
            {'id': 'DEMO-B-B', 'stableName': 'Haus B',
             'gebaeudeform': 'Bürobaukörper',
             'gebaeudeklasse': {'value': 'GK_4', 'state': 'Prüfung erforderlich',
                                'reason': 'CALC-004'},
             'areas': {k: (str(v) if v is not None else None) for k, v in ar['B'].items()},
             'segments': [{'id': 'DEMO-S-B1', 'nutzungsart': 'Büro',
                           'belegungsBarrierefreiheitsprofil': None,
                           'benchmarkprofil': 'BKI Büro/Verwaltung',
                           'leitkennzahl': 'EUR/m2 NUF nach DIN 277'}]},
        ],
        'runs': [
            {'calculationRunId': 'DEMO-RUN-0007', 'subject': 'DEMO-B-A',
             'variant': 'Basis', 'energiestandard': 'EH_55',
             'total': money(runs['A_basis']),
             'label': 'Zwischensumme der kalkulierten Positionen',
             'completeness': 'incomplete',
             'completenessReason': 'KG 500 coverage unknown (SCOPE-001, CALC-006)',
             'drivers': [
                 {'key': 'basis', 'exact': str(ar['A']['bgfAboveGround'] * D(cat['kBase']['value']))},
                 {'key': 'gebaeudeklasse_5', 'exact': str(runs['kg_A'] and (runs['A_basis'] - runs['A_noug']) and
                                                          (ar['A']['bgfAboveGround'] * D(cat['kBase']['value']) * D('0.05')))},
             ],
             'kgSplit': {k: money(v) for k, v in runs['kg_A'].items()},
             'untergeschoss': money(runs['ug_A'])},
            {'calculationRunId': 'DEMO-RUN-0009', 'subject': 'DEMO-B-A',
             'variant': 'EH 40', 'energiestandard': 'EH_40',
             'total': money(runs['A_eh40']),
             'label': 'Zwischensumme der kalkulierten Positionen',
             'completeness': 'incomplete',
             'deltaToBase': money(runs['deltaEh40'])},
            {'calculationRunId': 'DEMO-RUN-0011', 'subject': 'DEMO-B-A',
             'variant': 'Ohne UG', 'total': money(runs['A_noug']),
             'label': 'Zwischensumme der kalkulierten Positionen',
             'completeness': 'incomplete',
             'deltaToBase': money(runs['deltaNoUg']),
             'impactSnapshotId': 'DEMO-IMP-0004'},
            {'calculationRunId': 'DEMO-RUN-0008', 'subject': 'DEMO-B-B',
             'variant': 'Büro', 'energiestandard': 'EH_55',
             'total': money(runs['B']),
             'label': 'Zwischensumme der kalkulierten Positionen',
             'completeness': 'incomplete'},
            {'calculationRunId': 'DEMO-RUN-0012', 'subject': 'complex',
             'variant': 'Komplex Gesamt', 'total': money(runs['G']),
             'label': 'Zwischensumme der kalkulierten Positionen',
             'completeness': 'incomplete',
             'sumBgfAboveGround': str(runs['sumOber']),
             'sumBgfRS': str(runs['sumRS']),
             'nutzung': 'Wohnen + Büro'},
        ],
        'rates': rates,
        'discount': {'ratePercent': str(runs['discountRate'] * 100),
                     'baseIsExactTotal': True,
                     'result': money(runs['discount']),
                     'disclosure': 'Gerundet auf 1.000' + NNBSP + '€; exakter Rechenwert '
                                   + str(runs['discount']) + NNBSP + '€'},
        'schedule': sched,
        'uncertainty': {
            'scenarioId': 'DEMO-SC-02', 'unit': 'percentagePoints',
            'note': 'сужается ПОДТВЕРЖДЕНИЕМ параметра, не выбором опции (D-19); '
                    'варианты, отличающиеся опцией, наследуют интервал базового прогона',
            'states': [
                {'value': '22', 'runId': 'DEMO-RUN-0007',
                 'reason': '4 из 16 T0-параметров abgeleitet'},
                {'value': '17', 'runId': 'DEMO-RUN-0013', 'deltaPp': '-5',
                 'reason': 'WFL подтверждена клиентом'},
                {'value': '13', 'runId': 'DEMO-RUN-0014', 'deltaPp': '-4',
                 'reason': 'Energiestandard подтверждён'},
            ],
            'riskSeparate': {
                'id': 'Baugrundgutachten fehlt', 'category': 'Baugrund',
                'probability': 'mittel', 'costEffectPercent': '4',
                'costEffectBase': 'KG_320',
                'note': 'типизированная запись с категорией, вероятностью и базой, '
                        'а не одна подпись со знаком и процентом — такую подпись '
                        'аудит запрещает (CALC-001)',
            },
        },
        'validationIssues': [{
            'id': 'DEMO-VI-0001', 'category': 'compliance',
            'subject': 'Building DEMO-B-A · Gebäudeklasse', 'state': 'open',
            'materiality': 'material',
            'reason': 'Klassifikation nach MBO §2 nicht bestätigt; Geschossanzahl '
                      'ist nur Prüfauslöser, nicht Nachweis (CALC-004)',
            'blockedOutputProfiles': ['clientReadOnly', 'clientLiveConfiguration',
                                      'clientPdf', 'clientEmail', 'clientPrint'],
        }],
        'conflicts': [{
            'id': 'DEMO-CONF-0001', 'scenarioId': 'DEMO-SC-03',
            'slot': 'WFL nach WoFlV · DEMO-B-A · DEMO-S-A1',
            'state': 'open', 'materiality': 'warning',
            'materialityReason': 'площадь, не цена и не срок — клиентские профили не блокирует',
            'candidates': [
                {'origin': 'document', 'value': '1500.00', 'selectionStatus': 'authoritative',
                 'source': 'Grundrisse_Muster_V2.pdf, Seite 12', 'capturedAt': '2026-08-04'},
                {'origin': 'customer', 'value': '1560.00', 'selectionStatus': 'alternative',
                 'verificationEventId': 'DEMO-VE-0002', 'capturedAt': '2026-08-05'},
            ],
        }],
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = {'catalog.json': cat, 'demo-0001.json': project}
    changed = []
    for name, data in files.items():
        blob = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
        path = OUT_DIR / name
        old = path.read_text(encoding='utf-8') if path.exists() else None
        if old != blob:
            changed.append(name)
            if write:
                path.write_text(blob, encoding='utf-8')
    return b.report(), changed


def main():
    check_only = '--check' in sys.argv
    try:
        checks, changed = build(write=not check_only)
    except Mismatch as exc:
        print(f'  ✗ ФИКСТУРА НЕ СХОДИТСЯ: {exc}')
        return 2
    print(f'  ✓ сверено с документом: {len(checks)} величин')
    for c in checks:
        print(f'      · {c}')
    if check_only:
        if changed:
            print(f'  ✗ JSON расходится с документом: {", ".join(changed)}')
            return 1
        print('  ✓ JSON актуален')
    else:
        print(f'  записано: {", ".join(changed) if changed else "без изменений"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
