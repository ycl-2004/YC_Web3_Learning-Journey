import CreateForm from "./CreateForm";
import Todo from "./Todo";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { listen } from "@tauri-apps/api/event";

const STORAGE_KEY = "menubar_todo_v1";
const SETTINGS_KEY = "menubar_todo_settings_v1";

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function nowMs() {
  return Date.now();
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function TodoWrapper() {
  // -----------------------------
  // Load initial state from storage
  // -----------------------------
  const initialLoadedRef = useRef(false);

  const TAGS = ["All", "Study", "Exam", "Life", "Daily", "Other"];
  const [activeTag, setActiveTag] = useState("All");

  const [accent, setAccent] = useState(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (safeParse(raw, null)?.accent ?? "#d4a5c1") : "#d4a5c1";
  });

  const [themeMode, setThemeMode] = useState(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (safeParse(raw, null)?.themeMode ?? "system") : "system"; // "light" | "dark" | "system"
  });

  const [todos, setTodos] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    if (data?.todos?.length) return data.todos;

    // fallback seed
    return [
      {
        content: "學習1",
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: 25,
        tag: "Study",
      },
      {
        content: "學習2",
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: 25,
        tag: "Study",
      },
      {
        content: "學習3",
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: 25,
        tag: "Study",
      },
    ];
  });

  // Focus mode state
  const [activeId, setActiveId] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.timer?.activeId ?? null;
  });

  const [status, setStatus] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.timer?.status ?? "idle"; // idle | running | paused
  });

  const [remainingSec, setRemainingSec] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.timer?.remainingSec ?? 0;
  });

  const endAtRef = useRef(null); // number | null

  const [showCompleted, setShowCompleted] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.ui?.showCompleted ?? false;
  });

  const isLocked = status === "running" || status === "paused";

  // -----------------------------
  // Drag reorder
  // -----------------------------
  const dragIdRef = useRef(null);
  const hoverIdRef = useRef(null);
  const draggingRef = useRef(false);
  const pendingRef = useRef(null);

  const reorderTodos = (fromId, toId) => {
    if (fromId === toId) return;

    setTodos((prev) => {
      const arr = [...prev];
      const fromIndex = arr.findIndex((t) => t.id === fromId);
      const toIndex = arr.findIndex((t) => t.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
  };

  const DRAG_THRESHOLD = 8;

  const pointerMoveHandler = (e) => {
    const pending = pendingRef.current;
    if (!pending) return;

    if (!draggingRef.current) {
      const dx = e.clientX - pending.x;
      const dy = e.clientY - pending.y;
      const dist = Math.hypot(dx, dy);
      if (dist < DRAG_THRESHOLD) return;

      draggingRef.current = true;
      dragIdRef.current = pending.id;
      hoverIdRef.current = null;

      document.body.classList.add("is-reordering");
      e.preventDefault();
    }

    if (dragIdRef.current == null) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const todoEl = el?.closest?.("[data-todo-id]");
    const hoverIdStr = todoEl?.getAttribute?.("data-todo-id");
    if (!hoverIdStr) return;

    const toId = Number(hoverIdStr);
    if (Number.isNaN(toId)) return;

    const fromId = dragIdRef.current;
    if (fromId === toId) return;
    if (hoverIdRef.current === toId) return;

    hoverIdRef.current = toId;
    reorderTodos(fromId, toId);
  };

  const pointerUpHandler = () => {
    pendingRef.current = null;
    draggingRef.current = false;
    dragIdRef.current = null;
    hoverIdRef.current = null;

    document.body.classList.remove("is-reordering");

    window.removeEventListener("pointermove", pointerMoveHandler);
    window.removeEventListener("pointerup", pointerUpHandler);
  };

  const startPointerDrag = (id, startX, startY) => {
    if (isLocked) return;
    pendingRef.current = { id, x: startX, y: startY };

    window.addEventListener("pointermove", pointerMoveHandler, {
      passive: false,
    });
    window.addEventListener("pointerup", pointerUpHandler);
  };

  // -----------------------------
  // Derived lists
  // -----------------------------
  const normalizedTodos = useMemo(
    () => todos.map((t) => ({ ...t, tag: t.tag ?? "Study" })),
    [todos],
  );

  const allIncomplete = useMemo(
    () => normalizedTodos.filter((t) => !t.isCompleted),
    [normalizedTodos],
  );

  const allCompleted = useMemo(
    () => normalizedTodos.filter((t) => t.isCompleted),
    [normalizedTodos],
  );

  const visibleIncomplete = useMemo(() => {
    if (activeTag === "All") return allIncomplete;
    return allIncomplete.filter((t) => t.tag === activeTag);
  }, [allIncomplete, activeTag]);

  const visibleCompleted = useMemo(() => {
    if (activeTag === "All") return allCompleted;
    return allCompleted.filter((t) => t.tag === activeTag);
  }, [allCompleted, activeTag]);

  const activeTodo = useMemo(
    () => todos.find((t) => t.id === activeId) || null,
    [todos, activeId],
  );

  const remainingCount = allIncomplete.length;
  const nextTodoToStart = allIncomplete[0] || null;

  // -----------------------------
  // Sound settings (mp3 alarm)
  // -----------------------------
  const [soundDataUrl, setSoundDataUrl] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.ui?.sound?.dataUrl ?? null;
  });

  const [soundName, setSoundName] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.ui?.sound?.name ?? "";
  });

  const [soundVolume, setSoundVolume] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.ui?.sound?.volume ?? 1; // 0..3.5
  });

  const [showSoundPanel, setShowSoundPanel] = useState(false);

  const audioRef = useRef(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const sourceRef = useRef(null);

  // click outside close
  const soundPanelWrapRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (!showSoundPanel) return;
      if (!soundPanelWrapRef.current) return;
      if (soundPanelWrapRef.current.contains(e.target)) return;
      setShowSoundPanel(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSoundPanel]);

  const ensureAudio = async () => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;

    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;

    // ✅ 有些 macOS 需要 user gesture 後 resume 才能播
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }

    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(a);
    }

    if (!gainRef.current) {
      gainRef.current = ctx.createGain();
      gainRef.current.gain.value = Number(soundVolume) || 1;
      sourceRef.current.connect(gainRef.current);
      gainRef.current.connect(ctx.destination);
    }

    // ✅ HTML audio 永遠 1，音量全部交給 gain
    a.volume = 1;
    return a;
  };

  const syncAudioState = () => {
    const a = audioRef.current;
    if (!a) return;
    setIsSoundPlaying(!a.paused && !a.ended);
  };

  const playAlarmSound = async () => {
    if (!soundDataUrl) return false;

    try {
      const a = await ensureAudio();

      try {
        a.pause();
        a.currentTime = 0;
      } catch {}

      a.src = soundDataUrl;

      if (gainRef.current)
        gainRef.current.gain.value = Number(soundVolume) || 1;

      const p = a.play();
      if (p && typeof p.then === "function") await p;

      syncAudioState();
      return true;
    } catch (e) {
      console.error("[alarm] play failed:", e);
      alert("mp3 play failed: " + String(e));
      return false;
    }
  };

  const playSoundNow = async () => {
    if (!soundDataUrl) return;

    try {
      const a = await ensureAudio();

      if (a.src !== soundDataUrl) a.src = soundDataUrl;

      if (gainRef.current)
        gainRef.current.gain.value = Number(soundVolume) || 1;

      // paused -> resume, playing -> restart
      if (a.paused) {
        const p = a.play();
        if (p && typeof p.then === "function") await p;
      } else {
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.then === "function") await p;
      }

      syncAudioState();
    } catch (e) {
      console.error("[sound] playSoundNow failed:", e);
      alert("Play failed: " + String(e));
    }
  };

  const togglePauseResume = async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      if (!a.paused) {
        a.pause();
        syncAudioState();
        return;
      }

      // resume
      await ensureAudio();
      if (gainRef.current)
        gainRef.current.gain.value = Number(soundVolume) || 1;

      const p = a.play();
      if (p && typeof p.then === "function") await p;

      syncAudioState();
    } catch (e) {
      console.error("[sound] togglePauseResume failed:", e);
    }
  };

  const restartSound = async () => {
    if (!soundDataUrl) return;

    try {
      const a = await ensureAudio();
      if (a.src !== soundDataUrl) a.src = soundDataUrl;

      if (gainRef.current)
        gainRef.current.gain.value = Number(soundVolume) || 1;

      a.currentTime = 0;

      const p = a.play();
      if (p && typeof p.then === "function") await p;

      syncAudioState();
    } catch (e) {
      console.error("[sound] restartSound failed:", e);
    }
  };

  const stopSound = () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
    syncAudioState();
  };

  const revokeUrlIfNeeded = (url) => {
    try {
      if (url && typeof url === "string" && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    } catch {}
  };

  const onPickMp3 = async () => {
    try {
      const path = await invoke("pick_audio");
      if (!path) return;

      // ✅ revoke old url to avoid leaks
      revokeUrlIfNeeded(soundDataUrl);

      setSoundName(path.split("/").pop() || "sound");

      const bytes = await readFile(path);
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const blob = new Blob([uint8], { type: "audio/mpeg" });

      const url = URL.createObjectURL(blob);
      setSoundDataUrl(url);
    } catch (e) {
      console.error("[Upload MP3] error:", e);
      alert("Upload dialog failed: " + String(e));
    }
  };

  const clearSound = () => {
    revokeUrlIfNeeded(soundDataUrl);
    setSoundDataUrl(null);
    setSoundName("");

    // stop if playing
    stopSound();
  };

  // keep isSoundPlaying state in sync
  useEffect(() => {
    let mounted = true;

    (async () => {
      const a = await ensureAudio();
      if (!mounted) return;

      const onPlay = () => syncAudioState();
      const onPause = () => syncAudioState();
      const onEnded = () => syncAudioState();

      a.addEventListener("play", onPlay);
      a.addEventListener("pause", onPause);
      a.addEventListener("ended", onEnded);

      return () => {
        a.removeEventListener("play", onPlay);
        a.removeEventListener("pause", onPause);
        a.removeEventListener("ended", onEnded);
      };
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when volume changes, update gain
  useEffect(() => {
    if (gainRef.current) {
      const v = Number(soundVolume);
      gainRef.current.gain.value = Number.isFinite(v) ? v : 1;
    }
  }, [soundVolume]);

  // -----------------------------
  // Notification
  // -----------------------------
  const notifiedRef = useRef(false);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  };

  const fireNotification = async ({ title, body, beep = true }) => {
    const ok = await requestNotificationPermission();

    if (ok) {
      try {
        new Notification(title, { body });
      } catch {}
    }

    const originalTitle = document.title;
    document.title = `⏰ ${title}`;
    setTimeout(() => {
      document.title = originalTitle;
    }, 2500);

    if (!beep) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.06;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 180);
      }
    } catch {}
  };

  // -----------------------------
  // Restore timer endAt from storage on first mount
  // -----------------------------
  useEffect(() => {
    if (initialLoadedRef.current) return;
    initialLoadedRef.current = true;

    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;

    const timer = data?.timer;
    if (!timer) return;

    if (timer.status === "running" && timer.endAt && timer.activeId) {
      endAtRef.current = timer.endAt;

      const secLeft = Math.ceil((timer.endAt - nowMs()) / 1000);
      if (secLeft <= 0) {
        setRemainingSec(0);
        setTimeout(() => {
          finishActive(true);
        }, 0);
      } else {
        setRemainingSec(secLeft);
        setStatus("running");
        setActiveId(timer.activeId);
      }
    }

    if (timer.status === "paused" && timer.activeId) {
      endAtRef.current = null;
      setStatus("paused");
      setActiveId(timer.activeId);
      setRemainingSec(timer.remainingSec ?? 0);
    }

    if (timer.status === "idle") {
      endAtRef.current = null;
      setStatus("idle");
      setActiveId(null);
      setRemainingSec(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Persist to localStorage
  // -----------------------------
  useEffect(() => {
    const payload = {
      todos,
      timer: {
        activeId,
        status,
        remainingSec,
        endAt: endAtRef.current,
      },
      ui: {
        showCompleted,
        sound: {
          dataUrl: soundDataUrl,
          name: soundName,
          volume: soundVolume,
        },
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    todos,
    activeId,
    status,
    remainingSec,
    showCompleted,
    soundDataUrl,
    soundName,
    soundVolume,
  ]);

  // -----------------------------
  // countdown tick
  // -----------------------------
  useEffect(() => {
    if (status !== "running") return;
    if (!activeId) return;

    if (!endAtRef.current) {
      endAtRef.current = nowMs() + remainingSec * 1000;
    }

    const timer = setInterval(() => {
      const endAt = endAtRef.current;
      if (!endAt) return;

      const secLeft = Math.ceil((endAt - nowMs()) / 1000);
      if (secLeft <= 0) {
        setRemainingSec(0);
        return;
      }
      setRemainingSec(secLeft);
    }, 250);

    return () => clearInterval(timer);
  }, [status, activeId, remainingSec]);

  // when remainingSec hits 0 while running -> play mp3 + notify + auto finish (once)
  useEffect(() => {
    const run = async () => {
      if (status !== "running") return;
      if (remainingSec !== 0) return;
      if (!activeTodo) return;
      if (notifiedRef.current) return;

      notifiedRef.current = true;

      const ok = await playAlarmSound();

      fireNotification({
        title: "Time’s up!",
        body: `Finished: ${activeTodo.content} (${activeTodo.minutes ?? 25}m)`,
        beep: !ok,
      });

      finishActive(true);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, status, activeTodo]);

  useEffect(() => {
    notifiedRef.current = false;
  }, [activeId, status]);

  // -----------------------------
  // Listen settings from Rust
  // -----------------------------
  useEffect(() => {
    let unTheme, unAccent;

    (async () => {
      unTheme = await listen("settings://theme", (e) =>
        setThemeMode(String(e.payload)),
      );
      unAccent = await listen("settings://accent", (e) =>
        setAccent(String(e.payload)),
      );
    })();

    return () => {
      unTheme?.();
      unAccent?.();
    };
  }, []);

  // -----------------------------
  // Apply theme tokens
  // -----------------------------
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);

    const applyTheme = (mode) => {
      if (mode === "light") root.dataset.theme = "light";
      else if (mode === "dark") root.dataset.theme = "dark";
      else {
        const prefersDark = window.matchMedia?.(
          "(prefers-color-scheme: dark)",
        )?.matches;
        root.dataset.theme = prefersDark ? "dark" : "light";
      }
    };

    applyTheme(themeMode);

    let mq;
    const onChange = () => themeMode === "system" && applyTheme("system");
    if (themeMode === "system" && window.matchMedia) {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener?.("change", onChange);
    }

    return () => mq?.removeEventListener?.("change", onChange);
  }, [accent, themeMode]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ accent, themeMode }));
  }, [accent, themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);

    const hex = accent.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      root.style.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.18)`);
    }
  }, [accent]);

  // -----------------------------
  // CRUD
  // -----------------------------
  const addTodo = (content, minutes, tag) => {
    setTodos([
      ...todos,
      {
        content,
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: minutes ?? 25,
        tag: tag ?? "Study",
      },
    ]);
  };

  const deleteTodo = (id) => {
    if (isLocked) return;
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const toggleComplete = (id) => {
    if (isLocked) return;
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo,
      ),
    );
  };

  const toggleIsEditing = (id) => {
    if (isLocked) return;
    setTodos(
      todos.map((todo) => {
        if (todo.id === id) return { ...todo, isEditing: !todo.isEditing };
        return { ...todo, isEditing: false };
      }),
    );
  };

  const editTodo = (id, newContent, minutes) => {
    if (isLocked) return;
    setTodos(
      todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              content: newContent,
              minutes: minutes ?? todo.minutes,
              isEditing: false,
            }
          : todo,
      ),
    );
  };

  // -----------------------------
  // Focus controls
  // -----------------------------
  const startTodo = (todo) => {
    if (!todo) return;
    if (nextTodoToStart?.id !== todo.id) return;

    setActiveId(todo.id);
    const totalSec = (todo.minutes ?? 25) * 60;

    endAtRef.current = nowMs() + totalSec * 1000;
    setRemainingSec(totalSec);
    setStatus("running");
  };

  const pauseActive = () => {
    if (status !== "running") return;
    const endAt = endAtRef.current;

    if (endAt) {
      const secLeft = Math.ceil((endAt - nowMs()) / 1000);
      setRemainingSec(Math.max(0, secLeft));
    }

    endAtRef.current = null;
    setStatus("paused");
  };

  const resumeActive = () => {
    if (!activeId) return;
    if (status !== "paused") return;

    endAtRef.current = nowMs() + remainingSec * 1000;
    setStatus("running");
  };

  const finishActive = (fromAuto = false) => {
    if (!activeId) return;

    setTodos((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, isCompleted: true, isEditing: false } : t,
      ),
    );

    endAtRef.current = null;
    setStatus("idle");
    setActiveId(null);
    setRemainingSec(0);
  };

  const headerRight = useMemo(() => {
    if (isLocked && activeId) return formatTime(remainingSec);
    return `${remainingCount}`;
  }, [isLocked, activeId, remainingSec, remainingCount]);

  return (
    <div className="menu-card">
      <div className="menu-main">
        <header className="menu-header">
          <div className="header-row">
            <div className="title-wrap">
              <h1>YC Todo</h1>
              <span className="subtitle">想她了就學習吧</span>
            </div>

            {/* ✅ 重點：header-badges 變定位容器，sound-panel absolute 才會貼著它 */}
            <div
              className="header-badges"
              style={{ position: "relative", zIndex: 10 }}
            >
              <button type="button" className="badge badge-timer">
                {headerRight}
              </button>

              <button
                type="button"
                className="badge-music"
                onClick={() => setShowSoundPanel((v) => !v)}
                aria-label="Sound"
                title="Sound"
              >
                🎵
              </button>

              {showSoundPanel && (
                <div className="sound-panel" ref={soundPanelWrapRef}>
                  <div className="sound-row">
                    <div className="sound-title">Sound</div>

                    <button
                      type="button"
                      className="sound-close"
                      onClick={() => setShowSoundPanel(false)}
                      aria-label="Close sound panel"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="sound-meta" title={soundName || ""}>
                    {soundDataUrl
                      ? `Selected: ${soundName || "mp3"}`
                      : "No sound selected"}
                  </div>

                  <div className="sound-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={onPickMp3}
                      title="Pick an mp3"
                    >
                      Upload
                    </button>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={playSoundNow}
                      disabled={!soundDataUrl}
                      title="Play"
                    >
                      Play
                    </button>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={stopSound}
                      disabled={!soundDataUrl}
                      title="Stop"
                    >
                      Stop
                    </button>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={togglePauseResume}
                      disabled={!soundDataUrl}
                      title="Pause / Resume"
                    >
                      {isSoundPlaying ? "Pause" : "Resume"}
                    </button>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={restartSound}
                      disabled={!soundDataUrl}
                      title="Restart"
                    >
                      Restart
                    </button>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={clearSound}
                      disabled={!soundDataUrl}
                      title="Clear"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="sound-slider">
                    <div className="muted">Volume</div>
                    <input
                      type="range"
                      min="0"
                      max="3.5"
                      step="0.05"
                      value={Number(soundVolume) || 1}
                      onChange={(e) => setSoundVolume(e.target.value)}
                    />
                    <div className="muted">
                      {Number(soundVolume || 1).toFixed(2)}x
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <CreateForm addTodo={addTodo} isLocked={isLocked} />

        <div className="section-title">
          <span>Now</span>
          <span className="muted">{remainingCount} remaining</span>
        </div>

        <div className="now-section">
          <div className="tag-bar">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`tag-chip ${activeTag === t ? "active" : ""}`}
                onClick={() => setActiveTag(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="now-list">
            {visibleIncomplete.map((todo, index) => {
              const isActive = todo.id === activeId;
              const canStart = !isLocked && nextTodoToStart?.id === todo.id;

              return (
                <Todo
                  key={todo.id}
                  todo={todo}
                  order={index + 1}
                  deleteTodo={deleteTodo}
                  toggleComplete={toggleComplete}
                  toggleIsEditing={toggleIsEditing}
                  editTodo={editTodo}
                  isLocked={isLocked}
                  isActive={isActive}
                  canStart={canStart}
                  status={status}
                  onStart={() => {
                    if (!isActive) return startTodo(todo);
                    if (status === "running") return pauseActive();
                    if (status === "paused") return resumeActive();
                  }}
                  onPause={pauseActive}
                  onFinish={() => finishActive(false)}
                  onPointerDragStart={startPointerDrag}
                />
              );
            })}
          </div>
        </div>

        <div className="completed-panel">
          <button
            className="collapse-btn"
            onClick={() => setShowCompleted((v) => !v)}
            disabled={visibleCompleted.length === 0}
            aria-label="Toggle completed"
          >
            <span>Completed</span>
            <span className="muted">
              {visibleCompleted.length === 0
                ? "0"
                : `${visibleCompleted.length} ${showCompleted ? "▾" : "▸"}`}
            </span>
          </button>

          {showCompleted && visibleCompleted.length > 0 && (
            <div className="completed-list">
              {visibleCompleted.map((todo) => (
                <Todo
                  key={todo.id}
                  todo={todo}
                  hideOrder
                  deleteTodo={deleteTodo}
                  toggleComplete={toggleComplete}
                  toggleIsEditing={toggleIsEditing}
                  editTodo={editTodo}
                  isLocked={isLocked}
                  isActive={todo.id === activeId}
                  canStart={false}
                  status={status}
                  onStart={() => {}}
                  onPause={() => {}}
                  onFinish={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="footer-bar">
        <button
          className="btn ghost"
          disabled={!isLocked || status !== "running"}
          onClick={pauseActive}
        >
          Pause
        </button>
        <button
          className="btn ghost"
          disabled={!isLocked || status !== "paused"}
          onClick={resumeActive}
        >
          Resume
        </button>
        <button
          className="btn"
          disabled={!isLocked}
          onClick={() => finishActive(false)}
        >
          Finish
        </button>
      </div>
    </div>
  );
}

export default TodoWrapper;
