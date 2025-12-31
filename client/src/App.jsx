import SystemModal from "./SystemModal";
import "./App.css";
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5050";

const TOKEN_KEY = "solo_token";
const USER_KEY = "solo_username";

const ANIM_MS = 220;

const TRIGGER_HOUR = 0;
const TRIGGER_MINUTE = 0;

const DAYKEY_KEY = "solo_last_daykey";
const STARTED_DAYKEY_KEY = "solo_started_daykey";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API}${path}`, { ...options, headers });
}

// must match backend formula exactly
function maxMinutesFor(player, type) {
  if (!player?.stats) return 180; // safe fallback
  const s =
    type === "physical"
      ? player.stats.physical
      : type === "intellectual"
        ? player.stats.intellectual
        : player.stats.spiritual;

  return Math.min(180, Math.max(25, 25 + s * 5));
}

// allow raw typing (1, 12, 123) without snapping
function keepDigits(s) {
  const str = String(s);
  if (str === "") return "";
  return /^\d+$/.test(str) ? str : "";
}

function validateMinutesOrError(raw, maxM) {
  if (raw === "" || raw == null) return { ok: true, minutes: undefined };

  const x = Math.round(Number(raw));
  if (!Number.isFinite(x)) return { ok: false, message: "Minutes must be a number" };
  if (x < 1) return { ok: false, message: "Minutes must be at least 1" };
  if (x > maxM) return { ok: false, message: `Minutes must be between 1 and ${maxM}` };

  return { ok: true, minutes: x };
}

function xpToNext(level) {
  return 100 + (level - 1) * 25;
}

function pct(n, d) {
  if (!d) return 0;
  return Math.max(0, Math.min(100, (n / d) * 100));
}

function clientDayKey(date = new Date()) {
  const d = new Date(date);

  const h = d.getHours();
  const m = d.getMinutes();

  if (h < TRIGGER_HOUR || (h === TRIGGER_HOUR && m < TRIGGER_MINUTE)) {
    d.setDate(d.getDate() - 1);
  }

  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export default function App() {
  const pageRef = useRef(null);
  const templatesCardRef = useRef(null);
  const trackElRef = useRef(null);

  const timersRef = useRef([]);
  const lastClientDayKeyRef = useRef(localStorage.getItem(DAYKEY_KEY) || clientDayKey());

  const [player, setPlayer] = useState(null);
  const [day, setDay] = useState(null);
  const [quests, setQuests] = useState([]);
  const [reward, setReward] = useState(null);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState([]);

  const dayRef = useRef(null);
  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  // animation state
  const [leavingQuestIds, setLeavingQuestIds] = useState(() => new Set());
  const [leavingTemplateIds, setLeavingTemplateIds] = useState(() => new Set());
  const [addedQuestIds, setAddedQuestIds] = useState(() => new Set());
  const [addedTemplateIds, setAddedTemplateIds] = useState(() => new Set());
  const prevQuestIdsRef = useRef(new Set());
  const prevTemplateIdsRef = useRef(new Set());
  const questsRef = useRef([]);
  const templatesRef = useRef([]);

  // auth
  const [authUser, setAuthUser] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [signedInAs, setSignedInAs] = useState("");

  // quick add form
  const [quickTitle, setQuickTitle] = useState("");
  const [quickType, setQuickType] = useState("");
  const [quickMinutes, setQuickMinutes] = useState("");
  const [quickSaveAsTemplate, setQuickSaveAsTemplate] = useState(false);

  // templates modal
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // UI mode + open/close animation flags
  const [uiMode, setUiMode] = useState(getToken() ? "app" : "auth"); // "auth" | "app"
  const [authAnim, setAuthAnim] = useState("sys-open"); // sys-open | sys-close
  const [appAnim, setAppAnim] = useState("sys-open"); // sys-open | sys-close

  const [rewardAnim, setRewardAnim] = useState("sys-open"); // sys-open | sys-close
  const [templatesAnim, setTemplatesAnim] = useState("sys-open"); // sys-open | sys-close

  const [newDayNotice, setNewDayNotice] = useState(false);
  const [newDayAnim, setNewDayAnim] = useState("sys-open");

  const anyPopupOpen = templatesOpen || !!reward || newDayNotice;
  const quickMaxMinutes = quickType ? maxMinutesFor(player, quickType) : 25;

  function addTimer(id) {
    timersRef.current.push(id);
  }

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }

  function closeReward() {
    setRewardAnim("sys-close");
    const t = setTimeout(() => {
      setReward(null);
      setRewardAnim("sys-open"); // reset for next open
    }, ANIM_MS);
    addTimer(t);
  }

  function closeTemplates() {
    setTemplatesAnim("sys-close");
    const t = setTimeout(() => {
      setTemplatesOpen(false);
      setTemplatesAnim("sys-open"); // reset for next open
    }, ANIM_MS);
    addTimer(t);
  }

  function closeNewDay() {
    setNewDayAnim("sys-close");
    const t = setTimeout(() => {
      setNewDayNotice(false);
      setNewDayAnim("sys-open");
    }, ANIM_MS);
    addTimer(t);
  }

  function refreshTab() {
    // no close animation needed, but it's fine if it flashes
    window.location.reload();
  }

  async function login(username, password) {
    setError("");
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message || "Login failed");
      setAuthPassword("");
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);

    const uname = (data.username || username || "").toLowerCase();
    localStorage.setItem(USER_KEY, uname);
    setSignedInAs(uname);

    setAuthAnim("sys-close");
    const t = setTimeout(() => {
      setUiMode("app");
      setAppAnim("sys-open");
      setAuthAnim("sys-open"); // reset for later
    }, ANIM_MS);
    addTimer(t);

    setAuthUser("");
    setAuthPassword("");

    const k = clientDayKey();
    lastClientDayKeyRef.current = k;
    localStorage.setItem(DAYKEY_KEY, k);

    await load();
    await loadTemplates();
  }

  async function register(username, password) {
    setError("");
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message || "Register failed");
      setAuthPassword("");
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);

    const uname = (data.username || username || "").toLowerCase();
    localStorage.setItem(USER_KEY, uname);
    setSignedInAs(uname);

    setAuthAnim("sys-close");
    const t = setTimeout(() => {
      setUiMode("app");
      setAppAnim("sys-open");
      setAuthAnim("sys-open"); // reset for later
    }, ANIM_MS);
    addTimer(t);

    setAuthUser("");
    setAuthPassword("");

    const k = clientDayKey();
    lastClientDayKeyRef.current = k;
    localStorage.setItem(DAYKEY_KEY, k);

    await load();
    await loadTemplates();
  }

  function hardLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // keep DAYKEY_KEY so the boundary stays consistent, but clear started-day marker
    localStorage.removeItem(STARTED_DAYKEY_KEY);

    setSignedInAs("");

    setAuthUser("");
    setAuthPassword("");

    setPlayer(null);
    setDay(null);
    setQuests([]);
    setReward(null);
    setTemplates([]);
    setTemplatesOpen(false);

    setQuickTitle("");
    setQuickType("");
    setQuickMinutes("");
    setQuickSaveAsTemplate(false);

    // reset animation trackers
    setLeavingQuestIds(new Set());
    setLeavingTemplateIds(new Set());
    setAddedQuestIds(new Set());
    setAddedTemplateIds(new Set());
    prevQuestIdsRef.current = new Set();
    prevTemplateIdsRef.current = new Set();

    // reset popup anims too
    setRewardAnim("sys-open");
    setTemplatesAnim("sys-open");

    // reset new day noti
    setNewDayNotice(false);
    setNewDayAnim("sys-open");

    const k = clientDayKey();
    lastClientDayKeyRef.current = k;
    localStorage.setItem(DAYKEY_KEY, k);
  }

  function logout() {
    // close popups first so fixed overlays don't fight the stage close
    setTemplatesOpen(false);
    setReward(null);
    setNewDayNotice(false);

    // close the full UI, then actually logout and show auth
    setAppAnim("sys-close");
    const t = setTimeout(() => {
      hardLogout();
      setUiMode("auth");
      setAuthAnim("sys-open");
      setAppAnim("sys-open"); // reset for next time
    }, ANIM_MS);
    addTimer(t);
  }

  async function load() {
    setError("");
    const [pRes, dRes] = await Promise.all([apiFetch("/player"), apiFetch("/day")]);

    if (pRes.status === 401 || dRes.status === 401) {
      logout();
      return;
    }

    setPlayer(await pRes.json());
    const d = await dRes.json();
    setDay(d.activeDay);
    setQuests(d.quests || []);

    // if backend says there is no active day, clear the "started" marker
    if (!d.activeDay?.dayKey) {
      localStorage.removeItem(STARTED_DAYKEY_KEY);
    }
  }

  async function loadTemplates() {
    const res = await apiFetch("/templates");
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.message || "Could not load templates");
      setTemplates([]);
      return;
    }

    setTemplates(data.templates || []);
  }

  async function addFromTemplate(templateId) {
    setError("");

    const res = await apiFetch("/day/add-from-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message || "Could not add quest from template");
      return;
    }

    setQuests(data.quests || []);
  }

  async function startDay() {
    setError("");
    const res = await apiFetch("/day/start", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Could not start day");
      return;
    }

    // mark that user started the current dayKey
    if (data.activeDay?.dayKey) {
      localStorage.setItem(STARTED_DAYKEY_KEY, data.activeDay.dayKey);
    }

    await load();
  }

  async function completeQuest(id) {
    setError("");
    setReward(null);

    const res = await apiFetch(`/quests/${id}/complete`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Could not complete quest");
      return;
    }

    // ensure next open plays open anim
    setRewardAnim("sys-open");

    setReward({
      title: data.quest.title,
      xp: data.reward.xp,
      leveledUp: data.leveledUp,
      levelsGained: data.levelsGained,
      playerAfter: data.after,
    });

    await load();
  }

  async function quickAdd() {
    if (!quickType) {
      setError("Pick a type first");
      return;
    }
    setError("");

    const maxM = maxMinutesFor(player, quickType);
    const check = validateMinutesOrError(quickMinutes, maxM);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    const res = await apiFetch("/day/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: quickTitle,
        type: quickType,
        minutes: check.minutes,
        saveAsTemplate: quickSaveAsTemplate,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message || "Could not add quest");
      return;
    }

    setQuickTitle("");
    setQuickType("");
    setQuickMinutes("");
    setQuickSaveAsTemplate(false);

    setQuests(data.quests || []);

    if (data.template) {
      await loadTemplates();
    }
  }

  async function deleteQuest(id, title) {
    const ok = window.confirm(`Delete quest "${title}"?\n\nThis can't be undone.`);
    if (!ok) return;

    setError("");

    setLeavingQuestIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const res = await apiFetch(`/quests/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok || !data.ok) {
      setLeavingQuestIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError(data.message || "Could not delete quest");
      return;
    }

    const t = setTimeout(() => {
      setQuests(data.quests || []);
      setLeavingQuestIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 180);
    addTimer(t);
  }

  async function deleteTemplate(id, title) {
    const ok = window.confirm(`Delete template "${title}"?\n\nThis can't be undone.`);
    if (!ok) return;

    setError("");

    setLeavingTemplateIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const res = await apiFetch(`/templates/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok || !data.ok) {
      setLeavingTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError(data.message || "Could not delete template");
      return;
    }

    const t = setTimeout(() => {
      setTemplates(data.templates || []);
      setLeavingTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 180);
    addTimer(t);
  }

  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) setSignedInAs(savedUser);

    // ensure DAYKEY_KEY exists on first load
    const initKey = localStorage.getItem(DAYKEY_KEY) || clientDayKey();
    lastClientDayKeyRef.current = initKey;
    localStorage.setItem(DAYKEY_KEY, initKey);

    if (getToken()) {
      setUiMode("app");
      load();
      loadTemplates();
    } else {
      setUiMode("auth");
    }

    return () => {
      clearTimers();
    };
  }, []);

  // if user refreshes AFTER the reset time, still show the noti
  useEffect(() => {
    if (!getToken()) return;

    const stored = localStorage.getItem(DAYKEY_KEY) || clientDayKey();
    const nowKey = clientDayKey();
    const startedKey = localStorage.getItem(STARTED_DAYKEY_KEY);

    if (stored !== nowKey && startedKey && startedKey === stored) {
      localStorage.setItem(DAYKEY_KEY, nowKey);
      lastClientDayKeyRef.current = nowKey;

      setNewDayAnim("sys-open");
      setNewDayNotice(true);
    } else {
      localStorage.setItem(DAYKEY_KEY, nowKey);
      lastClientDayKeyRef.current = nowKey;
    }
  }, []);

  // refresh around the daily backend reset time
  useEffect(() => {
    if (uiMode !== "app") return;

    let alive = true;
    let timeoutId = null;
    let intervalId = null;

    function shouldShowNewDay(prevKey) {
      // only show if user had started THAT day
      const startedKey = localStorage.getItem(STARTED_DAYKEY_KEY);
      return !!startedKey && startedKey === prevKey;
    }

    async function refreshIfNewDay() {
      const k = clientDayKey();
      if (k !== lastClientDayKeyRef.current) {
        const prev = lastClientDayKeyRef.current;

        lastClientDayKeyRef.current = k;
        localStorage.setItem(DAYKEY_KEY, k);

        if (shouldShowNewDay(prev) && !!dayRef.current?.dayKey) {
          setNewDayAnim("sys-open");
          setNewDayNotice(true);
          return;
        }

        await load();
        await loadTemplates();
      }
    }

    function msUntilNextTrigger() {
      const now = new Date();
      const next = new Date(now);

      next.setHours(TRIGGER_HOUR, TRIGGER_MINUTE, 1, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

      return next.getTime() - now.getTime();
    }

    function scheduleNext() {
      const ms = msUntilNextTrigger();

      timeoutId = setTimeout(async () => {
        if (!alive) return;
        await refreshIfNewDay();
        if (!alive) return;
        scheduleNext();
      }, ms);

      addTimer(timeoutId);
    }

    // exact trigger timer
    scheduleNext();

    // fallback polling
    intervalId = setInterval(() => {
      if (!alive) return;
      refreshIfNewDay();
    }, 30_000);
    addTimer(intervalId);

    return () => {
      alive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [uiMode]); // only depends on being in app mode

  // detect added quests
  useEffect(() => {
    const nextIds = new Set((quests || []).map((q) => q.id));
    const prevIds = prevQuestIdsRef.current;

    const added = [];
    nextIds.forEach((id) => {
      if (!prevIds.has(id)) added.push(id);
    });

    if (added.length) {
      setAddedQuestIds((prev) => {
        const next = new Set(prev);
        added.forEach((id) => next.add(id));
        return next;
      });

      const t = setTimeout(() => {
        setAddedQuestIds((prev) => {
          const next = new Set(prev);
          added.forEach((id) => next.delete(id));
          return next;
        });
      }, 260);
      addTimer(t);
    }

    prevQuestIdsRef.current = nextIds;
    questsRef.current = quests || [];
  }, [quests]);

  // detect added templates
  useEffect(() => {
    const nextIds = new Set((templates || []).map((t) => t._id));
    const prevIds = prevTemplateIdsRef.current;

    const added = [];
    nextIds.forEach((id) => {
      if (!prevIds.has(id)) added.push(id);
    });

    if (added.length) {
      setAddedTemplateIds((prev) => {
        const next = new Set(prev);
        added.forEach((id) => next.add(id));
        return next;
      });

      const t = setTimeout(() => {
        setAddedTemplateIds((prev) => {
          const next = new Set(prev);
          added.forEach((id) => next.delete(id));
          return next;
        });
      }, 260);
      addTimer(t);
    }

    prevTemplateIdsRef.current = nextIds;
    templatesRef.current = templates || [];
  }, [templates]);

  // when a popup opens, move the mouse tracking target from the main page to the popup
  useEffect(() => {
    if (templatesOpen && templatesCardRef.current) {
      trackElRef.current = templatesCardRef.current;
      return;
    }

    if (reward || newDayNotice) {
      const raf = requestAnimationFrame(() => {
        const el = document.querySelector(".sys-card");
        trackElRef.current = el || pageRef.current;
      });
      return () => cancelAnimationFrame(raf);
    }

    trackElRef.current = pageRef.current;
  }, [templatesOpen, reward, newDayNotice]);

  // cursor tracking (--mx/--my)
  useEffect(() => {
    const fallbackEl = pageRef.current;
    if (!fallbackEl) return;

    let targetX = 0.5;
    let targetY = 0.4;
    let curX = 0.5;
    let curY = 0.4;

    let raf = 0;

    function onMove(e) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      targetX = Math.max(0, Math.min(1, e.clientX / w));
      targetY = Math.max(0, Math.min(1, e.clientY / h));
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function tick() {
      raf = 0;
      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;

      const el = trackElRef.current || fallbackEl;
      if (el) {
        el.style.setProperty("--mx", `${(curX * 100).toFixed(2)}%`);
        el.style.setProperty("--my", `${(curY * 100).toFixed(2)}%`);
      }
    }

    window.addEventListener("mousemove", onMove, { passive: true });

    fallbackEl.style.setProperty("--mx", "50%");
    fallbackEl.style.setProperty("--my", "40%");

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const visibleQuests = (quests || []).filter((q) => !q.completed);
  const isLoggedOut = uiMode === "auth";

  return (
    <div
      className="page"
      ref={pageRef}
      style={{
        "--lvlRaw": player?.level ?? 1,
        "--trackMain": anyPopupOpen ? 0 : 1,
      }}
    >
      <div
        className="shell"
        style={
          isLoggedOut
            ? {
              minHeight: "calc(100vh - 56px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }
            : undefined
        }
      >
        {isLoggedOut ? (
          <div className={`card ${authAnim}`} style={{ width: "min(900px, 100%)" }}>
            <h2>ACCOUNT</h2>

            <div className="authRow">
              <input
                className="input"
                placeholder="username"
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
              />
              <input
                className="input"
                placeholder="password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
              <button className="btn" onClick={() => login(authUser, authPassword)}>
                Login
              </button>
              <button className="btn" onClick={() => register(authUser, authPassword)}>
                Register
              </button>
            </div>

            {error && (
              <div
                className="err"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ flex: 1 }}>{error}</span>
                <button className="btn" onClick={() => setError("")}>
                  Got it
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`appStage ${appAnim}`}>
            <div className="topbar">
              <div>
                <div className="brand">Solo Level System</div>
              </div>

              <div className="pill">{day ? `Day: ${day.dayKey}` : "Day not started"}</div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <h2>ACCOUNT</h2>

              <div className="authRow authRowLoggedIn">
                <div className="subtle" style={{ flex: 1 }}>
                  Signed in as <b>{signedInAs}</b>
                </div>
                <button className="btn" onClick={logout}>
                  Logout
                </button>
              </div>
            </div>

            <div className="grid">
              {/* LEFT COLUMN */}
              <div style={{ display: "grid", gap: 16 }}>
                <div className="card">
                  <h2>LEVEL</h2>

                  {player ? (
                    <>
                      <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, marginTop: 6 }}>
                        {player.level}
                      </div>

                      <div className="subtle" style={{ marginTop: 10, marginBottom: 8 }}>
                        {player.xp} / {xpToNext(player.level)} XP
                      </div>

                      <div className="xpbar" style={{ height: 16 }}>
                        <div
                          className="xpfill"
                          style={{
                            width: `${pct(player.xp, xpToNext(player.level))}%`,
                            height: "100%",
                          }}
                        />
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <button className="btn" style={{ width: "100%" }} onClick={startDay} disabled={!!day}>
                          {day ? "Day started" : "Start day"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="subtle">Loading...</div>
                  )}

                  {error && (
                    <div
                      className="err"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span style={{ flex: 1 }}>{error}</span>
                      <button
                        className="btn"
                        onClick={() => {
                          setError("");
                          load();
                          loadTemplates();
                        }}
                      >
                        Got it
                      </button>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h2>STATS</h2>

                  {player ? (
                    <>
                      <div className="subtle" style={{ marginBottom: 10 }}>
                        Available Points: {player.statPoints}
                      </div>

                      {["physical", "intellectual", "spiritual"].map((s) => (
                        <div key={s} className="row" style={{ alignItems: "center" }}>
                          <div style={{ textTransform: "capitalize" }}>{s}</div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ width: 30, textAlign: "right" }}>{player.stats?.[s] ?? 0}</div>

                            <button
                              className="btn"
                              disabled={player.statPoints <= 0}
                              onClick={async () => {
                                setError("");
                                const res = await apiFetch("/stats/allocate", {
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
                  <div>
                    Add quests, complete them, and earn XP to level up. Leveling up updates the UI and grants stat points
                    that raise your max minutes by quest type.
                  </div>
                </div>

                <div className="hr" />

                <div style={{ marginTop: 18 }}>
                  <div className="subtle" style={{ marginBottom: 10 }}>
                    Today's Quests:
                  </div>

                  {day && (
                    <>
                      <div className="quickRow" style={{ marginBottom: 10 }}>
                        <input
                          className="input"
                          value={quickTitle}
                          onChange={(e) => setQuickTitle(e.target.value)}
                          placeholder="Quest title (e.g., hit legs, CS assignment, pray)"
                        />

                        <select
                          className={`select ${quickType === "" ? "selectPlaceholder" : ""}`}
                          value={quickType}
                          onChange={(e) => setQuickType(e.target.value)}
                        >
                          <option value="" disabled>
                            Type
                          </option>
                          <option value="physical">physical</option>
                          <option value="intellectual">intellectual</option>
                          <option value="spiritual">spiritual</option>
                        </select>

                        <input
                          className="input"
                          type="number"
                          value={quickMinutes}
                          min={1}
                          max={quickMaxMinutes}
                          placeholder={quickType ? `Min (up to ${quickMaxMinutes})` : "Min"}
                          onChange={(e) => setQuickMinutes(keepDigits(e.target.value))}
                        />

                        <button className="btn" onClick={quickAdd} disabled={!quickTitle.trim() || !quickType}>
                          Add
                        </button>
                      </div>

                      <label
                        className="subtle"
                        style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}
                      >
                        <input
                          type="checkbox"
                          checked={quickSaveAsTemplate}
                          onChange={(e) => setQuickSaveAsTemplate(e.target.checked)}
                        />
                        Also save as template
                      </label>
                    </>
                  )}

                  {!day ? (
                    <div className="subtle">Start your day to add quests.</div>
                  ) : quests.length === 0 ? (
                    <div className="subtle">No quests added yet.</div>
                  ) : visibleQuests.length === 0 ? (
                    <div className="subtle">No quests left.</div>
                  ) : (
                    visibleQuests.map((q) => (
                      <div
                        key={q.id}
                        className={[
                          "quest",
                          addedQuestIds.has(q.id) ? "quest-enter" : "",
                          leavingQuestIds.has(q.id) ? "quest-exit" : "",
                        ].join(" ")}
                      >
                        <div>
                          <div className="questTitle">{q.title}</div>
                          <div className="questMeta">
                            Type: {q.type} • {q.minutes} min • Reward: +{q.xpReward} XP
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <button className="btn" onClick={() => completeQuest(q.id)}>
                            Complete
                          </button>
                          <button className="btn" onClick={() => deleteQuest(q.id, q.title)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hr" />

                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn"
                    style={{ width: "100%" }}
                    onClick={() => {
                      setTemplatesAnim("sys-open");
                      setTemplatesOpen(true);
                    }}
                  >
                    Templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {templatesOpen && (
        <div className="sys-overlay" onClick={closeTemplates}>
          <div
            onClick={(e) => e.stopPropagation()}
            ref={templatesCardRef}
            className={`sys-card bg-surface tmpl-card ${templatesAnim}`}
            style={{
              width: "min(760px, 100%)",
              "--trackPopup": 1,
            }}
          >
            <div className="sys-header">
              <div className="sys-headrow">
                <div className="sys-tag">TEMPLATES</div>
                <button className="sys-btn sys-btn-ghost" onClick={closeTemplates}>
                  Close
                </button>
              </div>
            </div>

            <div className="sys-body">
              {templates.length === 0 ? (
                <div className="subtle">No templates yet. Use "Also save as template" when adding a quest.</div>
              ) : (
                <div className="tmpl-list">
                  {templates.map((t) => (
                    <div
                      key={t._id}
                      className={[
                        "tmpl-item",
                        addedTemplateIds.has(t._id) ? "tmpl-enter" : "",
                        leavingTemplateIds.has(t._id) ? "tmpl-exit" : "",
                      ].join(" ")}
                    >
                      <div>
                        <div className="tmpl-title">{t.title}</div>
                        <div className="tmpl-meta">
                          Type: {t.type} • Default: {t.minutes} min
                        </div>
                      </div>

                      <div className="tmpl-actions">
                        <button className="sys-btn" disabled={!day} onClick={() => addFromTemplate(t._id)}>
                          Add to today
                        </button>
                        <button className="sys-btn" onClick={() => deleteTemplate(t._id, t.title)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SystemModal
        open={newDayNotice}
        title="A new day has begun"
        highlight=""
        suffix="."
        lines={[]}
        animClass={newDayAnim}
        onAccept={refreshTab}
        buttonText="Refresh"
      />

      <SystemModal
        open={!!reward}
        title="You have completed the Quest"
        highlight={reward?.title || ""}
        suffix="."
        lines={
          reward
            ? [
              `+${reward.xp} XP`,
              ...(reward.leveledUp
                ? [
                  `Level Up! +${reward.levelsGained} level${reward.levelsGained === 1 ? "" : "s"}`,
                  `+${reward.levelsGained * 3} stat points`,
                ]
                : []),
            ]
            : []
        }
        animClass={rewardAnim}
        onAccept={closeReward}
      />
    </div>
  );
}
