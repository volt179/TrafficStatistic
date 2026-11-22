using System;
using System.Collections.Generic;
using Unity.Entities;

namespace TrafficStatistic
{
    // One in-game hour (or day) at one stop of one line.
    public struct StopValue
    {
        public float Boarded;   // people who got in here
        public float Alighted;  // people who got out here
        public float Waiting;   // average people waiting here for this line
        public float SegRiding; // riders summed over samples of vehicles on the stretch to the next stop
        public float SegSeats;  // seats summed over the same samples (load = SegRiding / SegSeats)
    }

    // Running sums of an unfinished hour or day.
    public class StopAccum
    {
        public double Boarded, Alighted, Waiting, SegRiding, SegSeats;
        public int WaitSamples;

        public StopValue Value()
        {
            return new StopValue
            {
                Boarded = (float)Boarded,
                Alighted = (float)Alighted,
                Waiting = WaitSamples > 0 ? (float)(Waiting / WaitSamples) : 0,
                SegRiding = (float)SegRiding,
                SegSeats = (float)SegSeats,
            };
        }

        public bool Empty { get { return WaitSamples == 0 && Boarded == 0 && Alighted == 0 && SegSeats == 0; } }

        public void Clear()
        {
            Boarded = Alighted = Waiting = SegRiding = SegSeats = 0;
            WaitSamples = 0;
        }
    }

    // A stop as one line sees it: the line's waypoint number <Index> on its route.
    public class StopRecord
    {
        public string Key;      // "<line key>|<index>"
        public string LineKey;
        public int Index;       // order on the route
        public string Place;    // rounded position: the same stop served by several lines shares it
        public string Name;
        public float X, Y, Z;
        public readonly SortedDictionary<long, StopValue> Hours = new SortedDictionary<long, StopValue>(); // last 24 hours
        public readonly SortedDictionary<long, StopValue> Days = new SortedDictionary<long, StopValue>();
        public readonly StopAccum HourAcc = new StopAccum();
        public readonly StopAccum DayAcc = new StopAccum();

        public bool Alive;
        public Entity Waypoint, Stop;
        public int LiveWaiting;

        public static string PlaceOf(float x, float z)
        {
            // 4 m grid: waypoints of different lines at one platform land in the same cell.
            return ((int)Math.Round(x / 4)).ToString() + ":" + ((int)Math.Round(z / 4)).ToString();
        }
    }
}
