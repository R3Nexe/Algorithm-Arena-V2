import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FiArrowRight,
  FiZap,
  FiFilter,
  FiSearch,
  FiCpu,
  FiAlertTriangle,
  FiActivity,
  FiTarget,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiMessageSquare,
} from "react-icons/fi";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";
import SkeletonCard from "../components/SkeletonCard";
import EmptyState from "../components/EmptyState";
import ChallengeCard from "../components/Card";
import { getSessionGreeting } from "../constants/greetings";

/* ── helpers ─────────────────────────────────── */
const getRGB = (d) =>
  d === "Easy"
    ? "34,197,94"
    : d === "Medium"
      ? "234,179,8"
      : d === "Hard"
        ? "239,68,68"
        : "99,102,241";

const buildQS = ({
  page,
  limit,
  search,
  difficulty,
  category,
  sortBy,
  sortDir,
}) => {
  const p = new URLSearchParams();
  p.set("page", page);
  p.set("limit", limit);
  p.set("sortBy", sortBy);
  p.set("sortDir", sortDir);
  if (search) p.set("search", search);
  if (difficulty) p.set("difficulty", difficulty);
  if (category) p.set("category", category);
  return p.toString();
};

const fd = (d = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay: d, ease: "easeOut" },
});

/* ══════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════ */
const Dashboard = () => {
  const { user } = useAuth();

  const greeting = useMemo(() => getSessionGreeting(), []);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 4,
    search: "",
    difficulty: "",
    category: "",
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const hf = (k, v) => setFilters((p) => ({ ...p, [k]: v, page: 1 }));

  /* ── queries ─────────────────────────────── */
  const challengesQ = useQuery({
    queryKey: ["dash-challenges", filters],
    queryFn: async () => {
      const r = await api.get(`/api/challenges?${buildQS(filters)}`);
      return r.data.data || [];
    },
  });

  const summaryQ = useQuery({
    queryKey: ["dash-summary"],
    queryFn: async () => {
      const r = await api.get("/api/dashboard/summary");
      return r.data.data || {};
    },
  });

  const profileQ = useQuery({
    queryKey: ["dash-profile"],
    queryFn: async () => {
      const r = await api.get("/api/profile/stats");
      return r.data.data || {};
    },
  });

  const setsQ = useQuery({
    queryKey: ["dash-sets"],
    queryFn: async () => {
      try {
        const r = await api.get("/api/sets");
        return r.data.data || [];
      } catch {
        return [];
      }
    },
  });

  /* ── derived ─────────────────────────────── */
  const summary = summaryQ.data;
  const profile = profileQ.data;
  const challenges = challengesQ.data || [];
  const allSubs = useMemo(
    () => profile?.recentSubmissions || summary?.recentActivity || [],
    [profile, summary],
  );

  const solved = summary?.solved ?? profile?.acceptedCount ?? 0;
  const total = summary?.totalChallenges ?? 0;
  const pending = summary?.pending ?? profile?.pendingCount ?? 0;
  const solvedPct = total > 0 ? Math.round((solved / total) * 100) : 0;

  const activeSet = setsQ.data?.find((s) => new Date(s.deadline) > new Date());
  // const featuredChallenge = activeSet?.questions?.[0] || challenges[0];

  const recentSubs = useMemo(
    () =>
      [...allSubs]
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 6),
    [allSubs],
  );

  const diffChips = [
    { v: "", l: "All" },
    { v: "Easy", l: "Easy" },
    { v: "Medium", l: "Medium" },
    { v: "Hard", l: "Hard" },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* ── Warning ─────────────────────────── */}
      {user?.status === "Warned" && (
        <motion.div
          {...fd(0)}
          className="flex items-center gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/8"
        >
          <FiAlertTriangle className="text-red-400 text-lg flex-shrink-0" />
          <p className="text-sm text-red-400">
            You have an active warning from your Clan Chief. Please review your
            activity.
          </p>
        </motion.div>
      )}

      {/* ── Greeting ────────────────────────── */}
      <motion.div {...fd(0.04)}>
        <h1 className="text-3xl font-black text-primary mb-1">
          {greeting.heading.replace("{username}", user?.username || "Operative")}
        </h1>
        <p className="text-secondary text-sm">
          {greeting.subtext}
        </p>
      </motion.div>

      {/* ── Hero — Recommended Challenge ────── */}
      <motion.div {...fd(0.08)}>
        <div
          className="relative  overflow-hidden rounded-2xl p-8 group transition-all duration-250
               hover:scale-[1.02]
               hover:shadow-[0_10px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]
               dark:hover:shadow-[0_0_40px_rgba(var(--accent-rgb),0.25),0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
          style={{
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* glow orbs */}
          <div
            className="absolute -top-20 -left-10 w-80 h-80 rounded-full blur-[120px] pointer-events-none opacity-20"
            style={{
              background:
                "radial-gradient(circle, rgba(var(--accent-rgb),1), transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-16 left-40 w-60 h-60 rounded-full blur-[100px] pointer-events-none opacity-15"
            style={{
              background:
                "radial-gradient(circle, rgba(168,85,247,1), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 ">
            <div className="flex-1 min-w-0">
              <span className="inline-block text-[10px] font-black uppercase tracking-[0.35em] text-accent mb-4">
                Recommended for you
              </span>
              <h2 className="text-4xl md:text-5xl font-black text:black leading-[1.1] dark:text-white mb-3">
                {activeSet ? (
                  <>
                    {activeSet.title.split(" ").slice(0, -1).join(" ")}{" "}
                    <span
                      style={{
                        background:
                          "linear-gradient(135deg, rgb(var(--accent-rgb)), rgba(168,85,247,1))",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {activeSet.title.split(" ").slice(-1)[0]}
                    </span>
                  </>
                ) : (
                  <>
                    Mastering Dynamic{" "}
                    <span
                      style={{
                        background:
                          "linear-gradient(135deg, rgb(var(--accent-rgb)), rgba(168,85,247,1))",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Programming
                    </span>
                  </>
                )}
              </h2>
              <p className="text-secondary text-sm leading-relaxed mb-6 max-w-md">
                {activeSet
                  ? `Target Level: ${activeSet.targetLevel} • Due ${new Date(activeSet.deadline).toLocaleDateString()}`
                  : "Push your limits with this week's elite challenge. Solve complex optimizations and climb the global leaderboards."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={
                    activeSet ? `/missions?setId=${activeSet._id}` : "/missions"
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background:
                      "linear-gradient(135deg, rgb(var(--accent-rgb)), rgba(168,85,247,0.9))",
                    boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.4)",
                  }}
                >
                  Enter Arena
                </Link>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-tertiary">
                  <FiZap className="text-yellow-400" size={13} />+
                  {activeSet?.questions?.reduce(
                    (a, q) => a + (q.points || 0),
                    0,
                  ) || 50}{" "}
                  Bonus XP
                </div>
              </div>
            </div>

            {/* watermark icon */}
            <div className="clip md:flex items-center justify-center flex-shrink-0 opacity-[0.1] group-hover:opacity-[0.5] transition-all duration-700 group-hover:rotate-6">
              <FiCpu size={200} className="text-accent overflow-hidden" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stat bar ────────────────────────── */}
      <motion.div {...fd(0.12)}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: FiTarget,
              label: "Total Challenges",
              value: total,
              delta: "+2%",
              color: "text-accent",
            },
            {
              icon: FiCheckCircle,
              label: "Solved",
              value: solved,
              delta: "+2%",
              color: "text-green-400",
            },
            {
              icon: FiClock,
              label: "Pending Reviews",
              value: pending,
              delta: "+2%",
              color: "text-yellow-400",
            },
            {
              icon: FiTrendingUp,
              label: "Solver Rate",
              value: `${solvedPct}%`,
              delta: "+2%",
              color: "text-purple-400",
            },
          ].map(({ icon: Icon, label, value, delta, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-4 rounded-xl border border-black/[0.1] dark:border-white/[0.11] transition-all hover:scale-[1.02]
              hover:shadow-[0_10px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]
              dark:hover:shadow-[0_0_40px_rgba(var(--accent-rgb),0.25),0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <Icon size={16} className={`${color} opacity-50 flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-[9px] text-tertiary uppercase tracking-widest font-bold mb-0.5 truncate">
                  {label}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-black ${color}`}>{value}</span>
                  <span className="text-[10px] text-green-500 font-bold">
                    {delta}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Two-column: Missions + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* LEFT: Available Missions */}
        <motion.div {...fd(0.16)} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-primary">
              Available Missions
            </h2>
            <Link
              to="/missions"
              className="text-xs font-bold text-accent hover:text-accent/80 flex items-center gap-1"
            >
              View All <FiArrowRight size={12} />
            </Link>
          </div>

          {/* filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[120px] max-w-xs">
              <FiSearch
                size={11}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"
              />
              <input
                className="field-input pl-8 text-xs py-1.5 h-8 w-full"
                placeholder="Search titles..."
                value={filters.search}
                onChange={(e) => hf("search", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 h-8">
              <FiFilter size={10} className="text-tertiary" />
              <select
                className="bg-transparent text-xs text-secondary font-semibold outline-none"
                value={filters.sortBy}
                onChange={(e) => hf("sortBy", e.target.value)}
              >
                <option value="createdAt">Newest</option>
                <option value="points">XP</option>
              </select>
            </div>
          </div>

          {/* difficulty chips */}
          <div className="flex gap-2 flex-wrap">
            {diffChips.map(({ v, l }) => {
              const active = filters.difficulty === v;
              const cls = active
                ? v === "Easy"
                  ? "bg-green-500/15 border-green-500/40 text-green-400"
                  : v === "Medium"
                    ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
                    : v === "Hard"
                      ? "bg-red-500/15 border-red-500/40 text-red-400"
                      : "bg-accent/15 border-accent/40 text-accent"
                : "bg-white/[0.03] border-white/[0.07] text-tertiary hover:text-secondary hover:border-white/20";
              return (
                <button
                  key={v}
                  onClick={() => hf("difficulty", v)}
                  className={`px-3.5 py-1 rounded-full text-[11px] font-bold border transition-all ${cls}`}
                >
                  {l}
                </button>
              );
            })}
          </div>

          {/* challenge grid 2×2 */}
          {challengesQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : challenges.length === 0 ? (
            <EmptyState
              title="No missions found"
              description="Adjust filters or check back later."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {challenges.map((ch, i) => {
                const diffCls =
                  ch.difficulty === "Easy"
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : ch.difficulty === "Medium"
                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                      : "bg-red-500/15 text-red-400 border-red-500/25";
                return (
                  <motion.div
                    key={ch._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={`/challenge/${ch._id}`}
                      className="group block h-full"
                    >
                      <ChallengeCard
                        className="h-full p-5 !rounded-2xl"
                        innerClassName="flex flex-col gap-3 h-full justify-between w-full"
                        difficultyColor={getRGB(ch.difficulty)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${diffCls}`}
                          >
                            {ch.difficulty}
                          </span>
                          <span className="text-[10px] font-black text-accent">
                            {ch.points} XP
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-bold leading-snug text-primary group-hover:text-accent transition-colors line-clamp-2 flex-1">
                            {ch.title}
                          </h3>
                          {/* eslint-disable-next-line */}
                          {new Date() - new Date(ch.createdAt || Date.now()) <
                            7 * 24 * 60 * 60 * 1000 && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 flex-shrink-0 mt-0.5">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-auto pt-2">
                          {ch.tags &&
                            ch.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary border border-white/5"
                              >
                                {tag}
                              </span>
                            ))}
                          {(!ch.tags || ch.tags.length === 0) &&
                            ch.category &&
                            ch.category.split(',').slice(0, 3).map((cat, idx) => (
                              <span
                                key={`cat-${idx}`}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary border border-white/5"
                              >
                                {cat.trim()}
                              </span>
                            ))}
                        </div>
                      </ChallengeCard>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* RIGHT: Recent Activity */}
        <motion.div {...fd(0.18)} className="space-y-4">
          <h2 className="text-base font-black text-primary flex items-center gap-2">
            <FiActivity className="text-accent" size={16} /> Recent Activity
          </h2>

          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            {recentSubs.length === 0 ? (
              <div className="p-8 text-center">
                <FiCpu size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-xs text-tertiary">
                  No submissions yet — start a challenge!
                </p>
              </div>
            ) : (
              <div className="rounded-2xl">
                {recentSubs.map((sub, i) => {
                  const ac = sub.status === "Accepted";
                  const wa = sub.status === "Rejected";
                  const badgeCls = ac
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : wa
                      ? "bg-red-500/15 text-red-400 border-red-500/25"
                      : "bg-yellow-500/15 text-yellow-400 border-yellow-500/25";
                  const badgeLabel = ac
                    ? "ACCEPTED"
                    : wa
                      ? "REJECTED"
                      : "PENDING";
                  return (
                    <Link
                      key={sub._id + i}
                      to={`/submission/${sub._id}`}
                      className="group flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors truncate">
                          {sub.challengeId?.title || "Unknown Challenge"}
                        </p>
                        <p className="text-[10px] text-tertiary mt-0.5">
                          {new Date(sub.submittedAt).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>
                      <span
                        className={`ml-3 text-[9px] font-black px-2 py-0.5 rounded border flex-shrink-0 ${badgeCls}`}
                      >
                        {badgeLabel}
                      </span>
                      {wa && sub.feedback && (
                        <span className="ml-1 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex-shrink-0">
                          <FiMessageSquare size={9} />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>



    </div>
  );
};

export default Dashboard;
