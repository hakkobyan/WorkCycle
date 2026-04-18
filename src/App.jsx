import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Trash2 } from "lucide-react";
import { AnimatedCircularProgressBar } from "./components/ui/animated-circular-progress-bar";
import { GlassCard as EinGlassCard } from "./components/ui/glass-card";
import { GlassInput } from "./components/ui/glass-input";
import GradientBackground from "./components/ui/gradient-background";
import "./styles.css";

const STORAGE_KEYS = {
  sessions: "pomodoro.sessions",
  tasks: "pomodoro.tasks",
};

const POMODORO_SECONDS = 25 * 60;

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function readStoredItems(key) {
  try {
    const storedItems = window.localStorage.getItem(key);
    return storedItems ? JSON.parse(storedItems) : [];
  } catch {
    return [];
  }
}

function useStoredList(key) {
  const [items, setItems] = useState(() => readStoredItems(key));

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(items));
  }, [items, key]);

  return [items, setItems];
}

function createItem(text, sessionId) {
  return {
    id: crypto.randomUUID(),
    text,
    sessionId,
    createdAt: new Date().toISOString(),
    focusSeconds: 0,
  };
}

function createSession(name) {
  const startedAt = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name,
    startedAt,
    lastSeenAt: startedAt,
    durationSeconds: 0,
    taskSeconds: {},
  };
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSpentTime(totalSeconds = 0) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSessionDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function MiniChart({ data }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [displayValue, setDisplayValue] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const chartData = data.filter((item) => item.value > 0).slice(0, 7);
  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  useEffect(() => {
    if (hoveredIndex !== null && chartData[hoveredIndex]) {
      setDisplayValue(chartData[hoveredIndex].value);
    }
  }, [chartData, hoveredIndex]);

  function handleContainerLeave() {
    setIsHovering(false);
    setHoveredIndex(null);
    window.setTimeout(() => {
      setDisplayValue(null);
    }, 150);
  }

  return (
    <div
      className={`mini-chart${chartData.length === 0 ? " is-empty" : ""}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleContainerLeave}
    >
      <div className="mini-chart-header">
        <div className="mini-chart-title">
          <span aria-hidden="true" />
          <strong>Activity</strong>
        </div>
        <div className={`mini-chart-value${isHovering && displayValue !== null ? " is-visible" : ""}`}>
          {displayValue !== null ? formatSpentTime(displayValue) : ""}
        </div>
      </div>
      <div className="mini-chart-bars">
        {chartData.length === 0 ? (
          <div className="mini-chart-empty">No timer data yet</div>
        ) : null}
        {chartData.map((item, index) => {
          const isHovered = hoveredIndex === index;
          const isAnyHovered = hoveredIndex !== null;
          const isNeighbor =
            hoveredIndex !== null && (index === hoveredIndex - 1 || index === hoveredIndex + 1);
          const stateClass = isHovered
            ? " is-hovered"
            : isNeighbor
              ? " is-neighbor"
              : isAnyHovered
                ? " is-muted"
                : "";

          return (
            <div
              key={item.label}
              className="mini-chart-bar-wrap"
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <div
                className={`mini-chart-bar${stateClass}`}
                style={{ height: `${(item.value / maxValue) * 72}px` }}
              />
              <span className={isHovered ? "is-hovered" : undefined}>{item.label.charAt(0)}</span>
              <div className={`mini-chart-tooltip${isHovered ? " is-visible" : ""}`}>
                {formatSpentTime(item.value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlassCard({ className = "", children }) {
  return (
    <div className={cn("glass-card-frame", className)}>
      <EinGlassCard glowEffect className="glass-card-shell">
        {children}
      </EinGlassCard>
    </div>
  );
}

function GlassCardHeader({ className = "", children }) {
  return <div className={cn("glass-card-header", className)}>{children}</div>;
}

function GlassCardTitle({ className = "", children }) {
  return <h3 className={cn("glass-card-title", className)}>{children}</h3>;
}

function GlassCardDescription({ className = "", children }) {
  return <p className={cn("glass-card-description", className)}>{children}</p>;
}

function GlassCardContent({ className = "", children }) {
  return <div className={cn("glass-card-content", className)}>{children}</div>;
}

function GlassCardFooter({ className = "", children }) {
  return <div className={cn("glass-card-footer", className)}>{children}</div>;
}

function GlassButton({ className = "", variant = "primary", type = "button", children, ...props }) {
  return (
    <button
      type={type}
      className={cn("glass-button", `glass-button-${variant}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tasks, setTasks] = useStoredList(STORAGE_KEYS.tasks);
  const [sessions, setSessions] = useStoredList(STORAGE_KEYS.sessions);
  const [taskText, setTaskText] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(POMODORO_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const taskListRef = useRef(null);
  const taskCountRef = useRef(tasks.length);
  const activeSessionBaseRef = useRef({ durationSeconds: 0, resumedAt: 0 });
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const summarySession = selectedSession ?? activeSession;
  const selectedSessionTasks = Object.entries(selectedSession?.taskSeconds ?? {})
    .map(([taskId, seconds]) => ({
      id: taskId,
      text: tasks.find((task) => task.id === taskId)?.text ?? "Deleted task",
      seconds,
    }))
    .filter((task) => task.seconds > 0)
    .sort((firstTask, secondTask) => secondTask.seconds - firstTask.seconds);
  const focusChartData = tasks
    .map((task) => ({ label: task.text, value: task.focusSeconds ?? 0 }))
    .sort((firstTask, secondTask) => secondTask.value - firstTask.value);
  const selectedSessionIndex = sessions.findIndex((session) => session.id === selectedSessionId);
  const timerProgress = POMODORO_SECONDS - timerSeconds;
  const taskHistorySession = selectedSession?.id !== activeSessionId ? selectedSession : null;
  const taskListSession = selectedSession ?? activeSession;
  const isViewingTaskHistory = Boolean(taskHistorySession);
  const visibleTasks = taskListSession
    ? [
        ...tasks
          .filter((task) => task.sessionId === taskListSession.id)
          .map((task) => ({
          id: task.id,
          text: task.text,
          displaySeconds:
            taskListSession.id === activeSessionId
              ? task.focusSeconds ?? 0
              : taskListSession.taskSeconds?.[task.id] ?? 0,
          isDeleted: false,
        })),
        ...(taskHistorySession
          ? selectedSessionTasks
          .filter((task) => !tasks.some((savedTask) => savedTask.id === task.id))
          .map((task) => ({
            id: task.id,
            text: task.text,
            displaySeconds: task.seconds,
            isDeleted: true,
          }))
          : []),
      ]
    : tasks.map((task) => ({
        ...task,
        displaySeconds: task.focusSeconds ?? 0,
        isDeleted: false,
      }));

  useEffect(() => {
    function syncPointer(event) {
      const x = event.clientX.toFixed(2);
      const y = event.clientY.toFixed(2);
      const xp = (event.clientX / window.innerWidth).toFixed(2);

      document.documentElement.style.setProperty("--x", x);
      document.documentElement.style.setProperty("--y", y);
      document.documentElement.style.setProperty("--xp", xp);
    }

    window.addEventListener("pointermove", syncPointer);
    return () => window.removeEventListener("pointermove", syncPointer);
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return undefined;
    }

    const initialSession = readStoredItems(STORAGE_KEYS.sessions).find(
      (session) => session.id === activeSessionId,
    );
    activeSessionBaseRef.current = {
      durationSeconds: initialSession?.durationSeconds ?? 0,
      resumedAt: Date.now(),
    };

    function updateActiveSession() {
      const durationSeconds = Math.max(
        0,
        activeSessionBaseRef.current.durationSeconds +
          Math.round((Date.now() - activeSessionBaseRef.current.resumedAt) / 1000),
      );
      const lastSeenAt = new Date().toISOString();

      setSessions((currentSessions) => {
        if (!currentSessions.some((session) => session.id === activeSessionId)) {
          return currentSessions;
        }

        const nextSessions = currentSessions.map((session) =>
          session.id === activeSessionId
            ? { ...session, durationSeconds, lastSeenAt }
            : session,
        );

        window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(nextSessions));

        return nextSessions;
      });
    }

    const sessionTimerId = window.setInterval(updateActiveSession, 1000);
    window.addEventListener("beforeunload", updateActiveSession);

    return () => {
      window.clearInterval(sessionTimerId);
      window.removeEventListener("beforeunload", updateActiveSession);
      updateActiveSession();
    };
  }, [activeSessionId, setSessions]);

  useEffect(() => {
    if (taskListRef.current && tasks.length > taskCountRef.current) {
      taskListRef.current.scrollTop = taskListRef.current.scrollHeight;
    }

    taskCountRef.current = tasks.length;
  }, [tasks]);

  useEffect(() => {
    const fallbackSessionId = activeSessionId ?? selectedSessionId;

    if (!fallbackSessionId || !tasks.some((task) => !task.sessionId)) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.sessionId ? task : { ...task, sessionId: fallbackSessionId })),
    );
  }, [activeSessionId, selectedSessionId, setTasks, tasks]);

  useEffect(() => {
    if (!timerRunning || !activeTaskId) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setTimerSeconds((currentSeconds) => {
        if (currentSeconds <= 0) {
          window.clearInterval(timerId);
          setTimerRunning(false);
          return 0;
        }

        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task.id === activeTaskId
              ? { ...task, focusSeconds: (task.focusSeconds ?? 0) + 1 }
              : task,
          ),
        );

        if (activeSessionId) {
          setSessions((currentSessions) =>
            currentSessions.map((session) =>
              session.id === activeSessionId
                ? {
                    ...session,
                    taskSeconds: {
                      ...(session.taskSeconds ?? {}),
                      [activeTaskId]: (session.taskSeconds?.[activeTaskId] ?? 0) + 1,
                    },
                  }
                : session,
            ),
          );
        }

        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          setTimerRunning(false);
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activeSessionId, activeTaskId, setSessions, setTasks, timerRunning]);

  function addTask(event) {
    event.preventDefault();
    const text = taskText.trim();

    if (!text) {
      return;
    }

    setTasks((currentTasks) => [...currentTasks, createItem(text, taskListSession?.id ?? null)]);
    setTaskText("");
  }

  function removeTask(taskId) {
    if (taskId === activeTaskId) {
      setActiveTaskId(null);
      setTimerRunning(false);
    }

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  }

  function selectTask(taskId) {
    setActiveTaskId(taskId);
    setTimerRunning(false);
    setTimerSeconds(POMODORO_SECONDS);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerSeconds(POMODORO_SECONDS);
  }

  function openSettings() {
    setSettingsClosing(false);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsClosing(true);
    window.setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
    }, 180);
  }

  function startNewSession(event) {
    event.preventDefault();
    const name = sessionName.trim();

    if (!name) {
      return;
    }

    const session = createSession(name);
    const nextSessions = [...readStoredItems(STORAGE_KEYS.sessions), session];

    window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(nextSessions));
    setSessions(nextSessions);
    setActiveSessionId(session.id);
    setSelectedSessionId(session.id);
    setSessionName("");
  }

  function stopSession() {
    setActiveSessionId(null);
  }

  function removeSession(sessionId) {
    if (sessionId === activeSessionId) {
      setActiveSessionId(null);
    }

    if (sessionId === selectedSessionId) {
      setSelectedSessionId(null);
    }

    setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
  }

  function selectSession(sessionId) {
    setSelectedSessionId(sessionId);
  }

  function moveSelectedSession(direction) {
    if (sessions.length === 0) {
      return;
    }

    const currentIndex = selectedSessionIndex >= 0 ? selectedSessionIndex : sessions.length - 1;
    const nextIndex = (currentIndex + direction + sessions.length) % sessions.length;
    setSelectedSessionId(sessions[nextIndex].id);
  }

  return (
    <main className="app-shell" aria-label="Pomodoro dashboard">
      <GradientBackground />
      <GlassCard className="top-menu-frame">
        <header className="top-menu" aria-label="Main menu">
          <div className="menu-title">Pomodoro</div>
          <div className="settings-area">
            <button
              className="settings-button"
              type="button"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-controls="settings-popup"
              onClick={() => {
                if (settingsOpen) {
                  closeSettings();
                } else {
                  openSettings();
                }
              }}
            >
              <Settings aria-hidden="true" size={20} strokeWidth={2.5} />
            </button>
          </div>
        </header>
      </GlassCard>
      {settingsOpen ? (
        <div
          className={`settings-overlay${settingsClosing ? " is-closing" : ""}`}
          role="presentation"
          onClick={closeSettings}
        >
          <div
            id="settings-popup"
            className="settings-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div id="settings-title" className="settings-popup-title">
              Settings
            </div>
            <button type="button" onClick={closeSettings}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      <section className="board" aria-label="Pomodoro board frame">
        <div className="board-row board-row-top">
          <GlassCard className="panel-small">
          <section className="panel" aria-labelledby="timer-title">
            <div className="panel-header">
              <h1 id="timer-title">Timer</h1>
            </div>
            <div className="timer-card" aria-live="polite">
                <div className="timer-progress">
                  <AnimatedCircularProgressBar
                    max={POMODORO_SECONDS}
                    min={0}
                    value={timerProgress}
                    gaugePrimaryColor="#faeb92"
                    gaugeSecondaryColor="rgb(255 255 255 / 18%)"
                    className="timer-progress-ring"
                  />
                  <div className="timer-display">{formatTimer(timerSeconds)}</div>
                </div>
                <div className="timer-task">
                  <strong>{activeTask ? activeTask.text : "Choose a task"}</strong>
                </div>
                <div className="timer-spent">
                  Spent {formatSpentTime(activeTask?.focusSeconds)} on this task
                </div>
              <div className="timer-actions">
                <button
                  type="button"
                    onClick={() => setTimerRunning((isRunning) => !isRunning)}
                    disabled={!activeTask || timerSeconds === 0}
                  >
                    {timerRunning ? "Pause" : "Start"}
                </button>
                <button type="button" onClick={resetTimer}>
                    Reset
                </button>
              </div>
                <div className="timer-status">
                  {timerSeconds === 0
                    ? "Time for a break."
                    : timerRunning
                      ? "Focus is running."
                      : activeTask
                      ? "Ready to focus."
                        : "Pick a task to start."}
                </div>
            </div>
          </section>
          </GlassCard>
          <GlassCard className="panel-wide">
          <section className="panel" aria-labelledby="tasks-title">
            <div className="panel-header">
              <h1 id="tasks-title">Tasks</h1>
            </div>
            <form className="entry-form" onSubmit={addTask}>
              <div className="entry-row">
                <GlassInput
                  className="glass-input-control"
                  id="task-input"
                  type="text"
                  value={taskText}
                  onChange={(event) => setTaskText(event.target.value)}
                  placeholder="What needs focus?"
                />
                <button type="submit">Add</button>
              </div>
            </form>
            <ul ref={taskListRef} className="item-list" aria-label="Saved tasks">
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <li
                    key={task.id}
                    className={`${task.id === activeTaskId ? "is-active" : ""}${
                      isViewingTaskHistory ? " is-session-task" : ""
                    }`.trim()}
                  >
                    <span>{task.text}</span>
                    <span className="task-time">{formatSpentTime(task.displaySeconds)}</span>
                    {isViewingTaskHistory || task.isDeleted ? null : (
                      <>
                        <button type="button" onClick={() => selectTask(task.id)}>
                          {task.id === activeTaskId ? "Selected" : "Focus"}
                        </button>
                        <button type="button" aria-label={`Delete task ${task.text}`} onClick={() => removeTask(task.id)}>
                          <Trash2 aria-hidden="true" size={15} strokeWidth={2.5} />
                        </button>
                      </>
                    )}
                  </li>
                ))
              ) : (
                <li className="item-list-empty">
                  <span>No tasks yet.</span>
                </li>
              )}
            </ul>
          </section>
          </GlassCard>
        </div>
        <div className="board-row board-row-bottom">
          <GlassCard className="panel-half">
          <section className="panel" aria-labelledby="sessions-title">
            <div className="panel-header">
              <h2 id="sessions-title">Sessions</h2>
            </div>
            <form className="session-form" onSubmit={startNewSession}>
              <GlassInput
                className="glass-input-control glass-input-control-session"
                type="text"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="Session name"
              />
              <button className="session-action" type="submit">
                New session
              </button>
            </form>
            <div className="session-summary">
              <div>
                <div className="session-summary-copy">
                  <strong>{summarySession ? summarySession.name || formatSessionDate(summarySession.startedAt) : "None"}</strong>
                  <em>{formatSpentTime(summarySession?.durationSeconds)}</em>
                </div>
                <div className="session-summary-arrows" aria-label="Browse sessions">
                  <button
                    type="button"
                    aria-label="Previous session"
                    onClick={() => moveSelectedSession(-1)}
                    disabled={sessions.length === 0}
                  >
                    <ChevronLeft aria-hidden="true" size={16} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next session"
                    onClick={() => moveSelectedSession(1)}
                    disabled={sessions.length === 0}
                  >
                    <ChevronRight aria-hidden="true" size={16} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete shown session"
                    onClick={() => {
                      if (summarySession) {
                        removeSession(summarySession.id);
                      }
                    }}
                    disabled={!summarySession}
                  >
                    <Trash2 aria-hidden="true" size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
            {activeSession ? (
              <button className="session-stop" type="button" onClick={stopSession}>
                Stop session
              </button>
            ) : null}
            <div className="session-details" aria-live="polite">
              <div className="session-details-title">
                <span>Viewed session</span>
                <strong>
                  {selectedSession
                    ? selectedSession.name || formatSessionDate(selectedSession.startedAt)
                    : "Choose a session"}
                </strong>
              </div>
              {selectedSessionTasks.length > 0 ? (
                <ul className="session-task-list" aria-label="Session task time">
                  {selectedSessionTasks.map((task) => (
                    <li key={task.id}>
                      <span>{task.text}</span>
                      <strong>{formatSpentTime(task.seconds)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="session-empty">No task time saved for this session yet.</p>
              )}
            </div>
          </section>
          </GlassCard>
          <GlassCard className="panel-half">
          <section className="panel" aria-labelledby="activity-title">
            <div className="panel-header">
              <h2 id="activity-title">Charts</h2>
            </div>
            <div className="chart-grid">
                <div className="chart-mini-card">
                  <MiniChart data={focusChartData} />
                </div>
                <div className="chart-mini-card chart-placeholder">
                  <span>Focus</span>
                </div>
                <div className="chart-mini-card chart-placeholder">
                  <span>Tasks</span>
                </div>
                <div className="chart-mini-card chart-placeholder">
                  <span>Sessions</span>
                </div>
            </div>
          </section>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
