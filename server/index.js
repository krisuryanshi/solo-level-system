import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ---- SYSTEM STATE (in-memory for v1) ----
const player = {
    level: 1,
    xp: 0,
    gold: 0,
    statPoints: 0,
    stats: {
        focus: 0,
        strength: 0,
        craft: 0,
    },
};

let activeDay = null; // { dayKey, startedAt }
let quests = []; // today's quests only

function xpToNext(level) {
    return 100 + (level - 1) * 25;
}

function applyRewards({ xp = 0, gold = 0 }) {
    const before = { ...player };

    player.xp += xp;
    player.gold += gold;

    let leveledUp = false;
    let levelsGained = 0;

    while (player.xp >= xpToNext(player.level)) {
        player.xp -= xpToNext(player.level);
        player.level += 1;
        player.statPoints += 3; // simple: +3 stat points per level
        leveledUp = true;
        levelsGained += 1;
    }

    const after = { ...player };
    return { before, after, leveledUp, levelsGained };
}

function makeDayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function generateDailyQuests() {
    // Hybrid: focus + strength + craft (simple, practical)
    return [
        { id: "focus-1", type: "focus", title: "25 min deep work", xpReward: 30, goldReward: 5, completed: false },
        { id: "strength-1", type: "strength", title: "Workout or 20 min movement", xpReward: 35, goldReward: 5, completed: false },
        { id: "craft-1", type: "craft", title: "45 min build session", xpReward: 40, goldReward: 8, completed: false },
    ];
}

// ---- ROUTES ----

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

function xpMultiplierFor(type) {
    if (type === "focus") return 1 + clamp(player.stats.focus * 0.02, 0, 0.3);
    if (type === "craft") return 1 + clamp(player.stats.craft * 0.02, 0, 0.3);
    return 1;
}

function goldMultiplierFor(type) {
    if (type === "strength") return 1 + clamp(player.stats.strength * 0.02, 0, 0.3);
    return 1;
}

app.get("/health", (req, res) => {
    res.json({ ok: true, message: "server is running" });
});

app.get("/player", (req, res) => {
    res.json(player);
});

app.get("/day", (req, res) => {
    res.json({
        activeDay,
        quests,
    });
});

// Start Day: creates today's quest set (only once per dayKey)
app.post("/day/start", (req, res) => {
    const dayKey = makeDayKey();
    if (activeDay && activeDay.dayKey === dayKey) {
        return res.json({ ok: true, message: "Day already started", activeDay, quests });
    }

    activeDay = { dayKey, startedAt: new Date().toISOString() };
    quests = generateDailyQuests();

    res.json({ ok: true, message: "Day started", activeDay, quests });
});

app.post("/quests", (req, res) => {
    if (!activeDay) {
        return res.status(400).json({ ok: false, message: "Start your day first" });
    }

    const { title, type, xpReward, goldReward } = req.body;

    const validTypes = ["focus", "strength", "craft"];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ ok: false, message: "Invalid quest type" });
    }

    if (!title || typeof title !== "string" || title.trim().length < 3) {
        return res.status(400).json({ ok: false, message: "Title must be at least 3 characters" });
    }

    const xp = Number(xpReward);
    const gold = Number(goldReward);

    if (!Number.isFinite(xp) || xp <= 0 || xp > 200) {
        return res.status(400).json({ ok: false, message: "xpReward must be between 1 and 200" });
    }

    if (!Number.isFinite(gold) || gold < 0 || gold > 200) {
        return res.status(400).json({ ok: false, message: "goldReward must be between 0 and 200" });
    }

    const id = `custom-${Date.now()}`;

    const newQuest = {
        id,
        type,
        title: title.trim(),
        xpReward: Math.round(xp),
        goldReward: Math.round(gold),
        completed: false,
    };

    quests.unshift(newQuest);

    res.json({ ok: true, quest: newQuest, quests });
});

// Complete quest: awards XP+gold, updates level/statPoints
app.post("/quests/:id/complete", (req, res) => {

    if (!activeDay) {
        return res.status(400).json({ ok: false, message: "Start your day first" });
    }

    const quest = quests.find((q) => q.id === req.params.id);
    if (!quest) return res.status(404).json({ ok: false, message: "Quest not found" });
    if (quest.completed) return res.status(400).json({ ok: false, message: "Quest already completed" });

    quest.completed = true;
    quest.completedAt = new Date().toISOString();

    const xpMult = xpMultiplierFor(quest.type);
    const goldMult = goldMultiplierFor(quest.type);

    const reward = {
        xp: Math.round(quest.xpReward * xpMult),
        gold: Math.round(quest.goldReward * goldMult),
    };

    const result = applyRewards(reward);

    res.json({
        ok: true,
        quest,
        reward,
        ...result,
    });
});

app.post("/stats/allocate", (req, res) => {
    const { stat, points } = req.body;

    const validStats = ["focus", "strength", "craft"];
    if (!validStats.includes(stat)) {
        return res.status(400).json({ ok: false, message: "Invalid stat" });
    }

    const pts = Number(points);
    if (!Number.isInteger(pts) || pts <= 0) {
        return res.status(400).json({ ok: false, message: "Points must be a positive integer" });
    }

    if (player.statPoints < pts) {
        return res.status(400).json({ ok: false, message: "Not enough stat points" });
    }

    player.statPoints -= pts;
    player.stats[stat] += pts;

    res.json({ ok: true, player });
});

const PORT = 5050;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
