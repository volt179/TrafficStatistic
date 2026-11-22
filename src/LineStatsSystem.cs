using System;
using System.Collections.Generic;
using Colossal.Serialization.Entities;
using Game;
using Game.City;
using Game.Common;
using Game.Prefabs;
using Game.Routes;
using Game.Simulation;
using Game.Tools;
using Game.UI;
using Game.Vehicles;
using Unity.Collections;
using Unity.Entities;

namespace TrafficStatistic
{
    // Every few simulation frames takes a sample of each line (riding, seats, waiting, vehicles,
    // newly boarded), sums the samples per in-game hour and per day, and keeps them in a StatsStore.
    public partial class LineStatsSystem : GameSystemBase
    {
        // 262144 frames per in-game day: ~10900 per hour, so ~21 samples per hour.
        const int Interval = 512;

        TimeSystem m_TimeSystem;
        CityConfigurationSystem m_CityConfig;
        NameSystem m_NameSystem;
        EntityQuery m_LineQuery;

        StatsStore m_Store;
        string m_File;
        long m_CurHour = -1;
        bool m_NeedLoad;

        // Passengers seen in each vehicle (car) at the last sample, to count who got in since.
        Dictionary<Entity, HashSet<Entity>> m_Riders = new Dictionary<Entity, HashSet<Entity>>();
        Dictionary<Entity, HashSet<Entity>> m_RidersNext = new Dictionary<Entity, HashSet<Entity>>();
        bool m_FirstSample;
        bool m_LoggedWaiting;

        // Version: finished points or the list of lines changed. LiveVersion: a new sample was taken.
        public int Version { get; private set; }
        public int LiveVersion { get; private set; }
        public StatsStore Store { get { return m_Store; } }

        public override int GetUpdateInterval(SystemUpdatePhase phase)
        {
            return Interval;
        }

        protected override void OnCreate()
        {
            base.OnCreate();
            m_TimeSystem = World.GetOrCreateSystemManaged<TimeSystem>();
            m_CityConfig = World.GetOrCreateSystemManaged<CityConfigurationSystem>();
            m_NameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            m_Simulation = World.GetOrCreateSystemManaged<SimulationSystem>();
            m_LineQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<TransportLine>(), ComponentType.ReadOnly<Route>(), ComponentType.ReadOnly<PrefabRef>(), ComponentType.ReadOnly<RouteVehicle>() },
                None = new[] { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Temp>() },
            });
        }

        protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode)
        {
            base.OnGameLoadingComplete(purpose, mode);
            m_Store = null;
            m_CurHour = -1;
            m_Riders.Clear();
            m_Trips.Clear();
            m_Deleting.Clear();
            m_LastStop.Clear();
            m_NeedLoad = mode == GameMode.Game;
        }

        protected override void OnUpdate()
        {
            if (m_NeedLoad)
            {
                m_NeedLoad = false;
                LoadForCity();
            }
            if (m_Store == null) return;

            long hour = CurrentHour();
            if (m_CurHour < 0) m_CurHour = hour;
            if (hour != m_CurHour)
            {
                if (hour < m_CurHour)
                {
                    // Time went back (should not happen without a load); start over from here.
                    m_Store.DropFrom(hour);
                    foreach (var l in m_Store.Lines.Values)
                    {
                        l.HourAcc.Clear();
                        l.DayAcc.Clear();
                    }
                    foreach (var s in m_Store.Stops.Values)
                    {
                        s.HourAcc.Clear();
                        s.DayAcc.Clear();
                    }
                }
                else
                {
                    FinishHour(m_CurHour, hour / 24 != m_CurHour / 24);
                }
                m_CurHour = hour;
                m_Store.TrimHours(hour - 1);
                Save();
                Version++;
            }
            Sample();
            LiveVersion++;
        }

        // The game's date has only daysPerYear (12) days a year and then jumps to January 1st of the next
        // year, so its ticks have holes; count days as year * daysPerYear + day of the year instead.
        // Lines deleted from the window: skipped until the game has removed them.
        readonly HashSet<Entity> m_Deleting = new HashSet<Entity>();

        // Removes everything recorded about a line: its history, stops, transfers, trips, purposes, destinations.
        public void ForgetLine(string key)
        {
            if (m_Store == null) return;
            LineRecord rec;
            if (m_Store.Lines.TryGetValue(key, out rec) && rec.Alive) m_Deleting.Add(rec.Entity);
            m_Store.Lines.Remove(key);
            RemoveWhere(m_Store.Stops, s => s.LineKey == key);
            RemoveWhere(m_Store.Transfers, t => t.FromLine == key || t.ToLine == key);
            RemoveWhere(m_Store.Chains, c => Array.IndexOf(c.Key.Split('>'), key) >= 0);
            RemoveWhere(m_Store.Purposes, p => p.Line == key);
            foreach (var d in m_Store.Destinations.Values) d.ByLine.Remove(key);
            RemoveWhere(m_Store.Destinations, d => d.ByLine.Count == 0);
            var trips = new List<Entity>();
            foreach (var kv in m_Trips) if (kv.Value.Lines.Contains(key)) trips.Add(kv.Key);
            foreach (Entity e in trips) m_Trips.Remove(e);
            Save();
            Version++;
            LiveVersion++;
            Mod.Log.Info("Forgot statistics of line " + key);
        }

        static void RemoveWhere<T>(Dictionary<string, T> map, Func<T, bool> drop)
        {
            var keys = new List<string>();
            foreach (var kv in map) if (drop(kv.Value)) keys.Add(kv.Key);
            foreach (string k in keys) map.Remove(k);
        }

        long CurrentHour()
        {
            return StatsStore.HourOf(m_TimeSystem.GetCurrentDateTime(), m_TimeSystem.daysPerYear);
        }

        void LoadForCity()
        {
            m_File = StatsStore.FileFor(m_CityConfig.cityName);
            try
            {
                m_Store = StatsStore.Load(m_File, m_TimeSystem.daysPerYear);
            }
            catch (Exception e)
            {
                Mod.Log.Error("Could not read " + m_File + ": " + e);
                m_Store = new StatsStore();
            }
            long hour = CurrentHour();
            m_Store.DropFrom(hour);
            if (m_Store.FirstDay < 0) m_Store.FirstDay = hour / 24;
            m_CurHour = hour;
            m_FirstSample = true;
            Version++;
            Mod.Log.Info("City '" + m_CityConfig.cityName + "': " + m_Store.Lines.Count + " lines of history from " + m_File);
        }

        void Save()
        {
            try
            {
                m_Store.Save(m_File);
            }
            catch (Exception e)
            {
                Mod.Log.Error("Could not write " + m_File + ": " + e);
            }
        }

        void FinishHour(long hour, bool dayEnded)
        {
            foreach (var l in m_Store.Lines.Values)
            {
                if (l.HourAcc.Samples > 0)
                {
                    l.Hours[hour] = l.HourAcc.Hour();
                    l.DayAcc.BoardedPeak = Math.Max(l.DayAcc.BoardedPeak, (float)l.HourAcc.Boarded);
                }
                l.HourAcc.Clear();
                if (dayEnded)
                {
                    if (l.DayAcc.Samples > 0) l.Days[hour / 24] = l.DayAcc.Day();
                    l.DayAcc.Clear();
                }
            }
            foreach (var s in m_Store.Stops.Values)
            {
                if (!s.HourAcc.Empty) s.Hours[hour] = s.HourAcc.Value();
                s.HourAcc.Clear();
                if (dayEnded)
                {
                    if (!s.DayAcc.Empty) s.Days[hour / 24] = s.DayAcc.Value();
                    s.DayAcc.Clear();
                }
                // Street names can change; pick them up once an hour.
                if (s.Alive && s.Stop != Entity.Null && EntityManager.Exists(s.Stop)) s.Name = EntityName(s.Stop);
            }
            EndTrips();
            foreach (var t in m_Store.Transfers.Values) t.Count.FinishHour(hour, dayEnded);
            foreach (var c in m_Store.Chains.Values) c.Count.FinishHour(hour, dayEnded);
        }

        void Sample()
        {
            var em = EntityManager;
            foreach (var l in m_Store.Lines.Values) l.Alive = false;
            foreach (var s in m_Store.Stops.Values) s.Alive = false;
            m_RidersNext.Clear();
            m_SeenVehicles.Clear();

            NativeArray<Entity> lines = m_LineQuery.ToEntityArray(Allocator.Temp);
            try
            {
                foreach (Entity line in lines)
                {
                    if (m_Deleting.Contains(line)) continue; // deleted from the window; gone by the next frame
                    Entity prefab = em.GetComponentData<PrefabRef>(line).m_Prefab;
                    if (!em.HasComponent<TransportLineData>(prefab)) continue;
                    TransportLineData data = em.GetComponentData<TransportLineData>(prefab);
                    if (!data.m_PassengerTransport) continue;

                    int number = em.HasComponent<RouteNumber>(line) ? em.GetComponentData<RouteNumber>(line).m_Number : 0;
                    string type = data.m_TransportType.ToString();
                    string key = type + "#" + number;

                    LineRecord rec;
                    if (!m_Store.Lines.TryGetValue(key, out rec))
                    {
                        rec = new LineRecord { Key = key, Type = type, Number = number };
                        m_Store.Lines[key] = rec;
                        Version++;
                    }
                    string name;
                    if (!m_NameSystem.TryGetCustomName(line, out name)) name = "";
                    string color = em.HasComponent<Color>(line) ? Hex(em.GetComponentData<Color>(line).m_Color) : "#cccccc";
                    if (rec.Name != name || rec.Color != color)
                    {
                        rec.Name = name;
                        rec.Color = color;
                        Version++;
                    }

                    StopRecord[] stops = SampleStops(em, line, rec);
                    int waiting = 0;
                    foreach (StopRecord s in stops) if (s != null) waiting += s.LiveWaiting;

                    DynamicBuffer<RouteVehicle> vehicles = em.GetBuffer<RouteVehicle>(line, true);
                    int riding = 0, capacity = 0, boarded = 0;
                    for (int i = 0; i < vehicles.Length; i++)
                    {
                        Entity v = vehicles[i].m_Vehicle;
                        m_SeenVehicles.Add(v);
                        var c = new VehicleCount();
                        m_TmpIn.Clear();
                        m_TmpOut.Clear();
                        CountVehicle(em, v, ref c);
                        if (m_FirstSample)
                        {
                            // Everyone looks "new" right after a load.
                            c.Boarded = c.Alighted = 0;
                            m_TmpIn.Clear();
                            m_TmpOut.Clear();
                        }
                        riding += c.Riding;
                        capacity += c.Capacity;
                        boarded += c.Boarded;
                        int at = AttributeToStop(em, v, stops, c);
                        TrackTrips(key, at >= 0 ? stops[at].Key : null);
                    }

                    rec.Alive = true;
                    rec.Entity = line;
                    rec.LiveRiding = riding;
                    rec.LiveCapacity = capacity;
                    rec.LiveWaiting = waiting;
                    rec.LiveVehicles = vehicles.Length;
                    rec.HourAcc.Add(riding, capacity, waiting, vehicles.Length, boarded);
                    rec.DayAcc.Add(riding, capacity, waiting, vehicles.Length, boarded);
                }
            }
            finally
            {
                lines.Dispose();
            }

            var t = m_Riders;
            m_Riders = m_RidersNext;
            m_RidersNext = t;
            m_FirstSample = false;
            m_LastStopGone.Clear();
            foreach (Entity v in m_LastStop.Keys) if (!m_SeenVehicles.Contains(v)) m_LastStopGone.Add(v);
            foreach (Entity gone in m_LastStopGone) m_LastStop.Remove(gone);
        }

        readonly HashSet<Entity> m_SeenVehicles = new HashSet<Entity>();

        struct VehicleCount
        {
            public int Riding, Capacity, Boarded, Alighted;
        }

        // Trains, trams and metro carry their passengers and seats in each car of the layout.
        void CountVehicle(EntityManager em, Entity vehicle, ref VehicleCount c)
        {
            if (em.HasBuffer<LayoutElement>(vehicle))
            {
                DynamicBuffer<LayoutElement> layout = em.GetBuffer<LayoutElement>(vehicle, true);
                if (layout.Length > 0)
                {
                    for (int j = 0; j < layout.Length; j++) CountCar(em, layout[j].m_Vehicle, ref c);
                    return;
                }
            }
            CountCar(em, vehicle, ref c);
        }

        void CountCar(EntityManager em, Entity car, ref VehicleCount c)
        {
            if (em.HasComponent<PrefabRef>(car))
            {
                Entity prefab = em.GetComponentData<PrefabRef>(car).m_Prefab;
                if (em.HasComponent<PublicTransportVehicleData>(prefab))
                    c.Capacity += em.GetComponentData<PublicTransportVehicleData>(prefab).m_PassengerCapacity;
            }
            if (!em.HasBuffer<Passenger>(car)) return;
            DynamicBuffer<Passenger> passengers = em.GetBuffer<Passenger>(car, true);
            c.Riding += passengers.Length;

            HashSet<Entity> before;
            m_Riders.TryGetValue(car, out before);
            var now = new HashSet<Entity>();
            int stayed = 0;
            for (int k = 0; k < passengers.Length; k++)
            {
                Entity p = passengers[k].m_Passenger;
                now.Add(p);
                if (before != null && before.Contains(p)) stayed++;
                else
                {
                    c.Boarded++;
                    m_TmpIn.Add(p);
                }
            }
            if (before != null)
            {
                c.Alighted += before.Count - stayed;
                foreach (Entity p in before) if (!now.Contains(p)) m_TmpOut.Add(p);
            }
            m_RidersNext[car] = now;
        }

        // ---------------------------------------------------------------- stops

        // Stop of the route each vehicle was last seen boarding at (index into the line's waypoints).
        readonly Dictionary<Entity, int> m_LastStop = new Dictionary<Entity, int>();
        readonly List<Entity> m_LastStopGone = new List<Entity>();
        readonly Dictionary<Entity, int> m_WaypointIndex = new Dictionary<Entity, int>();
        bool m_LoggedTargets;

        // Records of the line's stops in route order (null where a waypoint is not a stop),
        // with the people waiting there sampled.
        StopRecord[] SampleStops(EntityManager em, Entity line, LineRecord lineRec)
        {
            m_WaypointIndex.Clear();
            if (!em.HasBuffer<RouteWaypoint>(line)) return new StopRecord[0];
            DynamicBuffer<RouteWaypoint> waypoints = em.GetBuffer<RouteWaypoint>(line, true);
            var result = new StopRecord[waypoints.Length];
            for (int i = 0; i < waypoints.Length; i++)
            {
                Entity wp = waypoints[i].m_Waypoint;
                m_WaypointIndex[wp] = i;
                if (!em.HasComponent<Connected>(wp)) continue;
                Entity stop = em.GetComponentData<Connected>(wp).m_Connected;

                string key = lineRec.Key + "|" + i;
                StopRecord s;
                if (!m_Store.Stops.TryGetValue(key, out s))
                {
                    s = new StopRecord { Key = key, LineKey = lineRec.Key, Index = i };
                    m_Store.Stops[key] = s;
                    Version++;
                }
                if (s.Stop != stop || string.IsNullOrEmpty(s.Name))
                {
                    // New stop entity at this place on the route (or first sight): refresh where and what it is.
                    s.Stop = stop;
                    Unity.Mathematics.float3 pos = em.HasComponent<Game.Objects.Transform>(stop)
                        ? em.GetComponentData<Game.Objects.Transform>(stop).m_Position
                        : em.HasComponent<Position>(wp) ? em.GetComponentData<Position>(wp).m_Position : default(Unity.Mathematics.float3);
                    s.X = pos.x;
                    s.Y = pos.y;
                    s.Z = pos.z;
                    s.Place = StopRecord.PlaceOf(pos.x, pos.z);
                    s.Name = EntityName(stop);
                    Version++;
                }
                s.Waypoint = wp;
                s.Alive = true;

                int waiting = 0;
                if (em.HasComponent<WaitingPassengers>(wp)) waiting = em.GetComponentData<WaitingPassengers>(wp).m_Count;
                else if (em.HasComponent<WaitingPassengers>(stop))
                {
                    waiting = em.GetComponentData<WaitingPassengers>(stop).m_Count;
                    if (!m_LoggedWaiting)
                    {
                        m_LoggedWaiting = true;
                        Mod.Log.Info("Waiting passengers are found on stops, not on waypoints");
                    }
                }
                s.LiveWaiting = waiting;
                s.HourAcc.Waiting += waiting;
                s.HourAcc.WaitSamples++;
                s.DayAcc.Waiting += waiting;
                s.DayAcc.WaitSamples++;
                result[i] = s;
            }
            return result;
        }

        // Who got in or out goes to the stop the vehicle stands at (or last stood at);
        // a moving vehicle adds its load to the stretch after the stop it left.
        int AttributeToStop(EntityManager em, Entity vehicle, StopRecord[] stops, VehicleCount c)
        {
            int n = stops.Length;
            if (n == 0) return -1;
            int target = -1;
            if (em.HasComponent<Target>(vehicle)) m_WaypointIndex.TryGetValue(em.GetComponentData<Target>(vehicle).m_Target, out target);
            bool boarding = em.HasComponent<Game.Vehicles.PublicTransport>(vehicle)
                && (em.GetComponentData<Game.Vehicles.PublicTransport>(vehicle).m_State & PublicTransportFlags.Boarding) != 0;

            int at = -1;
            if (boarding)
            {
                at = NearestStop(em, vehicle, stops);
                if (at >= 0) m_LastStop[vehicle] = at;
            }
            else
            {
                // Driving towards <target>: it last stood at the stop before that.
                int last;
                if (target >= 0) at = StopBefore(stops, target);
                else if (m_LastStop.TryGetValue(vehicle, out last) && last < n) at = last;
            }
            if (!m_LoggedTargets && target < 0 && em.HasComponent<Target>(vehicle))
            {
                m_LoggedTargets = true;
                Mod.Log.Info("A line vehicle's target is not one of its route's waypoints");
            }
            if (at < 0) return -1;

            StopRecord s = stops[at];
            s.HourAcc.Boarded += c.Boarded;
            s.HourAcc.Alighted += c.Alighted;
            s.DayAcc.Boarded += c.Boarded;
            s.DayAcc.Alighted += c.Alighted;
            if (!boarding && c.Capacity > 0)
            {
                s.HourAcc.SegRiding += c.Riding;
                s.HourAcc.SegSeats += c.Capacity;
                s.DayAcc.SegRiding += c.Riding;
                s.DayAcc.SegSeats += c.Capacity;
            }
            return at;
        }

        // ---------------------------------------------------------------- transfers

        // One in-game hour of frames: who gets on another line within it after getting out has transferred.
        const long TransferFrames = 262144 / 24;

        readonly List<Entity> m_TmpIn = new List<Entity>();
        readonly List<Entity> m_TmpOut = new List<Entity>();
        readonly Dictionary<Entity, Trip> m_Trips = new Dictionary<Entity, Trip>();
        SimulationSystem m_Simulation;

        // m_TmpIn / m_TmpOut hold who got in / out of one vehicle of <line> at <stop> since the last sample.
        void TrackTrips(string line, string stop)
        {
            long frame = m_Simulation.frameIndex;
            foreach (Entity p in m_TmpOut)
            {
                Trip trip;
                if (!m_Trips.TryGetValue(p, out trip))
                {
                    trip = new Trip();
                    trip.Lines.Add(line);
                    m_Trips[p] = trip;
                }
                trip.LastLine = line;
                trip.LastStop = stop;
                trip.AlightFrame = frame;
                // Where they walk to now: a building at the end of the trip (a stop when transferring).
                var em = EntityManager;
                if (em.Exists(p) && em.HasComponent<Target>(p))
                {
                    Entity target = em.GetComponentData<Target>(p).m_Target;
                    if (target != Entity.Null && em.Exists(target) && em.HasComponent<Game.Buildings.Building>(target)) trip.Destination = target;
                }
            }
            foreach (Entity p in m_TmpIn)
            {
                Trip trip;
                if (m_Trips.TryGetValue(p, out trip) && trip.AlightFrame >= 0 && frame - trip.AlightFrame <= TransferFrames)
                {
                    if (trip.LastLine != line)
                    {
                        string tkey = StatsStore.TransferKey(trip.LastLine, line, stop);
                        TransferRecord t;
                        if (!m_Store.Transfers.TryGetValue(tkey, out t))
                        {
                            t = new TransferRecord { Key = tkey, FromLine = trip.LastLine, ToLine = line, FromStop = trip.LastStop, ToStop = stop };
                            m_Store.Transfers[tkey] = t;
                        }
                        t.Count.Add(1);
                        trip.Lines.Add(line);
                    }
                }
                else
                {
                    trip = new Trip();
                    trip.Lines.Add(line);
                    trip.Purpose = PurposeOf(p);
                    m_Trips[p] = trip;
                }
                trip.LastLine = line;
                trip.LastStop = null;
                trip.AlightFrame = -1;
                trip.Destination = Entity.Null;
            }
        }

        // ---------------------------------------------------------------- destinations

        // A finished trip: why it was made (for every line ridden) and which building it ended at.
        void CountTripEnd(Trip trip)
        {
            string purpose = trip.Purpose ?? "other";
            var seen = new HashSet<string>();
            foreach (string line in trip.Lines)
            {
                if (!seen.Add(line)) continue;
                string pkey = line + "|" + purpose;
                PurposeRecord pr;
                if (!m_Store.Purposes.TryGetValue(pkey, out pr))
                {
                    pr = new PurposeRecord { Key = pkey, Line = line, Purpose = purpose };
                    m_Store.Purposes[pkey] = pr;
                }
                pr.Count.Add(1);
            }

            Entity b = trip.Destination;
            var em = EntityManager;
            if (b == Entity.Null || !em.Exists(b) || !em.HasComponent<Game.Objects.Transform>(b)) return;
            Unity.Mathematics.float3 pos = em.GetComponentData<Game.Objects.Transform>(b).m_Position;
            string key = StopRecord.PlaceOf(pos.x, pos.z);
            DestRecord d;
            if (!m_Store.Destinations.TryGetValue(key, out d))
            {
                d = new DestRecord { Key = key, X = pos.x, Y = pos.y, Z = pos.z };
                m_Store.Destinations[key] = d;
            }
            if (d.Building != b)
            {
                d.Building = b;
                d.Kind = KindOf(b);
                d.Name = EntityName(b);
            }
            CountHistory c;
            if (!d.ByLine.TryGetValue(trip.LastLine, out c))
            {
                c = new CountHistory();
                d.ByLine[trip.LastLine] = c;
            }
            c.Add(1);
        }

        string PurposeOf(Entity passenger)
        {
            var em = EntityManager;
            if (!em.Exists(passenger) || !em.HasComponent<Game.Creatures.Resident>(passenger)) return "other";
            Entity citizen = em.GetComponentData<Game.Creatures.Resident>(passenger).m_Citizen;
            if (citizen == Entity.Null || !em.Exists(citizen) || !em.HasComponent<Game.Citizens.TravelPurpose>(citizen)) return "other";
            return PurposeGroup(em.GetComponentData<Game.Citizens.TravelPurpose>(citizen).m_Purpose);
        }

        // The game's many purposes folded into the few the window shows.
        static string PurposeGroup(Game.Citizens.Purpose p)
        {
            switch (p)
            {
                case Game.Citizens.Purpose.GoingToWork:
                case Game.Citizens.Purpose.Working:
                    return "work";
                case Game.Citizens.Purpose.GoingHome:
                case Game.Citizens.Purpose.Sleeping:
                    return "home";
                case Game.Citizens.Purpose.Shopping:
                    return "shopping";
                case Game.Citizens.Purpose.GoingToSchool:
                case Game.Citizens.Purpose.Studying:
                    return "school";
                case Game.Citizens.Purpose.Leisure:
                case Game.Citizens.Purpose.Relaxing:
                case Game.Citizens.Purpose.Sightseeing:
                case Game.Citizens.Purpose.VisitAttractions:
                case Game.Citizens.Purpose.Traveling:
                    return "leisure";
                case Game.Citizens.Purpose.Hospital:
                case Game.Citizens.Purpose.InHospital:
                    return "health";
                case Game.Citizens.Purpose.MovingAway:
                    return "moving";
                default:
                    return "other";
            }
        }

        string KindOf(Entity b)
        {
            var em = EntityManager;
            if (em.HasComponent<Game.Buildings.ResidentialProperty>(b)) return "home";
            if (em.HasComponent<Game.Buildings.CommercialProperty>(b)) return "shop";
            if (em.HasComponent<Game.Buildings.OfficeProperty>(b)) return "office";
            if (em.HasComponent<Game.Buildings.IndustrialProperty>(b)) return "industry";
            if (em.HasComponent<Game.Buildings.School>(b)) return "school";
            if (em.HasComponent<Game.Buildings.Hospital>(b)) return "hospital";
            if (em.HasComponent<Game.Buildings.Park>(b) || em.HasComponent<Game.Buildings.LeisureProvider>(b) || em.HasComponent<Game.Buildings.AttractivenessProvider>(b)) return "leisure";
            if (em.HasComponent<Game.Buildings.TransportStation>(b) || em.HasComponent<Game.Buildings.PublicTransportStation>(b)) return "station";
            if (em.HasComponent<Game.Buildings.PoliceStation>(b) || em.HasComponent<Game.Buildings.FireStation>(b) || em.HasComponent<Game.Buildings.AdminBuilding>(b)
                || em.HasComponent<Game.Buildings.WelfareOffice>(b) || em.HasComponent<Game.Buildings.PostFacility>(b) || em.HasComponent<Game.Buildings.ResearchFacility>(b)
                || em.HasComponent<Game.Buildings.DeathcareFacility>(b) || em.HasComponent<Game.Buildings.Prison>(b)) return "service";
            return "other";
        }

        // Trips nobody continued within the transfer time are over: count their chain of lines.
        void EndTrips()
        {
            long frame = m_Simulation.frameIndex;
            var done = new List<Entity>();
            foreach (var kv in m_Trips)
            {
                Trip trip = kv.Value;
                bool over = trip.AlightFrame >= 0 ? frame - trip.AlightFrame > TransferFrames : !EntityManager.Exists(kv.Key);
                if (!over) continue;
                done.Add(kv.Key);
                if (trip.AlightFrame >= 0) CountTripEnd(trip);
                if (trip.Lines.Count < 2) continue;
                string ckey = string.Join(">", trip.Lines.ToArray());
                ChainRecord c;
                if (!m_Store.Chains.TryGetValue(ckey, out c))
                {
                    c = new ChainRecord { Key = ckey };
                    m_Store.Chains[ckey] = c;
                }
                c.Count.Add(1);
            }
            foreach (Entity e in done) m_Trips.Remove(e);
        }

        static int StopBefore(StopRecord[] stops, int index)
        {
            int n = stops.Length;
            for (int k = 1; k <= n; k++)
            {
                int i = ((index - k) % n + n) % n;
                if (stops[i] != null) return i;
            }
            return -1;
        }

        static int NearestStop(EntityManager em, Entity vehicle, StopRecord[] stops)
        {
            if (!em.HasComponent<Game.Objects.Transform>(vehicle)) return -1;
            Unity.Mathematics.float3 p = em.GetComponentData<Game.Objects.Transform>(vehicle).m_Position;
            int best = -1;
            float bestD = float.MaxValue;
            for (int i = 0; i < stops.Length; i++)
            {
                if (stops[i] == null) continue;
                float dx = stops[i].X - p.x, dz = stops[i].Z - p.z;
                float d = dx * dx + dz * dz;
                if (d < bestD)
                {
                    bestD = d;
                    best = i;
                }
            }
            return best;
        }

        const System.Reflection.BindingFlags Private = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public;
        static readonly System.Reflection.FieldInfo s_NameType = typeof(NameSystem.Name).GetField("m_NameType", Private);
        static readonly System.Reflection.FieldInfo s_NameID = typeof(NameSystem.Name).GetField("m_NameID", Private);
        static readonly System.Reflection.FieldInfo s_NameArgs = typeof(NameSystem.Name).GetField("m_NameArgs", Private);

        // The stop's name as the game shows it: custom, or a localized / formatted one ("Street 12").
        string EntityName(Entity stop)
        {
            try
            {
                object name = m_NameSystem.GetName(stop, true); // boxed: its fields are private
                var dict = Game.SceneFlow.GameManager.instance.localizationManager.activeDictionary;
                string Tr(string id)
                {
                    string v;
                    return id != null && dict != null && dict.TryGetValue(id, out v) ? v : id;
                }
                var type = (NameSystem.NameType)s_NameType.GetValue(name);
                string nameId = (string)s_NameID.GetValue(name);
                switch (type)
                {
                    case NameSystem.NameType.Custom:
                        return nameId ?? "";
                    case NameSystem.NameType.Localized:
                        return Tr(nameId) ?? "";
                    default:
                        string text = Tr(nameId) ?? "";
                        string[] args = (string[])s_NameArgs.GetValue(name);
                        if (args != null)
                            for (int i = 0; i + 1 < args.Length; i += 2)
                                text = text.Replace("{" + args[i] + "}", Tr(args[i + 1]));
                        return text;
                }
            }
            catch (Exception e)
            {
                Mod.Log.Warn("Name failed: " + e.Message);
                return "";
            }
        }


        static string Hex(UnityEngine.Color32 c)
        {
            return "#" + c.r.ToString("x2") + c.g.ToString("x2") + c.b.ToString("x2");
        }
    }
}
