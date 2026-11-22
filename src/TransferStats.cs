using System.Collections.Generic;

namespace TrafficStatistic
{
    // People counted per in-game hour (last 24 kept) and per day.
    public class CountHistory
    {
        public readonly SortedDictionary<long, float> Hours = new SortedDictionary<long, float>();
        public readonly SortedDictionary<long, float> Days = new SortedDictionary<long, float>();
        public double HourAcc, DayAcc;

        // Finished hours plus the running one.
        public double Last24()
        {
            double n = HourAcc;
            foreach (float v in Hours.Values) n += v;
            return n;
        }

        public void FinishHour(long hour, bool dayEnded)
        {
            if (HourAcc > 0) Hours[hour] = (float)HourAcc;
            HourAcc = 0;
            if (dayEnded)
            {
                if (DayAcc > 0) Days[hour / 24] = (float)DayAcc;
                DayAcc = 0;
            }
        }

        public void Add(double n)
        {
            HourAcc += n;
            DayAcc += n;
        }

        public void Trim(long oldestHour)
        {
            var old = new List<long>();
            foreach (long h in Hours.Keys)
            {
                if (h < oldestHour) old.Add(h); else break;
            }
            foreach (long h in old) Hours.Remove(h);
        }

        public void DropFrom(long hour)
        {
            var hs = new List<long>();
            foreach (long h in Hours.Keys) if (h >= hour) hs.Add(h);
            foreach (long h in hs) Hours.Remove(h);
            var ds = new List<long>();
            foreach (long d in Days.Keys) if (d >= hour / 24) ds.Add(d);
            foreach (long d in ds) Days.Remove(d);
            HourAcc = DayAcc = 0;
        }

        public bool Empty { get { return HourAcc == 0 && DayAcc == 0 && Hours.Count == 0 && Days.Count == 0; } }
    }

    // People who left line From at stop FromStop and got on line To at stop ToStop.
    public class TransferRecord
    {
        public string Key;                   // "<from>><to>@<to stop>"
        public string FromLine, ToLine;      // line keys
        public string FromStop, ToStop;      // StopRecord keys
        public readonly CountHistory Count = new CountHistory();
    }

    // A whole trip with at least one transfer: the lines in the order ridden.
    public class ChainRecord
    {
        public string Key;                   // line keys joined by '>'
        public readonly CountHistory Count = new CountHistory();
    }

    // What one passenger is doing on the current trip.
    public class Trip
    {
        public readonly List<string> Lines = new List<string>();
        public string LastLine;              // line ridden last
        public string LastStop;              // stop where they got out of it (StopRecord key), or null
        public long AlightFrame = -1;        // frame they got out; -1 while riding
        public Unity.Entities.Entity Destination; // building they head to, seen when they last got out
        public string Purpose;               // why they travel (grouped), seen when they first got in
    }
}
