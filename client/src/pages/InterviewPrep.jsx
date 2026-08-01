import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FiCheck,
  FiClock,
  FiLock,
  FiHelpCircle,
  FiZap,
  FiArrowRight,
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
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
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

// Top-level domain of a question: its category, or "General" when uncategorised.
const domainOf = (it) => (it.category && it.category !== "Logic" ? it.category : "General");

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "mastered", label: "Mastered" },
  { id: "review", label: "Under review" },
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

const InterviewPrep = () => {
  const [activeDomain, setActiveDomain] = useState(null); // top-level category
  const [activeSub, setActiveSub] = useState(null); // sub-topic tag
  const [status, setStatus] = useState("all");

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

  const stats = useMemo(() => {
    let mastered = 0;
    let due = 0;
    for (const it of items) {
      if (it.masteryStatus === "Mastered") mastered += 1;
      else if (it.masteryStatus === "NeedsReview" && !it.locked) due += 1;
    }
    return { mastered, due, total: items.length };
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((it) => {
      if (activeDomain && domainOf(it) !== activeDomain) return false;
      if (activeSub && !(it.tags || []).includes(activeSub)) return false;
      if (status === "mastered" && it.masteryStatus !== "Mastered") return false;
      if (status === "review" && it.masteryStatus !== "NeedsReview") return false;
      return true;
    });
  }, [items, activeDomain, activeSub, status]);

  const pickDomain = (d) => {
    setActiveDomain(d);
    setActiveSub(null); // sub-topics are scoped to a domain
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
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

      {/* progress bar */}
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

      {/* Filters: domain (top-level) + status, then sub-topics scoped to the domain */}
      {stats.total > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* top-level domains */}
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={activeDomain == null} onClick={() => pickDomain(null)}>
                All domains
              </Chip>
              {domains.map((d) => (
                <Chip key={d} active={activeDomain === d} onClick={() => pickDomain(d)}>
                  {d}
                </Chip>
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

          {/* sub-topics within the chosen domain */}
          {activeDomain && subTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                {activeDomain}
              </span>
              <Chip active={activeSub == null} onClick={() => setActiveSub(null)}>
                All
              </Chip>
              {subTopics.map((t) => (
                <Chip key={t} active={activeSub === t} onClick={() => setActiveSub(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* grid */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
              description="Try a different domain, sub-topic, or status filter."
              icon={FiHelpCircle}
            />
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item, i) => (
              <QuestionCard key={item._id} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewPrep;
