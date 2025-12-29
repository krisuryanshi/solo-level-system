import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import User from "./models/User.js";
import auth from "./middleware/auth.js";
import Template from "./models/Template.js";

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
function xpToNext(level) {
  return 100 + (level - 1) * 25;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function xpMultiplierFor(player, type) {
  if (type === "physical") return 1 + clamp(player.stats.physical * 0.02, 0, 0.3);
  if (type === "spiritual") return 1 + clamp(player.stats.spiritual * 0.02, 0, 0.2);
  return 1;
}

function goldMultiplierFor(player, type) {
  if (type === "intellectual") return 1 + clamp(player.stats.intellectual * 0.02, 0, 0.3);
  if (type === "spiritual") return 1 + clamp(player.stats.spiritual * 0.02, 0, 0.2);
  return 1;
}

function applyRewards(player, { xp = 0, gold = 0 }) {
  const before = JSON.parse(JSON.stringify(player));

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

  const after = JSON.parse(JSON.stringify(player));
  return { before, after, leveledUp, levelsGained };
}

function makeDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  const pw = String(password);
  return crypto.createHash("sha256").update(pw + salt).digest("hex");
}

function isValidPassword(password) {
  const pw = String(password);
  return pw.length >= 8;
}

function isValidUsername(u) {
  return typeof u === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(u.trim());
}

function ensureToday(user) {
  const today = makeDayKey();

  if (!user.activeDay?.dayKey) return;
  if (user.activeDay.dayKey === today) return;

  user.activeDay = null;
  user.quests = [];
}

function clampInt(n, lo, hi) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function maxMinutesFor(player, type) {
  const s =
    type === "physical"
      ? player.stats.physical
      : type === "intellectual"
        ? player.stats.intellectual
        : player.stats.spiritual;

  // baseline 25, +5 per stat point, cap at 180
  return clampInt(25 + s * 5, 25, 180);
}

// ✅ strict minutes validation
function minutesFor(player, type, minutes) {
  const maxM = maxMinutesFor(player, type);

  if (minutes == null) {
    const m = clampInt(25, 1, maxM);
    return { ok: true, minutes: m, maxMinutes: maxM };
  }

  const x = Math.round(Number(minutes));
  if (!Number.isFinite(x)) return { ok: false, message: "Minutes must be a number", maxMinutes: maxM };

  if (x < 1) return { ok: false, message: "Minutes must be at least 1", maxMinutes: maxM };
  if (x > maxM) return { ok: false, message: `Minutes must be between 1 and ${maxM}`, maxMinutes: maxM };

  return { ok: true, minutes: x, maxMinutes: maxM };
}

function rewardsFor(player, type, minutes) {
  const mRes = minutesFor(player, type, minutes);
  if (!mRes.ok) return { ok: false, message: mRes.message, maxMinutes: mRes.maxMinutes };

  const m = mRes.minutes;

  const xpPerMin = type === "physical" ? 2 : 1;
  const xp = m * xpPerMin;

  const goldBase = type === "physical" ? 2 : type === "intellectual" ? 5 : 4;
  const gold = goldBase + Math.floor(m / 30);

  return {
    ok: true,
    xp: clampInt(xp, 1, 999),
    gold: clampInt(gold, 0, 99),
    minutes: m,
    maxMinutes: mRes.maxMinutes,
  };
}

// ---------- routes ----------
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "server is running" });
});

// ---- AUTH ----
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!isValidUsername(username)) {
      return res.status(400).json({
        ok: false,
        message: "Username must be 3–20 chars (letters, numbers, underscore)",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        ok: false,
        message: "Password must be at least 8 characters",
      });
    }

    const uname = username.trim().toLowerCase();

    const exists = await User.findOne({ username: uname });
    if (exists) {
      return res.status(400).json({ ok: false, message: "Username already taken" });
    }

    const salt = makeSalt();
    const passwordHash = hashPassword(password, salt);

    const user = await User.create({
      username: uname,
      passwordHash,
      passwordSalt: salt,
    });

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ ok: true, token, username: user.username });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ ok: false, message: "Register failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!isValidUsername(username) || !isValidPassword(password)) {
      return res.status(400).json({ ok: false, message: "Invalid username or password" });
    }

    const uname = username.trim().toLowerCase();
    const user = await User.findOne({ username: uname });
    if (!user) {
      return res.status(400).json({ ok: false, message: "Invalid username or password" });
    }

    const attempt = hashPassword(password, user.passwordSalt);
    if (attempt !== user.passwordHash) {
      return res.status(400).json({ ok: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ ok: true, token, username: user.username });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ ok: false, message: "Login failed" });
  }
});

// ---- Templates ----
app.get("/templates", auth, async (req, res) => {
  const templates = await Template.find({ userId: req.userId, archived: false }).sort({ createdAt: -1 });
  res.json({ ok: true, templates });
});

app.post("/templates", auth, async (req, res) => {
  const { title, type, minutes } = req.body;

  const validTypes = ["physical", "intellectual", "spiritual"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ ok: false, message: "Invalid type" });
  }

  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return res.status(400).json({ ok: false, message: "Title must be at least 3 characters" });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  const base = rewardsFor(user.player, type, minutes);
  if (!base.ok) {
    return res.status(400).json({ ok: false, message: base.message });
  }

  const t = await Template.create({
    userId: req.userId,
    title: title.trim(),
    type,
    minutes: base.minutes,
  });

  res.json({ ok: true, template: t });
});

// ✅ DELETE TEMPLATE (soft delete)
app.delete("/templates/:id", auth, async (req, res) => {
  try {
    const t = await Template.findOne({ _id: req.params.id, userId: req.userId, archived: false });
    if (!t) return res.status(404).json({ ok: false, message: "Template not found" });

    t.archived = true;
    await t.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE TEMPLATE ERROR:", err);
    res.status(500).json({ ok: false, message: "Could not delete template" });
  }
});

app.post("/day/add-from-template", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  ensureToday(user);
  if (!user.activeDay?.dayKey) {
    await user.save();
    return res.status(400).json({ ok: false, message: "Start your day first" });
  }

  const { templateId, minutes, note } = req.body;

  const template = await Template.findOne({ _id: templateId, userId: req.userId, archived: false });
  if (!template) {
    return res.status(404).json({ ok: false, message: "Template not found" });
  }

  const usedMinutes = minutes == null ? template.minutes : minutes;
  const base = rewardsFor(user.player, template.type, usedMinutes);
  if (!base.ok) {
    return res.status(400).json({ ok: false, message: base.message });
  }

  const quest = {
    id: `q-${Date.now()}`,
    kind: "template",
    templateId: String(template._id),
    type: template.type,
    title: template.title,
    minutes: base.minutes,
    note: typeof note === "string" ? note.trim() : "",
    xpReward: base.xp,
    goldReward: base.gold,
    completed: false,
    completedAt: null,
  };

  user.quests.unshift(quest);
  await user.save();

  res.json({ ok: true, quest, quests: user.quests });
});

app.post("/day/quick-add", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  ensureToday(user);
  if (!user.activeDay?.dayKey) {
    await user.save();
    return res.status(400).json({ ok: false, message: "Start your day first" });
  }

  const { title, type, minutes, saveAsTemplate } = req.body;

  const validTypes = ["physical", "intellectual", "spiritual"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ ok: false, message: "Invalid type" });
  }

  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return res.status(400).json({ ok: false, message: "Title must be at least 3 characters" });
  }

  const base = rewardsFor(user.player, type, minutes);
  if (!base.ok) {
    return res.status(400).json({ ok: false, message: base.message });
  }

  let createdTemplate = null;
  if (saveAsTemplate === true) {
    createdTemplate = await Template.create({
      userId: req.userId,
      title: title.trim(),
      type,
      minutes: base.minutes,
    });
  }

  const quest = {
    id: `q-${Date.now()}`,
    kind: "quick",
    templateId: createdTemplate ? String(createdTemplate._id) : null,
    type,
    title: title.trim(),
    minutes: base.minutes,
    note: "",
    xpReward: base.xp,
    goldReward: base.gold,
    completed: false,
    completedAt: null,
  };

  user.quests.unshift(quest);
  await user.save();

  res.json({
    ok: true,
    quest,
    quests: user.quests,
    template: createdTemplate,
    maxMinutes: base.maxMinutes,
  });
});

// ---- GAME (protected) ----
app.get("/player", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  const before = user.activeDay?.dayKey || null;
  ensureToday(user);
  const after = user.activeDay?.dayKey || null;
  if (before !== after) await user.save();

  res.json(user.player);
});

app.get("/day", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  const before = user.activeDay?.dayKey || null;
  ensureToday(user);
  const after = user.activeDay?.dayKey || null;
  if (before !== after) await user.save();

  res.json({
    activeDay: user.activeDay?.dayKey ? user.activeDay : null,
    quests: user.quests || [],
  });
});

app.post("/day/start", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  const dayKey = makeDayKey();
  ensureToday(user);

  if (user.activeDay?.dayKey === dayKey) {
    return res.json({ ok: true, message: "Day already started", activeDay: user.activeDay, quests: user.quests });
  }

  user.activeDay = { dayKey, startedAt: new Date().toISOString() };
  user.quests = [];

  await user.save();
  res.json({ ok: true, message: "Day started", activeDay: user.activeDay, quests: user.quests });
});

app.post("/quests/:id/complete", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

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

// ✅ DELETE QUEST
app.delete("/quests/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ ok: false, message: "User not found" });

    const beforeLen = user.quests?.length || 0;
    user.quests = (user.quests || []).filter((q) => q.id !== req.params.id);

    if ((user.quests?.length || 0) === beforeLen) {
      return res.status(404).json({ ok: false, message: "Quest not found" });
    }

    await user.save();
    res.json({ ok: true, quests: user.quests });
  } catch (err) {
    console.error("DELETE QUEST ERROR:", err);
    res.status(500).json({ ok: false, message: "Could not delete quest" });
  }
});

app.post("/stats/allocate", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ ok: false, message: "User not found" });

  const { stat, points } = req.body;

  const validStats = ["physical", "intellectual", "spiritual"];
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
