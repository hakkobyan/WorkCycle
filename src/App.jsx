import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";
import { AnimatedCircularProgressBar } from "./components/ui/animated-circular-progress-bar";
import {
  GlassSelect,
  GlassSelectContent,
  GlassSelectItem,
  GlassSelectTrigger,
  GlassSelectValue,
} from "./components/glass-select";
import { GlassCard as EinGlassCard } from "./components/ui/glass-card";
import { GlassInput } from "./components/ui/glass-input";
import { GlassSlider } from "./components/ui/glass-slider";
import GradientBackground from "./components/ui/gradient-background";
import "./styles.css";

const STORAGE_KEYS = {
  sessions: "pomodoro.sessions",
  tasks: "pomodoro.tasks",
  cardTransparency: "pomodoro.cardTransparency",
  cardOrder: "pomodoro.cardOrder",
};

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const DEFAULT_CARD_ORDER = ["tasks", "analytics", "timer", "sessions"];

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function formatDashboardDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function calculateSessionStreak(sessions) {
  if (!sessions.length) return 0;

  const uniqueDays = new Set(
    sessions.map((session) => {
      const date = new Date(session.startedAt);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }),
  );

  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let streak = 0;

  while (uniqueDays.has(cursor)) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }

  return streak;
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
    remainingFocusSeconds: null,
    completed: false,
  };
}

function readStoredNumber(key, fallbackValue) {
  try {
    const storedValue = window.localStorage.getItem(key);
    const parsedValue = storedValue === null ? NaN : Number(storedValue);

    return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function sanitizeCardOrder(value) {
  const source = Array.isArray(value) ? value : [];
  const uniqueItems = source.filter(
    (entry, index) => DEFAULT_CARD_ORDER.includes(entry) && source.indexOf(entry) === index,
  );

  return [
    ...uniqueItems,
    ...DEFAULT_CARD_ORDER.filter((entry) => !uniqueItems.includes(entry)),
  ];
}

function readStoredCardOrder() {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEYS.cardOrder);
    return sanitizeCardOrder(storedValue ? JSON.parse(storedValue) : DEFAULT_CARD_ORDER);
  } catch {
    return [...DEFAULT_CARD_ORDER];
  }
}

function chunkItems(items, size) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function moveItem(items, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
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

function createAutoSessionName(existingSessions) {
  const baseName = "session";
  const usedIndices = new Set();

  existingSessions.forEach((session) => {
    const match = session.name?.trim().match(/^session(\d+)$/i);

    if (!match) {
      return;
    }

    usedIndices.add(Number(match[1]));
  });

  let nextIndex = 1;

  while (usedIndices.has(nextIndex)) {
    nextIndex += 1;
  }

  return `${baseName}${nextIndex}`;
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

function playTimerBell(audioContext) {
  const now = audioContext.currentTime;
  const notes = [880, 1174.66, 880];

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startsAt = now + index * 0.18;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.2, startsAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.16);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.18);
  });
}

function formatChartTick(minutes) {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }

  return `${Math.round(minutes)}m`;
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

function WeeklyTimeSpentChart({ sessions, selectedSession }) {
  const days = [
    { short: "Mon", full: "Monday" },
    { short: "Tue", full: "Tuesday" },
    { short: "Wed", full: "Wednesday" },
    { short: "Thu", full: "Thursday" },
    { short: "Fri", full: "Friday" },
    { short: "Sat", full: "Saturday" },
    { short: "Sun", full: "Sunday" },
  ];
  const chartData = days.map((day) => ({ ...day, seconds: 0 }));
  let sessionDayIndex = null;

  sessions.forEach((session) => {
    const date = new Date(session.startedAt);

    if (!Number.isNaN(date.getTime())) {
      const dayIndex = (date.getDay() + 6) % 7;

      chartData[dayIndex].seconds += session.durationSeconds ?? 0;
    }
  });

  if (selectedSession) {
    const date = new Date(selectedSession.startedAt);

    if (!Number.isNaN(date.getTime())) {
      sessionDayIndex = (date.getDay() + 6) % 7;
    }
  }

  const sessionTitle = selectedSession
    ? selectedSession.name || formatSessionDate(selectedSession.startedAt)
    : "All sessions";
  const sessionSeconds = selectedSession?.durationSeconds ?? chartData.reduce(
    (totalSeconds, item) => totalSeconds + item.seconds,
    0,
  );

  const maxSeconds = Math.max(...chartData.map((item) => item.seconds), 60);
  const maxMinutes = Math.max(1, Math.ceil(maxSeconds / 60));
  const roundedMaxMinutes = Math.max(5, Math.ceil(maxMinutes / 5) * 5);
  const scaleMaxSeconds = roundedMaxMinutes * 60;
  const timeTicks = [roundedMaxMinutes, roundedMaxMinutes * 0.75, roundedMaxMinutes * 0.5, roundedMaxMinutes * 0.25];
  const hasData = chartData.some((item) => item.seconds > 0);
  const activeDay = sessionDayIndex;

  return (
    <div className="weekly-chart" aria-label="Time spent by day of week">
      <div className="weekly-chart-session">
        <span>{sessionTitle}</span>
        <strong>{formatSpentTime(sessionSeconds)}</strong>
      </div>
      <div className="weekly-chart-body">
        <div className="weekly-chart-scale" aria-hidden="true">
          {timeTicks.map((tick) => (
            <span key={tick}>{formatChartTick(tick)}</span>
          ))}
        </div>
        <div className="weekly-chart-plot">
          {chartData.map((item, index) => (
            <div
              className={`weekly-chart-column${activeDay === index ? " is-active" : ""}`}
              key={item.short}
            >
              <div className="weekly-chart-track">
                <div
                  className="weekly-chart-bar"
                  style={{
                    height: hasData ? `${(item.seconds / scaleMaxSeconds) * 100}%` : "0%",
                  }}
                  title={`${item.full}: ${formatSpentTime(item.seconds)}`}
                />
              </div>
              <span title={item.full}>{item.short}</span>
            </div>
          ))}
          {!hasData ? <div className="weekly-chart-empty">No session time yet</div> : null}
        </div>
      </div>
    </div>
  );
}

function GlassCard({ className = "", children }) {
  return (
    <div className={cn("glass-card-frame", className)}>
      <EinGlassCard glowEffect={false} className="glass-card-shell">
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
  const [activeView, setActiveView] = useState("Dashboard");
  const [tasks, setTasks] = useStoredList(STORAGE_KEYS.tasks);
  const [sessions, setSessions] = useStoredList(STORAGE_KEYS.sessions);
  const [taskText, setTaskText] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [cardTransparency, setCardTransparency] = useState(() =>
    readStoredNumber(STORAGE_KEYS.cardTransparency, 4),
  );
  const [cardOrder, setCardOrder] = useState(() => readStoredCardOrder());
  const [draftCardOrder, setDraftCardOrder] = useState(() => readStoredCardOrder());
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [timerMode, setTimerMode] = useState("focus");
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const audioContextRef = useRef(null);
  const taskListRef = useRef(null);
  const taskCountRef = useRef(tasks.length);
  const activeSessionBaseRef = useRef({ durationSeconds: 0, resumedAt: 0 });
  const sessionSwipeRef = useRef({ x: null, y: null });
  const taskSwipeRef = useRef({ x: null, y: null, taskId: null });
  const dragStateRef = useRef({ active: false, cardId: null, lastTargetId: null });
  const settingsCloseTimeoutRef = useRef(null);
  const sessionNameInputRef = useRef(null);
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
  const selectedSessionIndex = sessions.findIndex((session) => session.id === selectedSessionId);
  const sessionStreak = calculateSessionStreak(sessions);
  const dashboardDate = formatDashboardDate();
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const timerDuration = timerMode === "rest" ? breakDuration : focusDuration;
  const timerProgress = timerDuration - timerSeconds;
  const canRunTimer = timerMode === "rest" || Boolean(activeTask && (activeSessionId || activeTask.sessionId));
  const taskHistorySession = selectedSession?.id !== activeSessionId ? selectedSession : null;
  const taskListSession = selectedSession ?? activeSession;
  const isViewingTaskHistory = Boolean(taskHistorySession);
  const canEditTaskList = !activeSessionId || !taskListSession || taskListSession.id === activeSessionId;
  const focusableTasks = activeSessionId
    ? tasks.filter((task) => task.sessionId === activeSessionId)
    : tasks;
  const visibleTasks = taskListSession
    ? [
        ...tasks
          .filter((task) => task.sessionId === taskListSession.id)
          .map((task) => ({
          id: task.id,
          text: task.text,
          completed: task.completed ?? false,
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
            completed: false,
            displaySeconds: task.seconds,
            isDeleted: true,
          }))
          : []),
      ]
    : tasks.map((task) => ({
        ...task,
        completed: task.completed ?? false,
        displaySeconds: task.focusSeconds ?? 0,
        isDeleted: false,
      }));
  useEffect(() => {
    function syncPointer(event) {
      const xp = (event.clientX / window.innerWidth).toFixed(2);

      document.documentElement.style.setProperty("--xp", xp);
    }

    window.addEventListener("pointermove", syncPointer);
    return () => window.removeEventListener("pointermove", syncPointer);
  }, []);

  useEffect(() => {
    const glowTargets = document.querySelectorAll(".top-menu, .panel, .item-list li, .settings-popup");

    function updateLocalGlow(target, event) {
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--local-x", `${event.clientX - rect.left}px`);
      target.style.setProperty("--local-y", `${event.clientY - rect.top}px`);
      target.style.setProperty("--glow-active", "1");
    }

    function resetLocalGlow(target) {
      target.style.setProperty("--glow-active", "0");
    }

    glowTargets.forEach((target) => {
      target.style.setProperty("--glow-active", "0");

      const handlePointerEnter = (event) => updateLocalGlow(target, event);
      const handlePointerMove = (event) => updateLocalGlow(target, event);
      const handlePointerLeave = () => resetLocalGlow(target);

      target.addEventListener("pointerenter", handlePointerEnter);
      target.addEventListener("pointermove", handlePointerMove);
      target.addEventListener("pointerleave", handlePointerLeave);

      target._handlePointerEnter = handlePointerEnter;
      target._handlePointerMove = handlePointerMove;
      target._handlePointerLeave = handlePointerLeave;
    });

    return () => {
      glowTargets.forEach((target) => {
        target.removeEventListener("pointerenter", target._handlePointerEnter);
        target.removeEventListener("pointermove", target._handlePointerMove);
        target.removeEventListener("pointerleave", target._handlePointerLeave);
      });
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.cardTransparency, String(cardTransparency));
  }, [cardTransparency]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.cardOrder, JSON.stringify(cardOrder));
  }, [cardOrder]);

  useEffect(() => {
    return () => {
      if (settingsCloseTimeoutRef.current) {
        window.clearTimeout(settingsCloseTimeoutRef.current);
      }
    };
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
    if (!layoutEditMode) {
      dragStateRef.current = { active: false, cardId: null, lastTargetId: null };
      setDraggedCardId(null);
      return undefined;
    }

    function updateDraftCardOrder(cardId, targetCardId) {
      if (!cardId || !targetCardId || cardId === targetCardId) {
        return;
      }

      setDraftCardOrder((currentOrder) => {
        const fromIndex = currentOrder.indexOf(cardId);
        const toIndex = currentOrder.indexOf(targetCardId);

        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return currentOrder;
        }

        return moveItem(currentOrder, fromIndex, toIndex);
      });
    }

    function handlePointerMove(event) {
      if (!dragStateRef.current.active || !dragStateRef.current.cardId) {
        return;
      }

      const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
      const cardElement = elementAtPoint?.closest?.("[data-card-id]");
      const targetCardId = cardElement?.getAttribute("data-card-id");

      if (
        !targetCardId ||
        targetCardId === dragStateRef.current.cardId ||
        targetCardId === dragStateRef.current.lastTargetId
      ) {
        return;
      }

      dragStateRef.current.lastTargetId = targetCardId;
      updateDraftCardOrder(dragStateRef.current.cardId, targetCardId);
    }

    function finishDrag() {
      dragStateRef.current = { active: false, cardId: null, lastTargetId: null };
      setDraggedCardId(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [layoutEditMode]);

  useEffect(() => {
    if (!editingSessionId) {
      return;
    }

    sessionNameInputRef.current?.focus();
    sessionNameInputRef.current?.select();
  }, [editingSessionId]);

  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedSessionId !== null) {
        setSelectedSessionId(null);
      }

      return;
    }

    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
      return;
    }

    const fallbackSession = activeSessionId
      ? sessions.find((session) => session.id === activeSessionId)
      : sessions[sessions.length - 1];

    setSelectedSessionId(fallbackSession?.id ?? null);
  }, [activeSessionId, selectedSessionId, sessions]);

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
    const validSessionIds = new Set(sessions.map((session) => session.id));

    setTasks((currentTasks) => {
      const nextTasks = currentTasks.filter(
        (task) => !task.sessionId || validSessionIds.has(task.sessionId),
      );

      return nextTasks.length === currentTasks.length ? currentTasks : nextTasks;
    });
  }, [sessions, setTasks]);

  useEffect(() => {
    if (!timerRunning || (timerMode === "focus" && !activeTaskId)) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setTimerSeconds((currentSeconds) => {
        if (currentSeconds <= 0) {
          window.clearInterval(timerId);
          setTimerRunning(false);
          return 0;
        }

        if (timerMode === "focus") {
          const nextRemainingSeconds = Math.max(currentSeconds - 1, 0);

          setTasks((currentTasks) =>
            currentTasks.map((task) =>
              task.id === activeTaskId
                ? {
                    ...task,
                    focusSeconds: (task.focusSeconds ?? 0) + 1,
                    remainingFocusSeconds: nextRemainingSeconds,
                  }
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
        }

        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          ringTimerBell();

          if (timerMode === "focus") {
            persistTaskRemainingFocus(activeTaskId, focusDuration);
            setTimerMode("rest");
            setTimerRunning(true);
            return breakDuration;
          }

          setTimerMode("focus");
          setTimerRunning(false);
          return focusDuration;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activeSessionId, activeTaskId, breakDuration, focusDuration, setSessions, setTasks, timerMode, timerRunning]);

  function addTask(event) {
    event.preventDefault();
    const text = taskText.trim();

    if (!text) {
      return;
    }

    if (!activeSessionId) {
      const session = createSession(createAutoSessionName(sessions));

      setSessions((currentSessions) => [...currentSessions, session]);
      setActiveSessionId(session.id);
      setSelectedSessionId(session.id);
      setTasks((currentTasks) => [...currentTasks, createItem(text, session.id)]);
      setTaskText("");
      return;
    }

    if (taskListSession && taskListSession.id !== activeSessionId) {
      return;
    }

    setTasks((currentTasks) => [...currentTasks, createItem(text, activeSessionId)]);
    setTaskText("");
  }

  function removeTask(taskId) {
    if (taskId === activeTaskId) {
      setActiveTaskId(null);
      setTimerRunning(false);
    }

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  }

  function toggleTaskCompleted(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !(task.completed ?? false) } : task,
      ),
    );
  }

  function persistTaskRemainingFocus(taskId, nextRemainingSeconds) {
    if (!taskId) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, remainingFocusSeconds: nextRemainingSeconds } : task,
      ),
    );
  }

  function selectTask(taskId) {
    if (activeTaskId && activeTaskId !== taskId && timerMode === "focus") {
      persistTaskRemainingFocus(activeTaskId, timerSeconds);
    }

    const nextTask = tasks.find((task) => task.id === taskId);

    setActiveTaskId(taskId);
    setTimerRunning(false);
    setTimerMode("focus");
    setTimerSeconds(nextTask?.remainingFocusSeconds ?? focusDuration);
  }

  function moveSelectedTask(direction, baseTaskId = activeTaskId) {
    if (visibleTasks.length === 0) {
      return;
    }

    const selectableTasks = visibleTasks.filter((task) => !task.isDeleted);

    if (selectableTasks.length === 0) {
      return;
    }

    const currentTaskId = baseTaskId ?? selectableTasks[0].id;
    const currentIndex = selectableTasks.findIndex((task) => task.id === currentTaskId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + selectableTasks.length) % selectableTasks.length;

    selectTask(selectableTasks[nextIndex].id);
  }

  function handleTaskSwipeStart(taskId, event) {
    const target = event.target;

    if (
      target instanceof HTMLElement &&
      (target.closest("button") || target.closest("label") || target.closest("input"))
    ) {
      taskSwipeRef.current = { x: null, y: null, taskId: null };
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    taskSwipeRef.current = { x: touch.clientX, y: touch.clientY, taskId };
  }

  function handleTaskSwipeEnd(event) {
    const { x: startX, y: startY, taskId } = taskSwipeRef.current;
    const touch = event.changedTouches[0];

    taskSwipeRef.current = { x: null, y: null, taskId: null };

    if (!touch || startX === null || startY === null || !taskId) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const swipeThreshold = 42;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    moveSelectedTask(deltaX < 0 ? 1 : -1, taskId);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerMode("focus");
    setTimerSeconds(focusDuration);

    if (activeTaskId) {
      persistTaskRemainingFocus(activeTaskId, focusDuration);
    }
  }

  function updateFocusMinutes(value) {
    const nextMinutes = value[0] ?? DEFAULT_FOCUS_MINUTES;
    const nextDuration = nextMinutes * 60;

    setFocusMinutes(nextMinutes);

    if (timerMode === "focus") {
      setTimerSeconds((currentSeconds) =>
        timerRunning ? Math.min(currentSeconds, nextDuration) : nextDuration,
      );
    }
  }

  function updateBreakMinutes(value) {
    const nextMinutes = value[0] ?? DEFAULT_BREAK_MINUTES;
    const nextDuration = nextMinutes * 60;

    setBreakMinutes(nextMinutes);

    if (timerMode === "rest") {
      setTimerSeconds((currentSeconds) =>
        timerRunning ? Math.min(currentSeconds, nextDuration) : nextDuration,
      );
    }
  }

  function ensureTimerAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  function ringTimerBell() {
    const audioContext = ensureTimerAudio();

    if (audioContext) {
      playTimerBell(audioContext);
    }
  }

  function startTaskSessionIfNeeded() {
    if (timerMode !== "focus" || !activeTask) {
      return true;
    }

    const taskSessionId = activeTask.sessionId;

    if (activeSessionId || !taskSessionId) {
      return Boolean(activeSessionId || taskSessionId);
    }

    if (!sessions.some((session) => session.id === taskSessionId)) {
      return false;
    }

    setActiveSessionId(taskSessionId);
    setSelectedSessionId(taskSessionId);
    return true;
  }

  function handleTimerButtonClick() {
    ensureTimerAudio();

    if (timerRunning) {
      setTimerRunning(false);
      return;
    }

    if (!startTaskSessionIfNeeded()) {
      return;
    }

    setTimerRunning(true);
  }

  function openSettings() {
    if (settingsCloseTimeoutRef.current) {
      window.clearTimeout(settingsCloseTimeoutRef.current);
      settingsCloseTimeoutRef.current = null;
    }
    setSettingsClosing(false);
    setSettingsOpen(true);
  }

  function closeSettings() {
    if (settingsCloseTimeoutRef.current) {
      window.clearTimeout(settingsCloseTimeoutRef.current);
    }
    setSettingsClosing(true);
    settingsCloseTimeoutRef.current = window.setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
      settingsCloseTimeoutRef.current = null;
    }, 180);
  }

  function startNewSession(event) {
    event?.preventDefault?.();
    const name = "";

    const session = createSession(name);
    const nextSessions = [...readStoredItems(STORAGE_KEYS.sessions), session];

    window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(nextSessions));
    setSessions(nextSessions);
    setActiveSessionId(session.id);
    setSelectedSessionId(session.id);
    setSessionName("");
    setEditingSessionId(session.id);
  }

  function commitSessionName(sessionId) {
    const nextName = sessionName.trim() || createAutoSessionName(sessions);

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              name: nextName,
            }
          : session,
      ),
    );
    setSessionName("");
    setEditingSessionId(null);
  }

  function stopSession() {
    setActiveSessionId(null);
  }

  function continueSession() {
    if (!selectedSession) {
      return;
    }

    setActiveSessionId(selectedSession.id);
    setSelectedSessionId(selectedSession.id);
    setActiveTaskId(null);
    setTimerRunning(false);
    setTimerMode("focus");
    setTimerSeconds(focusDuration);
  }

  function removeSession(sessionId) {
    if (sessionId === activeSessionId) {
      setActiveSessionId(null);
    }

    if (sessionId === selectedSessionId) {
      setSelectedSessionId(null);
    }

    if (sessionId === editingSessionId) {
      setEditingSessionId(null);
      setSessionName("");
    }

    if (activeTask?.sessionId === sessionId) {
      setActiveTaskId(null);
      setTimerRunning(false);
      setTimerMode("focus");
      setTimerSeconds(focusDuration);
    }

    setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
    setTasks((currentTasks) => currentTasks.filter((task) => task.sessionId !== sessionId));
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

  function handleSessionSwipeStart(event) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    sessionSwipeRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleSessionSwipeEnd(event) {
    const startX = sessionSwipeRef.current.x;
    const startY = sessionSwipeRef.current.y;
    const touch = event.changedTouches[0];

    sessionSwipeRef.current = { x: null, y: null };

    if (!touch || startX === null || startY === null || sessions.length < 2) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const swipeThreshold = 42;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    moveSelectedSession(deltaX < 0 ? 1 : -1);
  }

  function openCardEditor() {
    setDraftCardOrder(cardOrder);
    setLayoutEditMode(true);
    closeSettings();
  }

  function saveCardLayout() {
    setCardOrder(sanitizeCardOrder(draftCardOrder));
    setLayoutEditMode(false);
    setDraggedCardId(null);
    dragStateRef.current = { active: false, cardId: null, lastTargetId: null };
  }

  function startCardDrag(cardId) {
    if (!layoutEditMode) {
      return;
    }

    dragStateRef.current = { active: true, cardId, lastTargetId: null };
    setDraggedCardId(cardId);
  }

  function renderCard(card) {
    return (
      <GlassCard
        key={card.id}
        className={cn(
          card.className,
          "board-card",
          layoutEditMode && "is-layout-editing",
          draggedCardId === card.id && "is-dragging",
        )}
      >
        <div
          className="board-card-frame"
          data-card-id={card.id}
          onPointerDown={() => startCardDrag(card.id)}
        >
          <div className="card-edit-label" aria-hidden={!layoutEditMode}>
            Drag to move
          </div>
          {card.content}
        </div>
      </GlassCard>
    );
  }

  const cardsById = {
    timer: {
      id: "timer",
      className: "panel-small app-intro-bottom",
      content: (
        <section className="panel" aria-labelledby="timer-title">
          <div className="panel-header">
            <h1 id="timer-title">Timer</h1>
          </div>
          <div className="timer-card" aria-live="polite">
            <div className="timer-progress">
              <AnimatedCircularProgressBar
                max={timerDuration}
                min={0}
                value={timerProgress}
                gaugePrimaryColor={timerMode === "rest" ? "#9ee8ff" : "#5f8bff"}
                gaugeSecondaryColor="transparent"
                className="timer-progress-ring"
              />
              <div className="timer-status">{timerMode === "rest" ? "BREAK TIME" : "FOCUS TIME"}</div>
              <div className="timer-display">{formatTimer(timerSeconds)}</div>
            </div>
            <div className="timer-task">
              {timerMode === "rest" ? (
                <strong className="timer-rest-label">Rest</strong>
              ) : (
                <GlassSelect
                  value={activeTaskId ?? ""}
                  onValueChange={selectTask}
                  disabled={focusableTasks.length === 0}
                >
                  <GlassSelectTrigger
                    className="timer-task-select h-6 rounded-lg px-2 py-0.5 text-[10px]"
                    aria-label="Choose task"
                  >
                    <GlassSelectValue placeholder="Choose a task" />
                  </GlassSelectTrigger>
                  <GlassSelectContent className="max-h-36 rounded-lg">
                    {focusableTasks.map((task) => (
                      <GlassSelectItem key={task.id} value={task.id} className="py-0.5 pl-7 text-[10px]">
                        {task.text}
                      </GlassSelectItem>
                    ))}
                  </GlassSelectContent>
                </GlassSelect>
              )}
            </div>
            <div className="timer-actions">
              <button
                type="button"
                onClick={handleTimerButtonClick}
                disabled={!canRunTimer || timerSeconds === 0}
              >
                {timerRunning ? "Pause" : "Start"}
              </button>
              <button type="button" onClick={resetTimer}>
                Reset
              </button>
            </div>
          </div>
        </section>
      ),
    },
    tasks: {
      id: "tasks",
      className: "panel-wide app-intro-top",
      content: (
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
                placeholder={canEditTaskList ? "What needs focus?" : "Continue session to add tasks"}
                disabled={!canEditTaskList || layoutEditMode}
              />
              <button type="submit" disabled={!canEditTaskList || layoutEditMode}>
                Add
              </button>
            </div>
          </form>
          <div className="task-filter-row" aria-label="Task filters">
            <button type="button" className="task-filter-pill is-active">All</button>
            <button type="button" className="task-filter-pill">Today</button>
            <button type="button" className="task-filter-pill">Upcoming</button>
          </div>
          <ul ref={taskListRef} className="item-list" aria-label="Saved tasks">
            {visibleTasks.length > 0 ? (
              visibleTasks.map((task) => (
                <li
                  key={task.id}
                  className={`${task.id === activeTaskId ? "is-active" : ""}${
                    isViewingTaskHistory ? " is-session-task" : ""
                  }${task.completed ? " is-completed" : ""
                  }`.trim()}
                  onTouchStart={(event) => handleTaskSwipeStart(task.id, event)}
                  onTouchEnd={handleTaskSwipeEnd}
                >
                  <span>{task.text}</span>
                  <span className="task-time">{formatSpentTime(task.displaySeconds)}</span>
                  {isViewingTaskHistory || task.isDeleted ? null : (
                    <button
                      type="button"
                      aria-label={`Delete task ${task.text}`}
                      onClick={() => removeTask(task.id)}
                      disabled={layoutEditMode}
                    >
                      <Trash2 aria-hidden="true" size={15} strokeWidth={2.5} />
                    </button>
                  )}
                  {task.isDeleted ? null : (
                    <label className="task-checkbox" aria-label={`Mark ${task.text} as done`}>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTaskCompleted(task.id)}
                        disabled={layoutEditMode}
                      />
                      <span aria-hidden="true" />
                    </label>
                  )}
                </li>
              ))
            ) : (
              <li className="item-list-empty">
                <span>No tasks yet.</span>
              </li>
            )}
          </ul>
          <div className="task-list-meta">{visibleTasks.length} tasks</div>
        </section>
      ),
    },
    sessions: {
      id: "sessions",
      className: "panel-half app-intro-bottom",
      content: (
        <section className="panel" aria-labelledby="sessions-title">
          <div className="panel-header">
            <h2 id="sessions-title">Sessions</h2>
            <button className="session-action" type="button" onClick={startNewSession} disabled={layoutEditMode}>
              New session
            </button>
          </div>
          {summarySession ? (
            <>
              <div className="session-summary">
                <div onTouchStart={handleSessionSwipeStart} onTouchEnd={handleSessionSwipeEnd}>
                  <div className="session-summary-copy">
                    {editingSessionId === summarySession.id ? (
                      <form
                        className="session-inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitSessionName(summarySession.id);
                        }}
                      >
                        <GlassInput
                          ref={sessionNameInputRef}
                          className="session-name-input"
                          type="text"
                          value={sessionName}
                          onChange={(event) => setSessionName(event.target.value)}
                          onBlur={() => commitSessionName(summarySession.id)}
                          placeholder={createAutoSessionName(sessions)}
                          disabled={layoutEditMode}
                        />
                      </form>
                    ) : (
                      <strong>{summarySession.name || formatSessionDate(summarySession.startedAt)}</strong>
                    )}
                    <em>{formatSpentTime(summarySession?.durationSeconds)}</em>
                  </div>
                  <div className="session-summary-arrows" aria-label="Browse sessions">
                    <button
                      type="button"
                      aria-label="Previous session"
                      onClick={() => moveSelectedSession(-1)}
                      disabled={sessions.length === 0 || layoutEditMode}
                    >
                      <ChevronLeft aria-hidden="true" size={16} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      aria-label="Next session"
                      onClick={() => moveSelectedSession(1)}
                      disabled={sessions.length === 0 || layoutEditMode}
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
                      disabled={!summarySession || layoutEditMode}
                    >
                      <Trash2 aria-hidden="true" size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
              {activeSession && selectedSession?.id === activeSessionId ? (
                <button className="session-stop" type="button" onClick={stopSession} disabled={layoutEditMode}>
                  Stop session
                </button>
              ) : null}
              {selectedSession && selectedSession.id !== activeSessionId ? (
                <button
                  className="session-continue"
                  type="button"
                  onClick={continueSession}
                  disabled={layoutEditMode}
                >
                  Continue session
                </button>
              ) : null}
            </>
          ) : (
            <div className="session-empty-state" aria-live="polite">
              <Clock3 aria-hidden="true" size={26} strokeWidth={1.8} />
              <strong>No active session</strong>
              <span>Start a new session to begin tracking your focus time.</span>
            </div>
          )}
        </section>
      ),
    },
    analytics: {
      id: "analytics",
      className: "panel-half app-intro-top",
      content: (
        <section className="panel analytics-panel" aria-labelledby="activity-title">
          <div className="panel-header">
            <h2 id="activity-title">Analytics</h2>
            <button type="button" className="analytics-period-button">
              This week
              <ChevronDown aria-hidden="true" size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="chart-grid chart-grid-empty">
            <div className="chart-mini-card chart-empty-card analytics-card">
              <WeeklyTimeSpentChart sessions={sessions} selectedSession={summarySession} />
            </div>
          </div>
        </section>
      ),
    },
  };
  const orderedCards = sanitizeCardOrder(layoutEditMode ? draftCardOrder : cardOrder)
    .map((cardId) => cardsById[cardId])
    .filter(Boolean);
  const boardRows = chunkItems(orderedCards, 2);
  const sidebarItems = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Sessions", icon: Clock3 },
    { label: "Tasks", icon: ListTodo },
    { label: "Analytics", icon: BarChart3 },
    { label: "Settings", icon: Settings },
  ];

  return (
    <main
      className="app-shell dashboard-shell"
      aria-label="Pomodoro dashboard"
      style={{
        "--card-transparency": `${cardTransparency}%`,
        "--card-surface-transparency": `${Math.min(cardTransparency + 3, 40)}%`,
      }}
    >
      <GradientBackground />
      <aside className="dashboard-sidebar" aria-label="Primary navigation">
        <div className="dashboard-brand">
          <div className="dashboard-brand-mark" aria-hidden="true">
            <Clock3 size={16} strokeWidth={2.2} />
          </div>
          <div className="menu-title">WorkCycle</div>
        </div>
        <nav className="dashboard-nav">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={cn("dashboard-nav-item", activeView === item.label && "is-active")}
                onClick={() => setActiveView(item.label)}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={2.1} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="dashboard-streak-card">
          <div className="dashboard-streak-label">
            <span className="dashboard-streak-dot" aria-hidden="true" />
            Current streak
          </div>
          <strong>{sessionStreak} days</strong>
          <div className="dashboard-streak-days" aria-hidden="true">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`} className={index < Math.min(sessionStreak, 7) ? "is-filled" : ""}>
                {day}
              </span>
            ))}
          </div>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-copy">
            <h1>{activeView}</h1>
          </div>
          <div className="dashboard-header-actions">
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
            <div className="timer-settings" aria-label="Timer settings">
              <label className="timer-setting-control">
                <span>
                  Focus timer
                  <strong>{focusMinutes} min</strong>
                </span>
                <GlassSlider
                  value={[focusMinutes]}
                  min={5}
                  max={60}
                  step={5}
                  onValueChange={updateFocusMinutes}
                  aria-label="Focus timer minutes"
                />
              </label>
              <label className="timer-setting-control">
                <span>
                  Break timer
                  <strong>{breakMinutes} min</strong>
                </span>
                <GlassSlider
                  value={[breakMinutes]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={updateBreakMinutes}
                  aria-label="Break timer minutes"
                />
              </label>
            </div>
            <button
              type="button"
              className="settings-action-button"
              aria-label="Edit cards"
              onClick={openCardEditor}
            >
              <Pencil aria-hidden="true" size={16} strokeWidth={2.5} />
              <span>Edit cards</span>
            </button>
            <button type="button" onClick={closeSettings}>
              Close
            </button>
          </div>
        </div>
      ) : null}
        {activeView === "Dashboard" ? (
          <section className={cn("board", layoutEditMode && "is-layout-editing")} aria-label="Pomodoro board frame">
            {layoutEditMode ? (
              <div className="layout-save-overlay">
                <button type="button" className="layout-save-button" onClick={saveCardLayout}>
                  <Check aria-hidden="true" size={18} strokeWidth={2.8} />
                  <span>Save layout</span>
                </button>
              </div>
            ) : null}
            {boardRows.map((row, index) => (
              <div
                key={`board-row-${index}`}
                className={cn("board-row", index === 0 ? "board-row-top" : "board-row-bottom")}
              >
                {row.map(renderCard)}
              </div>
            ))}
          </section>
        ) : (
          <section className="board board-placeholder" aria-label={`${activeView} content`} />
        )}
      </div>
    </main>
  );
}
