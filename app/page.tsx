"use client";

import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import episodesData from "./data/episodes.json";

type Episode = {
  id: number;
  original_title: string;
  title: string;
  level: string;
  mp3: string;
  poster: string;
  transcript_id: string;
  transcript_url: string;
};

type SortMode = "number-asc" | "number-desc" | "title";
type Theme = "light" | "dark";
type PersistedSettings = {
  loop: boolean;
  autoplayNext: boolean;
  groupByLevel: boolean;
  selectedLevel: string;
  transcriptVisible: boolean;
  sortMode: SortMode;
  playbackRate: number;
};

const episodes = episodesData as Episode[];
const LEVEL_ORDER = [
  "Elementary",
  "Intermediate",
  "Upper-Intermediate",
  "Advanced",
  "Daily Life",
  "The Office",
  "The Weekend",
  "Global View",
  "Advanced Media",
];
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DEFAULT_AUDIO_BASE =
  "https://ia800408.us.archive.org/10/items/englishpod_all";
const ARCHIVE_AUDIO_FALLBACKS = [
  "https://ia600408.us.archive.org/10/items/englishpod_all",
  "https://archive.org/download/englishpod_all",
];
const EXTERNAL_AUDIO_BASES = [
  DEFAULT_AUDIO_BASE,
  ...ARCHIVE_AUDIO_FALLBACKS,
];
const STORAGE = {
  episode: "englishpod:last-episode",
  positions: "englishpod:positions",
  completed: "englishpod:completed",
  theme: "englishpod:theme",
  settings: "englishpod:settings-v1",
};
const SORT_MODES: SortMode[] = ["number-asc", "number-desc", "title"];
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
const SLEEP_TIMER_OPTIONS = [0, 15, 30, 45, 60] as const;

type MediaIconName =
  | "replay10"
  | "previous"
  | "play"
  | "pause"
  | "next"
  | "forward10";

// Google Material Symbols Rounded, Apache 2.0:
// https://github.com/google/material-design-icons
const MEDIA_ICON_PATHS: Record<MediaIconName, string> = {
  replay10:
    "M360-514.67h-30q-11.27 0-18.63-7.57-7.37-7.58-7.37-19.17 0-11.59 7.56-18.76 7.55-7.16 19.11-7.16h56.66q11.67 0 18.84 7.16 7.16 7.17 7.16 18.84V-340q0 11.56-7.57 19.11-7.58 7.56-19.17 7.56-11.59 0-19.09-7.56-7.5-7.55-7.5-19.11v-174.67Zm144.67 201.34q-18.14 0-30.4-12.27Q462-337.87 462-356v-168.67q0-18.13 12.27-30.4 12.26-12.26 30.4-12.26h82q18.13 0 30.4 12.26 12.26 12.27 12.26 30.4V-356q0 18.13-12.26 30.4-12.27 12.27-30.4 12.27h-82Zm10.66-53.34H576v-148h-60.67v148ZM480-80q-75 0-140.5-28.17-65.5-28.16-114.33-77-48.84-48.83-77-114.33Q120-365 120-440q0-14.17 9.62-23.75 9.61-9.58 23.83-9.58 14.22 0 23.72 9.58 9.5 9.58 9.5 23.75 0 122.57 85.38 207.95T480-146.67q122.57 0 207.95-85.38T773.33-440q0-122.57-83.83-207.95t-206.17-85.38h-16.66l46 46q10 10 9.83 23.33-.17 13.33-9.57 23.33-10.26 10-23.76 10.17-13.5.17-23.5-9.83L361.33-744.67q-10-10-10-23.33 0-13.33 10-23.33l105-105q9.34-9.34 23.17-9.17 13.83.17 23.4 9.5 8.77 9.33 8.93 23 .17 13.67-9.16 23l-50 50H480q75 0 140.5 28.17 65.5 28.16 114.33 77 48.84 48.83 77 114.33Q840-515 840-440t-28.17 140.5q-28.16 65.5-77 114.33-48.83 48.84-114.33 77Q555-80 480-80Z",
  previous:
    "M220-273.33v-413.34q0-14.16 9.62-23.75 9.61-9.58 23.83-9.58 14.22 0 23.72 9.58 9.5 9.59 9.5 23.75v413.34q0 14.16-9.62 23.75-9.62 9.58-23.83 9.58-14.22 0-23.72-9.58-9.5-9.59-9.5-23.75Zm468-2.34L430-452.33q-7.67-5.34-11.17-12.37-3.5-7.03-3.5-15.3t3.5-15.3q3.5-7.03 11.17-12.37l258-176.66q4.33-3.34 9-4.67t9.67-1.33q13.33 0 23.33 9.16Q740-672 740-657v354q0 15-10 24.17-10 9.16-23.33 9.16-5 0-9.67-1.33t-9-4.67Z",
  play:
    "M292-247.33v-469.34q0-24 15.71-38.5 15.72-14.5 36.34-14.5 6.8 0 14.21 1.67 7.41 1.67 14.66 5.95l369.41 236.38q11.67 7.67 18 19.17 6.34 11.5 6.34 24.5t-6.34 24.5q-6.33 11.5-18 19.17L372.92-201.95q-7.25 4.28-14.68 5.62Q350.81-195 344-195q-20.67 0-36.33-14.02Q292-223.03 292-247.33Z",
  pause:
    "M623.33-200q-27.5 0-47.08-19.58-19.58-19.59-19.58-47.09v-426.66q0-27.5 19.58-47.09Q595.83-760 623.33-760H660q27.5 0 47.08 19.58 19.59 19.59 19.59 47.09v426.66q0 27.5-19.59 47.09Q687.5-200 660-200h-36.67ZM300-200q-27.5 0-47.08-19.58-19.59-19.59-19.59-47.09v-426.66q0-27.5 19.59-47.09Q272.5-760 300-760h36.67q27.5 0 47.08 19.58 19.58 19.59 19.58 47.09v426.66q0 27.5-19.58 47.09Q364.17-200 336.67-200H300Z",
  next:
    "M673.33-273.33v-413.34q0-14.16 9.62-23.75 9.62-9.58 23.83-9.58 14.22 0 23.72 9.58 9.5 9.59 9.5 23.75v413.34q0 14.16-9.62 23.75-9.61 9.58-23.83 9.58-14.22 0-23.72-9.58-9.5-9.59-9.5-23.75ZM220-303v-354q0-15 10-24.17 10-9.16 23.33-9.16 5 0 9.67 1.33t9 4.67l258 176.66q7.67 5.34 11.17 12.37 3.5 7.03 3.5 15.3t-3.5 15.3q-3.5 7.03-11.17 12.37L272-275.67q-4.33 3.34-9 4.67t-9.67 1.33q-13.33 0-23.33-9.16Q220-288 220-303Z",
  forward10:
    "M480-80q-75 0-140.5-28.17-65.5-28.16-114.33-77-48.84-48.83-77-114.33Q120-365 120-440t28.17-140.5q28.16-65.5 77-114.33 48.83-48.84 114.33-77Q405-800 480-800h17.33L448-849.33q-9.33-9.34-9.17-23 .17-13.67 8.94-23 9.56-9.34 23.06-9.84 13.5-.5 22.84 8.84l105 105q10 10 10 23.33 0 13.33-10 23.33L494.33-640.33q-10 10-23.5 9.83-13.5-.17-23.76-10.17-9.4-10-9.57-23.33-.17-13.33 9.83-23.33l46-46h-16.66q-122.34 0-206.17 85.38-83.83 85.38-83.83 207.95t85.38 207.95q85.38 85.38 207.95 85.38t207.95-85.38q85.38-85.38 85.38-207.95 0-14.17 9.62-23.75t23.83-9.58q14.22 0 23.72 9.58 9.5 9.58 9.5 23.75 0 75-28.17 140.5-28.16 65.5-77 114.33-48.83 48.84-114.33 77Q555-80 480-80ZM360-514.67h-30q-11.27 0-18.63-7.57-7.37-7.58-7.37-19.17 0-11.59 7.56-18.76 7.55-7.16 19.11-7.16h56.66q11.67 0 18.84 7.16 7.16 7.17 7.16 18.84V-340q0 11.56-7.57 19.11-7.58 7.56-19.17 7.56-11.59 0-19.09-7.56-7.5-7.55-7.5-19.11v-174.67Zm144.67 201.34q-18.14 0-30.4-12.27Q462-337.87 462-356v-168.67q0-18.13 12.27-30.4 12.26-12.26 30.4-12.26h82q18.13 0 30.4 12.26 12.26 12.27 12.26 30.4V-356q0 18.13-12.26 30.4-12.27 12.27-30.4 12.27h-82Zm10.66-53.34H576v-148h-60.67v148Z",
};

function MediaIcon({ name }: { name: MediaIconName }) {
  return (
    <svg
      className={`media-icon media-icon-${name}`}
      viewBox="0 -960 960 960"
      aria-hidden="true"
      focusable="false"
    >
      <path d={MEDIA_ICON_PATHS[name]} />
    </svg>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function readNumberMap(key: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) =>
          /^\d+$/.test(key) && typeof value === "number" && Number.isFinite(value),
      ),
    );
  } catch {
    return {};
  }
}

function readSettings(): Partial<PersistedSettings> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE.settings) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function sanitizeTranscriptHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  // Every source file repeats the current episode title as its first H1.
  // The page already shows that title prominently, so remove only this copy.
  parsed.body.querySelector("h1")?.remove();
  const allowedTags = new Set([
    "H1",
    "H2",
    "DIV",
    "P",
    "SPAN",
    "UL",
    "OL",
    "LI",
    "BR",
    "STRONG",
    "EM",
  ]);
  const allowedClasses = new Set([
    "dialogue-block",
    "line",
    "speaker",
    "text",
    "vocab-block",
    "vocab-item",
    "word",
    "type",
    "definition",
  ]);

  for (const element of Array.from(parsed.body.querySelectorAll("*"))) {
    if (!allowedTags.has(element.tagName)) {
      const parent = element.parentNode;
      if (parent) {
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        element.remove();
      }
      continue;
    }

    const safeClasses = Array.from(element.classList).filter((className) =>
      allowedClasses.has(className),
    );
    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
    if (safeClasses.length > 0) element.className = safeClasses.join(" ");
  }

  return parsed.body.innerHTML;
}

function EpisodeRow({
  episode,
  active,
  completed,
  onSelect,
  onToggleCompleted,
}: {
  episode: Episode;
  active: boolean;
  completed: boolean;
  onSelect: (episode: Episode) => void;
  onToggleCompleted: (episodeId: number, completed: boolean) => void;
}) {
  return (
    <div className={`episode-row ${active ? "is-active" : ""}`}>
      <button
        className="episode-select"
        onClick={() => onSelect(episode)}
        aria-current={active ? "true" : undefined}
      >
        <span className="episode-number" aria-hidden="true">
          {episode.id}
        </span>
        <span className="episode-copy">
          <strong>{episode.title}</strong>
          <span>{episode.level}</span>
        </span>
      </button>
      <button
        className={`episode-complete ${completed ? "is-finished" : ""}`}
        onClick={() => onToggleCompleted(episode.id, !completed)}
        aria-label={
          completed
            ? `Mark ${episode.title} as unfinished`
            : `Mark ${episode.title} as finished`
        }
        aria-pressed={completed}
        title={completed ? "Marked as finished" : "Mark as finished"}
      >
        <span aria-hidden="true">✓</span>
      </button>
    </div>
  );
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const episodeListRef = useRef<HTMLDivElement>(null);
  const sidebarSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingAutoplayRef = useRef(false);
  const lastPositionWriteRef = useRef(0);
  const [currentId, setCurrentId] = useState(5);
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("number-asc");
  const [groupByLevel, setGroupByLevel] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [transcriptLoading, setTranscriptLoading] = useState(true);
  const [transcriptError, setTranscriptError] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [audioSourceIndex, setAudioSourceIndex] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const currentEpisode =
    episodes.find((episode) => episode.id === currentId) ?? episodes[0];
  const currentIndex = episodes.findIndex((episode) => episode.id === currentId);
  const audioFileName = `${currentEpisode.transcript_id}pb.mp3`;
  const audioUrl = `${EXTERNAL_AUDIO_BASES[audioSourceIndex]}/${audioFileName}`;

  const levels = useMemo(
    () =>
      LEVEL_ORDER.filter((level) =>
        episodes.some((episode) => episode.level === level),
      ),
    [],
  );

  const visibleEpisodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = episodes.filter((episode) => {
      const matchesLevel =
        selectedLevel === "All" || episode.level === selectedLevel;
      const matchesQuery =
        !normalized ||
        episode.title.toLowerCase().includes(normalized) ||
        episode.level.toLowerCase().includes(normalized) ||
        String(episode.id).includes(normalized);
      return matchesLevel && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "number-desc") return b.id - a.id;
      if (sortMode === "title") return a.title.localeCompare(b.title);
      return a.id - b.id;
    });
  }, [query, selectedLevel, sortMode]);

  const groupedEpisodes = useMemo(() => {
    if (!groupByLevel) return [["Episodes", visibleEpisodes]] as [
      string,
      Episode[],
    ][];
    return levels
      .map(
        (level) =>
          [
            level,
            visibleEpisodes.filter((episode) => episode.level === level),
          ] as [string, Episode[]],
      )
      .filter(([, items]) => items.length > 0);
  }, [groupByLevel, levels, visibleEpisodes]);

  const savePosition = useCallback((episodeId: number, position: number) => {
    const positions = readNumberMap(STORAGE.positions);
    positions[String(episodeId)] = Math.max(0, Math.floor(position));
    localStorage.setItem(STORAGE.positions, JSON.stringify(positions));
    localStorage.setItem(STORAGE.episode, String(episodeId));
  }, []);

  const selectEpisode = useCallback(
    (episode: Episode, autoplay = true) => {
      if (audioRef.current) {
        savePosition(currentId, audioRef.current.currentTime);
        audioRef.current.pause();
      }
      pendingAutoplayRef.current = autoplay;
      setAudioSourceIndex(0);
      setCurrentId(episode.id);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setTranscript("");
      setTranscriptLoading(true);
      setTranscriptError(false);
      setSidebarOpen(false);
      localStorage.setItem(STORAGE.episode, String(episode.id));
    },
    [currentId, savePosition],
  );

  const nextEpisode = useCallback(
    (autoplay = true) => {
      const orderedCandidates = Array.from(
        { length: episodes.length },
        (_, offset) => episodes[(currentIndex + offset + 1) % episodes.length],
      );
      const next =
        orderedCandidates.find(
          (episode) => !completedIds.includes(episode.id),
        ) ?? orderedCandidates[0];
      selectEpisode(next, autoplay);
    },
    [completedIds, currentIndex, selectEpisode],
  );

  const previousEpisode = useCallback(() => {
    const previousCandidates = Array.from(
      { length: episodes.length },
      (_, offset) =>
        episodes[
          (currentIndex - offset - 1 + episodes.length) % episodes.length
        ],
    );
    const previous =
      previousCandidates.find(
        (episode) => !completedIds.includes(episode.id),
      ) ?? previousCandidates[0];
    selectEpisode(previous);
  }, [completedIds, currentIndex, selectEpisode]);

  const shuffleEpisode = useCallback(() => {
    const pool = visibleEpisodes.length > 1 ? visibleEpisodes : episodes;
    const unfinishedVisible = pool.filter(
      (episode) =>
        episode.id !== currentId && !completedIds.includes(episode.id),
    );
    const unfinishedAnywhere = episodes.filter(
      (episode) =>
        episode.id !== currentId && !completedIds.includes(episode.id),
    );
    const candidates =
      unfinishedVisible.length > 0
        ? unfinishedVisible
        : unfinishedAnywhere.length > 0
          ? unfinishedAnywhere
          : pool.filter((episode) => episode.id !== currentId);
    const next =
      candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
    selectEpisode(next);
  }, [completedIds, currentId, selectEpisode, visibleEpisodes]);

  const updateCompleted = useCallback(
    (episodeId: number, completed: boolean) => {
      const savedCompleted = readNumberMap(STORAGE.completed);
      if (completed) {
        savedCompleted[String(episodeId)] = 1;
      } else {
        delete savedCompleted[String(episodeId)];
      }
      localStorage.setItem(STORAGE.completed, JSON.stringify(savedCompleted));
      setCompletedIds((ids) =>
        completed
          ? ids.includes(episodeId)
            ? ids
            : [...ids, episodeId]
          : ids.filter((id) => id !== episodeId),
      );
    },
    [],
  );

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setIsBuffering(true);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      } finally {
        setIsBuffering(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(
      Math.max(0, audio.currentTime + seconds),
      audio.duration || Infinity,
    );
  }, []);

  const cycleSleepTimer = useCallback(() => {
    setSleepTimerMinutes((current) => {
      const index = SLEEP_TIMER_OPTIONS.indexOf(
        current as (typeof SLEEP_TIMER_OPTIONS)[number],
      );
      return SLEEP_TIMER_OPTIONS[(index + 1) % SLEEP_TIMER_OPTIONS.length];
    });
  }, []);

  const handleSidebarTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      sidebarSwipeStartRef.current = touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
    },
    [],
  );

  const handleSidebarTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      const start = sidebarSwipeStartRef.current;
      const touch = event.changedTouches[0];
      sidebarSwipeStartRef.current = null;
      if (!start || !touch) return;
      const distanceX = start.x - touch.clientX;
      const distanceY = Math.abs(start.y - touch.clientY);
      if (distanceX >= 56 && distanceX > distanceY * 1.25) {
        setSidebarOpen(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const savedId = Number(localStorage.getItem(STORAGE.episode));
      const savedTheme = localStorage.getItem(STORAGE.theme) as Theme | null;
      const savedCompleted = readNumberMap(STORAGE.completed);
      const savedSettings = readSettings();
      if (episodes.some((episode) => episode.id === savedId)) {
        setCurrentId(savedId);
      }
      setCompletedIds(
        Object.entries(savedCompleted)
          .filter(([, value]) => Boolean(value))
          .map(([id]) => Number(id)),
      );
      const nextTheme =
        savedTheme === "light" || savedTheme === "dark"
          ? savedTheme
          : window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      if (typeof savedSettings.loop === "boolean") setLoop(savedSettings.loop);
      if (typeof savedSettings.autoplayNext === "boolean") {
        setAutoplayNext(savedSettings.autoplayNext);
      }
      if (typeof savedSettings.groupByLevel === "boolean") {
        setGroupByLevel(savedSettings.groupByLevel);
      }
      if (
        savedSettings.selectedLevel === "All" ||
        LEVEL_ORDER.includes(savedSettings.selectedLevel ?? "")
      ) {
        setSelectedLevel(savedSettings.selectedLevel ?? "All");
      }
      if (typeof savedSettings.transcriptVisible === "boolean") {
        setTranscriptVisible(savedSettings.transcriptVisible);
      }
      if (SORT_MODES.includes(savedSettings.sortMode as SortMode)) {
        setSortMode(savedSettings.sortMode as SortMode);
      }
      if (PLAYBACK_RATES.includes(savedSettings.playbackRate ?? 0)) {
        setPlaybackRate(savedSettings.playbackRate ?? 1);
      }
      setSettingsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE.theme, theme);
  }, [theme]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const frameId = window.requestAnimationFrame(() => {
      episodeListRef.current
        ?.querySelector<HTMLElement>(".episode-row.is-active")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [sidebarOpen]);

  useEffect(() => {
    if (sleepTimerMinutes === 0) return;
    const timerId = window.setTimeout(() => {
      audioRef.current?.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      setSleepTimerMinutes(0);
    }, sleepTimerMinutes * 60_000);
    return () => window.clearTimeout(timerId);
  }, [sleepTimerMinutes]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const settings: PersistedSettings = {
      loop,
      autoplayNext,
      groupByLevel,
      selectedLevel,
      transcriptVisible,
      sortMode,
      playbackRate,
    };
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  }, [
    autoplayNext,
    groupByLevel,
    loop,
    playbackRate,
    selectedLevel,
    settingsLoaded,
    sortMode,
    transcriptVisible,
  ]);

  useEffect(() => {
    if (!transcriptVisible) return;
    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setTranscriptLoading(true);
      setTranscriptError(false);
    });
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    fetch(
      `${BASE_PATH}/transcripts/${currentEpisode.transcript_id}.html`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Transcript unavailable");
        return response.text();
      })
      .then((html) => {
        if (!active) return;
        setTranscript(sanitizeTranscriptHtml(html));
      })
      .catch(() => {
        if (active) setTranscriptError(true);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (active) setTranscriptLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentEpisode.transcript_id, transcriptVisible]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "BUTTON"
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlayback();
      } else if (event.key === "ArrowLeft") {
        seek(-10);
      } else if (event.key === "ArrowRight") {
        seek(10);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [seek, togglePlayback]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentEpisode.title,
      artist: `engpod · ${currentEpisode.level}`,
      album: "engpod listening library",
      artwork: [{ src: `${BASE_PATH}/logo.jpg`, sizes: "500x500" }],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      void togglePlayback();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => seek(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => seek(10));
    navigator.mediaSession.setActionHandler("previoustrack", previousEpisode);
    navigator.mediaSession.setActionHandler("nexttrack", () => nextEpisode());
  }, [
    currentEpisode,
    nextEpisode,
    previousEpisode,
    seek,
    togglePlayback,
  ]);

  useEffect(() => {
    const handlePageHide = () => {
      if (audioRef.current) {
        savePosition(currentId, audioRef.current.currentTime);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [currentId, savePosition]);

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    audio.playbackRate = playbackRate;
    const savedPosition = readNumberMap(STORAGE.positions)[String(currentId)] ?? 0;
    if (savedPosition > 0 && savedPosition < audio.duration - 5) {
      audio.currentTime = savedPosition;
      setCurrentTime(savedPosition);
    }
    if (pendingAutoplayRef.current) {
      pendingAutoplayRef.current = false;
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
    if (Date.now() - lastPositionWriteRef.current > 5000) {
      lastPositionWriteRef.current = Date.now();
      savePosition(currentId, audio.currentTime);
    }
  };

  const onEnded = () => {
    updateCompleted(currentId, true);
    setIsPlaying(false);
    if (loop && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().then(() => setIsPlaying(true));
    } else if (autoplayNext) {
      nextEpisode(true);
    }
  };

  const handleProgressChange = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const preventSliderKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
  };

  return (
    <main className="app-shell">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        loop={false}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          if (audioSourceIndex < EXTERNAL_AUDIO_BASES.length - 1) {
            setAudioSourceIndex((index) => index + 1);
          } else {
            setIsBuffering(false);
            setIsPlaying(false);
          }
        }}
        onEnded={onEnded}
      />

      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close episode library"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`library-panel ${sidebarOpen ? "is-open" : ""}`}
        onTouchStart={handleSidebarTouchStart}
        onTouchEnd={handleSidebarTouchEnd}
        onTouchCancel={() => {
          sidebarSwipeStartRef.current = null;
        }}
      >
        <div className="brand-block">
          <div className="brand-row">
            {/* Static local asset; optimization endpoints do not exist on Pages. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/logo.jpg`}
              alt=""
              className="brand-logo"
            />
            <div>
              <h1>eng<span>pod</span></h1>
            </div>
            <button
              className="mobile-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close episode library"
            >
              ×
            </button>
          </div>
          <div className="brand-actions">
            <button
              className="soft-button"
              onClick={() => {
                setSidebarOpen(false);
                setHelpOpen(true);
              }}
            >
              ? <span>Quick guide</span>
            </button>
          </div>
        </div>

        <div className="library-tools">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, level, or number"
              aria-label="Search episodes"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                ×
              </button>
            )}
          </label>

          <div className="level-filters" aria-label="Filter by level">
            {["All", ...levels].map((level) => {
              const count =
                level === "All"
                  ? episodes.length
                  : episodes.filter((episode) => episode.level === level).length;
              return (
                <button
                  key={level}
                  className={selectedLevel === level ? "is-selected" : ""}
                  onClick={() => setSelectedLevel(level)}
                >
                  {level} <span>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="list-options">
            <label>
              <span>Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                aria-label="Sort episodes"
              >
                <option value="number-asc">Oldest first</option>
                <option value="number-desc">Newest first</option>
                <option value="title">Title A–Z</option>
              </select>
            </label>
            <button
              className={groupByLevel ? "is-selected" : ""}
              onClick={() => setGroupByLevel((value) => !value)}
              aria-pressed={groupByLevel}
            >
              Group levels
            </button>
          </div>
        </div>

        <div className="episode-list" ref={episodeListRef}>
          <div className="results-line">
            <span>{visibleEpisodes.length} episodes</span>
            <span>{completedIds.length} finished</span>
          </div>
          {groupedEpisodes.map(([group, items]) => (
            <section className="episode-group" key={group}>
              {groupByLevel && (
                <div className="group-heading">
                  <h2>{group}</h2>
                  <span>{items.length}</span>
                </div>
              )}
              {items.map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  active={episode.id === currentId}
                  completed={completedIds.includes(episode.id)}
                  onSelect={selectEpisode}
                  onToggleCompleted={updateCompleted}
                />
              ))}
            </section>
          ))}
          {visibleEpisodes.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <strong>No episodes found</strong>
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedLevel("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="content-panel">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open episode library"
          >
            ☰
          </button>
          <p>small step every day</p>
          <div className="topbar-actions">
            <button onClick={shuffleEpisode} title="Play a random episode">
              <span aria-hidden="true">🎲</span>{" "}
              <span className="topbar-label">Random</span>
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </header>

        <div className="lesson-scroll">
          <div className="lesson">
            <div className="lesson-heading">
              <div>
                <div className="eyebrow">
                  <button
                    className="level-shortcut"
                    onClick={() => {
                      setSelectedLevel(currentEpisode.level);
                      setSidebarOpen(true);
                    }}
                    aria-label={`Open ${currentEpisode.level} episodes`}
                    title={`Show all ${currentEpisode.level} episodes`}
                  >
                    {currentEpisode.level}
                  </button>
                  <span>Episode {currentEpisode.id} of {episodes.length}</span>
                </div>
                <h2>{currentEpisode.title}</h2>
              </div>
              <button
                className={`heading-complete ${
                  completedIds.includes(currentId) ? "is-finished" : ""
                }`}
                onClick={() =>
                  updateCompleted(
                    currentId,
                    !completedIds.includes(currentId),
                  )
                }
                aria-label={
                  completedIds.includes(currentId)
                    ? "Mark episode as unfinished"
                    : "Mark episode as finished"
                }
                aria-pressed={completedIds.includes(currentId)}
                title={
                  completedIds.includes(currentId)
                    ? "Marked as finished"
                    : "Mark as finished"
                }
              >
                <span aria-hidden="true">✓</span>
              </button>
            </div>

            <section className="transcript-card">
              <div className="card-heading">
                <div>
                  <span className="section-kicker">READ ALONG</span>
                  <h3>Transcript & vocabulary</h3>
                </div>
                <button
                  onClick={() => setTranscriptVisible((value) => !value)}
                  aria-expanded={transcriptVisible}
                >
                  {transcriptVisible ? "Hide notes" : "Show notes"}
                </button>
              </div>

              {transcriptVisible && (
                <div
                  className={`transcript-content ${
                    transcriptLoading ? "is-loading" : ""
                  }`}
                >
                  {transcriptLoading && (
                    <div className="transcript-skeleton" aria-live="polite">
                      Loading transcript…
                    </div>
                  )}
                  {transcriptError && (
                    <div className="transcript-error">
                      <strong>Transcript could not be loaded.</strong>
                      <p>
                        The audio is still available. Refresh the page to try
                        loading the notes again.
                      </p>
                    </div>
                  )}
                  {!transcriptLoading && !transcriptError && (
                    <div dangerouslySetInnerHTML={{ __html: transcript }} />
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="player" aria-label="Audio player">
          <div className="progress-wrap">
            <span className="progress-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleProgressChange}
              onKeyDown={preventSliderKeys}
              aria-label="Episode progress"
              style={
                {
                  "--progress":
                    duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                } as React.CSSProperties
              }
            />
            <span className="progress-time">{formatTime(duration)}</span>
          </div>

          <div className="player-main">
            <div className="transport">
              <button
                className="skip-button"
                onClick={() => seek(-10)}
                aria-label="Back 10 seconds"
                title="Back 10 seconds"
              >
                <MediaIcon name="replay10" />
              </button>
              <button
                className="track-button"
                onClick={previousEpisode}
                aria-label="Previous episode"
              >
                <MediaIcon name="previous" />
              </button>
              <button
                className="play-button"
                onClick={() => void togglePlayback()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <span className="buffering-glyph" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <MediaIcon name={isPlaying ? "pause" : "play"} />
                )}
              </button>
              <button
                className="track-button"
                onClick={() => nextEpisode()}
                aria-label="Next episode"
              >
                <MediaIcon name="next" />
              </button>
              <button
                className="skip-button"
                onClick={() => seek(10)}
                aria-label="Forward 10 seconds"
                title="Forward 10 seconds"
              >
                <MediaIcon name="forward10" />
              </button>
            </div>

            <div className="player-options">
              <button
                className={autoplayNext ? "is-on" : ""}
                onClick={() => setAutoplayNext((value) => !value)}
                aria-pressed={autoplayNext}
                title="Autoplay next episode"
              >
                <span aria-hidden="true">⏭</span>
                <span className="control-label">Auto next</span>
              </button>
              <button
                className={loop ? "is-on" : ""}
                onClick={() => setLoop((value) => !value)}
                aria-pressed={loop}
                title="Loop this episode"
              >
                <span aria-hidden="true">↻</span>
                <span className="control-label">Loop</span>
              </button>
              <button
                className={`sleep-button ${sleepTimerMinutes > 0 ? "is-on" : ""}`}
                onClick={cycleSleepTimer}
                aria-label={
                  sleepTimerMinutes > 0
                    ? `Sleep timer set for ${sleepTimerMinutes} minutes`
                    : "Sleep timer off"
                }
                aria-pressed={sleepTimerMinutes > 0}
                title={
                  sleepTimerMinutes > 0
                    ? `Pause after ${sleepTimerMinutes} minutes`
                    : "Set a sleep timer"
                }
              >
                <span className="sleep-icon" aria-hidden="true">☾</span>
                <span className="control-label">
                  {sleepTimerMinutes > 0 ? `${sleepTimerMinutes}m` : "Sleep"}
                </span>
              </button>
              <button
                className={`speed-button ${
                  playbackRate !== 1 ? "is-on" : ""
                }`}
                onClick={() => {
                  const index = PLAYBACK_RATES.indexOf(playbackRate);
                  setPlaybackRate(
                    PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length],
                  );
                }}
                title="Change playback speed"
              >
                <span className="speed-value">{playbackRate}×</span>
                <span className="control-label">Speed</span>
              </button>
            </div>
          </div>

        </section>
      </section>

      {helpOpen && (
        <div className="modal-wrap" role="presentation">
          <button
            className="modal-scrim"
            aria-label="Close quick guide"
            onClick={() => setHelpOpen(false)}
          />
          <section
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <span className="section-kicker">QUICK GUIDE</span>
            <h2 id="guide-title">Make each listen count</h2>
            <ol>
              <li>
                <strong>Listen once</strong>
                <span>Focus on the situation without reading.</span>
              </li>
              <li>
                <strong>Read along</strong>
                <span>Replay difficult parts with the transcript open.</span>
              </li>
              <li>
                <strong>Repeat aloud</strong>
                <span>Copy the speakers’ rhythm and stress.</span>
              </li>
            </ol>
            <button className="primary-button" onClick={() => setHelpOpen(false)}>
              Start listening
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
