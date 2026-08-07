ИЗОБРАЖЕНИЯ: файлов 43/43 · серия единым стилем: да · сертификаты: нейтральные мотивы без знаков QNG/DGNB · суммарный вес 3,02 MB

# TASK-18 — фотореалистичные изображения карточек опций

Дата: 07.08.2026  
Исполнитель: Codex  
Режим генерации: встроенный OpenAI ImageGen, новые опорные кадры + image-to-image правки для вариантов одной группы.

## Итог

- поставлены все 43 значения из инвентаря KG 300 / KG 400 / QNG / DGNB;
- формат каждого файла — WebP, 960×720 px, 4:3, без скруглений и виньеток;
- максимальный вес файла — 175 634 байта (opt-erdarbeiten-nein.webp);
- суммарный вес — 3 018 352 байта = 3,02 MB (2,88 MiB);
- EXIF и ICC удалены; проверка Pillow: EXIF 0 записей, встроенных EXIF/ICC-блоков нет;
- имена не содержат клиентских адресов, названий или идентификаторов;
- источник всех файлов — генерация OpenAI ImageGen, клиентские рендеры и сток не использовались;
- полный машинный mapping находится в design-system/assets/options/manifest.json.

## Манифест поставки

| Group | Value | Файл | Мотив | Источник |
|---|---|---|---|---|
| erdarbeiten | ja | opt-erdarbeiten-ja.webp | Подготовленная строительная выемка перед Holz-MFH | OpenAI ImageGen, 07.08.2026 |
| erdarbeiten | nein | opt-erdarbeiten-nein.webp | Нетронутый участок в том же ракурсе | OpenAI ImageGen, 07.08.2026 |
| bodenplatte | ja | opt-bodenplatte-ja.webp | Свежая бетонная плита | OpenAI ImageGen, 07.08.2026 |
| bodenplatte | nein | opt-bodenplatte-nein.webp | Уплотнённое щебёночное основание без плиты | OpenAI ImageGen, 07.08.2026 |
| ugVariante | rohbauAusbau | opt-ugVariante-rohbauAusbau.webp | Подвал в конструкциях с начатой разводкой | OpenAI ImageGen, 07.08.2026 |
| ugVariante | nurAusbau | opt-ugVariante-nurAusbau.webp | Отделанный подвал в том же помещении | OpenAI ImageGen, 07.08.2026 |
| ugVariante | keins | opt-ugVariante-keins.webp | Здание на плите без подвала | OpenAI ImageGen, 07.08.2026 |
| balkone | ja | opt-balkone-ja.webp | Holz-MFH с рядами балконов | OpenAI ImageGen, 07.08.2026 |
| balkone | nein | opt-balkone-nein.webp | То же здание без балконов | OpenAI ImageGen, 07.08.2026 |
| balkonTyp | diagonal | opt-balkonTyp-diagonal.webp | Балкон с диагональными стальными подкосами | OpenAI ImageGen, 07.08.2026 |
| balkonTyp | stuetzen | opt-balkonTyp-stuetzen.webp | Тот же балкон на вертикальных стойках | OpenAI ImageGen, 07.08.2026 |
| balkonTyp | konsole | opt-balkonTyp-konsole.webp | Тот же балкон на бетонной консоли | OpenAI ImageGen, 07.08.2026 |
| egBauweise | holz | opt-egBauweise-holz.webp | Первый этаж в деревянных конструкциях | OpenAI ImageGen, 07.08.2026 |
| egBauweise | massiv | opt-egBauweise-massiv.webp | Тот же первый этаж в бетоне и кладке | OpenAI ImageGen, 07.08.2026 |
| garage | ja | opt-garage-ja.webp | Встроенные гаражные ворота в первом этаже | OpenAI ImageGen, 07.08.2026 |
| garage | nein | opt-garage-nein.webp | Жилой фасад и вход вместо ворот | OpenAI ImageGen, 07.08.2026 |
| fassade | plaster | opt-fassade-plaster.webp | Светлая минеральная штукатурка | OpenAI ImageGen, 07.08.2026 |
| fassade | timber | opt-fassade-timber.webp | Вертикальная деревянная облицовка | OpenAI ImageGen, 07.08.2026 |
| fassade | mixedTimber | opt-fassade-mixedTimber.webp | Штукатурка + деревянная облицовка | OpenAI ImageGen, 07.08.2026 |
| fassade | klinker | opt-fassade-klinker.webp | Сплошной красно-коричневый клинкер | OpenAI ImageGen, 07.08.2026 |
| fassade | mixedKlinker | opt-fassade-mixedKlinker.webp | Штукатурка + клинкер | OpenAI ImageGen, 07.08.2026 |
| klinkerFarbe | rotbunt | opt-klinkerFarbe-rotbunt.webp | Один фасад в пёстрой красной гамме | OpenAI ImageGen, 07.08.2026 |
| klinkerFarbe | anthrazit | opt-klinkerFarbe-anthrazit.webp | Тот же фасад в антраците | OpenAI ImageGen, 07.08.2026 |
| klinkerFarbe | weissgrau | opt-klinkerFarbe-weissgrau.webp | Тот же фасад в бело-серой гамме | OpenAI ImageGen, 07.08.2026 |
| kg420 | waermepumpe | opt-kg420-waermepumpe.webp | Наружный блок воздушного теплового насоса | OpenAI ImageGen, 07.08.2026 |
| kg420 | fernwaerme | opt-kg420-fernwaerme.webp | Шкаф теплопункта с подающей и обратной трассой | OpenAI ImageGen, 07.08.2026 |
| kg420 | gas | opt-kg420-gas.webp | Газовый конденсационный котёл с дымоходом | OpenAI ImageGen, 07.08.2026 |
| kg430 | zentralWrg | opt-kg430-zentralWrg.webp | Центральная установка с рекуперацией | OpenAI ImageGen, 07.08.2026 |
| kg430 | dezentral | opt-kg430-dezentral.webp | Несколько децентральных установок | OpenAI ImageGen, 07.08.2026 |
| kg430 | keine | opt-kg430-keine.webp | Пустая инженерная ниша и открытое окно | OpenAI ImageGen, 07.08.2026 |
| kg440 | standard | opt-kg440-standard.webp | Обычный компактный электрощит | OpenAI ImageGen, 07.08.2026 |
| kg440 | erhoeht | opt-kg440-erhoeht.webp | Расширенный щит с измерением и автоматикой | OpenAI ImageGen, 07.08.2026 |
| kg460 | ja | opt-kg460-ja.webp | Открытая кабина лифта рядом с лестницей | OpenAI ImageGen, 07.08.2026 |
| kg460 | nein | opt-kg460-nein.webp | Та же зона как лестничная клетка без лифта | OpenAI ImageGen, 07.08.2026 |
| kg480 | keine | opt-kg480-keine.webp | Обычные выключатели и комнатный термостат | OpenAI ImageGen, 07.08.2026 |
| kg480 | basis | opt-kg480-basis.webp | Базовая панель управления автоматикой | OpenAI ImageGen, 07.08.2026 |
| qng | keins | opt-qng-keins.webp | Материалы без мотива проверки или сертификации | OpenAI ImageGen, 07.08.2026 |
| qng | plus | opt-qng-plus.webp | Нейтральная базовая проверка качества | OpenAI ImageGen, 07.08.2026 |
| qng | premium | opt-qng-premium.webp | Расширенная нейтральная проверка качества | OpenAI ImageGen, 07.08.2026 |
| dgnb | keins | opt-dgnb-keins.webp | Стол материалов без сертификационного мотива | OpenAI ImageGen, 07.08.2026 |
| dgnb | silber | opt-dgnb-silber.webp | Нейтральная базовая проверка материалов и воздуха | OpenAI ImageGen, 07.08.2026 |
| dgnb | gold | opt-dgnb-gold.webp | Расширенная нейтральная проверка устойчивости | OpenAI ImageGen, 07.08.2026 |
| dgnb | platin | opt-dgnb-platin.webp | Полный нейтральный набор приёмки и измерений | OpenAI ImageGen, 07.08.2026 |

## Как обеспечено единство

Базовый prompt-set фиксировал современное немецкое многоэтажное деревянное строительство,
нейтральный рассеянный дневной свет, документальную архитектурную фотографию, спокойную
цветокоррекцию, отсутствие людей, машин, текста, брендов, логотипов и водяных знаков.
Композиция — 4:3 с безопасными полями для object-fit: cover.

Для пар и рядов сначала создавался опорный кадр, затем тот же файл передавался ImageGen как
reference для замены только различающего элемента. Поэтому ракурс и свет совпадают у
erdarbeiten, bodenplatte, balkone, balkonTyp, egBauweise, garage, всех фасадов,
цветов клинкера, KG 420/430/440/460/480 и внутри рядов QNG/DGNB. У ugVariante два состояния
подвала совпадают буквально; вариант без подвала показан на уровне плиты, поскольку
внутреннего подвального ракурса физически не существует, но сохраняет ту же палитру,
строительный контекст и свет.

## Решение по QNG / DGNB

Официальные знаки, формы знаков, медали, цветные печати, таблички и сертификаты не
генерировались. Уровни обозначены нейтрально и вторично: количеством и полнотой обычных
инструментов строительного контроля, материалами и закрытыми папками без надписей. Название
уровня остаётся только в текстовой подписи карточки; изображение его не подменяет.

## Контракт и витрина

- в components-core.md описан опциональный mediaSlot 4:3 для DC-20/DC-40;
- в components.css добавлены фото-слоты .a3-img и .a3-option-media;
- при отсутствии файла слот не создаётся; при ошибке загрузки скрывается через hidden, а
  подпись, цена, последствие и состояние выбора остаются;
- изображения имеют пустой alt, поскольку смысл остаётся за текстовым контрактом;
- в all3-design-system.html показаны два фасадных фото DC-20 и одно фото DC-40; две
  соседние фасадные плитки демонстрируют text-only fallback.

## Что проверить глазами второй стороне

1. В одном масштабе карточки сравнить ja/nein и многозначные ряды: меняется именно
   конструкция или материал, а не свет.
2. Отдельно принять допустимое изменение уровня камеры у ugVariante=keins.
3. Проверить инженерную правдоподобность мотивов KG 420/430/440 и читаемость отличий на
   маленькой плитке.
4. Подтвердить, что QNG/DGNB не напоминают официальные знаки и воспринимаются лишь как
   нейтральные мотивы проверки.
5. Временно сломать один src в витрине: плитка должна остаться полностью понятной и
   управляемой без изображения.

## Автоматическая проверка

Проверено скриптом Pillow:

- файлов: 43;
- записей manifest: 43, пары group/value уникальны;
- множество manifest.file равно множеству поставленных WebP;
- формат/размер: единообразно WEBP 960×720;
- каждый файл ≤ 200 000 байт;
- серия ≤ 6 MB;
- EXIF/ICC отсутствуют.
