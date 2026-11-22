using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace TrafficStatistic
{
    // One in-game hour of a line. -1 = not recorded (points saved by 0.1.0 have only Riding).
    public struct HourValue
    {
        public float Riding;    // average people in the line's vehicles
        public float Capacity;  // average seats of those vehicles
        public float Waiting;   // average people waiting at the line's stops
        public float Vehicles;  // average vehicles on the line
        public float Boarded;   // people who got in during the hour (a sum, not an average)
    }

    // One in-game day: averages and peaks of the samples, boarded = day total and busiest hour.
    public struct DayValue
    {
        public float Riding, RidingPeak, Capacity, LoadPeak, Waiting, WaitingPeak, Vehicles, VehiclesPeak, Boarded, BoardedPeak;
    }

    // Running sums of the samples of an unfinished hour or day.
    public class Accum
    {
        public double Riding, Capacity, Waiting, Vehicles, Boarded;
        public int Samples;
        public float RidingPeak, LoadPeak, WaitingPeak, VehiclesPeak, BoardedPeak;

        public void Add(int riding, int capacity, int waiting, int vehicles, int boarded)
        {
            Riding += riding;
            Capacity += capacity;
            Waiting += waiting;
            Vehicles += vehicles;
            Boarded += boarded;
            Samples++;
            RidingPeak = Math.Max(RidingPeak, riding);
            if (capacity > 0) LoadPeak = Math.Max(LoadPeak, 100f * riding / capacity);
            WaitingPeak = Math.Max(WaitingPeak, waiting);
            VehiclesPeak = Math.Max(VehiclesPeak, vehicles);
        }

        public HourValue Hour()
        {
            return new HourValue
            {
                Riding = (float)(Riding / Samples),
                Capacity = (float)(Capacity / Samples),
                Waiting = (float)(Waiting / Samples),
                Vehicles = (float)(Vehicles / Samples),
                Boarded = (float)Boarded,
            };
        }

        public DayValue Day()
        {
            return new DayValue
            {
                Riding = (float)(Riding / Samples), RidingPeak = RidingPeak,
                Capacity = (float)(Capacity / Samples), LoadPeak = LoadPeak,
                Waiting = (float)(Waiting / Samples), WaitingPeak = WaitingPeak,
                Vehicles = (float)(Vehicles / Samples), VehiclesPeak = VehiclesPeak,
                Boarded = (float)Boarded, BoardedPeak = BoardedPeak,
            };
        }

        public void Clear()
        {
            Riding = Capacity = Waiting = Vehicles = Boarded = 0;
            Samples = 0;
            RidingPeak = LoadPeak = WaitingPeak = VehiclesPeak = BoardedPeak = 0;
        }
    }

    // History of one public transport line. Keys are absolute in-game hours / days
    // (DateTime ticks / hour), so they keep growing across saves of the same city.
    public class LineRecord
    {
        public string Key;      // "Bus#3": transport type + line number, stable across loads
        public string Type;     // TransportType name
        public int Number;
        public string Name;     // custom name given by the player, or empty
        public string Color;    // "#rrggbb"
        public readonly SortedDictionary<long, HourValue> Hours = new SortedDictionary<long, HourValue>();
        public readonly SortedDictionary<long, DayValue> Days = new SortedDictionary<long, DayValue>();

        public readonly Accum HourAcc = new Accum();
        public readonly Accum DayAcc = new Accum();

        // Last sample, for the live numbers in the window. Alive = the line exists in the city now.
        public bool Alive;
        public Unity.Entities.Entity Entity; // the route entity at the last sample
        public int LiveRiding, LiveCapacity, LiveWaiting, LiveVehicles;
    }

    // All lines of one city, plus loading and saving to ModsData\TrafficStatistic\<city>.txt.
    public class StatsStore
    {
        public const int KeepHours = 7 * 24;
        const string Header = "TrafficStatistic 6";
        // Up to format 5 hours were DateTime ticks / hour, with a ~355-day hole at every in-game new year.
        const int FirstGaplessFormat = 6;

        public static long HourOf(DateTime dt, int daysPerYear)
        {
            return DayOf(dt, daysPerYear) * 24 + dt.Hour;
        }

        static long DayOf(DateTime dt, int daysPerYear)
        {
            return (long)dt.Year * daysPerYear + (dt.DayOfYear - 1);
        }

        // Moves every hour and day key written by format 5 or older to the gapless count.
        void ConvertOldKeys(int daysPerYear)
        {
            Func<long, long> day = d => DayOf(new DateTime(d * TimeSpan.TicksPerDay), daysPerYear);
            Func<long, long> hour = h => day(h / 24) * 24 + h % 24;
            if (FirstDay >= 0) FirstDay = day(FirstDay);
            foreach (var l in Lines.Values)
            {
                Rekey(l.Hours, hour);
                Rekey(l.Days, day);
            }
            foreach (var s in Stops.Values)
            {
                Rekey(s.Hours, hour);
                Rekey(s.Days, day);
            }
            var counts = new List<CountHistory>();
            foreach (var t in Transfers.Values) counts.Add(t.Count);
            foreach (var c in Chains.Values) counts.Add(c.Count);
            foreach (var p in Purposes.Values) counts.Add(p.Count);
            foreach (var d in Destinations.Values) counts.AddRange(d.ByLine.Values);
            foreach (var c in counts)
            {
                Rekey(c.Hours, hour);
                Rekey(c.Days, day);
            }
        }

        static void Rekey<T>(SortedDictionary<long, T> map, Func<long, long> key)
        {
            var old = new List<KeyValuePair<long, T>>(map);
            map.Clear();
            foreach (var kv in old) map[key(kv.Key)] = kv.Value;
        }

        public readonly Dictionary<string, LineRecord> Lines = new Dictionary<string, LineRecord>();
        public readonly Dictionary<string, StopRecord> Stops = new Dictionary<string, StopRecord>();
        public readonly Dictionary<string, TransferRecord> Transfers = new Dictionary<string, TransferRecord>();
        public readonly Dictionary<string, ChainRecord> Chains = new Dictionary<string, ChainRecord>();
        public const int KeepChains = 50;
        public readonly Dictionary<string, DestRecord> Destinations = new Dictionary<string, DestRecord>();
        public readonly Dictionary<string, PurposeRecord> Purposes = new Dictionary<string, PurposeRecord>();
        public long FirstDay = -1;

        public static string Folder
        {
            get { return Path.Combine(Colossal.PSI.Environment.EnvPath.kUserDataPath, "ModsData", "TrafficStatistic"); }
        }

        public static string FileFor(string city)
        {
            var sb = new StringBuilder();
            foreach (char c in string.IsNullOrEmpty(city) ? "city" : city)
                sb.Append(Array.IndexOf(Path.GetInvalidFileNameChars(), c) >= 0 ? '_' : c);
            return Path.Combine(Folder, sb.ToString().Trim() + ".txt");
        }

        public void TrimHours(long newestHour)
        {
            long oldest = newestHour - KeepHours + 1;
            foreach (var line in Lines.Values)
            {
                var old = new List<long>();
                foreach (long h in line.Hours.Keys)
                {
                    if (h < oldest) old.Add(h); else break;
                }
                foreach (long h in old) line.Hours.Remove(h);
            }
            // Stops keep only the last 24 hours; their days stay.
            long oldestStop = newestHour - 24 + 1;
            foreach (var stop in Stops.Values)
            {
                var old = new List<long>();
                foreach (long h in stop.Hours.Keys)
                {
                    if (h < oldestStop) old.Add(h); else break;
                }
                foreach (long h in old) stop.Hours.Remove(h);
            }
            foreach (var t in Transfers.Values) t.Count.Trim(oldestStop);
            foreach (var c in Chains.Values) c.Count.Trim(oldestStop);
            foreach (var p in Purposes.Values) p.Count.Trim(oldestStop);
            // Buildings nobody came to for a day are forgotten (there are many).
            var quiet = new List<string>();
            foreach (var d in Destinations.Values)
            {
                foreach (var c in d.ByLine.Values) c.Trim(oldestStop);
                if (d.Last24() <= 0) quiet.Add(d.Key);
            }
            foreach (string k in quiet) Destinations.Remove(k);
            // Chains are many and only the busiest matter: keep the top ones of the last 24 hours.
            if (Chains.Count > KeepChains)
            {
                var list = new List<ChainRecord>(Chains.Values);
                list.Sort((a, b) => b.Count.Last24().CompareTo(a.Count.Last24()));
                for (int i = KeepChains; i < list.Count; i++) Chains.Remove(list[i].Key);
            }
        }

        // An older save of the same city was loaded: forget what was recorded "in its future".
        public void DropFrom(long hour)
        {
            long day = hour / 24;
            foreach (var line in Lines.Values)
            {
                var hs = new List<long>();
                foreach (long h in line.Hours.Keys) if (h >= hour) hs.Add(h);
                foreach (long h in hs) line.Hours.Remove(h);
                var ds = new List<long>();
                foreach (long d in line.Days.Keys) if (d >= day) ds.Add(d);
                foreach (long d in ds) line.Days.Remove(d);
            }
            foreach (var stop in Stops.Values)
            {
                var hs = new List<long>();
                foreach (long h in stop.Hours.Keys) if (h >= hour) hs.Add(h);
                foreach (long h in hs) stop.Hours.Remove(h);
                var ds = new List<long>();
                foreach (long d in stop.Days.Keys) if (d >= day) ds.Add(d);
                foreach (long d in ds) stop.Days.Remove(d);
            }
            foreach (var t in Transfers.Values) t.Count.DropFrom(hour);
            foreach (var c in Chains.Values) c.Count.DropFrom(hour);
            foreach (var p in Purposes.Values) p.Count.DropFrom(hour);
            foreach (var d in Destinations.Values) foreach (var c in d.ByLine.Values) c.DropFrom(hour);
        }

        public void Save(string path)
        {
            var sb = new StringBuilder();
            sb.Append(Header).Append('\n');
            sb.Append("first\t").Append(FirstDay.ToString(CultureInfo.InvariantCulture)).Append('\n');
            foreach (var l in Lines.Values)
            {
                sb.Append("L\t").Append(l.Key).Append('\t').Append(l.Type).Append('\t').Append(Num(l.Number))
                  .Append('\t').Append(l.Color).Append('\t').Append(Clean(l.Name)).Append('\n');
                foreach (var kv in l.Hours)
                {
                    HourValue v = kv.Value;
                    sb.Append("H\t").Append(Num(kv.Key));
                    foreach (float f in new[] { v.Riding, v.Capacity, v.Waiting, v.Vehicles, v.Boarded }) sb.Append('\t').Append(Num(f));
                    sb.Append('\n');
                }
                foreach (var kv in l.Days)
                {
                    DayValue v = kv.Value;
                    sb.Append("D\t").Append(Num(kv.Key));
                    foreach (float f in new[] { v.Riding, v.RidingPeak, v.Capacity, v.LoadPeak, v.Waiting, v.WaitingPeak, v.Vehicles, v.VehiclesPeak, v.Boarded, v.BoardedPeak })
                        sb.Append('\t').Append(Num(f));
                    sb.Append('\n');
                }
            }
            foreach (var s in Stops.Values)
            {
                sb.Append("S\t").Append(s.Key).Append('\t').Append(s.LineKey).Append('\t').Append(Num(s.Index))
                  .Append('\t').Append(s.Place).Append('\t').Append(Num(s.X)).Append('\t').Append(Num(s.Y)).Append('\t').Append(Num(s.Z))
                  .Append('\t').Append(Clean(s.Name)).Append('\n');
                foreach (var kv in s.Hours) AppendStopValue(sb, "SH", kv.Key, kv.Value);
                foreach (var kv in s.Days) AppendStopValue(sb, "SD", kv.Key, kv.Value);
            }
            foreach (var t in Transfers.Values)
            {
                if (t.Count.Hours.Count == 0 && t.Count.Days.Count == 0) continue;
                sb.Append("T\t").Append(t.FromLine).Append('\t').Append(t.ToLine).Append('\t').Append(t.FromStop ?? "")
                  .Append('\t').Append(t.ToStop ?? "").Append('\n');
                AppendCounts(sb, t.Count);
            }
            foreach (var c in Chains.Values)
            {
                if (c.Count.Hours.Count == 0) continue;
                sb.Append("C\t").Append(c.Key).Append('\n');
                AppendCounts(sb, c.Count);
            }
            foreach (var p in Purposes.Values)
            {
                if (p.Count.Hours.Count == 0 && p.Count.Days.Count == 0) continue;
                sb.Append("P\t").Append(p.Line).Append('\t').Append(p.Purpose).Append('\n');
                AppendCounts(sb, p.Count);
            }
            foreach (var d in Destinations.Values)
            {
                sb.Append("B\t").Append(d.Key).Append('\t').Append(d.Kind).Append('\t').Append(Num(d.X)).Append('\t').Append(Num(d.Y))
                  .Append('\t').Append(Num(d.Z)).Append('\t').Append(Clean(d.Name)).Append('\n');
                foreach (var kv in d.ByLine)
                {
                    if (kv.Value.Hours.Count == 0) continue;
                    sb.Append("BL\t").Append(kv.Key).Append('\n');
                    AppendCounts(sb, kv.Value);
                }
            }
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, sb.ToString(), Encoding.UTF8);
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        public static StatsStore Load(string path, int daysPerYear)
        {
            var store = new StatsStore();
            if (!File.Exists(path)) return store;
            var ci = CultureInfo.InvariantCulture;
            LineRecord cur = null;
            StopRecord stop = null;
            CountHistory counts = null;
            DestRecord dest = null;
            int format = 0;
            foreach (string raw in File.ReadAllLines(path, Encoding.UTF8))
            {
                if (raw.StartsWith("TrafficStatistic "))
                {
                    int.TryParse(raw.Substring("TrafficStatistic ".Length).Trim(), NumberStyles.Integer, ci, out format);
                    continue;
                }
                string[] p = raw.Split('\t');
                try
                {
                    switch (p[0])
                    {
                        case "first":
                            store.FirstDay = long.Parse(p[1], ci);
                            break;
                        case "L":
                            cur = new LineRecord { Key = p[1], Type = p[2], Number = int.Parse(p[3], ci), Color = p[4], Name = p.Length > 5 ? p[5] : "" };
                            store.Lines[cur.Key] = cur;
                            break;
                        case "H":
                            if (cur == null) break;
                            // 0.1.0 wrote only the riding average.
                            cur.Hours[long.Parse(p[1], ci)] = new HourValue
                            {
                                Riding = F(p, 2), Capacity = F(p, 3), Waiting = F(p, 4), Vehicles = F(p, 5), Boarded = F(p, 6),
                            };
                            break;
                        case "D":
                            if (cur == null) break;
                            if (p.Length <= 4)
                            {
                                // 0.1.0: day, average, peak.
                                cur.Days[long.Parse(p[1], ci)] = new DayValue
                                {
                                    Riding = F(p, 2), RidingPeak = F(p, 3), Capacity = -1, LoadPeak = -1, Waiting = -1, WaitingPeak = -1,
                                    Vehicles = -1, VehiclesPeak = -1, Boarded = -1, BoardedPeak = -1,
                                };
                            }
                            else
                            {
                                cur.Days[long.Parse(p[1], ci)] = new DayValue
                                {
                                    Riding = F(p, 2), RidingPeak = F(p, 3), Capacity = F(p, 4), LoadPeak = F(p, 5), Waiting = F(p, 6),
                                    WaitingPeak = F(p, 7), Vehicles = F(p, 8), VehiclesPeak = F(p, 9), Boarded = F(p, 10), BoardedPeak = F(p, 11),
                                };
                            }
                            break;
                        case "S":
                            stop = new StopRecord
                            {
                                Key = p[1], LineKey = p[2], Index = int.Parse(p[3], ci), Place = p[4],
                                X = F(p, 5), Y = F(p, 6), Z = F(p, 7), Name = p.Length > 8 ? p[8] : "",
                            };
                            store.Stops[stop.Key] = stop;
                            break;
                        case "SH":
                            if (stop != null) stop.Hours[long.Parse(p[1], ci)] = ReadStopValue(p);
                            break;
                        case "SD":
                            if (stop != null) stop.Days[long.Parse(p[1], ci)] = ReadStopValue(p);
                            break;
                        case "T":
                        {
                            var t = new TransferRecord { FromLine = p[1], ToLine = p[2], FromStop = p[3], ToStop = p[4] };
                            t.Key = TransferKey(t.FromLine, t.ToLine, t.ToStop);
                            store.Transfers[t.Key] = t;
                            counts = t.Count;
                            break;
                        }
                        case "C":
                        {
                            var c = new ChainRecord { Key = p[1] };
                            store.Chains[c.Key] = c;
                            counts = c.Count;
                            break;
                        }
                        case "P":
                        {
                            var pr = new PurposeRecord { Line = p[1], Purpose = p[2], Key = p[1] + "|" + p[2] };
                            store.Purposes[pr.Key] = pr;
                            counts = pr.Count;
                            break;
                        }
                        case "B":
                            dest = new DestRecord { Key = p[1], Kind = p[2], X = F(p, 3), Y = F(p, 4), Z = F(p, 5), Name = p.Length > 6 ? p[6] : "" };
                            store.Destinations[dest.Key] = dest;
                            counts = null;
                            break;
                        case "BL":
                            if (dest == null) break;
                            counts = new CountHistory();
                            dest.ByLine[p[1]] = counts;
                            break;
                        case "CH":
                            if (counts != null) counts.Hours[long.Parse(p[1], ci)] = F(p, 2);
                            break;
                        case "CD":
                            if (counts != null) counts.Days[long.Parse(p[1], ci)] = F(p, 2);
                            break;
                    }
                }
                catch (Exception e)
                {
                    Mod.Log.Warn("Skipping bad line in " + path + ": " + raw + " (" + e.Message + ")");
                }
            }
            if (format < FirstGaplessFormat)
            {
                store.ConvertOldKeys(daysPerYear);
                Mod.Log.Info("Converted history of " + path + " from format " + format + " to gapless days");
            }
            return store;
        }

        public static string TransferKey(string from, string to, string toStop)
        {
            return from + ">" + to + "@" + toStop;
        }

        static void AppendCounts(StringBuilder sb, CountHistory c)
        {
            foreach (var kv in c.Hours) sb.Append("CH\t").Append(Num(kv.Key)).Append('\t').Append(Num(kv.Value)).Append('\n');
            foreach (var kv in c.Days) sb.Append("CD\t").Append(Num(kv.Key)).Append('\t').Append(Num(kv.Value)).Append('\n');
        }

        static void AppendStopValue(StringBuilder sb, string tag, long key, StopValue v)
        {
            sb.Append(tag).Append('\t').Append(Num(key));
            foreach (float f in new[] { v.Boarded, v.Alighted, v.Waiting, v.SegRiding, v.SegSeats }) sb.Append('\t').Append(Num(f));
            sb.Append('\n');
        }

        static StopValue ReadStopValue(string[] p)
        {
            return new StopValue { Boarded = F(p, 2), Alighted = F(p, 3), Waiting = F(p, 4), SegRiding = F(p, 5), SegSeats = F(p, 6) };
        }

        static float F(string[] p, int i)
        {
            return i < p.Length ? float.Parse(p[i], CultureInfo.InvariantCulture) : -1f;
        }

        static string Num(float f)
        {
            return f.ToString("0.##", CultureInfo.InvariantCulture);
        }

        static string Num(long n)
        {
            return n.ToString(CultureInfo.InvariantCulture);
        }

        static string Clean(string s)
        {
            return string.IsNullOrEmpty(s) ? "" : s.Replace('\t', ' ').Replace('\n', ' ').Replace('\r', ' ');
        }
    }
}
