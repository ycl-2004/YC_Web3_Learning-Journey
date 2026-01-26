import CreateForm from "./CreateForm";
import Todo from "./Todo";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { listen } from "@tauri-apps/api/event";

const STORAGE_KEY = "menubar_todo_v1"; // ✅ 保留
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
      },
      {
        content: "學習2",
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: 25,
      },
      {
        content: "學習3",
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: 25,
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

  // remainingSec is UI state; for running we derive from endAt
  const [remainingSec, setRemainingSec] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.timer?.remainingSec ?? 0;
  });

  // endAt is a timestamp in ms for running countdown
  const endAtRef = useRef(null); // number | null

  // UI state: completed collapse
  const [showCompleted, setShowCompleted] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw, null) : null;
    return data?.ui?.showCompleted ?? false;
  });

  const isLocked = status === "running" || status === "paused";

  const activeTodo = useMemo(
    () => todos.find((t) => t.id === activeId) || null,
    [todos, activeId],
  );

  const incompleteTodos = useMemo(
    () => todos.filter((t) => !t.isCompleted),
    [todos],
  );

  const completedTodos = useMemo(
    () => todos.filter((t) => t.isCompleted),
    [todos],
  );

  const remainingCount = incompleteTodos.length;
  const nextTodoToStart = incompleteTodos[0] || null;

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
    return data?.ui?.sound?.volume ?? 0.6; // 0..1
  });

  const [showSoundPanel, setShowSoundPanel] = useState(false);

  const audioRef = useRef(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  //const fileInputRef = useRef(null);

  // click outside to close sound panel
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

  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  };

  const playAlarmSound = async () => {
    if (!soundDataUrl) {
      console.warn("[alarm] no soundDataUrl");
      return false;
    }

    try {
      const a = ensureAudio();

      // ✅ 先停掉旧的
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}

      a.src = soundDataUrl;

      // 这里用你选的音量
      a.volume = Math.max(0, Math.min(1, Number(soundVolume) || 0.6));

      console.log("[alarm] play()", {
        srcPrefix: String(soundDataUrl).slice(0, 30),
        volume: a.volume,
        readyState: a.readyState,
      });

      const p = a.play();
      if (p && typeof p.then === "function") await p;

      console.log("[alarm] ✅ playing");
      return true;
    } catch (e) {
      console.error("[alarm] ❌ play failed:", e);
      alert("mp3 play failed: " + String(e));
      return false;
    }
  };

  const syncAudioState = () => {
    const a = audioRef.current;
    if (!a) return;
    setIsSoundPlaying(!a.paused && !a.ended);
  };

  const playSoundNow = async () => {
    if (!soundDataUrl) return;

    try {
      const a = ensureAudio();

      // ✅ 设置 src/音量（如果 src 变了或没设过）
      if (a.src !== soundDataUrl) a.src = soundDataUrl;
      a.volume = Math.max(0, Math.min(1, Number(soundVolume) || 0.6));

      // 如果是暂停状态，直接继续；否则从头播
      if (a.paused) {
        const p = a.play();
        if (p && typeof p.then === "function") await p;
      } else {
        // 正在播：也可以选择不处理；我这里让它从头重播更符合 “Play” 直觉
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

      // paused -> resume
      a.volume = Math.max(0, Math.min(1, Number(soundVolume) || 0.6));
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
      const a = ensureAudio();
      if (a.src !== soundDataUrl) a.src = soundDataUrl;

      a.volume = Math.max(0, Math.min(1, Number(soundVolume) || 0.6));
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

  const onPickMp3 = async () => {
    try {
      console.log("[Upload MP3] clicked");

      const path = await invoke("pick_audio"); // Rust 回传 string 或 null
      console.log("[Upload MP3] picked:", path);
      if (!path) return;

      setSoundName(path.split("/").pop() || "sound");

      const bytes = await readFile(path);

      // ✅ 关键：bytes 转成 Uint8Array，确保 Blob 正确
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const blob = new Blob([uint8], { type: "audio/mpeg" });

      const url = URL.createObjectURL(blob);
      setSoundDataUrl(url);
    } catch (e) {
      console.error("[Upload MP3] error:", e);
      console.error("Upload dialog failed", e);
    }
  };

  const clearSound = () => {
    setSoundDataUrl(null);
    setSoundName("");
  };

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
  // Persist to localStorage whenever important state changes
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
  // countdown tick (uses endAt when running)
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
        beep: !ok, // ✅ mp3失败才 beep
      });

      // 3) 完成任务
      finishActive(true);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, status, activeTodo]);

  // reset notified flag when switching task / leaving running state
  useEffect(() => {
    notifiedRef.current = false;
  }, [activeId, status]);

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
  // ----------------------------- music part
  useEffect(() => {
    const a = ensureAudio();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    a.volume = Math.max(0, Math.min(1, Number(soundVolume) || 0.6));
  }, [soundVolume]);

  // -- Color --
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);

    const applyTheme = (mode) => {
      if (mode === "light") root.dataset.theme = "light";
      else if (mode === "dark") root.dataset.theme = "dark";
      else {
        // system
        const prefersDark = window.matchMedia?.(
          "(prefers-color-scheme: dark)",
        )?.matches;
        root.dataset.theme = prefersDark ? "dark" : "light";
      }
    };

    applyTheme(themeMode);

    // system 模式下监听系统变化
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

    // 简单把 #RRGGBB -> rgba(r,g,b,0.18)
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
  const addTodo = (content, minutes) => {
    setTodos([
      ...todos,
      {
        content,
        id: Math.random(),
        isCompleted: false,
        isEditing: false,
        minutes: minutes ?? 25,
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
      <header className="menu-header">
        <div className="header-row">
          <div className="title-wrap">
            <h1>Todo</h1>
          </div>

          {/* 🎵 + 3 badge */}
          <div className="header-badges" ref={soundPanelWrapRef}>
            <button
              type="button"
              className="badge badge-circle badge-music"
              onClick={() => setShowSoundPanel((v) => !v)}
              aria-label="Sound settings"
              title={soundName ? `Sound: ${soundName}` : "Set timer sound"}
            >
              🎵
            </button>

            <span
              className={`badge badge-circle ${isLocked ? "badge-timer" : ""}`}
            >
              {headerRight}
            </span>

            {showSoundPanel && (
              <div className="sound-panel">
                <div className="sound-row">
                  <div className="sound-title">Timer Sound</div>
                  <button
                    type="button"
                    className="sound-close"
                    onClick={() => setShowSoundPanel(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="sound-meta">
                  {soundName ? soundName : "No sound selected"}
                </div>

                <div className="sound-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={onPickMp3}
                    disabled={false}
                  >
                    Upload MP3
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={playSoundNow}
                    disabled={!soundDataUrl}
                  >
                    Play
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={togglePauseResume}
                    disabled={!soundDataUrl}
                  >
                    {isSoundPlaying ? "Pause" : "Resume"}
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={restartSound}
                    disabled={!soundDataUrl}
                  >
                    Restart
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={clearSound}
                    disabled={!soundDataUrl}
                  >
                    Clear
                  </button>
                </div>

                <div className="sound-slider">
                  <span className="muted">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="subtitle">
          {isLocked
            ? "Focus mode: other tasks are locked"
            : "Quick tasks for your menubar workflow"}
        </p>
      </header>

      <CreateForm addTodo={addTodo} isLocked={isLocked} />

      <div className="section-title">
        <span>Now</span>
        <span className="muted">{remainingCount} remaining</span>
      </div>

      <div className="todo-list">
        {incompleteTodos.length === 0 ? (
          <p className="empty">✨ No active tasks. Add one above.</p>
        ) : (
          incompleteTodos.map((todo) => {
            const isActive = todo.id === activeId;
            const canStart = !isLocked && nextTodoToStart?.id === todo.id;

            return (
              <Todo
                key={todo.id}
                todo={todo}
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
              />
            );
          })
        )}
      </div>

      <div className="completed-panel">
        <button
          className="collapse-btn"
          onClick={() => setShowCompleted((v) => !v)}
          disabled={completedTodos.length === 0}
          aria-label="Toggle completed"
        >
          <span>Completed</span>
          <span className="muted">
            {completedTodos.length === 0
              ? "0"
              : `${completedTodos.length} ${showCompleted ? "▾" : "▸"}`}
          </span>
        </button>

        {showCompleted && completedTodos.length > 0 && (
          <div className="completed-list">
            {completedTodos.map((todo) => (
              <Todo
                key={todo.id}
                todo={todo}
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
