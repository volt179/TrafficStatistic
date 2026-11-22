using Colossal.Logging;
using Game;
using Game.Modding;

namespace TrafficStatistic
{
    public class Mod : IMod
    {
        public const string Version = "0.6.3";

        public static readonly ILog Log = LogManager.GetLogger("TrafficStatistic").SetShowsErrorsInUI(false);

        public void OnLoad(UpdateSystem updateSystem)
        {
            Log.Info("Traffic Statistic " + Version + " loaded");
            updateSystem.UpdateAt<LineStatsSystem>(SystemUpdatePhase.GameSimulation);
            updateSystem.UpdateAt<StatsUISystem>(SystemUpdatePhase.UIUpdate);
        }

        public void OnDispose()
        {
            Log.Info("Traffic Statistic unloaded");
        }
    }
}
