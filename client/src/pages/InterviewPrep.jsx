import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FiCheck,
  FiLock,
  FiHelpCircle,
  FiZap,
  FiArrowRight,
  FiSearch,
  FiChevronDown,
  FiX,
  FiRotateCcw,
} from "react-icons/fi";
import { api } from "../lib/api";
import { getDifficultyRGB } from "../constants/difficulty";
import SkeletonCard from "../components/SkeletonCard";
import EmptyState from "../components/EmptyState";

const untilLabel = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const StateBadge = ({ item }) => {
  if (item.masteryStatus === "Mastered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-500">
        <FiCheck size={10} /> Mastered
      </span>
    );
  }
  if (item.masteryStatus === "NeedsReview") {
    return item.locked ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-tertiary">
        <FiLock size={10} /> {untilLabel(item.nextAttemptAt)}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Due now
      </span>
    );
  }
  return null;
};

const QuestionCard = ({ item, index }) => {
  const diff = getDifficultyRGB(item.difficulty);
  const mastered = item.masteryStatus === "Mastered";
  const locked = item.locked && !mastered;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.24), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/interview-prep/${item._id}`}
        className={`group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border p-5 transition-all ${
          mastered
            ? "border-green-500/20 bg-green-500/[0.04]"
            : "border-subtle surface-card hover:border-accent/40"
        } ${locked ? "opacity-70" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-tertiary">
            {item.type === "mcq" ? "MCQ" : "Written"}
          </span>
          <StateBadge item={item} />
        </div>

        <h3 className="text-[15px] font-bold leading-snug text-primary transition-colors group-hover:text-accent">
          {item.title}
        </h3>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ color: `rgb(${diff})`, backgroundColor: `rgba(${diff},0.15)` }}
          >
            {item.difficulty}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
            <FiZap size={10} /> {item.points}
          </span>
          {(item.tags || []).slice(0, 2).map((t) => (
            <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-secondary">
              {t}
            </span>
          ))}
          {!mastered && !locked && (
            <FiArrowRight
              size={13}
              className="ml-auto text-tertiary transition-all group-hover:translate-x-0.5 group-hover:text-accent"
            />
          )}
        </div>
      </Link>
    </motion.div>
  );
};

// Top-level subject of a question (System Design, Data Science, …), or "General"
// when none is set. Topics live in `tags` one tier below.
const domainOf = (it) => it.subject || "General";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "mastered", label: "Mastered" },
  { id: "review", label: "Under review" },
];

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "mcq", label: "MCQ" },
  { id: "written", label: "Written" },
];

const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
      active ? "bg-accent text-white" : "bg-white/5 text-secondary hover:text-primary"
    }`}
  >
    {children}
  </button>
);

/* ── Searchable sub-topic combobox ──────────────────────────────────
   Replaces a crowding chip row: type to narrow the topic list, arrow-
   free selection, and a clearable active pill. */
const SubTopicSearch = ({ topics, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => (q ? t.toLowerCase().includes(q) : true)).slice(0, 40);
  }, [topics, query]);

  const pick = (t) => {
    onChange(t);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
          open ? "border-accent/60 surface-card" : "border-subtle bg-white/[0.03]"
        }`}
      >
        <FiSearch size={14} className="shrink-0 text-tertiary" />
        {value ? (
          <button
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent"
          >
            {value} <FiX size={11} />
          </button>
        ) : (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search topics…"
            className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
          />
        )}
        {!value && (
          <FiChevronDown
            size={14}
            onClick={() => setOpen((o) => !o)}
            className={`shrink-0 cursor-pointer text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {open && !value && (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-subtle surface-overlay p-1 shadow-xl backdrop-blur-md">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-tertiary">No topics match “{query}”.</p>
          ) : (
            matches.map((t) => (
              <button
                key={t}
                onClick={() => pick(t)}
                className="flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm text-secondary transition-colors hover:bg-accent/10 hover:text-primary"
              >
                {t}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ── Due-for-review strip ───────────────────────────────────────────
   The highest-value work: questions off cooldown, waiting to be re-
   earned. Routes straight into solving rather than making the learner
   hunt the grid. */
const DueReviewStrip = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4"
    >
      <div className="flex items-center gap-2">
        <FiRotateCcw className="text-amber-500" size={15} />
        <h2 className="text-sm font-bold text-primary">
          {items.length} {items.length === 1 ? "question is" : "questions are"} ready for review
        </h2>
        <span className="text-xs text-tertiary">— re-earn them while they're fresh</span>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {items.map((it) => {
          const diff = getDifficultyRGB(it.difficulty);
          return (
            <Link
              key={it._id}
              to={`/interview-prep/${it._id}`}
              className="group flex min-w-[220px] max-w-[260px] shrink-0 flex-col gap-2 rounded-xl border border-amber-500/20 bg-black/5 p-3 transition-all hover:border-amber-500/50 dark:bg-white/5"
            >
              <p className="line-clamp-2 text-[13px] font-bold leading-snug text-primary group-hover:text-accent">
                {it.title}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ color: `rgb(${diff})`, backgroundColor: `rgba(${diff},0.15)` }}
                >
                  {it.difficulty}
                </span>
                <span className="text-[10px] font-semibold text-tertiary">{domainOf(it)}</span>
                <FiArrowRight size={12} className="ml-auto text-amber-500 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

/* ── Per-subject track header with mastery progress ─────────────── */
const TrackHeader = ({ subject, mastered, total }) => {
  const pct = total ? Math.round((mastered / total) * 100) : 0;
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="text-base font-black text-primary">{subject}</h2>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-tertiary">
        {mastered}/{total} mastered
      </span>
    </div>
  );
};

const InterviewPrep = () => {
  const [activeDomain, setActiveDomain] = useState(null); // top-level category
  const [activeSub, setActiveSub] = useState(null); // sub-topic tag
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all"); // mcq | written

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["domain-pool"],
    queryFn: async () => {
      const res = await api.get("/api/challenges/domain");
      return res.data.data.items || [];
    },
  });

  // Top-level domains present in the pool.
  const domains = useMemo(() => {
    const set = new Set(items.map(domainOf));
    return Array.from(set).sort();
  }, [items]);

  // Sub-topics available within the selected domain (or all, when none selected).
  const subTopics = useMemo(() => {
    const scope = activeDomain ? items.filter((it) => domainOf(it) === activeDomain) : items;
    const set = new Set();
    scope.forEach((it) => (it.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items, activeDomain]);

  // A sub-topic selection only makes sense within its domain's topic list —
  // derive the effective value rather than syncing state in an effect.
  const effectiveSub = activeSub && subTopics.includes(activeSub) ? activeSub : null;

  const stats = useMemo(() => {
    let mastered = 0;
    let due = 0;
    for (const it of items) {
      if (it.masteryStatus === "Mastered") mastered += 1;
      else if (it.masteryStatus === "NeedsReview" && !it.locked) due += 1;
    }
    return { mastered, due, total: items.length };
  }, [items]);

  // Per-subject mastery tallies for the track headers (from the whole pool, so
  // the denominator stays stable as filters change).
  const subjectStats = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const d = domainOf(it);
      const s = map.get(d) || { mastered: 0, total: 0 };
      s.total += 1;
      if (it.masteryStatus === "Mastered") s.mastered += 1;
      map.set(d, s);
    }
    return map;
  }, [items]);

  const dueItems = useMemo(
    () => items.filter((it) => it.masteryStatus === "NeedsReview" && !it.locked),
    [items],
  );

  const visible = useMemo(() => {
    return items.filter((it) => {
      if (activeDomain && domainOf(it) !== activeDomain) return false;
      if (effectiveSub && !(it.tags || []).includes(effectiveSub)) return false;
      if (status === "mastered" && it.masteryStatus !== "Mastered") return false;
      if (status === "review" && it.masteryStatus !== "NeedsReview") return false;
      if (type === "mcq" && it.type !== "mcq") return false;
      if (type === "written" && it.type === "mcq") return false;
      return true;
    });
  }, [items, activeDomain, effectiveSub, status, type]);

  // Group the visible questions into subject tracks, ordered alphabetically.
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of visible) {
      const d = domainOf(it);
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const pickDomain = (d) => {
    setActiveDomain(d);
    setActiveSub(null); // sub-topics are scoped to a domain
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-primary">Interview Prep</h1>
          <p className="mt-1 text-sm text-secondary">
            Domain questions you can practise anytime — no deadline, just mastery.
          </p>
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="font-bold text-green-500">{stats.mastered} mastered</span>
            <span className="text-tertiary">·</span>
            <span className={`font-bold ${stats.due > 0 ? "text-amber-500" : "text-tertiary"}`}>
              {stats.due} due
            </span>
            <span className="text-tertiary">·</span>
            <span className="text-secondary">{stats.total} total</span>
          </div>
        )}
      </div>

      {/* overall progress bar */}
      {stats.total > 0 && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-green-500"
            initial={{ width: 0 }}
            animate={{ width: `${(stats.mastered / stats.total) * 100}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}

      {/* Due-for-review — the actionable subset, surfaced up top */}
      <DueReviewStrip items={dueItems} />

      {/* Filters: domain (top-level) + status + searchable sub-topic */}
      {stats.total > 0 && (
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* top-level domains */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={activeDomain == null} onClick={() => pickDomain(null)}>
              All subjects
            </Chip>
            {domains.map((d) => (
              <Chip key={d} active={activeDomain === d} onClick={() => pickDomain(d)}>
                {d}
              </Chip>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {subTopics.length > 0 && (
              <SubTopicSearch topics={subTopics} value={effectiveSub} onChange={setActiveSub} />
            )}
            {/* question type — segmented */}
            <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-subtle bg-white/[0.03] p-1">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    type === t.id ? "bg-accent text-white" : "text-secondary hover:text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* mastery status — segmented */}
            <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-subtle bg-white/[0.03] p-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    status === s.id ? "bg-accent text-white" : "text-secondary hover:text-primary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* grid — grouped into subject tracks */}
      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          items.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description="Domain questions appear here once an organiser adds them. Check back soon."
              icon={FiHelpCircle}
            />
          ) : (
            <EmptyState
              title="No questions match"
              description="Try a different subject, topic, or status filter."
              icon={FiHelpCircle}
            />
          )
        ) : (
          <div className="space-y-10">
            {groups.map(([subject, group]) => {
              const s = subjectStats.get(subject) || { mastered: 0, total: group.length };
              return (
                <section key={subject}>
                  <TrackHeader subject={subject} mastered={s.mastered} total={s.total} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.map((item, i) => (
                      <QuestionCard key={item._id} item={item} index={i} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewPrep;
