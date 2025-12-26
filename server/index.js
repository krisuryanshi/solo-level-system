import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import User from "./models/User.js";
import auth from "./middleware/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

// ---------- helpers ----------
function isValidUsername(u) {
  return typeof u === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(u.trim());
}
function isValidPin(pin) {
  return typeof pin === "string" && /^[0-9]{4}$/.test(pin);
}

function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPin(pin, salt) {
  // built-in, no extra deps
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return hash;
}

function xpToNext(level) {
  return 100 + (level - 1) * 25;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function xpMultiplierFor(player, type) {
  if (type === "focus") return 1 + clamp(player.stats.focus * 0.02, 0, 0.3);
  if (type === "craft") return 1 + clamp(player.stats.craft * 0.02, 0, 0.3);
  return 1;
}

function goldMultiplierFor(player, type) {
  if (type === "strength") return 1 + clamp(player.stats.strength * 0.02, 0, 0.3);
  return 1;
}

function applyRewards(player, { xp = 0, gold = 0 }) {
  const before = { ...player };

  player.xp += xp;
  player.gold += gold;

  let leveledUp = false;
  let levelsGained = 0;

  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level += 1;
    player.statPoints += 3;
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
  return [
    { id: "focus-1", type: "focus", title: "25 min deep work", xpReward: 30, goldReward: 5, completed: false },
    { id: "strength-1", type: "strength", title: "Workout or 20 min movement", xpReward: 35, goldReward: 5, completed: false },
    { id: "craft-1", type: "craft", title: "45 min build session", xpReward: 40, goldReward: 8, completed: false },
  ];
}

async function getUserOr404(req, res) {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ ok: false, message: "User not found" });
    return null;
  }
  return user;
}

// ---------- routes ----------
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "server is running" });
});

// ---- AUTH ----
app.post("/auth/register", async (req, res) => {
  try {
    const { username, pin } = req.body;

    if (!isValidUsername(username)) {
      return res.status(400).json({ ok: false, message: "Username must be 3–20 chars (letters, numbers, underscore)" });
    }
    if (!isValidPin(pin)) {
      return res.status(400).json({ ok: false, message: "PIN must be exactly 4 digits" });
    }

    const uname = username.trim().toLowerCase();

    const exists = await User.findOne({ username: uname });
    if (exists) {
      return res.status(400).json({ ok: false, message: "Username already taken" });
    }

    const salt = makeSalt();
    const pinHash = hashPin(pin, salt);

    const user = await User.create({
      username: uname,
      pinHash,
      pinSalt: salt,
      // player/quests fields auto default
    });

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ ok: true, token, username: user.username });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Register failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, pin } = req.body;

    if (!isValidUsername(username) || !isValidPin(pin)) {
      return res.status(400).json({ ok: false, message: "Invalid username or PIN" });
    }

    const uname = username.trim().toLowerCase();
    const user = await User.findOne({ username: uname });
    if (!user) {
      return res.status(400).json({ ok: false, message: "Invalid username or PIN" });
    }

    const attempt = hashPin(pin, user.pinSalt);
    if (attempt !== user.pinHash) {
      return res.status(400).json({ ok: false, message: "Invalid username or PIN" });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ ok: true, token, username: user.username });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Login failed" });
  }
});

// ---- GAME (protected) ----
app.get("/player", auth, async (req, res) => {
  const user = await getUserOr404(req, res);
  if (!user) return;
  res.json(user.player);
});

app.get("/day", auth, async (req, res) => {
  const user = await getUserOr404(req, res);
  if (!user) return;

  res.json({
    activeDay: user.activeDay?.dayKey ? user.activeDay : null,
    quests: user.quests || [],
  });
});

app.post("/day/start", auth, async (req, res) => {
  const user = await getUserOr404(req, res);
  if (!user) return;

  const dayKey = makeDayKey();
  if (user.activeDay?.dayKey === dayKey) {
    return res.json({ ok: true, message: "Day already started", activeDay: user.activeDay, quests: user.quests });
  }

  user.activeDay = { dayKey, startedAt: new Date().toISOString() };
  user.quests = generateDailyQuests();
  await user.save();

  res.json({ ok: true, message: "Day started", activeDay: user.activeDay, quests: user.quests });
});

app.post("/quests", auth, async (req, res) => {
  const user = await getUserOr404(req, res);
  if (!user) return;

  if (!user.activeDay?.dayKey) {
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

  user.quests.unshift(newQuest);
  await user.save();

  res.json({ ok: true, quest: newQuest, quests: user.quests });
});

app.post("/quests/:id/complete", auth, async (req, res) => {
  const user = await getUserOr404(req, res);
  if (!user) return;

  if (!user.activeDay?.dayKey) {
    return res.status(400).json({ ok: false, message: "Start your day first" });
  }

  const quest = user.quests.find((q) => q.id === req.params.id);
  if (!quest) return res.status(404).json({ ok: false, message: "Quest not found" });
  if (quest.completed) return res.status(400).json({ ok: false, message: "Quest already completed" });

  quest.completed = true;
  quest.completedAt = new Date().toISOString();

  const xpMult = xpMultiplierFor(user.player, quest.type);
  const goldMult = goldMultiplierFor(user.player, quest.type);

  const reward = {
    xp: Math.round(quest.xpReward * xpMult),
    gold: Math.round(quest.goldReward * goldMult),
  };

  const result = applyRewards(user.player, reward);

  await user.save();

  res.json({
    ok: true,
    quest,
    reward,
    ...result,
  });
});

app.post("/stats/allocate", auth, async (req, res) => {
  const user = await getUserOr404(req, res);
  if (!user) return;

  const { stat, points } = req.body;

  const validStats = ["focus", "strength", "craft"];
  if (!validStats.includes(stat)) {
    return res.status(400).json({ ok: false, message: "Invalid stat" });
  }

  const pts = Number(points);
  if (!Number.isInteger(pts) || pts <= 0) {
    return res.status(400).json({ ok: false, message: "Points must be a positive integer" });
  }

  if (user.player.statPoints < pts) {
    return res.status(400).json({ ok: false, message: "Not enough stat points" });
  }

  user.player.statPoints -= pts;
  user.player.stats[stat] += pts;

  await user.save();

  res.json({ ok: true, player: user.player });
});

const PORT = process.env.PORT || 5050;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
});
