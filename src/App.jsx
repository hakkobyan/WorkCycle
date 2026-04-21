import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Trash2 } from "lucide-react";
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
};

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

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

function WeeklyTimeSpentChart({ session }) {
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

  if (session) {
    const date = new Date(session.startedAt);

    if (!Number.isNaN(date.getTime())) {
      const dayIndex = (date.getDay() + 6) % 7;

      sessionDayIndex = dayIndex;
      chartData[dayIndex].seconds = session.durationSeconds ?? 0;
    }
  }

  const sessionTitle = session ? session.name || formatSessionDate(session.startedAt) : "No session";
  const sessionSeconds = session?.durationSeconds ?? 0;

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
                    height: hasData ? `${Math.max(8, (item.seconds / scaleMaxSeconds) * 100)}%` : "0%",
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

function TaskDoneChart({ tasks, session }) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const remainingTasks = Math.max(totalTasks - completedTasks, 0);
  const completedTaskLabels = tasks.filter((task) => task.completed).slice(0, 4);
  const sessionTitle = session ? session.name || formatSessionDate(session.startedAt) : "No session";

  return (
    <div className="task-done-chart" aria-label="Task completion chart">
      <div className="task-done-header">
        <div>
          <span>{sessionTitle}</span>
          <strong>{completionPercent}% done</strong>
        </div>
        <em>{completedTasks}/{totalTasks || 0}</em>
      </div>
      <div className="task-done-progress" aria-hidden="true">
        <div className="task-done-progress-fill" style={{ width: `${completionPercent}%` }} />
      </div>
      <div className="task-done-stats">
        <div>
          <strong>{completedTasks}</strong>
          <span>Completed</span>
        </div>
        <div>
          <strong>{remainingTasks}</strong>
          <span>Remaining</span>
        </div>
      </div>
      {completedTaskLabels.length > 0 ? (
        <ul className="task-done-list">
          {completedTaskLabels.map((task) => (
            <li key={task.id}>{task.text}</li>
          ))}
        </ul>
      ) : (
        <div className="task-done-empty">No completed tasks yet</div>
      )}
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
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [timerMode, setTimerMode] = useState("focus");
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState("time");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const audioContextRef = useRef(null);
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
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const timerDuration = timerMode === "rest" ? breakDuration : focusDuration;
  const timerProgress = timerDuration - timerSeconds;
  const canRunTimer = timerMode === "rest" || Boolean(activeTask && (activeSessionId || activeTask.sessionId));
  const taskHistorySession = selectedSession?.id !== activeSessionId ? selectedSession : null;
  const taskListSession = selectedSession ?? activeSession;
  const isViewingTaskHistory = Boolean(taskHistorySession);
  const canEditTaskList = Boolean(taskListSession && taskListSession.id === activeSessionId);
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
  const chartTasks = visibleTasks.filter((task) => !task.isDeleted);

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
    window.localStorage.setItem(STORAGE_KEYS.cardTransparency, String(cardTransparency));
  }, [cardTransparency]);

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

    if (taskListSession?.id !== activeSessionId) {
      return;
    }

    setTasks((currentTasks) => [...currentTasks, createItem(text, activeSessionId ?? null)]);
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
    <main
      className="app-shell"
      aria-label="Pomodoro dashboard"
      style={{
        "--card-transparency": `${cardTransparency}%`,
        "--card-surface-transparency": `${Math.min(cardTransparency + 3, 40)}%`,
      }}
    >
      <GradientBackground />
      <GlassCard className="top-menu-frame app-intro-menu">
        <header className="top-menu" aria-label="Main menu">
          <div className="menu-title">WorkCycle</div>
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
            <button type="button" onClick={closeSettings}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      <section className="board" aria-label="Pomodoro board frame">
        <div className="board-row board-row-top">
          <GlassCard className="panel-small app-intro-top">
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
                    gaugePrimaryColor={timerMode === "rest" ? "#9ee8ff" : "#faeb92"}
                    gaugeSecondaryColor="rgb(255 255 255 / 18%)"
                    className="timer-progress-ring"
                  />
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
                      <GlassSelectTrigger className="timer-task-select h-6 rounded-lg px-2 py-0.5 text-[10px]" aria-label="Choose task">
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
          </GlassCard>
          <GlassCard className="panel-wide app-intro-top">
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
                  disabled={!canEditTaskList}
                />
                <button type="submit" disabled={!canEditTaskList}>
                  Add
                </button>
              </div>
            </form>
            <ul ref={taskListRef} className="item-list" aria-label="Saved tasks">
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <li
                    key={task.id}
                    className={`${task.id === activeTaskId ? "is-active" : ""}${
                      isViewingTaskHistory ? " is-session-task" : ""
                    }${task.completed ? " is-completed" : ""
                    }`.trim()}
                  >
                    <span>{task.text}</span>
                    <span className="task-time">{formatSpentTime(task.displaySeconds)}</span>
                    {isViewingTaskHistory || task.isDeleted ? null : (
                      <button type="button" aria-label={`Delete task ${task.text}`} onClick={() => removeTask(task.id)}>
                        <Trash2 aria-hidden="true" size={15} strokeWidth={2.5} />
                      </button>
                    )}
                    {task.isDeleted ? null : (
                      <label className="task-checkbox" aria-label={`Mark ${task.text} as done`}>
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTaskCompleted(task.id)}
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
          </section>
          </GlassCard>
        </div>
        <div className="board-row board-row-bottom">
          <GlassCard className="panel-half app-intro-bottom">
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
            {activeSession && selectedSession?.id === activeSessionId ? (
              <button className="session-stop" type="button" onClick={stopSession}>
                Stop session
              </button>
            ) : null}
            {selectedSession && selectedSession.id !== activeSessionId ? (
              <button className="session-continue" type="button" onClick={continueSession}>
                Continue session
              </button>
            ) : null}
          </section>
          </GlassCard>
          <GlassCard className="panel-half app-intro-bottom">
          <section className="panel" aria-labelledby="activity-title">
            <div className="panel-header">
              <h2 id="activity-title">Charts</h2>
            </div>
            <div className="chart-tabs" aria-label="Chart views">
              <button
                className={activeChartTab === "time" ? "is-active" : ""}
                type="button"
                onClick={() => setActiveChartTab("time")}
              >
                Time spent
              </button>
              <button
                className={activeChartTab === "done" ? "is-active" : ""}
                type="button"
                onClick={() => setActiveChartTab("done")}
              >
                Task done
              </button>
            </div>
            <div className="chart-grid chart-grid-empty">
                <div className="chart-mini-card chart-empty-card">
                  {activeChartTab === "time" ? (
                  <WeeklyTimeSpentChart session={summarySession} />
                  ) : (
                  <TaskDoneChart tasks={chartTasks} session={summarySession} />
                  )}
                </div>
            </div>
          </section>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
