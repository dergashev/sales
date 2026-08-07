# -*- coding: utf-8 -*-
"""Собирает словарь EN из поставки Codex — механически, без ручной копии.

Источник — docs/audit/verdicts/content/i18n-en-*.md (список SOURCES): таблица
`key · de · en · где · числовое · длина`, которую Codex подготовил по
заданию № 07 ровно для этого шага. Выход — src/i18n/generated.ts.

Почему генерация, а не ручной перенос: 434 ключа, перенесённые руками,
разойдутся с источником при первой правке — и разойдутся молча. Файл
поставки остаётся единственным местом правки перевода; правка словаря
руками бессмысленна, потому что перезапишется.

Состояние всех ключей — draft (LOCALE-001): клиентские артефакты на EN
остаются заблокированными до утверждения. UI-переключение разрешено —
внутреннее пространство вправе показывать черновик с пометкой.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Поставки читаются все по списку; вторая (задание № 14) подхватится, как
# только появится. Дубль ключа МЕЖДУ поставками — та же ошибка, что внутри
# одной: молча выбрать одно из двух значений нельзя.
SOURCES = [
    ROOT / 'docs/audit/verdicts/content/i18n-en-260806.md',
    ROOT / 'docs/audit/verdicts/content/i18n-en-2-260806.md',
    ROOT / 'docs/audit/verdicts/content/i18n-en-3-260806.md',
]
OUT = ROOT / 'src/i18n/generated.ts'

ROW = re.compile(r'^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|')


SEP_UNITS = ('%', '€', 'm²', 'Monate', 'Pp')


def unescape(cell: str) -> str:
    # Экранированные пайпы и br-переносы в ячейках таблицы.
    cell = cell.replace('\\|', '|').replace('<br>', '\n').strip()
    # Поставка местами несёт обычный неразрывный U+00A0 между числом и
    # единицей; норматив предписывает узкий U+202F (правило 7). Дефект
    # источника зарегистрирован KNOWN_OPEN за автором поставки; здесь он
    # нормализуется, чтобы производный файл не тиражировал его в продукт.
    for u in SEP_UNITS:
        cell = re.sub(r'(?<=\d)[\u00a0 ](?=' + re.escape(u) + ')', '\u202f', cell)
    return cell


def main() -> None:
    de: dict[str, str] = {}
    en: dict[str, str] = {}
    origin: dict[str, str] = {}
    for src in SOURCES:
        if not src.exists():
            continue
        for line in src.read_text(encoding='utf-8').split('\n'):
            m = ROW.match(line)
            if not m:
                continue
            key, de_val, en_val = m.group(1), unescape(m.group(2)), unescape(m.group(3))
            if not key or key == 'key':
                continue
            # Дубль ключа — дефект поставки: молча перезаписать значило бы
            # выбрать одно из двух значений наугад.
            if key in de:
                raise SystemExit(
                    f'дубль ключа: {key} ({origin[key]} ↔ {src.name})')
            de[key] = de_val
            en[key] = en_val
            origin[key] = src.name

    if len(de) < 300:
        raise SystemExit(f'подозрительно мало ключей: {len(de)} — формат таблицы изменился?')

    def ts_dict(d: dict[str, str]) -> str:
        lines = []
        for k in sorted(d):
            v = d[k].replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')
            lines.append(f"  '{k}': '{v}',")
        return '\n'.join(lines)

    OUT.write_text(
        '// СГЕНЕРИРОВАНО tools/build_i18n.py из docs/audit/verdicts/content/'
        'i18n-en-260806.md.\n'
        '// НЕ ПРАВИТЬ РУКАМИ: правка перезапишется. Источник перевода — файл '
        'поставки Codex.\n'
        '// Состояние всех ключей — draft (LOCALE-001): клиентские артефакты '
        'на EN заблокированы\n'
        '// до утверждения; внутренний UI вправе показывать черновик.\n\n'
        'export const GENERATED_DE: Record<string, string> = {\n'
        + ts_dict(de) + '\n} as const\n\n'
        'export const GENERATED_EN: Record<string, string> = {\n'
        + ts_dict(en) + '\n} as const\n',
        encoding='utf-8')
    print(f'ключей: {len(de)} → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
