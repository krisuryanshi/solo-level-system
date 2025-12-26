import SystemModal from "./SystemModal";
import "./App.css";
import { useEffect, useState } from "react";

const API = "http://localhost:5050";

export default function App() {
  const [player, setPlayer] = useState(null);
  const [day, setDay] = useState(null);
  const [quests, setQuests] = useState([]);
  const [reward, setReward] = useState(null);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("focus");
  const [newXp, setNewXp] = useState(25);
  const [newGold, setNewGold] = useState(5);

  async function load() {
    setError("");
    const [pRes, dRes] = await Promise.all([
      fetch(`${API}/player`),
      fetch(`${API}/day`),
    ]);

    setPlayer(await pRes.json());
    const d = await dRes.json();
    setDay(d.activeDay);
    setQuests(d.quests || []);
  }

  async function startDay() {
    setError("");
    const res = await fetch(`${API}/day/start`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Could not start day");
      return;
    }
    await load();
  }

  async function completeQuest(id) {
    setError("");
    setReward(null);

    const res = await fetch(`${API}/quests/${id}/complete`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Could not complete quest");
      return;
    }

    setReward({
      title: data.quest.title,
      xp: data.reward.xp,
      gold: data.reward.gold,
      leveledUp: data.leveledUp,
      levelsGained: data.levelsGained,
      playerAfter: data.after,
    });

    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <div className="shell">
        <div className="topbar">
          <div>
            <div className="brand">Solo Level System</div>
            <div className="subtle">Daily quests, stat growth, and rewards you can actually use.</div>
          </div>

          {day ? <div className="pill">Day: {day.dayKey}</div> : <div className="pill">Day not started</div>}
        </div>

        <div className="grid">
          {/* LEFT COLUMN */}
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card">
              <h2>STATUS</h2>

              {player ? (
                <>
                  <div className="row">
                    <div>Level</div>
                    <div>{player.level}</div>
                  </div>

                  <div className="row">
                    <div>XP</div>
                    <div>{player.xp}</div>
                  </div>

                  <div className="row">
                    <div>Gold</div>
                    <div>{player.gold}</div>
                  </div>

                  <div className="row">
                    <div>Stat Points</div>
                    <div>{player.statPoints}</div>
                  </div>

                  {/* XP bar (simple for now) */}
                  <div className="xpbar">
                    <div
                      className="xpfill"
                      style={{
                        width: "0%",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                    <button className="btn" onClick={startDay} disabled={!!day}>
                      {day ? "Day started" : "Start day"}
                    </button>

                    <button className="btn" onClick={load}>
                      Refresh
                    </button>
                  </div>
                </>
              ) : (
                <div className="subtle">Loading player...</div>
              )}

              {error && <div className="err">{error}</div>}
            </div>

            <div className="card">
              <h2>STATS</h2>

              {player ? (
                <>
                  <div className="subtle" style={{ marginBottom: 10 }}>
                    Unspent points: {player.statPoints}
                  </div>

                  {["focus", "strength", "craft"].map((s) => (
                    <div key={s} className="row" style={{ alignItems: "center" }}>
                      <div style={{ textTransform: "capitalize" }}>{s}</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 30, textAlign: "right" }}>{player.stats?.[s] ?? 0}</div>

                        <button
                          className="btn"
                          disabled={player.statPoints <= 0}
                          onClick={async () => {
                            setError("");
                            const res = await fetch(`${API}/stats/allocate`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ stat: s, points: 1 }),
                            });

                            const data = await res.json();
                            if (!res.ok) {
                              setError(data.message || "Could not allocate points");
                              return;
                            }
                            await load();
                          }}
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="subtle">Loading stats...</div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="card">
            <h2>QUEST BOARD</h2>

            <div className="subtle" style={{ marginBottom: 10 }}>
              {day ? "Add quests, then complete them to earn rewards." : "Start your day to generate daily quests and add custom ones."}
            </div>

            {/* Add quest */}
            <div style={{ marginBottom: 14 }}>
              <div className="subtle" style={{ marginBottom: 8 }}>Add a quest</div>

              <input
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Quest title (e.g., finish math problem set)"
                disabled={!day}
                style={{ width: "100%", marginBottom: 10 }}
              />

              <div className="formRow">
                <select className="select" value={newType} onChange={(e) => setNewType(e.target.value)} disabled={!day}>
                  <option value="focus">focus</option>
                  <option value="strength">strength</option>
                  <option value="craft">craft</option>
                </select>

                <input
                  className="input"
                  type="number"
                  value={newXp}
                  onChange={(e) => setNewXp(e.target.value)}
                  disabled={!day}
                />

                <input
                  className="input"
                  type="number"
                  value={newGold}
                  onChange={(e) => setNewGold(e.target.value)}
                  disabled={!day}
                />

                <button
                  className="btn"
                  disabled={!day}
                  onClick={async () => {
                    setError("");
                    const res = await fetch(`${API}/quests`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: newTitle,
                        type: newType,
                        xpReward: Number(newXp),
                        goldReward: Number(newGold),
                      }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      setError(data.message || "Could not add quest");
                      return;
                    }

                    setNewTitle("");
                    await load();
                  }}
                >
                  Add
                </button>
              </div>

              <div className="subtle" style={{ marginTop: 8 }}>
                XP and gold are rewards. Type decides which stat boosts it.
              </div>
            </div>

            {/* Quest list */}
            <div style={{ marginTop: 18 }}>
              <div className="subtle" style={{ marginBottom: 10 }}>Today’s quests</div>

              {quests.length === 0 ? (
                <div className="subtle">No quests yet. Start your day.</div>
              ) : (
                quests.map((q) => (
                  <div key={q.id} className="quest">
                    <div>
                      <div className="questTitle">{q.title}</div>
                      <div className="questMeta">
                        Type: {q.type} • Reward: +{q.xpReward} XP, +{q.goldReward} gold
                      </div>
                    </div>

                    {q.completed ? (
                      <div style={{ opacity: 0.9 }}>✅</div>
                    ) : (
                      <button className="btn" onClick={() => completeQuest(q.id)}>
                        Complete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <SystemModal
          open={!!reward}
          title="You have completed a Quest."
          lines={
            reward
              ? [
                reward.title,
                `+${reward.xp} XP`,
                `+${reward.gold} gold`,
                ...(reward.leveledUp
                  ? [`Level Up! +${reward.levelsGained} level${reward.levelsGained === 1 ? "" : "s"}`]
                  : []),
              ]
              : []
          }
          onAccept={() => setReward(null)}
        />
      </div>
    </div>
  );
}
