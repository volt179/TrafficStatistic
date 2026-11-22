# Traffic Statistic — контекст проекта

Мод для **Cities: Skylines II**: окно статистики общественного транспорта. Графики пассажиров по линиям
(по часам и по суткам), таблица линий, остановки, пересадки, «куда едут» с подсветкой зданий.
Открывается иконкой с графиком на верхней левой панели игры (`GameTopLeft`).

Файл написан, чтобы новый чат или агент быстро вошёл в контекст. Владелец (`volt179`) общается
по-русски, тестирует сам в игре по скриншотам. Перед крупными новыми функциями он просит
**сначала описать план и дождаться подтверждения**; мелкие правки можно делать сразу.

---

## Окружение и сборка

- Игра CS2 1.6.x (Unity 2022.3, Entities 1.x, Mono). Путь к игре **не хранится в git**: он в
  `GameDir.props` рядом с проектом (в `.gitignore`). Без него берётся папка Steam по умолчанию.
- **.NET 8 SDK** (`C:\Program Files\dotnet\dotnet.exe`). `TrafficStatistic.csproj` — net472, C# 9,
  собирается **против библиотек игры** (`Cities2_Data\Managed`) без NuGet: `NoStdLib`,
  `DisableImplicitFrameworkReferences`, `FrameworkPathOverride` + `_TargetFrameworkDirectories` указывают
  на папку игры (иначе MSBuild ищет targeting pack .NET Framework). Нужная сборка игры → добавить имя в
  `GameRef`.
- Официальный Modding Toolchain (Unity, Burst, генераторы Entities) **не используется**. Поэтому в коде
  нет `SystemAPI`, `IJobEntity`, `Entities.ForEach`: только `EntityQuery` + `EntityManager` на главном
  потоке. Системы помечены `partial` по привычке, генераторов нет.
- Сборка и установка:
  ```
  powershell -ExecutionPolicy Bypass -File build.ps1            # собрать + установить
  powershell -ExecutionPolicy Bypass -File build.ps1 -NoInstall # только собрать в bin/
  ```
  Установка: `%USERPROFILE%\AppData\LocalLow\Colossal Order\Cities Skylines II\Mods\TrafficStatistic\`
  (`TrafficStatistic.dll` + `TrafficStatistic.mjs`). Игра грузит локальные моды оттуда сама; новый DLL
  подхватывается только после перезапуска игры.
- Логи: `...\Cities Skylines II\Logs\TrafficStatistic.log` (наш `Mod.Log`), `Logs\Modding.log` (что
  загрузилось), `Player.log`.
- **Другие моды владельца тоже лежат локально** в той же папке `Mods\` (скопированы 2026-11-19 из
  `.cache\Mods\pdx_mods`, потому что Paradox-набор не грузился). Если набор Paradox снова включён, моды
  грузятся дважды — это не наша ошибка.
- GitHub: https://github.com/volt179/TrafficStatistic (публичный, ветка `main`), коммиты от `volt179`.
  GitHub CLI стоит в `C:\Program Files\GitHub CLI\gh.exe` (в PATH Git Bash его нет — вызывать полным
  путём), вход выполнен. Пушить, коммитить и создавать что-то на GitHub — только по просьбе владельца.

### Как изучать код игры
Декомпилятора нет. Типы и поля смотрятся reflection-only загрузкой `Game.dll` в PowerShell
(`Assembly.ReflectionOnlyLoadFrom` + `ReflectionOnlyAssemblyResolve` на папку `Managed`; при
`GetTypes()` ловить `ReflectionTypeLoadException` и брать `.Types`). Часть типов не грузится (например,
`OverlayRenderSystem`, `EndFrameBarrier`) — тогда проверяем имя компиляцией. Тело метода можно
посмотреть через `GetMethodBody().GetILAsByteArray()` + `Module.ResolveMember` по токенам (так нашли,
что `TransportationOverviewUISystem.DeleteLine` просто добавляет `Deleted` через `EndFrameBarrier`).
Самый надёжный проверщик API — компилятор.

### Проверка интерфейса без игры
`ui/TrafficStatistic.mjs` можно открыть в браузере: тестовая страница подставляет `window.React` с
unpkg, заглушки `cs2/api` (bindValue/useValue/trigger пишет в console) и `cs2/ui` (Button, Portal) и
фальшивые JSON всех привязок. Страница и маленький node-сервер лежали во временной папке сессии; их
проще написать заново, чем искать. `html{font-size:0.8px}`, т.к. размеры в `rem` (в игре 1rem ≈ 1px).
Иконки игры (`Media/Game/Icons/*.svg`) в браузере дают 404 — это нормально.

---

## Версии

Текущая версия **0.6.3**. Номер в трёх местах, менять вместе: `Mod.Version` в `src/Mod.cs`,
`<Version>` в `TrafficStatistic.csproj`, `Version:` в шапке `ui/TrafficStatistic.mjs` (+ строка в
`README.md`). Файлы писать **UTF-8 без BOM** (PowerShell 5 `Set-Content -Encoding utf8` ставит BOM).

История: 0.1 график по линиям → 0.2 вкладки видов, 5 величин, проценты → 0.3 таблица, открытие линии →
0.4 остановки → 0.5 пересадки → 0.6 «куда едут» и подсветка; 0.6.1 ключи дней без дыр; 0.6.2
среднее/пик, сортировка воронкой; 0.6.3 удаление линии.

---

## Файлы

| Файл | Что делает |
|---|---|
| `src/Mod.cs` | `IMod`: `LineStatsSystem` в `GameSimulation`, `StatsUISystem` в `UIUpdate`; `Mod.Log` |
| `src/LineStatsSystem.cs` | Сбор данных: замер каждые 512 кадров, часы/сутки, остановки, поездки и пересадки, цели поездок, загрузка/сохранение, `ForgetLine` |
| `src/StatsStore.cs` | Данные города (`HourValue`, `DayValue`, `Accum`, `LineRecord`, `StatsStore`), файл истории, перевод старых ключей |
| `src/StopStats.cs` | `StopRecord`, `StopValue`, `StopAccum` — остановка одной линии |
| `src/TransferStats.cs` | `CountHistory` (счётчик по часам/суткам), `TransferRecord`, `ChainRecord`, `Trip` |
| `src/DestinationStats.cs` | `DestRecord` (здание-цель по линиям), `PurposeRecord` (зачем едут) |
| `src/StatsUISystem.cs` | Привязки для окна (JSON), триггеры: открыть/удалить линию, камера к остановке/зданию, подсветка |
| `ui/TrafficStatistic.mjs` | Весь интерфейс: React через `React.createElement`, без сборщика |
| `build.ps1` | `dotnet build` + копия DLL и `.mjs` в папку модов |

---

## Как это работает

### Время
`TimeSystem.GetCurrentDateTime()` в CS2 даёт дату, где **в году всего `daysPerYear` (12) дней**, после
чего дата прыгает на 1 января следующего года. Поэтому ключи — не тики `DateTime`, а
`день = год × daysPerYear + (DayOfYear − 1)`, `час = день × 24 + Hour` (`StatsStore.HourOf`). До формата
файла 6 ключи были тиками (дыры ~355 дней на каждом новом годе); `Load` переводит их (`ConvertOldKeys`).
Подписи «День N» = день − `FirstDay` + 1.

### Замер (`LineStatsSystem.Sample`, каждые 512 кадров ≈ 20 раз за игровой час)
- Линии: `TransportLine` + `Route` + `PrefabRef` + буфер `RouteVehicle`, без `Deleted`/`Temp`.
  Префаб: `TransportLineData` (`m_PassengerTransport`, `m_TransportType`). Ключ линии —
  `"<TransportType>#<RouteNumber>"` (стабилен между загрузками; новая линия с тем же номером сольётся со
  старой историей). Имя — `NameSystem.TryGetCustomName`, иначе в окне «Вид N». Цвет — `Game.Routes.Color`.
- Машина: если есть `LayoutElement` — по вагонам. Пассажиры — буфер `Passenger`, места —
  `PublicTransportVehicleData.m_PassengerCapacity` префаба вагона.
- **Вошло/вышло**: множества пассажиров каждого вагона с прошлого замера (`m_Riders`); новые = вошли,
  пропавшие = вышли. Первый замер после загрузки не считается.
- Ждут: `WaitingPassengers.m_Count` на путевой точке линии (запасной вариант — на остановке).
- Остановка, к которой относятся вошедшие/вышедшие: если у машины флаг `PublicTransportFlags.Boarding` —
  ближайшая остановка линии к машине; иначе остановка перед `Target` машины (следующая путевая точка).
  Загрузка перегона — едущие/места движущихся машин после остановки.
- Остановка линии = путевая точка с `Connected` (номер в `RouteWaypoint`). `Place` — позиция
  остановки, округлённая до 4 м: так одна платформа разных линий склеивается в таблице.
  Название — `NameSystem.GetName` (поля `Name` приватные → reflection) + словарь локализации.
- Конец часа (`FinishHour`): средние за час в `Hours` (7 суток), при смене суток — `Days` (навсегда),
  сохранение файла, `Version++`.

### Пересадки и цели (`TrackTrips`, `EndTrips`, `CountTripEnd`)
Пассажир (`m_Passenger`, сущность-человечек) один на всю поездку. Вышел с линии A → запомнили
(`Trip`: линия, остановка, кадр, цель). Сел на линию B в течение `TransferFrames` (1 игровой час) —
пересадка A→B. Поездка кончилась, если за этот час он никуда не сел: цепочка линий (если ≥ 2) →
`Chains` (топ 50), цель (`Target` пассажира при последнем выходе, если это `Building`) → `Destinations`
по последней линии, цель поездки (`TravelPurpose` жителя через `Resident.m_Citizen`, свёрнута в
work/home/shopping/school/leisure/health/moving/other) → `Purposes`. Тип здания — по компонентам
(`ResidentialProperty`, `CommercialProperty`, `OfficeProperty`, …).

### Файл истории
`ModsData\TrafficStatistic\<имя города>.txt`, текст с табуляциями, первая строка `TrafficStatistic N`
(сейчас 6). Записи: `first`, `L`/`H`/`D` (линии), `S`/`SH`/`SD` (остановки), `T`, `C`, `P`, `B`/`BL` +
`CH`/`CD` (счётчики). Пишется через `.tmp` и замену. При загрузке более старого сохранения точки «из
будущего» удаляются (`DropFrom`). Хранится **не в сохранении игры**, чтобы удаление мода не ломало
сохранения; минус — привязка к имени города.

### Окно (`StatsUISystem` ↔ `TrafficStatistic.mjs`)
Группа привязок `trafficStatistic`. Значения (JSON-строки): `visible`, `lang`, `data` (история,
пересобирается при `Version`), `live` (последний замер), `stops` (только пока открыты «Остановки» или
«Пересадки» — триггер `stopsView`), `transfers`, `dest` (только при `destView`). Триггеры: `toggle`,
`openLine`, `deleteLine`, `focusStop`, `focusBuilding`, `highlight` (ключи зданий через запятую; пусто —
снять).
- Открыть линию: `SelectedInfoUISystem.SetSelection` + `CameraUpdateSystem.gamePlayController`
  (`pivot`, `zoom`) по рамке путевых точек.
- Удалить линию: приватный `TransportationOverviewUISystem.DeleteLine` через reflection (запасной
  путь — `Deleted` через `Game.EndFrameBarrier`), затем `LineStatsSystem.ForgetLine` стирает всё про
  линию и пропускает её сущность до исчезновения.
- Подсветка зданий: компоненты `Game.Tools.Highlighted` + `Game.Common.BatchesUpdated` (стандартная
  подсветка игры, один цвет). Остаётся, пока кнопка включена, даже при закрытом окне.
- Интерфейс: `moduleRegistry.append("GameTopLeft", ToolbarButton)`, окно через `cs2/ui` `Portal`,
  своя вёрстка инлайн-стилями, SVG для графика и значков (в шрифте игры нет «✕»). Состояние окна
  (вкладки, режимы, сортировки) — в объекте `state` модуля, живёт до перезапуска игры; позиция окна —
  ещё и в `localStorage`.

---

## Что пробовали и почему отказались (не повторять)
- **Круги-«тепловая карта» над зданиями** (OverlayRenderSystem): владелец попросил вместо этого
  стандартную подсветку зданий по типу. Разные цвета по типу потребовали бы своего инфо-режима — не
  делали.
- **Ключи времени из `DateTime.Ticks`**: дыры на каждом игровом новом годе (см. «Время»).
- **Хранение истории внутри сохранения**: отказались ради безопасности сохранений.

## Известные ограничения
- Вошедшие/вышедшие считаются по замерам раз в ~8 с: совсем короткие поездки между замерами теряются.
- Пересадка = сел на другую линию в течение часа после выхода; зашёл в магазин и поехал дальше тоже
  считается пересадкой. Такси и личные машины не учитываются.
- «Куда едут» — только пассажиры общественного транспорта, цель берётся при последнем выходе.
- Для «Заполненность %» в суммах по видам/общей пиков нет (проценты разных линий не складываются).
- История привязана к имени города; два города с одним именем смешаются.
