"use client";

import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
  const speakerTones = new Map<string, string>();
  for (const speaker of Array.from(
    parsed.body.querySelectorAll<HTMLElement>(".speaker"),
  )) {
    const speakerName = speaker.textContent?.trim().toLocaleLowerCase() ?? "";
    let toneClass = speakerTones.get(speakerName);
    if (!toneClass) {
      toneClass = `speaker-tone-${(speakerTones.size % 6) + 1}`;
      speakerTones.set(speakerName, toneClass);
    }
    speaker.classList.add(toneClass);
    speaker.closest(".line")?.classList.add(toneClass);
  }
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
    "speaker-tone-1",
    "speaker-tone-2",
    "speaker-tone-3",
    "speaker-tone-4",
    "speaker-tone-5",
    "speaker-tone-6",
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
}: {
  episode: Episode;
  active: boolean;
  completed: boolean;
  onSelect: (episode: Episode) => void;
}) {
  return (
    <button
      className={`episode-row ${active ? "is-active" : ""}`}
      onClick={() => onSelect(episode)}
      aria-current={active ? "true" : undefined}
    >
      <span className="episode-number" aria-hidden="true">
        {active ? "▶" : completed ? "✓" : episode.id}
      </span>
      <span className="episode-copy">
        <strong>{episode.title}</strong>
        <span>{episode.level}</span>
      </span>
      {active && <span className="now-label">NOW</span>}
    </button>
  );
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
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
      setTranscriptLoading(true);
      setTranscriptError(false);
      setSidebarOpen(false);
      localStorage.setItem(STORAGE.episode, String(episode.id));
    },
    [currentId, savePosition],
  );

  const nextEpisode = useCallback(
    (autoplay = true) => {
      const next = episodes[(currentIndex + 1) % episodes.length];
      selectEpisode(next, autoplay);
    },
    [currentIndex, selectEpisode],
  );

  const previousEpisode = useCallback(() => {
    const previous =
      episodes[(currentIndex - 1 + episodes.length) % episodes.length];
    selectEpisode(previous);
  }, [currentIndex, selectEpisode]);

  const shuffleEpisode = useCallback(() => {
    const pool = visibleEpisodes.length > 1 ? visibleEpisodes : episodes;
    const candidates = pool.filter((episode) => episode.id !== currentId);
    const next =
      candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
    selectEpisode(next);
  }, [currentId, selectEpisode, visibleEpisodes]);

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
    const controller = new AbortController();
    let active = true;
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
      .catch((error: Error) => {
        if (active && error.name !== "AbortError") setTranscriptError(true);
      })
      .finally(() => {
        if (active) setTranscriptLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [currentEpisode]);

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
    const completed = readNumberMap(STORAGE.completed);
    completed[String(currentId)] = 1;
    localStorage.setItem(STORAGE.completed, JSON.stringify(completed));
    setCompletedIds((ids) =>
      ids.includes(currentId) ? ids : [...ids, currentId],
    );
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

      <aside className={`library-panel ${sidebarOpen ? "is-open" : ""}`}>
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
            <button className="soft-button" onClick={() => setHelpOpen(true)}>
              ? <span>Quick guide</span>
            </button>
            <button
              className="soft-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "☀" : "☾"} <span>{theme}</span>
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

        <div className="episode-list">
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
                ↶<small>10</small>
              </button>
              <button onClick={previousEpisode} aria-label="Previous episode">
                |◀
              </button>
              <button
                className="play-button"
                onClick={() => void togglePlayback()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? "…" : isPlaying ? "Ⅱ" : "▶"}
              </button>
              <button onClick={() => nextEpisode()} aria-label="Next episode">
                ▶|
              </button>
              <button
                className="skip-button"
                onClick={() => seek(10)}
                aria-label="Forward 10 seconds"
                title="Forward 10 seconds"
              >
                ↷<small>10</small>
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
                className="speed-button"
                onClick={() => {
                  const index = PLAYBACK_RATES.indexOf(playbackRate);
                  setPlaybackRate(
                    PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length],
                  );
                }}
                title="Change playback speed"
              >
                {playbackRate}×
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
            <button
              className="modal-close"
              onClick={() => setHelpOpen(false)}
              aria-label="Close quick guide"
            >
              ×
            </button>
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
            <p>
              Your episode, position, filters, grouping, transcript visibility,
              loop, autoplay, and speed are saved on this device.
            </p>
            <p className="project-disclaimer">
              Independent educational project. Not affiliated with or endorsed
              by EnglishPod.
            </p>
            <button className="primary-button" onClick={() => setHelpOpen(false)}>
              Start listening
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
