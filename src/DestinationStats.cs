using System.Collections.Generic;
using Unity.Entities;

namespace TrafficStatistic
{
    // A building public transport riders went to at the end of their trip.
    public class DestRecord
    {
        public string Key;      // rounded position, stable across loads
        public string Name;
        public string Kind;     // home, shop, office, industry, school, hospital, leisure, station, service, other
        public float X, Y, Z;
        public Entity Building; // known once someone went there in this session
        // People who came, by the line they rode last.
        public readonly Dictionary<string, CountHistory> ByLine = new Dictionary<string, CountHistory>();

        public double Last24()
        {
            double n = 0;
            foreach (var c in ByLine.Values) n += c.Last24();
            return n;
        }
    }

    // Why riders of a line travel: one record per line and trip purpose.
    public class PurposeRecord
    {
        public string Key;      // "<line>|<purpose>"
        public string Line;
        public string Purpose;  // Game.Citizens.Purpose name, grouped (see LineStatsSystem.PurposeGroup)
        public readonly CountHistory Count = new CountHistory();
    }
}
