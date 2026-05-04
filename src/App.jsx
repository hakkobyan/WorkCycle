import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  CircleDot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
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
  overallInsightCycle: "pomodoro.overallInsightCycle",
};

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const DEFAULT_CARD_ORDER = ["tasks", "analytics", "timer", "sessions"];

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function getAiApiCandidates() {
  if (typeof window === "undefined") {
    return ["/api/generate-plan"];
  }

  const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  const sameOriginUrl = `${window.location.origin}/api/generate-plan`;
  const configuredUrl = configuredBaseUrl ? `${configuredBaseUrl}/api/generate-plan` : null;
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const localFallbackUrl = isLocalHost ? "http://127.0.0.1:8787/api/generate-plan" : null;

  return Array.from(new Set([sameOriginUrl, configuredUrl, localFallbackUrl].filter(Boolean)));
}

async function parseApiResponse(response) {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const looksLikeJson = contentType.includes("application/json");

  if (looksLikeJson) {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error("The AI service returned invalid JSON.");
    }
  }

  return { rawText };
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

function getNextOverallInsightCycle() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const currentValue = Number(window.localStorage.getItem(STORAGE_KEYS.overallInsightCycle) ?? "0");
    const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;
    window.localStorage.setItem(STORAGE_KEYS.overallInsightCycle, String(nextValue));
    return nextValue;
  } catch {
    return 0;
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
  return sanitizeOrder(value, DEFAULT_CARD_ORDER);
}

function sanitizeOrder(value, validItems) {
  const source = Array.isArray(value) ? value : [];
  const uniqueItems = source.filter(
    (entry, index) => validItems.includes(entry) && source.indexOf(entry) === index,
  );

  return [
    ...uniqueItems,
    ...validItems.filter((entry) => !uniqueItems.includes(entry)),
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

function createAutoTaskName(existingTasks) {
  const baseName = "task";
  const usedIndices = new Set();

  existingTasks.forEach((task) => {
    const match = task.text?.trim().match(/^task(\d+)$/i);

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

function cleanGeneratedTaskTitle(value, fallbackIndex) {
  const nextValue = String(value ?? "")
    .replace(/^\s*[-*]\s*/, "")
    .replace(/^\s*\d+[\).\s-]+/, "")
    .trim();

  return nextValue || `Task ${fallbackIndex + 1}`;
}

function normalizeAiPlan(payload) {
  const sessionName = String(payload?.sessionName ?? "").trim();
  const tasks = Array.isArray(payload?.tasks)
    ? payload.tasks
        .map((task, index) => cleanGeneratedTaskTitle(task?.title, index))
        .filter(Boolean)
    : [];
  const outcome = String(payload?.outcome ?? "").trim();

  if (!sessionName || tasks.length === 0) {
    throw new Error("The AI response did not include a usable session name and task list.");
  }

  return {
    sessionName,
    tasks,
    outcome,
  };
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimerWindow(totalSeconds, baseDate = new Date()) {
  const endDate = new Date(baseDate.getTime() + Math.max(totalSeconds, 0) * 1000);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formatter.format(baseDate)} - ${formatter.format(endDate)}`;
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
  return new Intl.DateTimeFormat("en-US", {
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
    gain.gain.exponentialRampToValueAtTime(0.32, startsAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.16);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.18);
  });
}

function playTimerModeSound(audioContext, nextMode) {
  const now = audioContext.currentTime;
  const notes =
    nextMode === "rest"
      ? [
          { frequency: 659.25, duration: 0.16, gain: 0.22 },
          { frequency: 783.99, duration: 0.18, gain: 0.24 },
          { frequency: 987.77, duration: 0.24, gain: 0.26 },
        ]
      : [
          { frequency: 523.25, duration: 0.16, gain: 0.2 },
          { frequency: 659.25, duration: 0.18, gain: 0.22 },
          { frequency: 783.99, duration: 0.22, gain: 0.24 },
        ];

  notes.forEach((note, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startsAt = now + index * 0.12;

    oscillator.type = nextMode === "rest" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(note.frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(note.gain, startsAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + note.duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + note.duration + 0.02);
  });
}

function formatChartTick(minutes) {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }

  return `${Math.round(minutes)}m`;
}

function buildRecentActivityData(sessions) {
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      key: date.getTime(),
      label: formatter.format(date),
      value: 0,
    };
  });

  const valuesByDay = new Map(days.map((day) => [day.key, day]));

  sessions.forEach((session) => {
    const date = new Date(session.startedAt);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const sessionDayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const matchingDay = valuesByDay.get(sessionDayKey);

    if (matchingDay) {
      matchingDay.value += session.durationSeconds ?? 0;
    }
  });

  return days;
}

function getTimeOfDayLabel(hours) {
  if (hours < 6) return "late night";
  if (hours < 12) return "morning";
  if (hours < 17) return "afternoon";
  if (hours < 21) return "evening";
  return "night";
}

function buildOverallInsights({
  sessions,
  tasks,
  totalFocusSeconds,
  completedTaskCount,
  completionRate,
  sessionStreak,
  topTaskAnalytics,
  averageSessionSeconds,
  insightCycle,
}) {
  if (sessions.length === 0 && tasks.length === 0) {
    return [
      {
        id: "overall-empty",
        tone: "primary",
        title: "No activity yet",
        body:
          "Start a session or finish a few tasks and this space will turn your work history into an AI-style summary.",
      },
    ];
  }

  const weekdayTotals = new Map();
  const timeOfDayTotals = new Map();

  sessions.forEach((session) => {
    const date = new Date(session.startedAt);
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    const timeOfDay = getTimeOfDayLabel(date.getHours());
    const seconds = session.durationSeconds ?? 0;

    weekdayTotals.set(weekday, (weekdayTotals.get(weekday) ?? 0) + seconds);
    timeOfDayTotals.set(timeOfDay, (timeOfDayTotals.get(timeOfDay) ?? 0) + seconds);
  });

  const bestWeekdayEntry =
    [...weekdayTotals.entries()].sort((firstDay, secondDay) => secondDay[1] - firstDay[1])[0] ?? null;
  const bestTimeOfDayEntry =
    [...timeOfDayTotals.entries()].sort((firstSlot, secondSlot) => secondSlot[1] - firstSlot[1])[0] ?? null;
  const longestSession =
    [...sessions].sort(
      (firstSession, secondSession) => (secondSession.durationSeconds ?? 0) - (firstSession.durationSeconds ?? 0),
    )[0] ?? null;
  const latestSession =
    [...sessions].sort(
      (firstSession, secondSession) =>
        new Date(secondSession.startedAt).getTime() - new Date(firstSession.startedAt).getTime(),
    )[0] ?? null;
  const openTasks = tasks.filter((task) => !(task.completed ?? false));
  const topTask = topTaskAnalytics[0] ?? null;
  const focusedDays = new Set(
    sessions.map((session) => {
      const date = new Date(session.startedAt);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }),
  ).size;
  const topTimeBody = bestTimeOfDayEntry
    ? `Protect your ${bestTimeOfDayEntry[0]} hours. That's where you've already logged ${formatSpentTime(bestTimeOfDayEntry[1])} of focus.`
    : `Start with one short session today so the app can learn when you focus best.`;
  const weekdayBody = bestWeekdayEntry
    ? `${bestWeekdayEntry[0]} is your strongest day so far with ${formatSpentTime(bestWeekdayEntry[1])} tracked. Consider reserving deeper work there.`
    : "Your strongest workday will appear once you build a little more history.";
  const topTaskBody = topTask
    ? `"${topTask.text}" is pulling the most attention at ${formatSpentTime(topTask.focusSeconds ?? 0)}. Break it into a smaller next target if it keeps expanding.`
    : "No single task dominates yet. That's a good moment to choose one priority and protect it.";
  const sessionBody = latestSession
    ? `Your latest session was ${formatSessionDate(latestSession.startedAt)}. Repeating that time slot can help you build a steadier rhythm.`
    : "Your next session will start shaping a more useful rhythm recommendation.";
  const streakBody =
    sessionStreak > 0
      ? `You're on a ${sessionStreak}-day streak. A short session today is enough to keep the chain alive.`
      : "You don't have a streak yet. One completed cycle today is enough to start one.";
  const taskBody =
    openTasks.length > 0
      ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} still need attention. Try reducing that list before starting another broad task.`
      : "Your open list is clear right now. This is a great time to start a single high-value task.";
  const advicePool = [
    {
      id: "overall-focus",
      tone: "primary",
      title: "Protect your best hours",
      body: topTimeBody,
    },
    {
      id: "overall-weekday",
      tone: "accent",
      title: "Lean into your strongest day",
      body: weekdayBody,
    },
    {
      id: "overall-tasks",
      tone: "success",
      title: "Tighten the task list",
      body: taskBody,
    },
    {
      id: "overall-top-task",
      tone: "secondary",
      title: "Watch the heaviest task",
      body: topTaskBody,
    },
    {
      id: "overall-session",
      tone: "warning",
      title: "Reuse your latest rhythm",
      body: sessionBody,
    },
    {
      id: "overall-momentum",
      tone: "neutral",
      title: "Keep momentum alive",
      body: streakBody,
    },
    {
      id: "overall-session-length",
      tone: "warning",
      title: "Session length check",
      body: longestSession
        ? `Your longest session was ${formatSpentTime(longestSession.durationSeconds ?? 0)} on ${formatSessionDate(longestSession.startedAt)}${longestSession.name ? `, saved as "${longestSession.name}"` : ""}.`
        : "Your longest session will show up here once you start tracking sessions.",
    },
  ];
  const statsCard = {
    id: "overall-stats",
    tone: "primary",
    title: "Overall stats",
    body: `Sessions: ${sessions.length}. Focus: ${formatSpentTime(totalFocusSeconds)}. Average session: ${formatSpentTime(averageSessionSeconds)}. Completion: ${completionRate}%. Focused days: ${focusedDays}.`,
  };
  const startIndex = advicePool.length > 0 ? insightCycle % advicePool.length : 0;
  const rotatingAdvice = Array.from({ length: Math.min(3, advicePool.length) }, (_, offset) => {
    const index = (startIndex + offset) % advicePool.length;
    return advicePool[index];
  });

  return [
    statsCard,
    ...rotatingAdvice,
  ];
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
  const [activeView, setActiveView] = useState("Introduction");
  const [tasks, setTasks] = useStoredList(STORAGE_KEYS.tasks);
  const [sessions, setSessions] = useStoredList(STORAGE_KEYS.sessions);
  const [taskText, setTaskText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [navMenuOpen, setNavMenuOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth > 1080,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [cardTransparency, setCardTransparency] = useState(() =>
    readStoredNumber(STORAGE_KEYS.cardTransparency, 4),
  );
  const [cardOrder, setCardOrder] = useState(() => readStoredCardOrder());
  const [draftCardOrder, setDraftCardOrder] = useState(() => readStoredCardOrder());
  const [draftSessionOrder, setDraftSessionOrder] = useState(() => sessions.map((session) => session.id));
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [timerMode, setTimerMode] = useState("focus");
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [overallInsightCycle] = useState(() => getNextOverallInsightCycle());
  const audioContextRef = useRef(null);
  const taskListRef = useRef(null);
  const taskCountRef = useRef(tasks.length);
  const activeSessionBaseRef = useRef({ durationSeconds: 0, resumedAt: 0 });
  const sessionSwipeRef = useRef({ x: null, y: null });
  const taskSwipeRef = useRef({ x: null, y: null, taskId: null });
  const dragStateRef = useRef({ active: false, cardId: null, lastTargetId: null });
  const settingsCloseTimeoutRef = useRef(null);
  const sessionNameInputRef = useRef(null);
  const dashboardMainRef = useRef(null);
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
  const totalFocusSeconds = sessions.reduce(
    (totalSeconds, session) => totalSeconds + (session.durationSeconds ?? 0),
    0,
  );
  const completedTaskCount = tasks.filter((task) => task.completed).length;
  const completionRate = tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : 0;
  const averageSessionSeconds = sessions.length > 0 ? Math.round(totalFocusSeconds / sessions.length) : 0;
  const longestSessionSeconds = sessions.reduce(
    (longestSeconds, session) => Math.max(longestSeconds, session.durationSeconds ?? 0),
    0,
  );
  const recentActivityData = buildRecentActivityData(sessions);
  const topTaskAnalytics = [...tasks]
    .sort((firstTask, secondTask) => (secondTask.focusSeconds ?? 0) - (firstTask.focusSeconds ?? 0))
    .slice(0, 5);
  const todaySessions = sessions.filter((session) => {
    const date = new Date(session.startedAt);
    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  });
  const todayFocusSeconds = todaySessions.reduce(
    (totalSeconds, session) => totalSeconds + (session.durationSeconds ?? 0),
    0,
  );
  const bestTimeOfDayEntry =
    [...sessions.reduce((timeOfDayTotals, session) => {
      const date = new Date(session.startedAt);
      const timeOfDay = getTimeOfDayLabel(date.getHours());
      const seconds = session.durationSeconds ?? 0;

      timeOfDayTotals.set(timeOfDay, (timeOfDayTotals.get(timeOfDay) ?? 0) + seconds);
      return timeOfDayTotals;
    }, new Map()).entries()].sort((firstSlot, secondSlot) => secondSlot[1] - firstSlot[1])[0] ?? null;
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const timerDuration = timerMode === "rest" ? breakDuration : focusDuration;
  const timerProgress = timerDuration - timerSeconds;
  const timerProgressRatio = timerDuration > 0 ? Math.min(Math.max(timerProgress / timerDuration, 0), 1) : 0;
  const canRunTimer =
    timerMode === "rest" ||
    !activeTask ||
    Boolean(activeSessionId || activeTask.sessionId);
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
  const allTasksOverview = tasks
    .map((task) => {
      const session = sessions.find((entry) => entry.id === task.sessionId);

      return {
        id: task.id,
        text: task.text,
        completed: task.completed ?? false,
        focusSeconds: task.focusSeconds ?? 0,
        sessionLabel: session?.name || (task.sessionId ? "Saved session" : "No session"),
        createdAt: task.createdAt,
      };
    })
    .sort((firstTask, secondTask) => {
      if ((firstTask.completed ? 1 : 0) !== (secondTask.completed ? 1 : 0)) {
        return Number(firstTask.completed) - Number(secondTask.completed);
      }

      return new Date(secondTask.createdAt).getTime() - new Date(firstTask.createdAt).getTime();
    });
  const allTaskClasses = [
    {
      id: "open",
      title: "Open",
      items: allTasksOverview.filter((task) => !task.completed),
    },
    {
      id: "completed",
      title: "Completed",
      items: allTasksOverview.filter((task) => task.completed),
    },
  ];
  const overallInsights = buildOverallInsights({
    sessions,
    tasks,
    totalFocusSeconds,
    completedTaskCount,
    completionRate,
    sessionStreak,
    topTaskAnalytics,
    averageSessionSeconds,
    insightCycle: overallInsightCycle,
  });
  const nextOpenTask = allTaskClasses[0].items[0] ?? null;
  const overallStory =
    sessions.length > 0
      ? `You've tracked ${formatSpentTime(totalFocusSeconds)} across ${sessions.length} session${sessions.length === 1 ? "" : "s"}. ${completedTaskCount > 0 ? `You also finished ${completedTaskCount} task${completedTaskCount === 1 ? "" : "s"}.` : "You're still building momentum with your tasks."}`
      : "You have not tracked enough work yet for a deep summary, but this page will get smarter as you use the timer and complete tasks.";
  const overallNextStep = nextOpenTask
    ? `Best next step: continue "${nextOpenTask.text}".`
    : "Best next step: start a new focused task to build your next insight.";

  function isDesktopViewport() {
    return typeof window !== "undefined" && window.innerWidth > 1080;
  }

  function openView(viewName) {
    setActiveView(viewName);

    if (!isDesktopViewport()) {
      setNavMenuOpen(false);
    }
  }

  function openTasksAndCreateTask() {
    addTaskFromTasksView();
    openView("Tasks");
  }

  function openTimerAndStart() {
    openView("Timer");

    if (!timerRunning) {
      handleTimerButtonClick();
    }
  }

  function resetDashboardScroll() {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    dashboardMainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

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

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    resetDashboardScroll();

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    resetDashboardScroll();
  }, [activeView]);

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

    function updateDraftOrder(itemId, targetItemId) {
      if (!itemId || !targetItemId || itemId === targetItemId) {
        return;
      }

      const reorder = (currentOrder) => {
        const fromIndex = currentOrder.indexOf(itemId);
        const toIndex = currentOrder.indexOf(targetItemId);

        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return currentOrder;
        }

        return moveItem(currentOrder, fromIndex, toIndex);
      };

      if (activeView === "Sessions") {
        setDraftSessionOrder(reorder);
      } else {
        setDraftCardOrder(reorder);
      }
    }

    function handlePointerMove(event) {
      if (!dragStateRef.current.active || !dragStateRef.current.cardId) {
        return;
      }

      const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
      const cardElement = activeView === "Sessions"
        ? elementAtPoint?.closest?.("[data-session-id]")
        : elementAtPoint?.closest?.("[data-card-id]");
      const targetCardId = activeView === "Sessions"
        ? cardElement?.getAttribute("data-session-id")
        : cardElement?.getAttribute("data-card-id");

      if (
        !targetCardId ||
        targetCardId === dragStateRef.current.cardId ||
        targetCardId === dragStateRef.current.lastTargetId
      ) {
        return;
      }

      dragStateRef.current.lastTargetId = targetCardId;
      updateDraftOrder(dragStateRef.current.cardId, targetCardId);
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
  }, [activeView, layoutEditMode]);

  useEffect(() => {
    const validSessionIds = sessions.map((session) => session.id);
    setDraftSessionOrder((currentOrder) => sanitizeOrder(currentOrder, validSessionIds));
  }, [sessions]);

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
            playTimerTransitionSound("rest");
            setTimerMode("rest");
            setTimerRunning(true);
            return breakDuration;
          }

          playTimerTransitionSound("focus");
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

  async function generateAiSessionPlan() {
    const prompt = aiPrompt.trim();

    if (!prompt || aiLoading) {
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiResult("Generating session and tasks with Google AI...");

    try {
      let responseData = null;
      let lastError = null;

      for (const apiUrl of getAiApiCandidates()) {
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt }),
          });
          responseData = await parseApiResponse(response);

          if (!response.ok) {
            const apiError =
              responseData?.error ||
              responseData?.rawText ||
              "Google AI request failed.";
            throw new Error(apiError);
          }

          if (!responseData?.plan) {
            throw new Error("The AI service did not return a valid plan.");
          }

          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError || !responseData?.plan) {
        throw lastError ?? new Error("Failed to reach the AI service.");
      }

      const parsedPlan = normalizeAiPlan(responseData?.plan);
      const nextSession = createSession(parsedPlan.sessionName);
      const nextTasks = parsedPlan.tasks.map((taskTitle) => createItem(taskTitle, nextSession.id));

      setSessions((currentSessions) => [...currentSessions, nextSession]);
      setTasks((currentTasks) => [...currentTasks, ...nextTasks]);
      setActiveSessionId(nextSession.id);
      setSelectedSessionId(nextSession.id);
      setActiveTaskId(nextTasks[0]?.id ?? null);
      setTimerRunning(false);
      setTimerMode("focus");
      setTimerSeconds(focusDuration);
      setAiResult(
        [
          `Session created: ${parsedPlan.sessionName}`,
          "",
          ...parsedPlan.tasks.map((taskTitle, index) => `${index + 1}. ${taskTitle}`),
          "",
          `Outcome: ${parsedPlan.outcome}`,
        ].join("\n"),
      );
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Failed to generate a session plan.");
      setAiResult("");
    } finally {
      setAiLoading(false);
    }
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

  function pauseTimer() {
    setTimerRunning(false);
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

  function withTimerAudio(playback) {
    const audioContext = ensureTimerAudio();

    if (!audioContext) {
      return;
    }

    const play = () => playback(audioContext);

    if (audioContext.state === "running") {
      play();
      return;
    }

    audioContext.resume().then(play).catch(() => {});
  }

  function ringTimerBell() {
    withTimerAudio((audioContext) => {
      playTimerBell(audioContext);
    });
  }

  function playTimerTransitionSound(nextMode) {
    withTimerAudio((audioContext) => {
      playTimerModeSound(audioContext, nextMode);
    });
  }

  function startTaskSessionIfNeeded() {
    if (timerMode !== "focus") {
      return true;
    }

    if (!activeTask) {
      const nextSession =
        activeSession ??
        selectedSession ??
        createSession(createAutoSessionName(sessions));
      const shouldCreateSession = !activeSession && !selectedSession;
      const nextTask = createItem(createAutoTaskName(tasks), nextSession.id);

      if (shouldCreateSession) {
        setSessions((currentSessions) => [...currentSessions, nextSession]);
      }

      setTasks((currentTasks) => [...currentTasks, nextTask]);
      setActiveSessionId(nextSession.id);
      setSelectedSessionId(nextSession.id);
      setActiveTaskId(nextTask.id);
      setTimerMode("focus");
      setTimerSeconds(focusDuration);
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

  function addTaskFromTasksView() {
    const baseSession = activeSession ?? selectedSession;

    if (!baseSession) {
      const nextSession = createSession(createAutoSessionName(sessions));
      const nextTask = createItem(createAutoTaskName(tasks), nextSession.id);

      setSessions((currentSessions) => [...currentSessions, nextSession]);
      setTasks((currentTasks) => [...currentTasks, nextTask]);
      setActiveSessionId(nextSession.id);
      setSelectedSessionId(nextSession.id);
      setActiveTaskId(nextTask.id);
      return;
    }

    const nextTask = createItem(createAutoTaskName(tasks), baseSession.id);
    setTasks((currentTasks) => [...currentTasks, nextTask]);
    setSelectedSessionId(baseSession.id);

    if (activeSessionId === baseSession.id) {
      setActiveTaskId(nextTask.id);
    }
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

  function saveCardLayout() {
    if (activeView === "Sessions") {
      setSessions((currentSessions) => {
        const sessionIds = currentSessions.map((session) => session.id);
        const nextOrder = sanitizeOrder(draftSessionOrder, sessionIds);
        const sessionMap = new Map(currentSessions.map((session) => [session.id, session]));
        return nextOrder.map((sessionId) => sessionMap.get(sessionId)).filter(Boolean);
      });
    } else {
      setCardOrder(sanitizeCardOrder(draftCardOrder));
    }
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

  function renderTimerExperience({ compact = false } = {}) {
    const timerStateLabel = timerMode === "rest" ? "Break" : "Focus";
    const timerTone = timerMode === "rest" ? "#9ee8ff" : "#5A78FF";
    const progressRatio = timerDuration > 0 ? Math.min(Math.max(timerProgress / timerDuration, 0), 1) : 0;

    return (
      <section
        className={cn("timer-experience", compact && "timer-experience-compact")}
        aria-label={compact ? undefined : undefined}
        aria-labelledby={compact ? "timer-title" : "timer-page-title"}
      >
        {compact ? (
          <div className="panel-header">
            <h1 id="timer-title">Timer</h1>
          </div>
        ) : null}

        <div className="timer-layout">
          <div className="timer-info-pane">
            {!compact ? (
              <div className="timer-overall-block" aria-label="AI summary">
                <div className="timer-overall-story">
                  <strong>{overallNextStep}</strong>
                  <span>{overallStory}</span>
                </div>
                <div className="timer-overall-bubbles">
                  {overallInsights.map((insight) => (
                    <article
                      key={insight.id}
                      className={cn("timer-overall-bubble", `timer-overall-bubble-${insight.tone}`)}
                    >
                      <span>{insight.title}</span>
                      <p>{insight.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="timer-hero">
            <div className="timer-dial-shell">
              <div className="timer-dial">
                <svg
                  className="timer-progress-ring"
                  viewBox="0 0 240 240"
                  aria-hidden="true"
                >
                  <circle className="timer-progress-ring-track" cx="120" cy="120" r="88" />
                  <circle
                    cx="120"
                    cy="120"
                    r="88"
                    pathLength="100"
                    className="timer-progress-ring-line"
                    style={{
                      stroke: timerTone,
                      strokeDasharray: `${progressRatio * 100} 100`,
                    }}
                  />
                </svg>
                <div className="timer-dial-readout">
                  <div className="timer-hero-display">{formatTimer(timerSeconds)}</div>
                  <div className={cn("timer-mode-pill", timerMode === "rest" && "is-rest")}>
                    <span>{timerStateLabel}</span>
                  </div>
                </div>
              </div>
              {!compact ? (
                <div className="timer-hero-controls">
                  <div className="timer-task-picker-block">
                    {timerMode === "rest" ? (
                      <div className="timer-task-picker timer-task-picker-readonly">
                        <div className="timer-task-picker-topline">Current mode</div>
                        <div className="timer-task-picker-body">
                          <span>Break time</span>
                        </div>
                      </div>
                    ) : (
                      <GlassSelect
                        value={activeTaskId ?? ""}
                        onValueChange={selectTask}
                        disabled={focusableTasks.length === 0}
                      >
                        <GlassSelectTrigger
                          id={compact ? "timer-task-compact" : "timer-task-full"}
                          className={cn(
                            "timer-task-picker",
                            compact && "timer-task-picker-compact",
                          )}
                          aria-label="Choose task"
                        >
                          <div className="timer-task-picker-copy">
                            <div className="timer-task-picker-topline">Current task</div>
                            <div className="timer-task-picker-value">
                              <ListTodo aria-hidden="true" size={16} strokeWidth={2.1} />
                              <GlassSelectValue
                                placeholder={focusableTasks.length > 0 ? "Choose a task" : "Create a task to begin"}
                              />
                            </div>
                          </div>
                        </GlassSelectTrigger>
                        <GlassSelectContent className="timer-task-picker-menu">
                          {focusableTasks.map((task) => (
                            <GlassSelectItem key={task.id} value={task.id} className="timer-task-picker-item">
                              {task.text}
                            </GlassSelectItem>
                          ))}
                        </GlassSelectContent>
                      </GlassSelect>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="timer-command-row" aria-label="Timer controls">
                <button type="button" className="timer-command-button" onClick={resetTimer} aria-label="Reset timer">
                  <RotateCcw aria-hidden="true" size={24} strokeWidth={2.2} />
                  <span className="timer-command-copy">Reset</span>
                </button>
                <button
                  type="button"
                  className="timer-command-button timer-command-button-primary"
                  onClick={handleTimerButtonClick}
                  disabled={!timerRunning && (!canRunTimer || timerSeconds === 0)}
                  aria-label="Start timer"
                >
                  <Play aria-hidden="true" size={28} strokeWidth={2.2} fill="currentColor" />
                  <span className="timer-command-copy">{timerRunning ? "Pause session" : "Start session"}</span>
                </button>
                <button
                  type="button"
                  className="timer-command-button timer-command-button-stop"
                  onClick={pauseTimer}
                  disabled={!timerRunning}
                  aria-label="Pause timer"
                >
                  <Pause aria-hidden="true" size={24} strokeWidth={2.4} />
                  <span className="timer-command-copy">Pause</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </section>
    );
  }

  const cardsById = {
    timer: {
      id: "timer",
      className: "panel-small app-intro-bottom",
      content: (
        <section className="panel" aria-labelledby="timer-title">
          <div aria-live="polite">{renderTimerExperience({ compact: true })}</div>
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
            <div
              className="chart-mini-card chart-empty-card analytics-card analytics-card-link"
              role="button"
              tabIndex={layoutEditMode ? -1 : 0}
              onClick={() => {
                if (!layoutEditMode) {
                  setActiveView("Analytics");
                }
              }}
              onKeyDown={(event) => {
                if (layoutEditMode) {
                  return;
                }

                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveView("Analytics");
                }
              }}
            >
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
    { label: "Introduction", icon: CircleDot },
    { label: "Timer", icon: Clock3 },
    { label: "Sessions", icon: Clock3 },
    { label: "Tasks", icon: ListTodo },
    { label: "Analytics", icon: BarChart3 },
    { label: "AI Generator", icon: Bot },
    { label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <main
      className={cn("app-shell dashboard-shell", navMenuOpen ? "is-sidebar-open" : "is-sidebar-collapsed")}
      aria-label="Pomodoro dashboard"
      style={{
        "--card-transparency": `${cardTransparency}%`,
        "--card-surface-transparency": `${Math.min(cardTransparency + 3, 40)}%`,
      }}
    >
      <GradientBackground />
      <aside className={cn("dashboard-sidebar", navMenuOpen && "is-nav-open")} aria-label="Primary navigation">
        <div className="dashboard-sidebar-head">
          <div className="dashboard-brand">
            <div className="dashboard-brand-mark" aria-hidden="true">
              <Clock3 size={16} strokeWidth={2.2} />
            </div>
            <div className="menu-title">WorkCycle</div>
          </div>
          <button
            type="button"
            className="dashboard-menu-toggle"
            aria-label={navMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={navMenuOpen}
            aria-controls="dashboard-navigation"
            onClick={() => setNavMenuOpen((currentValue) => !currentValue)}
          >
            {navMenuOpen ? (
              <X aria-hidden="true" size={18} strokeWidth={2.4} />
            ) : (
              <Menu aria-hidden="true" size={18} strokeWidth={2.4} />
            )}
          </button>
        </div>
        <div className="dashboard-sidebar-panel">
          <nav id="dashboard-navigation" className="dashboard-nav">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={cn("dashboard-nav-item", activeView === item.label && "is-active")}
                  onClick={() => openView(item.label)}
                >
                  <Icon aria-hidden="true" size={17} strokeWidth={2.1} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="dashboard-sidebar-utility-row">
            <button
              className="dashboard-menu-settings"
              type="button"
              aria-label="Settings"
              onClick={() => {
                setNavMenuOpen(false);
                if (settingsOpen) {
                  closeSettings();
                } else {
                  openSettings();
                }
              }}
            >
              <Settings aria-hidden="true" size={18} strokeWidth={2.4} />
              <span>Settings</span>
            </button>
            <div className="dashboard-streak-card dashboard-section-card">
              <div className="dashboard-streak-label">
                <span className="dashboard-streak-dot" aria-hidden="true" />
                Current session
              </div>
              <strong>{summarySession?.name || (summarySession ? formatSessionDate(summarySession.startedAt) : "No session")}</strong>
              <div className="dashboard-section-copy">
                {summarySession
                  ? `${formatSpentTime(summarySession.durationSeconds ?? 0)} tracked`
                  : "Start or continue a session to track focus time"}
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div
        ref={dashboardMainRef}
        className={cn("dashboard-main", activeView === "Introduction" && "is-introduction-view")}
      >
        <header className={cn("dashboard-header", activeView === "Timer" && "dashboard-header-timer")}>
          <div className="dashboard-header-title-row">
            <button
              type="button"
              className="dashboard-header-menu-toggle"
              aria-label={navMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={navMenuOpen}
              aria-controls="dashboard-navigation"
              onClick={() => setNavMenuOpen((currentValue) => !currentValue)}
            >
              {navMenuOpen ? (
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.4} />
              ) : (
                <Menu aria-hidden="true" size={18} strokeWidth={2.4} />
              )}
            </button>
            <div className="dashboard-header-copy">
              <h1>{activeView}</h1>
            </div>
          </div>
          <div className="dashboard-header-actions">
            {activeView === "Sessions" ? (
              <>
                <button
                  className="session-action"
                  type="button"
                  onClick={startNewSession}
                  disabled={layoutEditMode}
                  aria-label="Add session"
                >
                  <Plus aria-hidden="true" size={16} strokeWidth={2.6} />
                </button>
                <button
                  className="session-action"
                  type="button"
                  onClick={() => {
                    if (selectedSession) {
                      removeSession(selectedSession.id);
                    }
                  }}
                  disabled={!selectedSession || layoutEditMode}
                  aria-label="Delete selected session"
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
              </>
            ) : null}
            {activeView === "Tasks" ? (
              <>
                <button
                  className="session-action"
                  type="button"
                  onClick={addTaskFromTasksView}
                  disabled={layoutEditMode}
                  aria-label="Add task"
                >
                  <Plus aria-hidden="true" size={16} strokeWidth={2.6} />
                </button>
                <button
                  className="session-action"
                  type="button"
                  onClick={() => {
                    if (activeTaskId) {
                      removeTask(activeTaskId);
                    }
                  }}
                  disabled={!activeTaskId || layoutEditMode}
                  aria-label="Delete task"
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
              </>
            ) : null}
            <button
              className="settings-button dashboard-header-settings"
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
            <button type="button" onClick={closeSettings}>
              Close
            </button>
          </div>
        </div>
      ) : null}
        {activeView === "Introduction" ? (
          <section className="intro-view is-viewport-fit" aria-label="Introduction overview">
            <div className="intro-shell">
              <div className="intro-topline">
                <Info aria-hidden="true" size={16} strokeWidth={2.2} />
                <span>Focus that remembers your work</span>
              </div>
              <div className="intro-grid">
                <section className="panel intro-hero-panel" aria-labelledby="intro-welcome-title">
                  <div className="intro-copy">
                    <h2 id="intro-welcome-title">One cycle. Clear results.</h2>
                    <p>
                      You pick a task, set your rhythm,
                      <br />
                      work one cycle - and see the result.
                      <br />
                      Work stops spilling across the day.
                    </p>
                    <div className="intro-action-row">
                      <button type="button" className="intro-primary-action" onClick={openTimerAndStart}>
                        <Play aria-hidden="true" size={18} strokeWidth={2.2} fill="currentColor" />
                        <span>{timerRunning ? "Open running session" : "Start first session"}</span>
                      </button>
                      <button type="button" className="intro-secondary-action" onClick={openTasksAndCreateTask}>
                        <Plus aria-hidden="true" size={18} strokeWidth={2.4} />
                        <span>Create task</span>
                      </button>
                    </div>
                  </div>

                  <div className="intro-focus-area">
                    <div className="intro-timer-spotlight">
                      <div className="intro-timer-dial">
                        <svg className="intro-timer-ring-svg" viewBox="0 0 240 240" aria-hidden="true">
                          <circle className="intro-timer-ring-track" cx="120" cy="120" r="88" />
                          <circle
                            className="intro-timer-ring-progress"
                            cx="120"
                            cy="120"
                            r="88"
                            pathLength="100"
                            style={{
                              strokeDasharray: `${timerProgressRatio * 100} 100`,
                            }}
                          />
                        </svg>
                        <div className="intro-timer-readout">
                          <strong>{formatTimer(timerSeconds)}</strong>
                          <div className={cn("intro-timer-mode", timerMode === "rest" && "is-rest")}>
                            <span>{timerMode === "rest" ? "Break" : "Focus"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="intro-timer-controls" aria-label="Introduction timer controls">
                      <button type="button" className="intro-icon-button" onClick={resetTimer} aria-label="Reset timer">
                        <RotateCcw aria-hidden="true" size={22} strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        className="intro-icon-button intro-icon-button-primary"
                        onClick={openTimerAndStart}
                        aria-label="Start timer"
                      >
                        <Play aria-hidden="true" size={24} strokeWidth={2.2} fill="currentColor" />
                      </button>
                      <button type="button" className="intro-icon-button" onClick={pauseTimer} aria-label="Pause timer">
                        <Pause aria-hidden="true" size={22} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                </section>

                <aside className="panel intro-steps-panel" aria-labelledby="intro-steps-title">
                  <div className="intro-steps-header">
                    <div>
                      <h2 id="intro-steps-title">Welcome to WorkCycle</h2>
                      <p>Three steps and you're in flow.</p>
                    </div>
                  </div>

                  <div className="intro-step-list">
                    <article className="intro-step-card">
                      <div className="intro-step-number">1</div>
                      <div className="intro-step-copy">
                        <strong>Choose a task</strong>
                        <p>{nextOpenTask ? `Next up: ${nextOpenTask.text}` : "Add one clear task to start your first session."}</p>
                        <button type="button" className="intro-step-action" onClick={openTasksAndCreateTask}>
                          Create task
                        </button>
                      </div>
                    </article>

                    <article className="intro-step-card">
                      <div className="intro-step-number">2</div>
                      <div className="intro-step-copy">
                        <strong>Start the cycle</strong>
                        <p>Start a {focusMinutes}-minute focus cycle with an automatic {breakMinutes}-minute break after it.</p>
                        <button type="button" className="intro-step-action is-primary" onClick={openTimerAndStart}>
                          Start timer
                        </button>
                      </div>
                    </article>

                    <article className="intro-step-card">
                      <div className="intro-step-number">3</div>
                      <div className="intro-step-copy">
                        <strong>See patterns</strong>
                        <p>After a few sessions, analytics reveal your timing, rhythm, and best hours for deep focus.</p>
                        <button type="button" className="intro-step-action" onClick={() => openView("Dashboard")}>
                          Open Dashboard
                        </button>
                      </div>
                    </article>
                  </div>

                  <div className="intro-steps-footer">You can always open Dashboard from the menu.</div>
                </aside>
              </div>

              <section className="panel intro-stats-panel" aria-labelledby="intro-stats-title">
                <div className="intro-stats-grid">
                  <article className="intro-stat-card">
                    <div className="intro-stat-label">
                      <Clock3 aria-hidden="true" size={18} strokeWidth={2.1} />
                      <span id="intro-stats-title">Today</span>
                    </div>
                    <strong>{todaySessions.length}<span>{todaySessions.length === 1 ? " session" : " sessions"}</span></strong>
                    <p>{formatSpentTime(todayFocusSeconds)}</p>
                  </article>

                  <article className="intro-stat-card">
                    <div className="intro-stat-label">
                      <CircleDot aria-hidden="true" size={18} strokeWidth={2.1} />
                      <span>Total focus</span>
                    </div>
                    <strong>{formatSpentTime(totalFocusSeconds)}</strong>
                    <p>all time</p>
                  </article>

                  <article className="intro-stat-card">
                    <div className="intro-stat-label">
                      <BarChart3 aria-hidden="true" size={18} strokeWidth={2.1} />
                      <span>Current streak</span>
                    </div>
                    <strong>{sessionStreak}<span>{sessionStreak === 1 ? " day" : " days"}</span></strong>
                    <p>{sessionStreak > 0 ? "keep it going" : "start today"}</p>
                  </article>

                  <article className="intro-stat-card">
                    <div className="intro-stat-label">
                      <CalendarDays aria-hidden="true" size={18} strokeWidth={2.1} />
                      <span>Best time</span>
                    </div>
                    <strong>{bestTimeOfDayEntry ? bestTimeOfDayEntry[0] : "—"}</strong>
                    <p>{bestTimeOfDayEntry ? "based on tracked focus" : "not enough data"}</p>
                  </article>
                </div>
              </section>
            </div>
          </section>
        ) : activeView === "Timer" ? (
          <section className="timer-view" aria-label="Timer workspace">
            {renderTimerExperience()}
          </section>
        ) : activeView === "Dashboard" ? (
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
        ) : activeView === "Sessions" ? (
          <section className="sessions-grid-view" aria-label="Sessions grid">
            {layoutEditMode ? (
              <div className="layout-save-overlay">
                <button type="button" className="layout-save-button" onClick={saveCardLayout}>
                  <Check aria-hidden="true" size={18} strokeWidth={2.8} />
                  <span>Save layout</span>
                </button>
              </div>
            ) : null}
            {sessions.length > 0 ? (
              sanitizeOrder(
                layoutEditMode ? draftSessionOrder : sessions.map((session) => session.id),
                sessions.map((session) => session.id),
              ).map((sessionId) => {
                const session = sessions.find((entry) => entry.id === sessionId);

                if (!session) {
                  return null;
                }

                const sessionTasks = tasks
                  .filter((task) => task.sessionId === session.id)
                  .map((task) => ({
                    id: task.id,
                    text: task.text,
                    seconds: session.taskSeconds?.[task.id] ?? task.focusSeconds ?? 0,
                  }))
                  .sort((firstTask, secondTask) => secondTask.seconds - firstTask.seconds);

                return (
                  <article
                    key={session.id}
                    className={cn(
                      "sessions-grid-card",
                      selectedSessionId === session.id && "is-selected",
                      layoutEditMode && "is-layout-editing",
                      draggedCardId === session.id && "is-dragging",
                    )}
                    data-session-id={session.id}
                    onPointerDown={() => {
                      selectSession(session.id);

                      if (layoutEditMode) {
                        startCardDrag(session.id);
                      }
                    }}
                  >
                    <div className="sessions-grid-card-top">
                      <div className="sessions-grid-card-head">
                        <h2>{session.name || formatSessionDate(session.startedAt)}</h2>
                        <span>{formatSessionDate(session.startedAt)}</span>
                      </div>
                      <div className="sessions-grid-card-time">{formatSpentTime(session.durationSeconds)}</div>
                    </div>
                    <div className="sessions-grid-card-tasks">
                      {sessionTasks.length > 0 ? (
                        sessionTasks.map((task) => (
                          <div key={task.id} className="sessions-grid-task-row">
                            <span>{task.text}</span>
                            <strong>{formatSpentTime(task.seconds)}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="sessions-grid-task-empty">No tasks yet</div>
                      )}
                    </div>
                    <div className="card-edit-label" aria-hidden={!layoutEditMode}>
                      Drag to move
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="sessions-grid-empty" />
            )}
          </section>
        ) : activeView === "Tasks" ? (
          <section className="tasks-view" aria-label="All tasks overview">
            <div className="tasks-view-summary">
              <article className="tasks-view-stat">
                <span>Total tasks</span>
                <strong>{allTasksOverview.length}</strong>
              </article>
              <article className="tasks-view-stat">
                <span>Open</span>
                <strong>{allTaskClasses[0].items.length}</strong>
              </article>
              <article className="tasks-view-stat">
                <span>Completed</span>
                <strong>{allTaskClasses[1].items.length}</strong>
              </article>
            </div>
            <div className="tasks-class-grid">
              {allTaskClasses.map((taskClass) => (
                <section key={taskClass.id} className="panel tasks-class-panel" aria-labelledby={`tasks-class-${taskClass.id}`}>
                  <div className="panel-header">
                    <h2 id={`tasks-class-${taskClass.id}`}>{taskClass.title}</h2>
                    <div className="analytics-summary-label">{taskClass.items.length}</div>
                  </div>
                  {taskClass.items.length > 0 ? (
                    <div className="tasks-class-list">
                      {taskClass.items.map((task) => (
                        <div
                          key={task.id}
                          className={cn("tasks-class-row", task.completed && "is-completed")}
                        >
                          <label className="task-checkbox" aria-label={`Mark ${task.text} as done`}>
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTaskCompleted(task.id)}
                              disabled={layoutEditMode}
                            />
                            <span aria-hidden="true" />
                          </label>
                          <div className="tasks-class-copy">
                            <strong>{task.text}</strong>
                            <span>{task.sessionLabel}</span>
                          </div>
                          <div className="tasks-class-time">{formatSpentTime(task.focusSeconds)}</div>
                          <button
                            type="button"
                            aria-label={`Delete task ${task.text}`}
                            onClick={() => removeTask(task.id)}
                            disabled={layoutEditMode}
                          >
                            <Trash2 aria-hidden="true" size={15} strokeWidth={2.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="placeholder-panel-body">No tasks in this class yet.</div>
                  )}
                </section>
              ))}
            </div>
          </section>
        ) : activeView === "Analytics" ? (
          <section className="analytics-view" aria-label="Whole activity analytics">
            <div className="analytics-summary-grid">
              <article className="analytics-summary-card">
                <span>Total focus</span>
                <strong>{formatSpentTime(totalFocusSeconds)}</strong>
              </article>
              <article className="analytics-summary-card">
                <span>Sessions</span>
                <strong>{sessions.length}</strong>
              </article>
              <article className="analytics-summary-card">
                <span>Tasks done</span>
                <strong>{completedTaskCount}</strong>
              </article>
              <article className="analytics-summary-card">
                <span>Completion rate</span>
                <strong>{completionRate}%</strong>
              </article>
            </div>
            <div className="analytics-detail-grid">
              <section className="panel analytics-panel" aria-labelledby="analytics-weekly-title">
                <div className="panel-header">
                  <h2 id="analytics-weekly-title">Whole activity</h2>
                  <div className="analytics-summary-label">{dashboardDate}</div>
                </div>
                <div className="chart-grid chart-grid-empty">
                  <div className="chart-mini-card chart-empty-card analytics-card">
                    <WeeklyTimeSpentChart sessions={sessions} selectedSession={null} />
                  </div>
                </div>
              </section>
              <section className="panel analytics-panel" aria-labelledby="analytics-recent-title">
                <div className="panel-header">
                  <h2 id="analytics-recent-title">Recent activity</h2>
                  <div className="analytics-summary-label">Last 7 days</div>
                </div>
                <div className="chart-grid chart-grid-empty">
                  <div className="chart-mini-card chart-empty-card analytics-card">
                    <MiniChart data={recentActivityData} />
                  </div>
                </div>
              </section>
              <section className="panel analytics-panel" aria-labelledby="analytics-top-tasks-title">
                <div className="panel-header">
                  <h2 id="analytics-top-tasks-title">Top tasks</h2>
                  <div className="analytics-summary-label">{topTaskAnalytics.length}</div>
                </div>
                {topTaskAnalytics.length > 0 ? (
                  <div className="analytics-task-list">
                    {topTaskAnalytics.map((task, index) => (
                      <div key={task.id} className="analytics-task-row">
                        <div className="analytics-task-rank">{index + 1}</div>
                        <div className="analytics-task-copy">
                          <strong>{task.text}</strong>
                          <span>{task.completed ? "Completed" : "Open"}</span>
                        </div>
                        <div className="analytics-task-time">{formatSpentTime(task.focusSeconds ?? 0)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="placeholder-panel-body">No focused task data yet.</div>
                )}
              </section>
              <section className="panel analytics-panel" aria-labelledby="analytics-momentum-title">
                <div className="panel-header">
                  <h2 id="analytics-momentum-title">Momentum</h2>
                  <div className="analytics-summary-label">Overall</div>
                </div>
                <div className="analytics-momentum-grid">
                  <article className="analytics-momentum-card">
                    <span>Current streak</span>
                    <strong>{sessionStreak} days</strong>
                  </article>
                  <article className="analytics-momentum-card">
                    <span>Average session</span>
                    <strong>{formatSpentTime(averageSessionSeconds)}</strong>
                  </article>
                  <article className="analytics-momentum-card">
                    <span>Longest session</span>
                    <strong>{formatSpentTime(longestSessionSeconds)}</strong>
                  </article>
                  <article className="analytics-momentum-card">
                    <span>Total tasks</span>
                    <strong>{tasks.length}</strong>
                  </article>
                </div>
              </section>
            </div>
          </section>
        ) : activeView === "AI Generator" ? (
          <section className="ai-generator-view" aria-label="AI generator workspace">
            <div className="ai-generator-summary">
              <article className="ai-generator-stat">
                <span>Open tasks</span>
                <strong>{allTaskClasses[0].items.length}</strong>
              </article>
              <article className="ai-generator-stat">
                <span>Total sessions</span>
                <strong>{sessions.length}</strong>
              </article>
              <article className="ai-generator-stat">
                <span>Provider</span>
                <strong>Google AI</strong>
              </article>
            </div>
            <div className="ai-generator-grid">
              <section className="panel ai-generator-panel" aria-labelledby="ai-generator-title">
                <div className="panel-header">
                  <h2 id="ai-generator-title">Prompt Builder</h2>
                  <div className="analytics-summary-label">Creates session + tasks via Google AI</div>
                </div>
                <div className="ai-generator-form">
                  <label className="ai-generator-label" htmlFor="ai-generator-input">
                    Describe what you want to achieve
                  </label>
                  <GlassInput
                    id="ai-generator-input"
                    className="ai-generator-input"
                    type="text"
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Example: Create Landing website"
                  />
                  <div className="ai-generator-actions">
                    <GlassButton
                      onClick={generateAiSessionPlan}
                      disabled={aiLoading || !aiPrompt.trim()}
                    >
                      {aiLoading ? "Generating..." : "Generate"}
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      disabled={aiLoading}
                      onClick={() => {
                        setAiPrompt("");
                        setAiResult("");
                        setAiError("");
                      }}
                    >
                      Clear
                    </GlassButton>
                  </div>
                  {aiError ? <div className="ai-generator-error">{aiError}</div> : null}
                </div>
                <div className="ai-generator-output" aria-live="polite">
                  {aiResult || "Your generated session and task list will appear here."}
                </div>
              </section>
            </div>
          </section>
        ) : (
          <section className="board board-placeholder" aria-label={`${activeView} content`} />
        )}
      </div>
    </main>
  );
}
