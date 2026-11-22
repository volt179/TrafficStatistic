using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Colossal.Mathematics;
using Colossal.UI.Binding;
using Game;
using Game.Rendering;
using Game.Routes;
using Game.SceneFlow;
using Game.UI;
using Game.UI.InGame;
using Unity.Entities;
using Unity.Mathematics;

namespace TrafficStatistic
{
    // Bindings for TrafficStatistic.mjs: window open/closed, game language, the history as JSON
    // ("data", rebuilt when a point is finished) and the latest sample per line ("live").
    public partial class StatsUISystem : UISystemBase
    {
        const string Group = "trafficStatistic";

        static readonly string[] TypeOrder = { "Bus", "Tram", "Subway", "Train", "Ship", "Ferry", "Airplane", "Helicopter" };

        LineStatsSystem m_Stats;
        ValueBinding<bool> m_Visible;
        ValueBinding<string> m_Lang;
        ValueBinding<string> m_Data;
        ValueBinding<string> m_Live;
        int m_SentVersion = -1, m_SentLive = -1;

        protected override void OnCreate()
        {
            base.OnCreate();
            m_Stats = World.GetOrCreateSystemManaged<LineStatsSystem>();
            AddBinding(m_Visible = new ValueBinding<bool>(Group, "visible", false));
            AddBinding(m_Lang = new ValueBinding<string>(Group, "lang", "en-US"));
            AddBinding(m_Data = new ValueBinding<string>(Group, "data", ""));
            AddBinding(m_Live = new ValueBinding<string>(Group, "live", ""));
            AddBinding(new TriggerBinding<bool>(Group, "toggle", OnToggle));
            AddBinding(new TriggerBinding<string>(Group, "openLine", OnOpenLine));
            AddBinding(new TriggerBinding<string>(Group, "deleteLine", OnDeleteLine));
            AddBinding(m_Stops = new ValueBinding<string>(Group, "stops", ""));
            AddBinding(m_Transfers = new ValueBinding<string>(Group, "transfers", ""));
            AddBinding(m_Dest = new ValueBinding<string>(Group, "dest", ""));
            AddBinding(new TriggerBinding<bool>(Group, "destView", open => { m_DestView = open; m_SentDest = -1; }));
            AddBinding(new TriggerBinding<string>(Group, "highlight", OnHighlight));
            AddBinding(new TriggerBinding<string>(Group, "focusBuilding", OnFocusBuilding));
            AddBinding(new TriggerBinding<bool>(Group, "stopsView", open => { m_StopsView = open; m_SentStops = -1; }));
            AddBinding(new TriggerBinding<string>(Group, "focusStop", OnFocusStop));
            m_SelectedInfo = World.GetOrCreateSystemManaged<SelectedInfoUISystem>();
            m_Camera = World.GetOrCreateSystemManaged<CameraUpdateSystem>();
        }

        SelectedInfoUISystem m_SelectedInfo;
        CameraUpdateSystem m_Camera;
        ValueBinding<string> m_Stops;
        ValueBinding<string> m_Transfers;
        bool m_StopsView;
        int m_SentStops = -1, m_SentTransfers = -1;

        ValueBinding<string> m_Dest;
        bool m_DestView;
        int m_SentDest = -1;
        // Buildings this mod lit up with the game's own highlight.
        readonly HashSet<Entity> m_Lit = new HashSet<Entity>();

        // ids = destination keys separated by ','; empty turns the highlight off.
        void OnHighlight(string ids)
        {
            var want = new HashSet<Entity>();
            StatsStore store = m_Stats.Store;
            if (store != null && !string.IsNullOrEmpty(ids))
            {
                foreach (string id in ids.Split(','))
                {
                    DestRecord d;
                    if (store.Destinations.TryGetValue(id, out d) && d.Building != Entity.Null && EntityManager.Exists(d.Building)) want.Add(d.Building);
                }
            }
            foreach (Entity e in m_Lit)
            {
                if (want.Contains(e) || !EntityManager.Exists(e)) continue;
                if (EntityManager.HasComponent<Game.Tools.Highlighted>(e)) EntityManager.RemoveComponent<Game.Tools.Highlighted>(e);
                EntityManager.AddComponent<Game.Common.BatchesUpdated>(e);
            }
            foreach (Entity e in want)
            {
                if (m_Lit.Contains(e) && EntityManager.HasComponent<Game.Tools.Highlighted>(e)) continue;
                EntityManager.AddComponent<Game.Tools.Highlighted>(e);
                EntityManager.AddComponent<Game.Common.BatchesUpdated>(e);
            }
            m_Lit.Clear();
            foreach (Entity e in want) m_Lit.Add(e);
        }

        protected override void OnGamePreload(Colossal.Serialization.Entities.Purpose purpose, GameMode mode)
        {
            base.OnGamePreload(purpose, mode);
            m_Lit.Clear(); // entities of the old world
        }

        void OnFocusBuilding(string id)
        {
            StatsStore store = m_Stats.Store;
            DestRecord d;
            if (store == null || !store.Destinations.TryGetValue(id, out d)) return;
            if (d.Building != Entity.Null && EntityManager.Exists(d.Building)) m_SelectedInfo.SetSelection(d.Building);
            CameraController cam = m_Camera.gamePlayController;
            if (cam == null || !ReferenceEquals(m_Camera.activeCameraController, cam)) return;
            cam.pivot = new UnityEngine.Vector3(d.X, d.Y, d.Z);
            Bounds1 range = cam.zoomRange;
            cam.zoom = math.clamp(300f, range.min, range.max);
        }

        // Why people ride each line, and the buildings they went to (busiest first), last 24 hours.
        static string BuildDest(StatsStore store)
        {
            var sb = new StringBuilder("{\"purposes\":[");
            bool first = true;
            foreach (var p in store.Purposes.Values)
            {
                double n = p.Count.Last24();
                if (n <= 0) continue;
                if (!first) sb.Append(',');
                first = false;
                sb.Append("{\"line\":").Append(Str(p.Line)).Append(",\"p\":").Append(Str(p.Purpose)).Append(",\"n\":").Append(F((float)n)).Append('}');
            }
            sb.Append("],\"dest\":[");
            var list = new List<KeyValuePair<DestRecord, double>>();
            foreach (var d in store.Destinations.Values)
            {
                double n = d.Last24();
                if (n > 0) list.Add(new KeyValuePair<DestRecord, double>(d, n));
            }
            list.Sort((a, b) => b.Value.CompareTo(a.Value));
            for (int i = 0; i < list.Count && i < 500; i++)
            {
                DestRecord d = list[i].Key;
                if (i > 0) sb.Append(',');
                sb.Append("{\"id\":").Append(Str(d.Key)).Append(",\"name\":").Append(Str(d.Name)).Append(",\"kind\":").Append(Str(d.Kind ?? "other"))
                  .Append(",\"n\":").Append(F((float)list[i].Value)).Append(",\"lines\":{");
                bool f2 = true;
                foreach (var kv in d.ByLine)
                {
                    double n = kv.Value.Last24();
                    if (n <= 0) continue;
                    if (!f2) sb.Append(',');
                    f2 = false;
                    sb.Append(Str(kv.Key)).Append(':').Append(F((float)n));
                }
                sb.Append("}}");
            }
            return sb.Append("]}").ToString();
        }

        // Transfers between lines and whole trips with transfers, last 24 hours.
        static string BuildTransfers(StatsStore store)
        {
            var sb = new StringBuilder("{\"transfers\":[");
            bool first = true;
            foreach (var t in store.Transfers.Values)
            {
                double n = t.Count.Last24();
                if (n <= 0) continue;
                if (!first) sb.Append(',');
                first = false;
                sb.Append("{\"from\":").Append(Str(t.FromLine)).Append(",\"to\":").Append(Str(t.ToLine))
                  .Append(",\"fromStop\":").Append(Str(t.FromStop)).Append(",\"toStop\":").Append(Str(t.ToStop))
                  .Append(",\"n\":").Append(F((float)n)).Append('}');
            }
            sb.Append("],\"chains\":[");
            first = true;
            foreach (var c in store.Chains.Values)
            {
                double n = c.Count.Last24();
                if (n <= 0) continue;
                if (!first) sb.Append(',');
                first = false;
                sb.Append("{\"lines\":[");
                string[] parts = c.Key.Split('>');
                for (int i = 0; i < parts.Length; i++) sb.Append(i > 0 ? "," : "").Append(Str(parts[i]));
                sb.Append("],\"n\":").Append(F((float)n)).Append('}');
            }
            return sb.Append("]}").ToString();
        }

        // Moves the camera over one stop and selects it.
        void OnFocusStop(string key)
        {
            StatsStore store = m_Stats.Store;
            StopRecord s;
            if (store == null || !store.Stops.TryGetValue(key, out s)) return;
            if (s.Alive && EntityManager.Exists(s.Stop)) m_SelectedInfo.SetSelection(s.Stop);
            CameraController cam = m_Camera.gamePlayController;
            if (cam == null || !ReferenceEquals(m_Camera.activeCameraController, cam)) return;
            cam.pivot = new UnityEngine.Vector3(s.X, s.Y, s.Z);
            Bounds1 range = cam.zoomRange;
            cam.zoom = math.clamp(250f, range.min, range.max);
        }

        // Every stop of every line with its last 24 hours (finished hours + the running one).
        static string BuildStops(StatsStore store)
        {
            var sb = new StringBuilder("{\"stops\":[");
            bool first = true;
            foreach (var s in store.Stops.Values)
            {
                double b = s.HourAcc.Boarded, a = s.HourAcc.Alighted, segR = s.HourAcc.SegRiding, segS = s.HourAcc.SegSeats;
                double w = 0;
                int wn = 0;
                foreach (var v in s.Hours.Values)
                {
                    if (v.Boarded > 0) b += v.Boarded;
                    if (v.Alighted > 0) a += v.Alighted;
                    if (v.SegSeats > 0) { segR += v.SegRiding; segS += v.SegSeats; }
                    if (v.Waiting >= 0) { w += v.Waiting; wn++; }
                }
                if (s.HourAcc.WaitSamples > 0) { w += s.HourAcc.Waiting / s.HourAcc.WaitSamples; wn++; }
                if (!first) sb.Append(',');
                first = false;
                sb.Append("{\"id\":").Append(Str(s.Key))
                  .Append(",\"line\":").Append(Str(s.LineKey))
                  .Append(",\"idx\":").Append(N(s.Index))
                  .Append(",\"place\":").Append(Str(s.Place))
                  .Append(",\"name\":").Append(Str(s.Name))
                  .Append(",\"alive\":").Append(s.Alive ? "true" : "false")
                  .Append(",\"wait\":").Append(N(s.LiveWaiting))
                  .Append(",\"b\":").Append(F((float)b))
                  .Append(",\"a\":").Append(F((float)a))
                  .Append(",\"w\":").Append(wn > 0 ? F((float)(w / wn)) : "-1")
                  .Append(",\"l\":").Append(segS > 0 ? F((float)(100 * segR / segS)) : "-1")
                  .Append('}');
            }
            return sb.Append("]}").ToString();
        }

        // Opens the game's own panel of the line and moves the camera over its stops.
        // The game's own "delete line" of the Transportation Overview (private there: it marks the line
        // Deleted through the end-of-frame barrier, and the game removes stops, segments and vehicles).
        static readonly System.Reflection.MethodInfo s_DeleteLine = typeof(TransportationOverviewUISystem).GetMethod(
            "DeleteLine", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public);

        // Deletes the line from the city (if it still exists) and forgets its statistics.
        void OnDeleteLine(string key)
        {
            StatsStore store = m_Stats.Store;
            LineRecord rec;
            if (store == null || !store.Lines.TryGetValue(key, out rec)) return;
            if (rec.Alive && EntityManager.Exists(rec.Entity))
            {
                Entity line = rec.Entity;
                if (s_DeleteLine != null)
                    s_DeleteLine.Invoke(World.GetOrCreateSystemManaged<TransportationOverviewUISystem>(), new object[] { line });
                else
                    World.GetOrCreateSystemManaged<Game.EndFrameBarrier>().CreateCommandBuffer().AddComponent(line, default(Game.Common.Deleted));
                if (m_SelectedInfo.selectedEntity == line) m_SelectedInfo.SetSelection(Entity.Null);
                Mod.Log.Info("Deleted line " + key + (s_DeleteLine != null ? "" : " (fallback)"));
            }
            m_Stats.ForgetLine(key);
        }

        void OnOpenLine(string key)
        {
            StatsStore store = m_Stats.Store;
            LineRecord rec;
            if (store == null || !store.Lines.TryGetValue(key, out rec) || !rec.Alive) return;
            Entity line = rec.Entity;
            if (!EntityManager.Exists(line)) return;
            m_SelectedInfo.SetSelection(line);

            if (!EntityManager.HasBuffer<RouteWaypoint>(line)) return;
            DynamicBuffer<RouteWaypoint> waypoints = EntityManager.GetBuffer<RouteWaypoint>(line, true);
            float3 min = new float3(float.MaxValue), max = new float3(float.MinValue);
            int n = 0;
            for (int i = 0; i < waypoints.Length; i++)
            {
                Entity wp = waypoints[i].m_Waypoint;
                if (!EntityManager.HasComponent<Position>(wp)) continue;
                float3 p = EntityManager.GetComponentData<Position>(wp).m_Position;
                min = math.min(min, p);
                max = math.max(max, p);
                n++;
            }
            CameraController cam = m_Camera.gamePlayController;
            if (n == 0 || cam == null || !ReferenceEquals(m_Camera.activeCameraController, cam)) return;
            float3 center = (min + max) * 0.5f;
            float size = math.max(max.x - min.x, max.z - min.z);
            cam.pivot = new UnityEngine.Vector3(center.x, center.y, center.z);
            Bounds1 range = cam.zoomRange;
            cam.zoom = math.clamp(size * 1.1f + 200f, range.min, range.max);
        }

        void OnToggle(bool open)
        {
            m_Visible.Update(open);
            if (open) m_SentVersion = m_SentLive = m_SentTransfers = m_SentStops = -1;
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();
            var loc = GameManager.instance.localizationManager;
            if (loc != null && loc.activeLocaleId != null) m_Lang.Update(loc.activeLocaleId);

            if (!m_Visible.value) return;
            StatsStore store = m_Stats.Store;
            if (store == null)
            {
                m_Data.Update("");
                m_Live.Update("");
                return;
            }
            if (m_Stats.Version != m_SentVersion)
            {
                m_SentVersion = m_Stats.Version;
                m_Data.Update(BuildData(store));
            }
            if (m_Stats.LiveVersion != m_SentLive)
            {
                m_SentLive = m_Stats.LiveVersion;
                m_Live.Update(BuildLive(store));
            }
            if (m_Stats.LiveVersion != m_SentTransfers)
            {
                m_SentTransfers = m_Stats.LiveVersion;
                m_Transfers.Update(BuildTransfers(store));
            }
            if (m_DestView && m_Stats.LiveVersion != m_SentDest)
            {
                m_SentDest = m_Stats.LiveVersion;
                m_Dest.Update(BuildDest(store));
            }
            // Stops are many: only built while the window shows them.
            if (m_StopsView && m_Stats.LiveVersion != m_SentStops)
            {
                m_SentStops = m_Stats.LiveVersion;
                m_Stops.Update(BuildStops(store));
            }
        }

        static List<LineRecord> Sorted(StatsStore store)
        {
            var lines = new List<LineRecord>(store.Lines.Values);
            lines.Sort((a, b) =>
            {
                int ta = Order(a.Type), tb = Order(b.Type);
                return ta != tb ? ta.CompareTo(tb) : a.Number.CompareTo(b.Number);
            });
            return lines;
        }

        static string BuildData(StatsStore store)
        {
            var lines = Sorted(store);
            long h0 = long.MaxValue, h1 = long.MinValue, d0 = long.MaxValue, d1 = long.MinValue;
            foreach (var l in lines)
            {
                foreach (long h in l.Hours.Keys) { if (h < h0) h0 = h; if (h > h1) h1 = h; }
                foreach (long d in l.Days.Keys) { if (d < d0) d0 = d; if (d > d1) d1 = d; }
            }
            int hourCount = h1 >= h0 ? (int)(h1 - h0 + 1) : 0;
            int dayCount = d1 >= d0 ? (int)(d1 - d0 + 1) : 0;

            var sb = new StringBuilder();
            sb.Append("{\"firstDay\":").Append(N(store.FirstDay));
            sb.Append(",\"hourStart\":").Append(N(hourCount > 0 ? h0 : 0));
            sb.Append(",\"hourCount\":").Append(N(hourCount));
            sb.Append(",\"dayStart\":").Append(N(dayCount > 0 ? d0 : 0));
            sb.Append(",\"dayCount\":").Append(N(dayCount));
            sb.Append(",\"lines\":[");
            for (int li = 0; li < lines.Count; li++)
            {
                var l = lines[li];
                if (li > 0) sb.Append(',');
                sb.Append("{\"id\":").Append(Str(l.Key))
                  .Append(",\"type\":").Append(Str(l.Type))
                  .Append(",\"num\":").Append(N(l.Number))
                  .Append(",\"name\":").Append(Str(l.Name))
                  .Append(",\"color\":").Append(Str(l.Color));
                // Hours: riding, capacity, waiting, vehicles, boarded.
                Hours(sb, "hr", l, h0, hourCount, v => v.Riding);
                Hours(sb, "hc", l, h0, hourCount, v => v.Capacity);
                Hours(sb, "hw", l, h0, hourCount, v => v.Waiting);
                Hours(sb, "hv", l, h0, hourCount, v => v.Vehicles);
                Hours(sb, "hb", l, h0, hourCount, v => v.Boarded);
                // Days: average (or total for boarded) and peak of each.
                Days(sb, "dr", l, d0, dayCount, v => v.Riding);
                Days(sb, "drp", l, d0, dayCount, v => v.RidingPeak);
                Days(sb, "dc", l, d0, dayCount, v => v.Capacity);
                Days(sb, "dlp", l, d0, dayCount, v => v.LoadPeak);
                Days(sb, "dw", l, d0, dayCount, v => v.Waiting);
                Days(sb, "dwp", l, d0, dayCount, v => v.WaitingPeak);
                Days(sb, "dv", l, d0, dayCount, v => v.Vehicles);
                Days(sb, "dvp", l, d0, dayCount, v => v.VehiclesPeak);
                Days(sb, "db", l, d0, dayCount, v => v.Boarded);
                Days(sb, "dbp", l, d0, dayCount, v => v.BoardedPeak);
                sb.Append('}');
            }
            sb.Append("]}");
            return sb.ToString();
        }

        static void Hours(StringBuilder sb, string name, LineRecord l, long h0, int count, Func<HourValue, float> get)
        {
            sb.Append(",\"").Append(name).Append("\":[");
            for (int i = 0; i < count; i++)
            {
                if (i > 0) sb.Append(',');
                HourValue v;
                sb.Append(l.Hours.TryGetValue(h0 + i, out v) ? F(get(v)) : "-1");
            }
            sb.Append(']');
        }

        static void Days(StringBuilder sb, string name, LineRecord l, long d0, int count, Func<DayValue, float> get)
        {
            sb.Append(",\"").Append(name).Append("\":[");
            for (int i = 0; i < count; i++)
            {
                if (i > 0) sb.Append(',');
                DayValue v;
                sb.Append(l.Days.TryGetValue(d0 + i, out v) ? F(get(v)) : "-1");
            }
            sb.Append(']');
        }

        // {"Bus#3":[riding, capacity, waiting, vehicles], ...} for lines that exist now.
        static string BuildLive(StatsStore store)
        {
            var sb = new StringBuilder("{");
            bool first = true;
            foreach (var l in store.Lines.Values)
            {
                if (!l.Alive) continue;
                if (!first) sb.Append(',');
                first = false;
                sb.Append(Str(l.Key)).Append(":[").Append(N(l.LiveRiding)).Append(',').Append(N(l.LiveCapacity))
                  .Append(',').Append(N(l.LiveWaiting)).Append(',').Append(N(l.LiveVehicles)).Append(']');
            }
            return sb.Append('}').ToString();
        }

        static int Order(string type)
        {
            int i = Array.IndexOf(TypeOrder, type);
            return i < 0 ? TypeOrder.Length : i;
        }

        static string F(float f)
        {
            return f < 0 ? "-1" : f.ToString("0.#", CultureInfo.InvariantCulture);
        }

        static string N(long n)
        {
            return n.ToString(CultureInfo.InvariantCulture);
        }

        static string Str(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in s ?? "")
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }
    }
}
