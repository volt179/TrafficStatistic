/*!
 * Cities: Skylines II UI Module
 *
 * Id: TrafficStatistic
 * Author: volt179
 * Version: 0.6.3
 * Dependencies:
 */
// Hand-written ES module (no bundler): React comes from the game as window.React.
const React = window.React;
const h = React.createElement;
const { useState, useMemo, useRef, useEffect } = React;
const api = window["cs2/api"];
const ui = window["cs2/ui"];

const G = "trafficStatistic";
const visible$ = api.bindValue(G, "visible", false);
const lang$ = api.bindValue(G, "lang", "en-US");
const data$ = api.bindValue(G, "data", "");
const live$ = api.bindValue(G, "live", "");
const stops$ = api.bindValue(G, "stops", "");
const transfers$ = api.bindValue(G, "transfers", "");
const dest$ = api.bindValue(G, "dest", "");

// ---------------------------------------------------------------- texts

const TEXT = {
    title: ["Traffic Statistic", "Traffic Statistic"],
    hours: ["По часам", "Hourly"],
    days: ["По суткам", "Daily"],
    each: ["Каждая линия", "Each line"],
    byType: ["Сумма по видам", "Sum by type"],
    total: ["Общая сумма", "Total"],
    all: ["Все", "All"],
    none: ["Ничего", "None"],
    noLines: ["В городе нет линий общественного транспорта.", "The city has no public transport lines."],
    noData: ["Данных пока нет. Первая точка появится через игровой час.", "No data yet. The first point appears after one in-game hour."],
    noMetric: ["Для этой величины данных пока нет: она собирается с версии 0.2.0.", "No data for this value yet: it is collected since version 0.2.0."],
    noneChosen: ["Выберите линии слева.", "Pick lines on the left."],
    noTabs: ["Включите вид транспорта вверху.", "Turn on a transport type above."],
    avg: ["среднее", "average"],
    peak: ["пик", "peak"],
    dayTotal: ["за сутки", "per day"],
    busiestHour: ["самый загруженный час", "busiest hour"],
    perHour: ["за час", "per hour"],
    day: ["День", "Day"],
    sum: ["Сумма", "Sum"],
    deleted: ["удалена", "deleted"],
    loadTip: ["Заполненность сейчас", "Load now"],
    noVehicles: ["нет машин", "no vehicles"],
    chart: ["График", "Chart"],
    table: ["Таблица", "Table"],
    colLine: ["Линия", "Line"],
    colRiding: ["Едут", "Riding"],
    colLoad: ["Заполн.", "Load"],
    colWaiting: ["Ждут", "Waiting"],
    colVehicles: ["Машин", "Vehicles"],
    colBoarded: ["Вошло за сутки", "Boarded, 24 h"],
    colPeak: ["Пик за сутки", "Peak, 24 h"],
    tableHint: ["Сейчас и за последние 24 игровых часа. Щелчок по строке открывает линию.", "Now and over the last 24 in-game hours. Click a row to open the line."],
    noAlive: ["Среди выбранных нет действующих линий.", "No working lines among the picked ones."],
    open: ["Открыть линию", "Open the line"],
    stopsView: ["Остановки", "Stops"],
    thisLine: ["Эта линия", "This line"],
    allStops: ["Все остановки", "All stops"],
    stopsLineHint: ["Остановки по порядку маршрута, за последние 24 игровых часа. Линию выберите слева, щелчок по остановке переносит к ней камеру.",
        "Stops in route order, last 24 in-game hours. Pick the line on the left; click a stop to move the camera there."],
    stopsAllHint: ["Все остановки выбранных видов транспорта, за последние 24 игровых часа. Щелчок переносит камеру.",
        "Every stop of the picked transport types, last 24 in-game hours. Click to move the camera."],
    pickLine: ["Выберите линию слева.", "Pick a line on the left."],
    noStops: ["Данных по остановкам пока нет — подождите немного.", "No stop data yet — wait a little."],
    stop: ["Остановка", "Stop"],
    waitNow: ["ждут", "waiting"],
    boardedShort: ["вошло", "in"],
    alightedShort: ["вышло", "out"],
    segment: ["перегон", "stretch"],
    backToFirst: ["к первой остановке", "back to the first stop"],
    waitAvg: ["в среднем ждали", "waited on average"],
    colStop: ["Остановка", "Stop"],
    colLines: ["Линии", "Lines"],
    colWaitNow: ["Ждут", "Waiting"],
    colIn: ["Вошло", "In"],
    colOut: ["Вышло", "Out"],
    colWaitAvg: ["Ждут в ср.", "Avg waiting"],
    transfersView: ["Пересадки", "Transfers"],
    wholeCity: ["Весь город", "Whole city"],
    transLineHint: ["Пересадки за последние 24 игровых часа: человек вышел из одной линии и в течение часа сел на другую. Линию выберите слева.",
        "Transfers over the last 24 in-game hours: someone got out of one line and onto another within an hour. Pick the line on the left."],
    transCityHint: ["Пересадочные узлы и поездки с пересадками за последние 24 игровых часа. Щелчок по узлу переносит камеру.",
        "Transfer hubs and trips with transfers over the last 24 in-game hours. Click a hub to move the camera."],
    fromThis: ["С этой линии пересаживаются на", "From this line people change to"],
    toThis: ["На эту линию пересаживаются с", "People change to this line from"],
    chains: ["Поездки с пересадками", "Trips with transfers"],
    hubs: ["Пересадочные узлы", "Transfer hubs"],
    noTransfers: ["Пересадок пока не замечено — подождите немного.", "No transfers seen yet — wait a little."],
    atStop: ["на ост.", "at"],
    people: ["чел.", "people"],
    transferMark: ["пересадки здесь: сели с других линий / вышли на другие", "transfers here: came from other lines / left for other lines"],
    transIn: ["сели с других линий", "came from other lines"],
    transOut: ["вышли на другие линии", "left for other lines"],
    colTransfer: ["С пересадки", "Transferred"],
    destView: ["Куда едут", "Destinations"],
    destLineHint: ["Куда и зачем ехали пассажиры этой линии за последние 24 игровых часа (по последнему отрезку поездки). Щелчок по зданию переносит камеру.",
        "Where and why riders of this line went over the last 24 in-game hours (by the last leg of the trip). Click a building to move the camera."],
    destCityHint: ["Куда и зачем ехали пассажиры общественного транспорта за последние 24 игровых часа. Щелчок по зданию переносит камеру.",
        "Where and why public transport riders went over the last 24 in-game hours. Click a building to move the camera."],
    why: ["Зачем едут", "Why they ride"],
    where: ["Куда приезжают", "Where they arrive"],
    noDest: ["Пока никто не доехал — подождите немного.", "Nobody has arrived yet — wait a little."],
    highlight: ["Подсветить на карте", "Highlight on the map"],
    highlightTip: ["Подсвечивает в городе 50 первых зданий из списка ниже (с учётом фильтра по типу). Подсветка остаётся, пока кнопка включена.",
        "Highlights the first 50 buildings of the list below in the city (with the type filter). Stays while the button is on."],
    allKinds: ["Все типы", "All types"],
    showAvg: ["Среднее", "Average"],
    showPeak: ["Пик", "Peak"],
    showBoth: ["Оба", "Both"],
    showTotal: ["За сутки", "Per day"],
    showBusiest: ["Пиковый час", "Busiest hour"],
    sortTip: ["Сортировка линий этого вида", "Sort the lines of this type"],
    sort_number: ["По номеру", "By number"],
    sort_loadDesc: ["Сначала заполненные", "Fullest first"],
    sort_loadAsc: ["Сначала пустые", "Emptiest first"],
    sort_name: ["По имени", "By name"],
    deleteTip: ["Удалить линию", "Delete the line"],
    deleteTitle: ["Удалить линию?", "Delete the line?"],
    deleteText: ["Линия «{0}» будет удалена из города вместе с её остановками и транспортом, как кнопкой удаления в игре. Её статистика в моде тоже будет стёрта. Отменить это нельзя.",
        "The line “{0}” will be removed from the city with its stops and vehicles, like the game's own delete button. Its statistics in this mod are erased too. This can't be undone."],
    deleteGoneTitle: ["Стереть статистику?", "Erase the statistics?"],
    deleteGoneText: ["Линии «{0}» уже нет в городе. Её статистика в моде будет стёрта. Отменить это нельзя.",
        "The line “{0}” is no longer in the city. Its statistics in this mod will be erased. This can't be undone."],
    deleteYes: ["Удалить", "Delete"],
    cancel: ["Отмена", "Cancel"],
};
const PURPOSES = {
    work: ["на работу", "to work", "#4fa8ff"],
    home: ["домой", "home", "#5fd38d"],
    shopping: ["в магазин", "shopping", "#ffc93d"],
    school: ["на учёбу", "to school", "#c27bff"],
    leisure: ["отдых", "leisure", "#ff6a3d"],
    health: ["к врачу", "health", "#ff5fa2"],
    moving: ["переезд", "moving", "#3de0e0"],
    other: ["другое", "other", "#999999"],
};
const PURPOSE_ORDER = ["work", "home", "shopping", "school", "leisure", "health", "moving", "other"];
const KINDS = {
    home: ["Жилые", "Homes", "#5fd38d"],
    shop: ["Магазины", "Shops", "#ffc93d"],
    office: ["Офисы", "Offices", "#4fa8ff"],
    industry: ["Промышленность", "Industry", "#c8a06e"],
    school: ["Учёба", "Schools", "#c27bff"],
    hospital: ["Больницы", "Hospitals", "#ff5fa2"],
    leisure: ["Отдых", "Leisure", "#ff6a3d"],
    station: ["Вокзалы", "Stations", "#3de0e0"],
    service: ["Службы", "Services", "#aab4c0"],
    other: ["Другое", "Other", "#888888"],
};
const KIND_ORDER = ["home", "shop", "office", "industry", "school", "hospital", "leisure", "station", "service", "other"];
// Hover tips of the table columns.
const COLUMN_TIPS = {
    name: ["Название линии и её цвет, как в игре. Щелчок сортирует по алфавиту.", "Line name and colour as in the game. Click to sort by name."],
    riding: ["Сколько людей едет в транспорте линии прямо сейчас.", "People riding the line's vehicles right now."],
    load: ["Заполненность сейчас: едущие ÷ все места в машинах линии. Зелёный — норма, жёлтый — больше 80%, красный — больше 100%.",
        "Load now: riders ÷ all seats in the line's vehicles. Green is fine, yellow is over 80%, red is over 100%."],
    waiting: ["Сколько людей ждёт этот транспорт на остановках линии прямо сейчас.", "People waiting at the line's stops right now."],
    vehicles: ["Сколько машин (автобусов, поездов…) работает на линии сейчас.", "Vehicles working on the line right now."],
    boarded: ["Сколько людей село в транспорт линии за последние 24 игровых часа.", "People who got in over the last 24 in-game hours."],
    peak: ["Самая высокая заполненность за последние 24 игровых часа (среднее за час).", "Highest load over the last 24 in-game hours (hourly average)."],
    transfer: ["Какая доля севших за 24 часа пришла с другой линии. Высокая доля — линия работает как подвоз к другим.",
        "Share of people who got in over 24 hours coming from another line. High share means the line feeds others."],
};
// What the chart can show.
const METRICS = {
    riding: ["Едут", "Riding"],
    load: ["Заполненность %", "Load %"],
    waiting: ["Ждут", "Waiting"],
    vehicles: ["Машин", "Vehicles"],
    boarded: ["Вошло", "Boarded"],
};
const METRIC_ORDER = ["riding", "load", "waiting", "vehicles", "boarded"];
const METRIC_HINT = {
    riding: ["людей в транспорте линии", "people in the line's vehicles"],
    load: ["едут ÷ мест во всех машинах линии", "riding ÷ seats in all the line's vehicles"],
    waiting: ["людей ждёт на остановках линии", "people waiting at the line's stops"],
    vehicles: ["машин на линии", "vehicles on the line"],
    boarded: ["людей село в транспорт", "people who got in"],
};
// Names match Game.Prefabs.TransportType.
const TYPES = {
    Bus: ["Автобус", "Bus"],
    Tram: ["Трамвай", "Tram"],
    Subway: ["Метро", "Subway"],
    Train: ["Поезд", "Train"],
    Ship: ["Корабль", "Ship"],
    Ferry: ["Паром", "Ferry"],
    Airplane: ["Самолёт", "Airplane"],
    Helicopter: ["Вертолёт", "Helicopter"],
    Other: ["Другое", "Other"],
};
const TYPE_COLORS = {
    Bus: "#4fa8ff", Tram: "#ff6a3d", Subway: "#c27bff", Train: "#ffc93d",
    Ship: "#3de0e0", Ferry: "#3ddc97", Airplane: "#ff5fa2", Helicopter: "#f5e663", Other: "#bbbbbb",
};
// The game's own icons (Cities2_Data\Content\Game\UI\Media\Game\Icons).
const TYPE_ICONS = {
    Bus: "Bus", Tram: "Tram", Subway: "Subway", Train: "Train", Ship: "Ship",
    Ferry: "Ship", Airplane: "Airplane", Helicopter: "Airplane", Other: "Transportation",
};
const TYPE_ORDER = ["Bus", "Tram", "Subway", "Train", "Ship", "Ferry", "Airplane", "Helicopter", "Other"];
const typeOf = (t) => (TYPES[t] ? t : "Other");

function makeT(lang) {
    const i = lang && lang.indexOf("ru") === 0 ? 0 : 1;
    return {
        ru: i === 0,
        t: (k) => (TEXT[k] ? TEXT[k][i] : k),
        type: (k) => (TYPES[k] || TYPES.Other)[i],
        metric: (k) => METRICS[k][i],
        hint: (k) => METRIC_HINT[k][i],
    };
}

const pad2 = (n) => (n < 10 ? "0" : "") + n;

// Turns the raw JSON from StatsUISystem into what the panel draws.
function prepare(raw, tr) {
    const hourLabels = [], dayLabels = [];
    const D = tr.ru ? "Д" : "D";
    for (let i = 0; i < raw.hourCount; i++) {
        const hh = raw.hourStart + i;
        const day = Math.floor(hh / 24) - raw.firstDay + 1;
        hourLabels.push(D + day + " " + pad2(hh % 24) + ":00");
    }
    for (let i = 0; i < raw.dayCount; i++) {
        dayLabels.push(tr.t("day") + " " + (raw.dayStart + i - raw.firstDay + 1));
    }
    const lines = raw.lines.map((l) => Object.assign({}, l, {
        type: typeOf(l.type),
        name: l.name ? l.name : tr.type(typeOf(l.type)) + " " + l.num,
    }));
    return { lines, hourLabels, dayLabels };
}

// Values of one metric for a group of lines: { values, peak } (-1 = no data).
// Counts add up; load of a group = all riding ÷ all seats, so its peak can't be summed.
function seriesOf(group, metric, daily, len) {
    const values = [], peak = [];
    const add = (acc, v) => (v < 0 ? acc : (acc < 0 ? 0 : acc) + v);
    for (let i = 0; i < len; i++) {
        let v = -1, p = -1;
        if (metric === "load") {
            let r = -1, c = -1;
            group.forEach((l) => {
                const lr = daily ? l.dr[i] : l.hr[i], lc = daily ? l.dc[i] : l.hc[i];
                if (lr >= 0 && lc >= 0) { r = add(r, lr); c = add(c, lc); }
                if (daily && group.length === 1) p = l.dlp[i];
            });
            v = c > 0 ? (100 * r) / c : (c === 0 && r >= 0 ? 0 : -1);
        } else {
            const key = { riding: "r", waiting: "w", vehicles: "v", boarded: "b" }[metric];
            group.forEach((l) => {
                v = add(v, (daily ? l["d" + key] : l["h" + key])[i]);
                if (daily) p = add(p, l["d" + key + "p"][i]);
            });
        }
        values.push(v);
        peak.push(p);
    }
    return { values, peak: daily ? peak : null };
}

// ---------------------------------------------------------------- styles

const C = {
    panelBg: "rgba(18, 22, 28, 0.97)",
    border: "rgba(255, 255, 255, 0.14)",
    text: "#f2f5f8",
    dim: "rgba(242, 245, 248, 0.55)",
    grid: "rgba(255, 255, 255, 0.09)",
    accent: "#4fc3f7",
};

function btnStyle(on, disabled) {
    return {
        display: "flex",
        alignItems: "center",
        padding: "5rem 12rem",
        borderRadius: "4rem",
        background: on ? C.accent : "rgba(255,255,255,0.08)",
        color: on ? "#0c1218" : C.text,
        fontSize: "13rem",
        fontWeight: on ? 700 : 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        marginRight: "6rem",
        marginBottom: "6rem",
    };
}

function Toggle(props) {
    return h("div", { style: btnStyle(props.on, props.disabled), onClick: props.disabled ? null : props.onClick }, props.icon, props.label);
}

function loadColor(pct) {
    return pct > 100 ? "#ff5a5a" : pct > 80 ? "#ffc93d" : "#5fd38d";
}

// ---------------------------------------------------------------- icons

function ChartIcon(props) {
    const c = props.active ? "#ffffff" : "#d9eef8";
    return h("svg", { viewBox: "0 0 32 32", width: "26", height: "26", fill: "none" },
        h("path", { d: "M4 4 V28 H28", stroke: c, strokeWidth: "2.5", fill: "none" }),
        h("path", { d: "M8 22 L13 15 L18 18 L26 8", stroke: c, strokeWidth: "2.5", fill: "none" }),
        h("path", { d: "M8 25 H11 V21 H8 Z M14 25 H17 V19 H14 Z M20 25 H23 V16 H20 Z", fill: c }));
}

// Delete button of a line in the list.
function TrashIcon() {
    return h("svg", { viewBox: "0 0 16 16", width: "13rem", height: "13rem" },
        h("path", { d: "M3 4.5 H13 M6.5 4.5 V3 H9.5 V4.5 M4.5 4.5 L5.2 13.5 H10.8 L11.5 4.5 M7 7 V11.5 M9 7 V11.5", stroke: C.dim, strokeWidth: "1.4", fill: "none" }));
}

// Sort button of a transport type in the line list.
function FunnelIcon(props) {
    return h("svg", { viewBox: "0 0 16 16", width: "13rem", height: "13rem" },
        h("path", { d: "M2 3 H14 L9.5 8.5 V13 L6.5 11.5 V8.5 Z", fill: props.active ? C.accent : "none", stroke: props.active ? C.accent : C.dim, strokeWidth: "1.5" }));
}

// The game font has no "✕", so the close cross is drawn.
function CloseIcon() {
    return h("svg", { viewBox: "0 0 16 16", width: "16rem", height: "16rem" },
        h("path", { d: "M3 3 L13 13 M13 3 L3 13", stroke: C.text, strokeWidth: "2", fill: "none" }));
}

function TypeIcon(props) {
    return h("img", {
        src: "Media/Game/Icons/" + TYPE_ICONS[props.type] + ".svg",
        style: { width: (props.size || 18) + "rem", height: (props.size || 18) + "rem", marginRight: props.size ? "2rem" : "6rem" },
    });
}

// ---------------------------------------------------------------- chart

const CW = 640, CH = 300, PAD_L = 52, PAD_R = 12, PAD_T = 12, PAD_B = 30;

function niceMax(v) {
    if (v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
}

// series: [{ key, label, color, values: number[] (-1 = no data), peak?: number[] }]
function Chart(props) {
    const { series, labels, tr, daily, unit, minMax } = props;
    const [hover, setHover] = useState(-1);
    const boxRef = useRef(null);
    const n = labels.length;

    let maxV = minMax || 0;
    series.forEach((s) => {
        s.values.forEach((v) => { if (v > maxV) maxV = v; });
        if (s.peak) s.peak.forEach((v) => { if (v > maxV) maxV = v; });
    });
    const yMax = niceMax(maxV);
    const iw = CW - PAD_L - PAD_R, ih = CH - PAD_T - PAD_B;
    const x = (i) => PAD_L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => PAD_T + ih - (v / yMax) * ih;
    // Hour values are averages of ~20 samples; people are shown whole, only the axis keeps fractions.
    const fmt = (v) => Math.round(v).toString() + unit;
    const fmtAxis = (v) => (v % 1 ? v.toFixed(1) : v.toString()) + unit;

    function pathOf(values) {
        let d = "", pen = false;
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (v < 0) { pen = false; continue; }
            d += (pen ? " L" : " M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
            pen = true;
        }
        return d;
    }

    const children = [];
    const yLabels = [];
    for (let k = 0; k <= 4; k++) {
        const v = (yMax * k) / 4;
        const yy = y(v);
        children.push(h("path", { key: "g" + k, d: `M${PAD_L} ${yy} H${CW - PAD_R}`, stroke: C.grid, strokeWidth: "1" }));
        yLabels.push(h("div", {
            key: "yl" + k,
            style: { position: "absolute", left: "0", width: (PAD_L - 6) + "rem", top: (yy - 8) + "rem", textAlign: "right", fontSize: "11rem", color: C.dim },
        }, fmtAxis(v)));
    }
    if (unit === "%" && yMax > 100) {
        children.push(h("path", { key: "full", d: `M${PAD_L} ${y(100)} H${CW - PAD_R}`, stroke: "rgba(255,90,90,0.5)", strokeWidth: "1", strokeDasharray: "4 4" }));
    }
    const xLabels = [];
    const step = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += step) {
        xLabels.push(h("div", {
            key: "xl" + i,
            style: { position: "absolute", left: (x(i) - 40) + "rem", width: "80rem", top: (CH - PAD_B + 6) + "rem", textAlign: "center", fontSize: "11rem", color: C.dim },
        }, labels[i]));
    }
    series.forEach((s) => {
        if (s.peak) children.push(h("path", { key: "p" + s.key, d: pathOf(s.peak), stroke: s.color, strokeWidth: "1.5", strokeOpacity: "0.35", fill: "none" }));
        children.push(h("path", { key: "s" + s.key, d: pathOf(s.values), stroke: s.color, strokeWidth: "2.5", fill: "none" }));
        if (n === 1 && s.values[0] >= 0) {
            children.push(h("circle", { key: "c" + s.key, cx: x(0), cy: y(s.values[0]), r: "4", fill: s.color }));
        }
    });
    if (hover >= 0 && hover < n) {
        children.push(h("path", { key: "hv", d: `M${x(hover)} ${PAD_T} V${PAD_T + ih}`, stroke: "rgba(255,255,255,0.5)", strokeWidth: "1" }));
    }

    function onMove(e) {
        const el = boxRef.current;
        if (!el || n === 0) return;
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - r.left) / (r.width / CW);
        let i = n <= 1 ? 0 : Math.round(((mx - PAD_L) / iw) * (n - 1));
        setHover(Math.max(0, Math.min(n - 1, i)));
    }

    let tip = null;
    if (hover >= 0 && hover < n) {
        const rows = series
            .filter((s) => s.values[hover] >= 0)
            .sort((a, b) => b.values[hover] - a.values[hover])
            .slice(0, 12)
            .map((s) => h("div", { key: s.key, style: { display: "flex", alignItems: "center", marginTop: "3rem" } },
                h("div", { style: { width: "10rem", height: "10rem", borderRadius: "2rem", background: s.color, marginRight: "6rem" } }),
                h("div", { style: { flexGrow: 1, marginRight: "10rem" } }, s.label),
                h("div", { style: { fontWeight: 700 } },
                    fmt(s.values[hover]) +
                    (daily && s.peak && s.peak[hover] >= 0 ? "  (" + tr.t("peak") + " " + fmt(s.peak[hover]) + ")" : ""))));
        const left = x(hover) > CW / 2 ? x(hover) - 262 : x(hover) + 12;
        tip = h("div", {
            style: {
                position: "absolute", left: left + "rem", top: PAD_T + "rem", width: "250rem",
                background: "rgba(8,10,14,0.95)", border: "1rem solid " + C.border, borderRadius: "4rem",
                padding: "8rem", fontSize: "12rem", color: C.text, pointerEvents: "none",
            },
        }, h("div", { style: { fontWeight: 700, marginBottom: "2rem" } }, labels[hover]), rows);
    }

    return h("div", {
        ref: boxRef,
        style: { position: "relative", width: CW + "rem", height: CH + "rem" },
        onMouseMove: onMove,
        onMouseLeave: () => setHover(-1),
    },
        h("svg", { width: CW + "rem", height: CH + "rem", viewBox: `0 0 ${CW} ${CH}`, style: { position: "absolute", left: "0", top: "0" } }, children),
        yLabels, xLabels, tip);
}

// ---------------------------------------------------------------- table

// Small "go to" arrow: opens the line in the game.
function OpenIcon() {
    return h("svg", { viewBox: "0 0 16 16", width: "14rem", height: "14rem" },
        h("path", { d: "M6 3 H13 V10 M13 3 L4 12", stroke: C.dim, strokeWidth: "2", fill: "none" }));
}

// One row per working line: the latest sample plus the last 24 finished hours.
function tableRows(lines, live, transfers) {
    const rows = [];
    const cameFrom = {};
    (transfers ? transfers.transfers : []).forEach((t) => { cameFrom[t.to] = (cameFrom[t.to] || 0) + t.n; });
    lines.forEach((l) => {
        const lv = live && live[l.id];
        if (!lv) return;
        let boarded = -1, peak = -1;
        for (let i = Math.max(0, l.hb.length - 24); i < l.hb.length; i++) {
            if (l.hb[i] >= 0) boarded = (boarded < 0 ? 0 : boarded) + l.hb[i];
            if (l.hr[i] >= 0 && l.hc[i] > 0) peak = Math.max(peak, (100 * l.hr[i]) / l.hc[i]);
        }
        rows.push({
            line: l,
            riding: lv[0],
            load: lv[1] > 0 ? (100 * lv[0]) / lv[1] : -1,
            waiting: lv[2],
            vehicles: lv[3],
            boarded,
            peak,
            transfer: boarded > 0 ? Math.min(100, (100 * (cameFrom[l.id] || 0)) / boarded) : -1,
        });
    });
    return rows;
}

const COLUMNS = [
    // widths + 8rem padding each must stay under the chart width (640)
    { key: "name", text: "colLine", width: 130 },
    { key: "riding", text: "colRiding", width: 45 },
    { key: "load", text: "colLoad", width: 55 },
    { key: "waiting", text: "colWaiting", width: 45 },
    { key: "vehicles", text: "colVehicles", width: 50 },
    { key: "boarded", text: "colBoarded", width: 90 },
    { key: "peak", text: "colPeak", width: 75 },
    { key: "transfer", text: "colTransfer", width: 80 },
];

function Table(props) {
    const { tr, lines, live, transfers } = props;
    const [sort, setSort] = usePersisted("sort");
    const [hoverCol, setHoverCol] = useState(-1);
    const rows = tableRows(lines, live, transfers);
    if (rows.length === 0) return h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t("noAlive"));

    const val = (r, k) => (k === "name" ? r.line.name : r[k]);
    rows.sort((a, b) => {
        const va = val(a, sort.key), vb = val(b, sort.key);
        const c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return sort.desc ? -c : c;
    });
    const cell = (col, content, extra, onClick) => h("div", {
        key: col.key,
        onClick,
        style: Object.assign({ width: col.width + "rem", flexShrink: 0, textAlign: col.key === "name" ? "left" : "right", paddingRight: "8rem" }, extra),
    }, content);
    const num = (v, unit) => (v < 0 ? "—" : Math.round(v) + (unit || ""));

    // A click on a header sorts by it; a second click turns the order around.
    // Hovering a header shows what the column means.
    const header = h("div", { style: { display: "flex", fontSize: "11rem", color: C.dim, paddingBottom: "6rem", borderBottom: "1rem solid " + C.border } },
        COLUMNS.map((col, i) => h("div", {
            key: col.key,
            onMouseEnter: () => setHoverCol(i),
            onMouseLeave: () => setHoverCol(-1),
            onClick: () => setSort({ key: col.key, desc: sort.key === col.key ? !sort.desc : col.key !== "name" }),
            style: {
                width: col.width + "rem", flexShrink: 0, paddingRight: "8rem", cursor: "pointer", whiteSpace: "nowrap",
                textAlign: col.key === "name" ? "left" : "right",
                fontWeight: sort.key === col.key ? 700 : 500, color: sort.key === col.key ? C.text : C.dim,
            },
        }, (sort.key === col.key ? (sort.desc ? "▼ " : "▲ ") : "") + tr.t(col.text))));
    let tip = null;
    if (hoverCol >= 0) {
        let left = 0;
        for (let i = 0; i < hoverCol; i++) left += COLUMNS[i].width + 8;
        left = Math.min(left, CW - 260);
        tip = h("div", {
            style: {
                position: "absolute", left: left + "rem", top: "22rem", width: "260rem", zIndex: 10,
                background: "rgba(8,10,14,0.97)", border: "1rem solid " + C.border, borderRadius: "4rem",
                padding: "8rem", fontSize: "12rem", color: C.text, pointerEvents: "none",
            },
        }, COLUMN_TIPS[COLUMNS[hoverCol].key][tr.ru ? 0 : 1]);
    }

    const body = rows.map((r) => {
        const over = r.load > 100, empty = r.load >= 0 && r.load < 20;
        return h("div", {
            key: r.line.id,
            style: {
                display: "flex", alignItems: "center", padding: "5rem 0", fontSize: "13rem", cursor: "pointer",
                borderBottom: "1rem solid rgba(255,255,255,0.05)",
                background: over ? "rgba(255,90,90,0.12)" : "transparent",
                color: empty ? C.dim : C.text,
            },
            onClick: () => api.trigger(G, "openLine", r.line.id),
        },
            cell(COLUMNS[0], h("div", { style: { display: "flex", alignItems: "center" } },
                h("div", { style: { width: "10rem", height: "10rem", borderRadius: "2rem", background: r.line.color, marginRight: "7rem", flexShrink: 0 } }),
                h("div", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, r.line.name))),
            cell(COLUMNS[1], num(r.riding)),
            cell(COLUMNS[2], num(r.load, "%"), { fontWeight: 700, color: r.load < 0 ? C.dim : loadColor(r.load) }),
            cell(COLUMNS[3], num(r.waiting)),
            cell(COLUMNS[4], num(r.vehicles)),
            cell(COLUMNS[5], num(r.boarded)),
            cell(COLUMNS[6], num(r.peak, "%"), { color: r.peak < 0 ? C.dim : loadColor(r.peak) }),
            cell(COLUMNS[7], num(r.transfer, "%")));
    });

    return h("div", { style: { width: CW + "rem", position: "relative" } },
        header,
        tip,
        h("div", { style: { maxHeight: "300rem", overflowY: "auto", overflowX: "hidden" } }, body));
}

// ---------------------------------------------------------------- stops

const stopName = (s, tr) => s.name || tr.t("stop") + " " + (s.idx + 1);
const IN_COLOR = "#5fd38d", OUT_COLOR = "#ff9f43";

function Bar(props) {
    const w = props.max > 0 && props.value > 0 ? Math.max(2, Math.round((props.width * props.value) / props.max)) : 0;
    return h("div", { style: { display: "flex", alignItems: "center", width: (props.width + 40) + "rem" } },
        h("div", { style: { width: w + "rem", height: "8rem", borderRadius: "2rem", background: props.color, marginRight: "5rem" } }),
        h("div", { style: { fontSize: "12rem", color: props.color } }, Math.round(props.value).toString()));
}

// The line drawn top to bottom: a stop per row, the stretch to the next stop between rows.
function StopDiagram(props) {
    const { tr, line, stops, transfers } = props;
    const [hover, setHover] = useState(-1);
    const list = stops.filter((s) => s.line === line.id && s.alive).sort((a, b) => a.idx - b.idx);
    if (list.length === 0) return h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t("noStops"));
    let max = 1;
    list.forEach((s) => { max = Math.max(max, s.b, s.a); });
    // Transfers at each stop: got on this line from another one / got off it onto another one.
    const tIn = {}, tOut = {};
    (transfers ? transfers.transfers : []).forEach((t) => {
        if (t.to === line.id) tIn[t.toStop] = (tIn[t.toStop] || 0) + t.n;
        if (t.from === line.id) tOut[t.fromStop] = (tOut[t.fromStop] || 0) + t.n;
    });

    const rows = [];
    list.forEach((s, i) => {
        const hv = hover === i;
        rows.push(h("div", {
            key: "s" + s.id,
            style: { display: "flex", alignItems: "center", height: "26rem", cursor: "pointer", background: hv ? "rgba(255,255,255,0.06)" : "transparent" },
            onMouseEnter: () => setHover(i),
            onMouseLeave: () => setHover(-1),
            onClick: () => api.trigger(G, "focusStop", s.id),
        },
            // the line itself: a dot on a vertical stripe
            h("div", { style: { width: "30rem", height: "26rem", position: "relative", flexShrink: 0 } },
                h("div", { style: { position: "absolute", left: "12rem", top: "0", width: "6rem", height: "26rem", background: line.color } }),
                h("div", { style: { position: "absolute", left: "7rem", top: "5rem", width: "16rem", height: "16rem", borderRadius: "8rem", background: C.panelBg, border: "3rem solid " + line.color } })),
            h("div", { style: { width: "170rem", fontSize: "13rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: "8rem" } }, stopName(s, tr)),
            h("div", { style: { width: "80rem", fontSize: "12rem", color: s.wait > 0 ? C.text : C.dim } }, tr.t("waitNow") + " " + s.wait),
            h("div", { style: { width: "60rem", fontSize: "12rem", color: C.accent } },
                tIn[s.id] || tOut[s.id] ? "⇄ " + Math.round(tIn[s.id] || 0) + "/" + Math.round(tOut[s.id] || 0) : ""),
            h(Bar, { value: s.b, max, width: 95, color: IN_COLOR }),
            h(Bar, { value: s.a, max, width: 95, color: OUT_COLOR })));
        // stretch to the next stop (routes are loops: the last one goes back to the first)
        const last = i === list.length - 1;
        rows.push(h("div", { key: "g" + s.id, style: { display: "flex", alignItems: "center", height: "18rem" } },
            h("div", { style: { width: "30rem", height: "18rem", position: "relative", flexShrink: 0 } },
                h("div", { style: { position: "absolute", left: "12rem", top: "0", width: "6rem", height: "18rem", background: s.l >= 0 ? loadColor(s.l) : line.color, opacity: s.l >= 0 ? 0.9 : 0.4 } })),
            h("div", { style: { fontSize: "11rem", color: C.dim } },
                "↓ " + tr.t("segment") + (last ? " " + tr.t("backToFirst") : "") + ": ",
                h("span", { style: { color: s.l >= 0 ? loadColor(s.l) : C.dim, fontWeight: 700 } }, s.l >= 0 ? Math.round(s.l) + "%" : "—"))));
    });

    let tip = null;
    if (hover >= 0) {
        const s = list[hover];
        tip = h("div", {
            style: {
                position: "absolute", right: "8rem", top: "4rem", width: "230rem", zIndex: 10, pointerEvents: "none",
                background: "rgba(8,10,14,0.97)", border: "1rem solid " + C.border, borderRadius: "4rem", padding: "8rem", fontSize: "12rem",
            },
        },
            h("div", { style: { fontWeight: 700, marginBottom: "4rem" } }, stopName(s, tr)),
            h("div", null, tr.t("waitNow") + ": " + s.wait),
            h("div", null, tr.t("waitAvg") + ": " + (s.w >= 0 ? Math.round(s.w) : "—")),
            h("div", { style: { color: IN_COLOR } }, tr.t("boardedShort") + ": " + Math.round(s.b)),
            h("div", { style: { color: OUT_COLOR } }, tr.t("alightedShort") + ": " + Math.round(s.a)),
            h("div", null, tr.t("segment") + ": " + (s.l >= 0 ? Math.round(s.l) + "%" : "—")),
            h("div", { style: { color: C.accent } }, "⇄ " + tr.t("transIn") + ": " + Math.round(tIn[s.id] || 0)),
            h("div", { style: { color: C.accent } }, "⇄ " + tr.t("transOut") + ": " + Math.round(tOut[s.id] || 0)));
    }

    return h("div", { style: { position: "relative", width: CW + "rem" } },
        h("div", { style: { display: "flex", fontSize: "11rem", color: C.dim, marginBottom: "4rem", paddingLeft: "280rem" } },
            h("div", { style: { width: "60rem", color: C.accent }, title: tr.t("transferMark") }, "⇄"),
            h("div", { style: { width: "135rem", color: IN_COLOR } }, tr.t("boardedShort")),
            h("div", { style: { width: "135rem", color: OUT_COLOR } }, tr.t("alightedShort"))),
        h("div", { style: { maxHeight: "330rem", overflowY: "auto", overflowX: "hidden" } }, rows),
        tip);
}

const STOP_COLUMNS = [
    // leaves room for the scroll bar inside 640
    { key: "name", text: "colStop", width: 185 },
    { key: "lines", text: "colLines", width: 100 },
    { key: "wait", text: "colWaitNow", width: 60 },
    { key: "b", text: "colIn", width: 70 },
    { key: "a", text: "colOut", width: 70 },
    { key: "w", text: "colWaitAvg", width: 70 },
];
const STOP_TIPS = {
    name: ["Название остановки, как в игре. Щелчок по строке переносит к ней камеру.", "Stop name as in the game. Click a row to move the camera there."],
    lines: ["Линии, которые останавливаются здесь.", "Lines that stop here."],
    wait: ["Сколько людей ждёт здесь прямо сейчас (все линии вместе).", "People waiting here right now (all lines together)."],
    b: ["Сколько людей село здесь за последние 24 игровых часа.", "People who got in here over the last 24 in-game hours."],
    a: ["Сколько людей вышло здесь за последние 24 игровых часа.", "People who got out here over the last 24 in-game hours."],
    w: ["Сколько людей ждало здесь в среднем за последние 24 игровых часа.", "Average number of people waiting here over the last 24 in-game hours."],
};

// Stops of the city: one row per platform, the lines serving it added up.
function StopsTable(props) {
    const { tr, lines, stops } = props;
    const [sort, setSort] = usePersisted("stopSort");
    const [hoverCol, setHoverCol] = useState(-1);
    const byId = {};
    lines.forEach((l) => { byId[l.id] = l; });
    const groups = {};
    stops.forEach((s) => {
        if (!s.alive || !byId[s.line]) return;
        let g = groups[s.place];
        if (!g) g = groups[s.place] = { id: s.id, name: s.name, idx: s.idx, lines: [], wait: 0, b: 0, a: 0, w: 0 };
        if (!g.name && s.name) g.name = s.name;
        if (g.lines.indexOf(byId[s.line]) < 0) g.lines.push(byId[s.line]);
        g.wait += s.wait;
        g.b += s.b;
        g.a += s.a;
        if (s.w > 0) g.w += s.w;
    });
    const rows = Object.keys(groups).map((k) => groups[k]);
    if (rows.length === 0) return h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t("noStops"));
    const val = (r, k) => (k === "name" ? stopName(r, tr) : k === "lines" ? r.lines.length : r[k]);
    rows.sort((x, y) => {
        const a = val(x, sort.key), b = val(y, sort.key);
        const c = typeof a === "string" ? a.localeCompare(b) : a - b;
        return sort.desc ? -c : c;
    });

    const header = h("div", { style: { display: "flex", fontSize: "11rem", paddingBottom: "6rem", borderBottom: "1rem solid " + C.border } },
        STOP_COLUMNS.map((col, i) => h("div", {
            key: col.key,
            onMouseEnter: () => setHoverCol(i),
            onMouseLeave: () => setHoverCol(-1),
            onClick: () => setSort({ key: col.key, desc: sort.key === col.key ? !sort.desc : col.key !== "name" }),
            style: {
                width: col.width + "rem", flexShrink: 0, paddingRight: "8rem", cursor: "pointer", whiteSpace: "nowrap",
                textAlign: col.key === "name" || col.key === "lines" ? "left" : "right",
                fontWeight: sort.key === col.key ? 700 : 500, color: sort.key === col.key ? C.text : C.dim,
            },
        }, (sort.key === col.key ? (sort.desc ? "▼ " : "▲ ") : "") + tr.t(col.text))));
    let tip = null;
    if (hoverCol >= 0) {
        let left = 0;
        for (let i = 0; i < hoverCol; i++) left += STOP_COLUMNS[i].width + 8;
        tip = h("div", {
            style: {
                position: "absolute", left: Math.min(left, CW - 260) + "rem", top: "22rem", width: "260rem", zIndex: 10,
                background: "rgba(8,10,14,0.97)", border: "1rem solid " + C.border, borderRadius: "4rem",
                padding: "8rem", fontSize: "12rem", color: C.text, pointerEvents: "none",
            },
        }, STOP_TIPS[STOP_COLUMNS[hoverCol].key][tr.ru ? 0 : 1]);
    }
    const cell = (col, content, extra) => h("div", {
        key: col.key,
        style: Object.assign({ width: col.width + "rem", flexShrink: 0, paddingRight: "8rem", textAlign: col.key === "name" || col.key === "lines" ? "left" : "right" }, extra),
    }, content);
    const body = rows.slice(0, 200).map((r) => h("div", {
        key: r.id,
        style: { display: "flex", alignItems: "center", padding: "5rem 0", fontSize: "13rem", cursor: "pointer", borderBottom: "1rem solid rgba(255,255,255,0.05)" },
        onClick: () => api.trigger(G, "focusStop", r.id),
    },
        cell(STOP_COLUMNS[0], h("div", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, stopName(r, tr))),
        cell(STOP_COLUMNS[1], h("div", { style: { display: "flex", flexWrap: "wrap" } },
            r.lines.map((l) => h("div", {
                key: l.id,
                style: { padding: "0 4rem", marginRight: "3rem", marginBottom: "2rem", borderRadius: "3rem", background: l.color, color: "#0c1218", fontSize: "11rem", fontWeight: 700 },
            }, l.num.toString())))),
        cell(STOP_COLUMNS[2], r.wait.toString()),
        cell(STOP_COLUMNS[3], Math.round(r.b).toString(), { color: IN_COLOR }),
        cell(STOP_COLUMNS[4], Math.round(r.a).toString(), { color: OUT_COLOR }),
        cell(STOP_COLUMNS[5], Math.round(r.w).toString())));

    return h("div", { style: { width: CW + "rem", position: "relative" } },
        header, tip,
        h("div", { style: { maxHeight: "300rem", overflowY: "auto", overflowX: "hidden" } }, body));
}

// ---------------------------------------------------------------- transfers

function LineBadge(props) {
    const l = props.line;
    if (!l) return h("div", { style: { padding: "0 5rem", borderRadius: "3rem", background: "#666", fontSize: "11rem" } }, "?");
    return h("div", {
        style: { display: "flex", alignItems: "center", padding: "1rem 5rem", borderRadius: "3rem", background: l.color, color: "#0c1218", fontSize: "11rem", fontWeight: 700, flexShrink: 0 },
    }, h(TypeIcon, { type: l.type, size: 12 }), l.num.toString());
}

function Chain(props) {
    const parts = [];
    props.lines.forEach((id, i) => {
        if (i > 0) parts.push(h("div", { key: "a" + i, style: { margin: "0 4rem", color: C.dim } }, "→"));
        parts.push(h(LineBadge, { key: "l" + i, line: props.byId[id] }));
    });
    return h("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap" } }, parts);
}

const sectionTitle = (text) => h("div", { style: { fontSize: "12rem", fontWeight: 700, margin: "8rem 0 6rem 0" } }, text);

// Transfers off and onto one line, and the trips it is part of.
function TransfersLine(props) {
    const { tr, line, lines, transfers, stopNames } = props;
    const byId = {};
    lines.forEach((l) => { byId[l.id] = l; });
    const all = transfers ? transfers.transfers : [];
    // Group by the other line; remember the stop where most of them change.
    const group = (list, other, stopOf) => {
        const g = {};
        list.forEach((t) => {
            const k = other(t);
            const e = g[k] || (g[k] = { line: k, n: 0, stops: {} });
            e.n += t.n;
            e.stops[stopOf(t)] = (e.stops[stopOf(t)] || 0) + t.n;
        });
        return Object.keys(g).map((k) => g[k]).sort((a, b) => b.n - a.n);
    };
    const out = group(all.filter((t) => t.from === line.id), (t) => t.to, (t) => t.fromStop);
    const inn = group(all.filter((t) => t.to === line.id), (t) => t.from, (t) => t.toStop);
    let max = 1;
    out.concat(inn).forEach((e) => { max = Math.max(max, e.n); });
    const topStop = (e) => {
        let best = null;
        Object.keys(e.stops).forEach((s) => { if (!best || e.stops[s] > e.stops[best]) best = s; });
        return best;
    };
    const column = (title, entries) => h("div", { style: { width: "310rem", marginRight: "10rem" } },
        sectionTitle(title),
        entries.length === 0 ? h("div", { style: { color: C.dim, fontSize: "12rem" } }, "—") :
            entries.slice(0, 10).map((e) => {
                const s = topStop(e);
                return h("div", {
                    key: e.line,
                    style: { display: "flex", alignItems: "center", padding: "3rem 0", cursor: s ? "pointer" : "default" },
                    onClick: () => { if (s) api.trigger(G, "focusStop", s); },
                },
                    h("div", { style: { width: "60rem", display: "flex" } }, h(LineBadge, { line: byId[e.line] })),
                    h(Bar, { value: e.n, max, width: 80, color: C.accent }),
                    h("div", { style: { fontSize: "11rem", color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "120rem" } },
                        s && stopNames[s] ? tr.t("atStop") + " " + stopNames[s] : ""));
            }));

    const chains = (transfers ? transfers.chains : []).filter((c) => c.lines.indexOf(line.id) >= 0).sort((a, b) => b.n - a.n).slice(0, 8);
    if (out.length === 0 && inn.length === 0 && chains.length === 0)
        return h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t("noTransfers"));
    return h("div", { style: { width: CW + "rem", maxHeight: "360rem", overflowY: "auto", overflowX: "hidden" } },
        h("div", { style: { display: "flex" } },
            column(tr.t("fromThis"), out),
            column(tr.t("toThis"), inn)),
        sectionTitle(tr.t("chains")),
        chains.length === 0 ? h("div", { style: { color: C.dim, fontSize: "12rem" } }, "—") :
            chains.map((c) => h("div", { key: c.lines.join(">"), style: { display: "flex", alignItems: "center", padding: "3rem 0" } },
                h("div", { style: { flexGrow: 1 } }, h(Chain, { lines: c.lines, byId })),
                h("div", { style: { fontSize: "12rem", fontWeight: 700, marginLeft: "8rem" } }, Math.round(c.n) + " " + tr.t("people")))));
}

// Hubs: stops (by place) where most people change lines, with the busiest pairs; and the busiest trips.
function TransfersCity(props) {
    const { tr, lines, transfers, stops } = props;
    const byId = {};
    lines.forEach((l) => { byId[l.id] = l; });
    const stopById = {};
    (stops ? stops.stops : []).forEach((s) => { stopById[s.id] = s; });
    const hubs = {};
    (transfers ? transfers.transfers : []).forEach((t) => {
        if (!byId[t.from] && !byId[t.to]) return;
        const s = stopById[t.toStop];
        const place = s ? s.place : t.toStop;
        const hub = hubs[place] || (hubs[place] = { place, stop: t.toStop, name: s ? stopName(s, tr) : "", n: 0, pairs: [] });
        hub.n += t.n;
        hub.pairs.push(t);
    });
    const list = Object.keys(hubs).map((k) => hubs[k]).sort((a, b) => b.n - a.n).slice(0, 30);
    const chains = (transfers ? transfers.chains : [])
        .filter((c) => c.lines.some((id) => byId[id])).sort((a, b) => b.n - a.n).slice(0, 12);
    if (list.length === 0 && chains.length === 0)
        return h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t("noTransfers"));
    let max = 1;
    list.forEach((hb) => { max = Math.max(max, hb.n); });

    return h("div", { style: { width: CW + "rem", maxHeight: "360rem", overflowY: "auto", overflowX: "hidden" } },
        sectionTitle(tr.t("hubs")),
        list.map((hb) => {
            const pairs = hb.pairs.slice().sort((a, b) => b.n - a.n).slice(0, 3);
            return h("div", {
                key: hb.place,
                style: { display: "flex", alignItems: "center", padding: "4rem 0", cursor: "pointer", borderBottom: "1rem solid rgba(255,255,255,0.05)" },
                onClick: () => api.trigger(G, "focusStop", hb.stop),
            },
                h("div", { style: { width: "170rem", fontSize: "13rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: "8rem" } },
                    hb.name || tr.t("stop")),
                h(Bar, { value: hb.n, max, width: 80, color: C.accent }),
                h("div", { style: { display: "flex", flexWrap: "wrap", width: "330rem" } },
                    pairs.map((p, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", marginRight: "10rem", fontSize: "11rem" } },
                        h(LineBadge, { line: byId[p.from] }),
                        h("div", { style: { margin: "0 3rem", color: C.dim } }, "→"),
                        h(LineBadge, { line: byId[p.to] }),
                        h("div", { style: { marginLeft: "4rem", color: C.dim } }, Math.round(p.n).toString())))));
        }),
        sectionTitle(tr.t("chains")),
        chains.length === 0 ? h("div", { style: { color: C.dim, fontSize: "12rem" } }, "—") :
            chains.map((c) => h("div", { key: c.lines.join(">"), style: { display: "flex", alignItems: "center", padding: "3rem 0" } },
                h("div", { style: { flexGrow: 1 } }, h(Chain, { lines: c.lines, byId })),
                h("div", { style: { fontSize: "12rem", fontWeight: 700, marginLeft: "8rem" } }, Math.round(c.n) + " " + tr.t("people")))));
}

// ---------------------------------------------------------------- destinations

// One bar split by trip purpose, with a legend under it.
function PurposeBar(props) {
    const { tr, counts } = props;
    let total = 0;
    PURPOSE_ORDER.forEach((p) => { total += counts[p] || 0; });
    if (total <= 0) return h("div", { style: { color: C.dim, fontSize: "12rem" } }, "—");
    const i = tr.ru ? 0 : 1;
    const parts = PURPOSE_ORDER.filter((p) => counts[p] > 0);
    return h("div", null,
        h("div", { style: { display: "flex", width: CW + "rem", height: "14rem", borderRadius: "3rem", overflow: "hidden" } },
            parts.map((p) => h("div", { key: p, style: { width: ((CW * counts[p]) / total).toFixed(1) + "rem", height: "14rem", background: PURPOSES[p][2] } }))),
        h("div", { style: { display: "flex", flexWrap: "wrap", marginTop: "5rem" } },
            parts.map((p) => h("div", { key: p, style: { display: "flex", alignItems: "center", marginRight: "12rem", fontSize: "12rem" } },
                h("div", { style: { width: "10rem", height: "10rem", borderRadius: "2rem", background: PURPOSES[p][2], marginRight: "4rem" } }),
                PURPOSES[p][i] + " " + Math.round((100 * counts[p]) / total) + "%"))));
}

// Why riders travel and where they arrive: for one line, or for all lines of the open tabs.
function DestView(props) {
    const { tr, line, lines, dest } = props;
    const [kinds, setKinds] = usePersisted("destKinds");      // null = every kind
    const [lit, setLit] = usePersisted("highlightOn");
    const byId = {};
    lines.forEach((l) => { byId[l.id] = l; });
    const inScope = (id) => (line ? id === line.id : !!byId[id]);
    const i = tr.ru ? 0 : 1;

    const counts = {};
    (dest ? dest.purposes : []).forEach((p) => { if (inScope(p.line)) counts[p.p] = (counts[p.p] || 0) + p.n; });

    // Buildings with only the riders of the lines in scope counted.
    const rows = [];
    (dest ? dest.dest : []).forEach((d) => {
        let n = 0;
        const ls = [];
        Object.keys(d.lines).forEach((id) => {
            if (!inScope(id)) return;
            n += d.lines[id];
            ls.push({ id, n: d.lines[id] });
        });
        if (n <= 0) return;
        ls.sort((a, b) => b.n - a.n);
        rows.push({ id: d.id, name: d.name, kind: KINDS[d.kind] ? d.kind : "other", n, lines: ls });
    });
    rows.sort((a, b) => b.n - a.n);
    const presentKinds = KIND_ORDER.filter((k) => rows.some((r) => r.kind === k));
    const shown = rows.filter((r) => kinds === null || kinds.indexOf(r.kind) >= 0);

    // The game's highlight follows the list while the button is on.
    const litIds = lit ? shown.slice(0, 50).map((r) => r.id).join(",") : "";
    useEffect(() => { api.trigger(G, "highlight", litIds); }, [litIds]);

    if (rows.length === 0) return h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t("noDest"));
    let max = 1;
    shown.forEach((r) => { max = Math.max(max, r.n); });
    // From "all types" a click keeps just that type; after that clicks add or remove types.
    function toggleKind(k) {
        if (kinds === null) return setKinds([k]);
        const cur = kinds.slice();
        const j = cur.indexOf(k);
        if (j >= 0) cur.splice(j, 1); else cur.push(k);
        setKinds(cur);
    }

    return h("div", { style: { width: CW + "rem" } },
        sectionTitle(tr.t("why")),
        h(PurposeBar, { tr, counts }),
        h("div", { style: { display: "flex", alignItems: "center", margin: "10rem 0 4rem 0" } },
            h("div", { style: { flexGrow: 1, fontSize: "12rem", fontWeight: 700 } }, tr.t("where")),
            h("div", { title: tr.t("highlightTip") },
                h(Toggle, { label: (lit ? "● " : "○ ") + tr.t("highlight"), on: !!lit, onClick: () => setLit(!lit) }))),
        h("div", { style: { display: "flex", flexWrap: "wrap" } },
            h(Toggle, { label: tr.t("allKinds"), on: kinds === null, onClick: () => setKinds(null) }),
            presentKinds.map((k) => h("div", {
                key: k,
                onClick: () => toggleKind(k),
                style: Object.assign(btnStyle(kinds !== null && kinds.indexOf(k) >= 0, false), { borderLeft: "4rem solid " + KINDS[k][2] }),
            }, KINDS[k][i]))),
        h("div", { style: { maxHeight: "240rem", overflowY: "auto", overflowX: "hidden" } },
            shown.slice(0, 150).map((r) => h("div", {
                key: r.id,
                style: { display: "flex", alignItems: "center", padding: "4rem 0", cursor: "pointer", borderBottom: "1rem solid rgba(255,255,255,0.05)" },
                onClick: () => api.trigger(G, "focusBuilding", r.id),
            },
                h("div", { style: { width: "10rem", height: "10rem", borderRadius: "5rem", background: KINDS[r.kind][2], marginRight: "6rem", flexShrink: 0 } }),
                h("div", { style: { width: "90rem", fontSize: "11rem", color: C.dim, flexShrink: 0 } }, KINDS[r.kind][i]),
                h("div", { style: { width: "190rem", fontSize: "13rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: "8rem" } }, r.name || "—"),
                h(Bar, { value: r.n, max, width: 90, color: C.accent }),
                line ? null : h("div", { style: { display: "flex", flexWrap: "wrap", width: "150rem" } },
                    r.lines.slice(0, 4).map((x) => h("div", { key: x.id, style: { marginRight: "3rem", marginBottom: "2rem" } }, h(LineBadge, { line: byId[x.id] }))))))));
}

// ---------------------------------------------------------------- panel

function parseJson(json) {
    if (!json) return null;
    try { return JSON.parse(json); } catch (e) { return null; }
}

// Window position survives closing the window (and the game, where storage works).
let savedPos = null;
try { savedPos = JSON.parse(window.localStorage.getItem("trafficStatistic.pos")); } catch (e) { }
if (!savedPos) savedPos = { x: 60, y: 140 };

// Settings remembered while the game runs.
const state = {
    tabs: null, metric: "riding", daily: false, combine: "each", picked: null, view: "chart", sort: { key: "load", desc: true },
    stopsLine: null, stopsScope: "line", stopSort: { key: "b", desc: true },
    destKinds: null, highlightOn: false, dayShow: "both", listSort: {},
};

function usePersisted(key) {
    const [v, setV] = useState(state[key]);
    return [v, (nv) => { state[key] = nv; setV(nv); }];
}

function Panel(props) {
    const { tr, data, live } = props;
    const [tabs, setTabs] = usePersisted("tabs");        // null = every available type on
    const [metric, setMetric] = usePersisted("metric");
    const [daily, setDaily] = usePersisted("daily");
    const [combine, setCombine] = usePersisted("combine"); // each | byType | total
    const [dayShow, setDayShow] = usePersisted("dayShow"); // both | avg | peak
    const [listSort, setListSort] = usePersisted("listSort"); // { type: number | loadDesc | loadAsc | name }
    const [sortMenu, setSortMenu] = useState(null);         // type whose sort choices are open
    const [confirmDelete, setConfirmDelete] = useState(null); // { id, name, alive } waiting for "yes"
    const [picked, setPicked] = usePersisted("picked");    // null = every line on
    const [view, setView] = usePersisted("view");          // chart | table | stops
    const [stopsLine, setStopsLine] = usePersisted("stopsLine");
    const [stopsScope, setStopsScope] = usePersisted("stopsScope"); // line | all
    const [pos, setPos] = useState(savedPos);

    // The game builds the (large) stop data only while the stops view is open.
    useEffect(() => {
        api.trigger(G, "stopsView", view === "stops" || view === "transfers");
        api.trigger(G, "destView", view === "dest");
    }, [view]);
    useEffect(() => () => { api.trigger(G, "stopsView", false); api.trigger(G, "destView", false); }, []);

    // Dragging by the header.
    const drag = useRef(null);
    useEffect(() => {
        const move = (e) => {
            if (!drag.current) return;
            const p = { x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) };
            savedPos = p;
            setPos(p);
        };
        const up = () => {
            if (!drag.current) return;
            drag.current = null;
            try { window.localStorage.setItem("trafficStatistic.pos", JSON.stringify(savedPos)); } catch (e) { }
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
        return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    }, []);

    const lines = data ? data.lines : [];
    const liveOf = (id) => (live && live[id] ? live[id] : null);
    // A type tab works only when the city has a line of that type right now.
    const available = TYPE_ORDER.filter((t) => lines.some((l) => l.type === t && liveOf(l.id)));
    const tabOn = (t) => available.indexOf(t) >= 0 && (tabs === null || tabs.indexOf(t) >= 0);
    function toggleTab(t) {
        const cur = tabs === null ? available.slice() : tabs.slice();
        const i = cur.indexOf(t);
        if (i >= 0) cur.splice(i, 1); else cur.push(t);
        setTabs(cur);
    }

    const shown = lines.filter((l) => tabOn(l.type));
    const isOn = (id) => picked === null || picked.indexOf(id) >= 0;
    function toggleLine(id) {
        const cur = picked === null ? lines.map((l) => l.id) : picked.slice();
        const i = cur.indexOf(id);
        if (i >= 0) cur.splice(i, 1); else cur.push(id);
        setPicked(cur);
    }
    function pickOnly(ids) {
        // Lines of hidden tabs keep their state.
        const hiddenOn = lines.filter((l) => !tabOn(l.type) && isOn(l.id)).map((l) => l.id);
        setPicked(hiddenOn.concat(ids));
    }

    const labels = data ? (daily ? data.dayLabels : data.hourLabels) : [];
    const chosen = shown.filter((l) => isOn(l.id));

    const series = useMemo(() => {
        const len = labels.length;
        if (combine === "each") {
            return chosen.map((l) => Object.assign({ key: l.id, label: l.name, color: l.color }, seriesOf([l], metric, daily, len)));
        }
        if (combine === "byType") {
            return TYPE_ORDER
                .filter((t) => chosen.some((l) => l.type === t))
                .map((t) => Object.assign({ key: t, label: tr.type(t), color: TYPE_COLORS[t] },
                    seriesOf(chosen.filter((l) => l.type === t), metric, daily, len)));
        }
        return chosen.length ? [Object.assign({ key: "total", label: tr.t("sum"), color: C.accent }, seriesOf(chosen, metric, daily, len))] : [];
    }, [data, live, picked, tabs, metric, daily, combine, tr.ru]);
    // Daily view can leave out the peak line, or draw the peaks alone as the main line.
    const drawn = !daily || dayShow === "both" ? series
        : series.map((s) => Object.assign({}, s, { values: dayShow === "peak" ? s.peak || [] : s.values, peak: null }));

    const hasValues = drawn.some((s) => s.values.some((v) => v >= 0));
    const msg = (k) => h("div", { style: { padding: "20rem", color: C.dim, width: CW + "rem", height: "120rem" } }, tr.t(k));
    // In the stops view a click in the list picks the one line whose stops are shown.
    const stopsMode = view === "stops" || view === "transfers" || view === "dest";
    const lineView = stopsMode && stopsScope === "line";
    const stopList = props.stops ? props.stops.stops : [];
    const stopNames = useMemo(() => {
        const m = {};
        stopList.forEach((s) => { m[s.id] = stopName(s, tr); });
        return m;
    }, [props.stops, tr.ru]);
    const stopLine = lineView
        ? shown.find((l) => l.id === stopsLine && liveOf(l.id)) || shown.find((l) => liveOf(l.id)) || null
        : null;

    let body;
    if (!data || lines.length === 0) body = msg("noLines");
    else if (stopsMode && (available.length === 0 || shown.length === 0)) body = msg("noTabs");
    else if (lineView && !stopLine) body = msg("pickLine");
    else if (view === "dest") body = h(DestView, { tr, line: lineView ? stopLine : null, lines: lineView ? lines : chosen, dest: props.dest });
    else if (view === "transfers" && lineView) body = h(TransfersLine, { tr, line: stopLine, lines, transfers: props.transfers, stopNames });
    else if (view === "transfers") body = h(TransfersCity, { tr, lines: chosen, transfers: props.transfers, stops: props.stops });
    else if (lineView) body = h(StopDiagram, { tr, line: stopLine, stops: stopList, transfers: props.transfers });
    else if (stopsMode) body = h(StopsTable, { tr, lines: chosen, stops: stopList });
    else if (labels.length === 0) body = msg("noData");
    else if (available.length === 0 || shown.length === 0) body = msg("noTabs");
    else if (series.length === 0) body = msg("noneChosen");
    else if (view === "table") body = h(Table, { tr, lines: chosen, live, transfers: props.transfers });
    else if (!hasValues) body = msg("noMetric");
    else body = h(Chart, { series: drawn, labels, tr, daily, unit: metric === "load" ? "%" : "", minMax: metric === "load" ? 100 : 0 });

    let sub = tr.hint(metric);
    if (daily) {
        const a = tr.t(metric === "boarded" ? "dayTotal" : "avg"), p = tr.t(metric === "boarded" ? "busiestHour" : "peak");
        sub += " — " + (dayShow === "avg" ? a : dayShow === "peak" ? p : a + " / " + p);
    }
    else if (metric === "boarded") sub += " " + tr.t("perHour");

    // Line list of the open tabs, grouped by type, with the load right now.
    const list = [];
    // Load right now, for sorting: lines without vehicles come after, deleted lines last.
    const loadNow = (l) => {
        const lv = liveOf(l.id);
        return !lv ? -2 : lv[1] > 0 ? lv[0] / lv[1] : -1;
    };
    const SORTS = ["number", "loadDesc", "loadAsc", "name"];
    const sorters = {
        number: null, // the game's order (by line number), as the data comes
        loadDesc: (a, b) => loadNow(b) - loadNow(a),
        loadAsc: (a, b) => {
            const la = loadNow(a), lb = loadNow(b);
            return (la < 0) !== (lb < 0) ? lb - la : la - lb; // still keep "no vehicles" / deleted at the end
        },
        name: (a, b) => a.name.localeCompare(b.name),
    };
    TYPE_ORDER.filter(tabOn).forEach((t) => {
        const mode = (listSort && listSort[t]) || "number";
        list.push(h("div", {
            key: "t" + t,
            style: { display: "flex", alignItems: "center", marginTop: "8rem", marginBottom: "3rem", fontSize: "12rem", fontWeight: 700, color: TYPE_COLORS[t] },
        },
            h("div", { style: { cursor: "pointer", flexGrow: 1 }, onClick: () => pickOnly(lines.filter((l) => l.type === t).map((l) => l.id)) }, tr.type(t)),
            h("div", {
                style: { display: "flex", alignItems: "center", cursor: "pointer", padding: "1rem 4rem", borderRadius: "3rem", background: sortMenu === t ? "rgba(255,255,255,0.12)" : "transparent" },
                title: tr.t("sortTip"),
                onClick: () => setSortMenu(sortMenu === t ? null : t),
            },
                mode !== "number" ? h("div", { style: { fontSize: "10rem", color: C.dim, marginRight: "4rem", fontWeight: 500 } }, tr.t("sort_" + mode)) : null,
                h(FunnelIcon, { active: mode !== "number" }))));
        if (sortMenu === t) {
            list.push(h("div", { key: "m" + t, style: { display: "flex", flexWrap: "wrap", marginBottom: "4rem" } },
                SORTS.map((s) => h("div", {
                    key: s,
                    style: Object.assign(btnStyle(mode === s, false), { padding: "3rem 7rem", fontSize: "11rem", marginRight: "4rem", marginBottom: "4rem" }),
                    onClick: () => {
                        const next = Object.assign({}, listSort);
                        next[t] = s;
                        setListSort(next);
                        setSortMenu(null);
                    },
                }, tr.t("sort_" + s)))));
        }
        const ofType = lines.filter((l) => l.type === t);
        if (sorters[mode]) ofType.sort(sorters[mode]);
        ofType.forEach((l) => {
            const on = lineView ? !!stopLine && stopLine.id === l.id : isOn(l.id);
            const lv = liveOf(l.id);
            let badge = null;
            if (!lv) {
                badge = h("div", { style: { fontSize: "11rem", color: C.dim, marginLeft: "6rem" } }, tr.t("deleted"));
            } else if (lv[1] > 0) {
                const pct = Math.round((100 * lv[0]) / lv[1]);
                badge = h("div", { style: { fontSize: "12rem", fontWeight: 700, color: loadColor(pct), marginLeft: "6rem" } }, pct + "%");
            } else {
                badge = h("div", { style: { fontSize: "11rem", color: C.dim, marginLeft: "6rem" } }, tr.t("noVehicles"));
            }
            list.push(h("div", {
                key: l.id,
                style: { display: "flex", alignItems: "center", padding: "3rem 0", cursor: "pointer", opacity: on ? 1 : 0.45 },
                onClick: () => (lineView ? setStopsLine(l.id) : toggleLine(l.id)),
            },
                h("div", {
                    style: {
                        width: "12rem", height: "12rem", borderRadius: "2rem", marginRight: "7rem", flexShrink: 0,
                        border: "2rem solid " + l.color, background: on ? l.color : "transparent",
                    },
                }),
                h("div", { style: { fontSize: "13rem", flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: lv ? "normal" : "italic" } }, l.name),
                badge,
                lv ? h("div", {
                    style: { marginLeft: "6rem", padding: "1rem 2rem", display: "flex", cursor: "pointer" },
                    title: tr.t("open"),
                    onClick: (e) => { e.stopPropagation(); api.trigger(G, "openLine", l.id); },
                }, h(OpenIcon)) : null,
                h("div", {
                    style: { marginLeft: "2rem", padding: "1rem 2rem", display: "flex", cursor: "pointer" },
                    title: tr.t("deleteTip"),
                    onClick: (e) => { e.stopPropagation(); setConfirmDelete({ id: l.id, name: l.name, alive: !!lv }); },
                }, h(TrashIcon))));
        });
    });

    return h("div", {
        style: {
            position: "absolute", top: pos.y + "rem", left: pos.x + "rem", pointerEvents: "auto",
            background: C.panelBg, border: "1rem solid " + C.border, borderRadius: "6rem",
            color: C.text, boxShadow: "0 10rem 40rem rgba(0,0,0,0.6)",
        },
    },
        // header: drag handle + close
        h("div", {
            style: { display: "flex", alignItems: "center", padding: "10rem 14rem", borderBottom: "1rem solid " + C.border, cursor: "move" },
            onMouseDown: (e) => { e.preventDefault(); drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; },
        },
            h("div", { style: { flexGrow: 1, fontSize: "16rem", fontWeight: 700 } }, tr.t("title")),
            h("div", {
                style: { cursor: "pointer", padding: "2rem 4rem", display: "flex" },
                onMouseDown: (e) => e.stopPropagation(),
                onClick: () => api.trigger(G, "toggle", false),
            }, h(CloseIcon))),
        // transport type tabs
        h("div", { style: { display: "flex", flexWrap: "wrap", padding: "10rem 14rem 4rem 14rem", borderBottom: "1rem solid " + C.border } },
            TYPE_ORDER.filter((t) => t !== "Other" || lines.some((l) => l.type === t)).map((t) =>
                h(Toggle, {
                    key: t, label: tr.type(t), icon: h(TypeIcon, { type: t }),
                    on: tabOn(t), disabled: available.indexOf(t) < 0, onClick: () => toggleTab(t),
                }))),
        h("div", { style: { display: "flex", padding: "10rem 14rem 14rem 14rem" } },
            // left: lines
            h("div", { style: { width: "220rem", marginRight: "14rem" } },
                lineView ? null : h("div", { style: { display: "flex", flexWrap: "wrap" } },
                    h(Toggle, { label: tr.t("all"), on: shown.length > 0 && shown.every((l) => isOn(l.id)), onClick: () => pickOnly(shown.map((l) => l.id)) }),
                    h(Toggle, { label: tr.t("none"), on: shown.length > 0 && !shown.some((l) => isOn(l.id)), onClick: () => pickOnly([]) })),
                h("div", { style: { maxHeight: "330rem", overflowY: "auto" } }, list)),
            // right: switches + chart
            h("div", null,
                h("div", { style: { display: "flex", flexWrap: "wrap", marginBottom: "2rem" } },
                    h(Toggle, { label: tr.t("chart"), on: view === "chart", onClick: () => setView("chart") }),
                    h(Toggle, { label: tr.t("table"), on: view === "table", onClick: () => setView("table") }),
                    h(Toggle, { label: tr.t("stopsView"), on: view === "stops", onClick: () => setView("stops") }),
                    h(Toggle, { label: tr.t("transfersView"), on: view === "transfers", onClick: () => setView("transfers") }),
                    h(Toggle, { label: tr.t("destView"), on: view === "dest", onClick: () => setView("dest") })),
                stopsMode ? h("div", { style: { display: "flex", flexWrap: "wrap", marginBottom: "2rem" } },
                    h(Toggle, { label: tr.t("thisLine"), on: stopsScope === "line", onClick: () => setStopsScope("line") }),
                    h(Toggle, { label: tr.t(view === "stops" ? "allStops" : "wholeCity"), on: stopsScope === "all", onClick: () => setStopsScope("all") })) : null,
                view === "chart" ? h("div", { style: { display: "flex", flexWrap: "wrap", marginBottom: "2rem" } },
                    METRIC_ORDER.map((m) => h(Toggle, { key: m, label: tr.metric(m), on: metric === m, onClick: () => setMetric(m) }))) : null,
                view === "table" ? h("div", { style: { fontSize: "11rem", color: C.dim, margin: "4rem 0 8rem 0" } }, tr.t("tableHint")) : null,
                stopsMode ? h("div", { style: { fontSize: "11rem", color: C.dim, margin: "4rem 0 8rem 0", width: CW + "rem" } },
                    tr.t(view === "dest" ? (lineView ? "destLineHint" : "destCityHint")
                        : view === "transfers" ? (lineView ? "transLineHint" : "transCityHint") : (lineView ? "stopsLineHint" : "stopsAllHint"))) : null,
                view === "chart" ? h("div", { style: { display: "flex", flexWrap: "wrap", marginBottom: "4rem" } },
                    h(Toggle, { label: tr.t("hours"), on: !daily, onClick: () => setDaily(false) }),
                    h(Toggle, { label: tr.t("days"), on: daily, onClick: () => setDaily(true) }),
                    h("div", { style: { width: "16rem" } }),
                    h(Toggle, { label: tr.t("each"), on: combine === "each", onClick: () => setCombine("each") }),
                    h(Toggle, { label: tr.t("byType"), on: combine === "byType", onClick: () => setCombine("byType") }),
                    h(Toggle, { label: tr.t("total"), on: combine === "total", onClick: () => setCombine("total") })) : null,
                // daily only: which of the two lines to draw (for "boarded": the day total and the busiest hour)
                view === "chart" && daily ? h("div", { style: { display: "flex", flexWrap: "wrap", marginBottom: "4rem" } },
                    h(Toggle, { label: tr.t(metric === "boarded" ? "showTotal" : "showAvg"), on: dayShow === "avg", onClick: () => setDayShow("avg") }),
                    h(Toggle, { label: tr.t(metric === "boarded" ? "showBusiest" : "showPeak"), on: dayShow === "peak", onClick: () => setDayShow("peak") }),
                    h(Toggle, { label: tr.t("showBoth"), on: dayShow === "both", onClick: () => setDayShow("both") })) : null,
                view === "chart" ? h("div", { style: { fontSize: "11rem", color: C.dim, marginBottom: "4rem" } }, sub) : null,
                body)),
        confirmDelete ? h(ConfirmDelete, {
            tr, line: confirmDelete,
            onYes: () => { api.trigger(G, "deleteLine", confirmDelete.id); setConfirmDelete(null); },
            onNo: () => setConfirmDelete(null),
        }) : null);
}

// "Are you sure?" over the whole window before a line is deleted.
function ConfirmDelete(props) {
    const { tr, line } = props;
    const text = tr.t(line.alive ? "deleteText" : "deleteGoneText").replace("{0}", line.name);
    return h("div", {
        style: {
            position: "absolute", left: "0", top: "0", right: "0", bottom: "0", background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6rem", zIndex: 20,
        },
        onMouseDown: (e) => e.stopPropagation(),
    },
        h("div", {
            style: { width: "380rem", background: "#1b2129", border: "1rem solid " + C.border, borderRadius: "6rem", padding: "16rem", boxShadow: "0 10rem 30rem rgba(0,0,0,0.6)" },
        },
            h("div", { style: { fontSize: "16rem", fontWeight: 700, marginBottom: "10rem" } }, tr.t(line.alive ? "deleteTitle" : "deleteGoneTitle")),
            h("div", { style: { fontSize: "13rem", lineHeight: "1.4", color: C.text, marginBottom: "16rem" } }, text),
            h("div", { style: { display: "flex", justifyContent: "flex-end" } },
                h("div", { style: btnStyle(false, false), onClick: props.onNo }, tr.t("cancel")),
                h("div", {
                    style: Object.assign(btnStyle(false, false), { background: "#d64545", color: "#ffffff", fontWeight: 700, marginRight: "0" }),
                    onClick: props.onYes,
                }, tr.t("deleteYes")))));
}

function ToolbarButton() {
    const visible = api.useValue(visible$);
    const lang = api.useValue(lang$);
    const json = api.useValue(data$);
    const liveJson = api.useValue(live$);
    const tr = useMemo(() => makeT(lang), [lang]);
    const data = useMemo(() => {
        const raw = parseJson(json);
        return raw ? prepare(raw, tr) : null;
    }, [json, tr]);
    const live = useMemo(() => parseJson(liveJson), [liveJson]);
    const stopsJson = api.useValue(stops$);
    const stops = useMemo(() => parseJson(stopsJson), [stopsJson]);
    const transfersJson = api.useValue(transfers$);
    const transfers = useMemo(() => parseJson(transfersJson), [transfersJson]);
    const destJson = api.useValue(dest$);
    const dest = useMemo(() => parseJson(destJson), [destJson]);
    return h(React.Fragment, null,
        h(ui.Button, {
            variant: "floating",
            selected: visible,
            tooltipLabel: "Traffic Statistic",
            onSelect: () => api.trigger(G, "toggle", !visible),
        }, h(ChartIcon, { active: visible })),
        visible ? h(ui.Portal, null, h(Panel, { tr, data, live, stops, transfers, dest })) : null);
}

const register = (moduleRegistry) => {
    moduleRegistry.append("GameTopLeft", ToolbarButton);
};

export const hasCSS = false;
export default register;
