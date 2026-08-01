import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDifficultyRGB } from "../constants/difficulty";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
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
  FiLayers,
  FiList,
  FiGitBranch,
  FiShare2,
  FiDatabase,
  FiLink,
  FiType,
  FiHash,
  FiGrid,
} from "react-icons/fi";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";
import SkeletonCard from "../components/SkeletonCard";
import EmptyState from "../components/EmptyState";
import ChallengeCard from "../components/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { getSessionGreeting } from "../constants/greetings";
import DueForReviewWidget from "../components/DueForReviewWidget";

/* ── helpers ─────────────────────────────────── */
const getDominantIcon = (activeSet) => {
  if (!activeSet) return FiCpu;

  const title = (activeSet.title || "").toLowerCase();
  const questions = activeSet.questions || [];

  const topics = [
    {
      name: "stack",
      icon: FiLayers,
      keywords: ["stack", "monotonic stack"],
    },
    {
      name: "queue",
      icon: FiList,
      keywords: ["queue", "deque", "priority queue", "heap", "monotonic queue"],
    },
    {
      name: "tree",
      icon: FiGitBranch,
      keywords: [
        "tree",
        "binary tree",
        "bst",
        "trie",
        "segment tree",
        "avl",
        "red-black tree",
      ],
    },
    {
      name: "graph",
      icon: FiShare2,
      keywords: [
        "graph",
        "dfs",
        "bfs",
        "union find",
        "disjoint set",
        "topological sort",
        "dijkstra",
        "mst",
        "kruskal",
        "prim",
        "shortest path",
        "bipartite",
        "network",
      ],
    },
    {
      name: "hash-table",
      icon: FiDatabase,
      keywords: [
        "hash table",
        "hashmap",
        "hashset",
        "map",
        "set",
        "hash",
        "dictionary",
      ],
    },
    {
      name: "linked-list",
      icon: FiLink,
      keywords: ["linked list", "doubly linked list", "list"],
    },
    {
      name: "string",
      icon: FiType,
      keywords: ["string", "substring", "anagram", "palindrome", "regex"],
    },
    {
      name: "math",
      icon: FiHash,
      keywords: [
        "math",
        "geometry",
        "number theory",
        "bit manipulation",
        "bitwise",
        "prime",
        "modulo",
        "combinatorics",
        "binary",
      ],
    },
    {
      name: "dp",
      icon: FiCpu,
      keywords: [
        "dp",
        "recursion",
        "memoization",
        "backtracking",
        "knapsack",
        "lcs",
        "lis",
      ],
    },
    {
      name: "array",
      icon: FiGrid,
      keywords: [
        "array",
        "matrix",
        "sorting",
        "searching",
        "binary search",
        "two pointers",
        "sliding window",
        "divide and conquer",
      ],
    },
  ];

  const scores = {};
  topics.forEach((t) => {
    scores[t.name] = 0;
  });

  topics.forEach((t) => {
    t.keywords.forEach((kw) => {
      if (title.includes(kw)) {
        scores[t.name] += 10;
      }
    });
  });

  questions.forEach((q) => {
    const qTitle = (q.title || "").toLowerCase();
    const qCategory = (q.category || "").toLowerCase();
    const qTags = (q.tags || []).map((tag) => tag.toLowerCase());

    topics.forEach((t) => {
      t.keywords.forEach((kw) => {
        if (qTitle.includes(kw)) {
          scores[t.name] += 3;
        }
        if (qCategory.includes(kw)) {
          scores[t.name] += 2;
        }
        qTags.forEach((tag) => {
          if (tag.includes(kw) || kw.includes(tag)) {
            scores[t.name] += 2;
          }
        });
      });
    });
  });

  let maxScore = 0;
  let dominantTopic = null;

  topics.forEach((t) => {
    if (scores[t.name] > maxScore) {
      maxScore = scores[t.name];
      dominantTopic = t;
    }
  });

  return dominantTopic ? dominantTopic.icon : FiCpu;
};

const getLocalDrafts = () => {
  const drafts = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("challenge-draft:")) {
        const challengeId = key.split(":")[1];
        const raw = localStorage.getItem(key);
        if (raw) {
          const draft = JSON.parse(raw);
          const hasCode =
            draft.codeByLang &&
            Object.values(draft.codeByLang).some((c) => c && c.trim());
          if (draft.repoUrl?.trim() || hasCode) {
            drafts.push({
              _id: `draft-${challengeId}`,
              challengeId: {
                _id: challengeId,
                title: draft.challengeTitle || "Unknown Challenge",
                difficulty: draft.challengeDifficulty || "Easy",
                points: draft.challengePoints || 0,
              },
              status: "Attempted",
              submittedAt: draft.updatedAt || new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Error reading drafts from localStorage", e);
  }
  return drafts;
};

const getCardBadge = (chId, subsMap, drafts) => {
  if (subsMap[chId] === "Accepted") {
    return {
      label: "Solved",
      cls: "bg-green-500/10 text-green-400 border-green-500/20",
    };
  }
  const hasDraft = drafts.some((d) => d.challengeId?._id === chId);
  if (hasDraft) {
    return {
      label: "Attempted",
      cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };
  }
  if (subsMap[chId] === "Rejected") {
    return {
      label: "Rejected",
      cls: "bg-red-500/10 text-red-400 border-red-500/20",
    };
  }
  if (subsMap[chId] === "Pending") {
    return {
      label: "Pending Review",
      cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    };
  }
  return null;
};

// QuestionSet.deadline is stored as UTC midnight of the due date (admin picks
// a bare date, no time). Treat it as valid through the end of that day rather
// than expiring the instant UTC midnight ticks over.
const isDeadlineActive = (deadline, now) => {
  const end = new Date(deadline);
  end.setUTCHours(23, 59, 59, 999);
  return end.getTime() > now;
};

// Friendly nudges for an unfinished set whose deadline is closing in. Several
// tones per bucket so the greeting doesn't say the exact same thing every day.
const DEADLINE_NUDGES = {
  dayLeft: [
    (set) => `Heads up — "${set}" wraps up tomorrow. A couple more solves today keeps you clear of the rush.`,
    (set) => `One day left on "${set}"! Future-you will be very grateful if you knock a few out now.`,
    (set) => `"${set}" closes tomorrow — solid excuse for one more coffee and one more problem. ☕`,
    (set) => `Tick tock! "${set}" is due tomorrow — let's not let this one slip past the buzzer.`,
    (set) => `Friendly reminder: "${set}" is due tomorrow. A quick sprint now beats a scramble later.`,
  ],
  finalHours: [
    (set) => `"${set}" is due today — a few focused minutes now and you're in the clear!`,
    (set) => `Final stretch! "${set}" closes today. You've got this. 🔥`,
    (set) => `Last call for "${set}" — today's the day. Go grab those points before time's up!`,
    (set) => `The clock's ticking on "${set}" — today's your last shot to lock in those solves.`,
    (set) => `Heads up: "${set}" is due today. Small effort now, zero regrets later.`,
  ],
};

const getDeadlineNudge = (set, now, subsMap) => {
  if (!set) return null;
  const questions = set.questions || [];
  const solvedCount = questions.filter(
    (q) => q.title && subsMap[q.title.trim().toLowerCase()] === "Accepted",
  ).length;
  if (questions.length > 0 && solvedCount >= questions.length) return null;

  const end = new Date(set.deadline);
  end.setUTCHours(23, 59, 59, 999);
  const hoursLeft = (end.getTime() - now) / (1000 * 60 * 60);
  if (hoursLeft <= 0 || hoursLeft > 48) return null;

  const bucket = hoursLeft <= 24 ? "finalHours" : "dayLeft";
  const pool = DEADLINE_NUDGES[bucket];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick(set.title);
};

const buildQS = ({ page, limit, search, difficulty, category }) => {
  const p = new URLSearchParams();
  p.set("page", page);
  p.set("limit", limit);
  // Always fetch by createdAt desc; sorting is handled client-side
  p.set("sortBy", "createdAt");
  p.set("sortDir", "desc");
  if (search) p.set("search", search);
  if (difficulty) p.set("difficulty", difficulty);
  if (category) p.set("category", category);
  return p.toString();
};

/* ══════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════ */
const DIFF_ORDER = { Easy: 1, Medium: 2, Hard: 3 };

const Dashboard = () => {
  const [now] = useState(() => Date.now());
  const { user } = useAuth();

  const [showWarning, setShowWarning] = useState(true);
  useEffect(() => {
    if (user?.status === "Warned") {
      const warnedToastShown = sessionStorage.getItem("warnedToastShown");
      if (!warnedToastShown) {
        toast.error("You have been warned", { icon: "⚠️", duration: 6000 });
        sessionStorage.setItem("warnedToastShown", "true");
      }
      const t = setTimeout(() => setShowWarning(false), 20000);
      return () => clearTimeout(t);
    }
  }, [user?.status]);

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
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroDir, setHeroDir] = useState(1);
  const [contentMode, setContentMode] = useState("missions"); // "missions" | "domain"

  /* ── queries ─────────────────────────────── */
  const challengesQ = useQuery({
    queryKey: ["dash-challenges", filters],
    staleTime: 30_000,
    queryFn: async () => {
      const queryParams = { ...filters, limit: 20 };
      const r = await api.get(`/api/challenges?${buildQS(queryParams)}`);
      return r.data.data || [];
    },
  });

  const summaryQ = useQuery({
    queryKey: ["dash-summary"],
    staleTime: 30_000,
    queryFn: async () => {
      const r = await api.get("/api/dashboard/summary");
      return r.data.data || {};
    },
  });

  const profileQ = useQuery({
    queryKey: ["dash-profile"],
    staleTime: 30_000,
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

  const mySubmissionsQ = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/submissions/my-submissions");
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  const domainQ = useQuery({
    queryKey: ["dash-domain"],
    enabled: contentMode === "domain",
    staleTime: 30_000,
    queryFn: async () => {
      const res = await api.get("/api/challenges/domain");
      return res.data.data.items || [];
    },
  });

  /* ── derived ─────────────────────────────── */
  const summary = summaryQ.data;
  const profile = profileQ.data;
  const challenges = challengesQ.data;

  const subsMap = useMemo(() => {
    const map = {};
    (mySubmissionsQ.data || []).forEach((sub) => {
      if (!sub.challengeId) return;
      const cid =
        typeof sub.challengeId === "object"
          ? sub.challengeId._id || sub.challengeId.id
          : sub.challengeId;
      if (!cid) return;
      const cidStr = cid.toString();
      if (
        !map[cidStr] ||
        sub.status === "Accepted" ||
        (sub.status === "Pending" && map[cidStr] !== "Accepted")
      ) {
        map[cidStr] = sub.status;
      }

      const titleKey = sub.challengeId?.title?.trim().toLowerCase();
      if (titleKey) {
        if (
          !map[titleKey] ||
          sub.status === "Accepted" ||
          (sub.status === "Pending" && map[titleKey] !== "Accepted")
        ) {
          map[titleKey] = sub.status;
        }
      }
    });
    return map;
  }, [mySubmissionsQ.data]);

  const availableChallenges = useMemo(() => {
    // 1. Group and filter out duplicate questions by title (case-insensitive)
    const seen = new Set();
    const unique = [];
    for (const ch of challenges || []) {
      const titleKey = ch.title?.trim().toLowerCase();
      if (titleKey && !seen.has(titleKey)) {
        seen.add(titleKey);
        unique.push(ch);
      }
    }

    // 2. Filter out solved and pending challenges by ID or by title
    const filtered = unique.filter((ch) => {
      const chId = ch._id?.toString();
      const titleKey = ch.title?.trim().toLowerCase();
      const statusById = subsMap[chId];
      const statusByTitle = titleKey ? subsMap[titleKey] : null;

      const isSolved =
        statusById === "Accepted" || statusByTitle === "Accepted";
      const isPending = statusById === "Pending" || statusByTitle === "Pending";

      return !isSolved && !isPending;
    });

    // 3. Sort by selected criteria
    const sorted = [...filtered].sort((a, b) => {
      if (filters.sortBy === "deadline") {
        const dlA = a.questionSetId?.deadline
          ? new Date(a.questionSetId.deadline).getTime()
          : Infinity;
        const dlB = b.questionSetId?.deadline
          ? new Date(b.questionSetId.deadline).getTime()
          : Infinity;

        const isPastA = dlA < now;
        const isPastB = dlB < now;

        if (isPastA !== isPastB) return isPastA ? 1 : -1; // Upcoming before past
        if (dlA !== dlB) return dlA - dlB; // Ascending order
      } else if (filters.sortBy === "difficulty") {
        const dA = DIFF_ORDER[a.difficulty] || 4;
        const dB = DIFF_ORDER[b.difficulty] || 4;
        if (dA !== dB) return dA - dB;
      } else if (filters.sortBy === "points") {
        if ((a.points || 0) !== (b.points || 0))
          return (b.points || 0) - (a.points || 0);
      } else if (filters.sortBy === "title") {
        const cmp = (a.title || "").localeCompare(b.title || "");
        if (cmp !== 0) return cmp;
      } else if (filters.sortBy === "createdAt") {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        if (tA !== tB) return tB - tA;
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    // 4. Return at most 4 challenges
    return sorted.slice(0, 4);
  }, [challenges, subsMap, filters.sortBy, now]);

  const drafts = useMemo(() => {
    const rawDrafts = getLocalDrafts();
    return rawDrafts
      .map((d) => {
        if (d.challengeId?.title === "Unknown Challenge") {
          const matched = (challenges || []).find(
            (c) => c._id === d.challengeId._id,
          );
          if (matched) {
            d.challengeId.title = matched.title;
            d.challengeId.difficulty = matched.difficulty;
            d.challengeId.points = matched.points;
          }
        }
        return d;
      })
      .filter((d) => d.challengeId?.title !== "Unknown Challenge");
  }, [challenges]);

  const combinedSubs = useMemo(() => {
    const dbSubs = mySubmissionsQ.data || [];
    const uniqueMap = new Map();

    dbSubs.forEach((sub) => {
      const cid = sub.challengeId?._id || sub.challengeId;
      if (!cid) return;
      const existing = uniqueMap.get(cid);
      if (
        !existing ||
        sub.status === "Accepted" ||
        new Date(sub.submittedAt) > new Date(existing.submittedAt)
      ) {
        uniqueMap.set(cid, sub);
      }
    });

    drafts.forEach((draft) => {
      const cid = draft.challengeId?._id;
      if (!cid) return;
      const existing = uniqueMap.get(cid);
      if (!existing || existing.status !== "Accepted") {
        uniqueMap.set(cid, draft);
      }
    });

    const list = Array.from(uniqueMap.values());
    const statusWeight = {
      Attempted: 1,
      Rejected: 2,
      Pending: 3,
      Accepted: 4,
    };

    return list.sort((a, b) => {
      const weightA = statusWeight[a.status] || 3;
      const weightB = statusWeight[b.status] || 3;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    });
  }, [mySubmissionsQ.data, drafts]);

  const recentSubs = useMemo(() => combinedSubs.slice(0, 6), [combinedSubs]);

  const solved =
    summary?.solved ??
    profile?.stats?.acceptedCount ??
    profile?.acceptedCount ??
    0;
  const total = summary?.totalChallenges ?? 0;
  const pending =
    summary?.pending ??
    profile?.stats?.pendingCount ??
    profile?.pendingCount ??
    0;
  const solvedPct = total > 0 ? Math.round((solved / total) * 100) : 0;

  const activeSets = useMemo(() => {
    return (setsQ.data || [])
      .filter((s) => isDeadlineActive(s.deadline, now))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, [setsQ.data, now]);
  const clampedIdx = Math.min(heroIdx, Math.max(activeSets.length - 1, 0));
  const activeSet = activeSets[clampedIdx];

  const HeroIcon = useMemo(() => getDominantIcon(activeSet), [activeSet]);

  const isNewSet = useMemo(() => {
    if (!activeSet) return false;
    const createdDate = activeSet.createdAt
      ? new Date(activeSet.createdAt)
      : activeSet.deadline
        ? new Date(
            new Date(activeSet.deadline).getTime() - 7 * 24 * 60 * 60 * 1000,
          )
        : new Date(now);
    return now - createdDate.getTime() < 7 * 24 * 60 * 60 * 1000;
  }, [activeSet, now]);

  const closestSet = activeSets[0];
  const deadlineNudge = useMemo(
    () => getDeadlineNudge(closestSet, now, subsMap),
    [closestSet, now, subsMap],
  );

  const goHero = (dir) => {
    setHeroDir(dir);
    setHeroIdx((i) => Math.max(0, Math.min(activeSets.length - 1, i + dir)));
  };

  const diffChips = [
    { v: "", l: "All" },
    { v: "Easy", l: "Easy" },
    { v: "Medium", l: "Medium" },
    { v: "Hard", l: "Hard" },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* ── Due for review ──────────────────── */}
      <DueForReviewWidget />

      {/* ── Warning ─────────────────────────── */}
      {user?.status === "Warned" && showWarning && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/8"
        >
          <FiAlertTriangle className="text-red-400 text-lg flex-shrink-0" />
          <p className="text-sm text-red-400">
            <strong className="font-black mr-2">Official Warning:</strong>
            {user?.warningMessage ||
              "You have an active warning from your Clan Chief. Please review your activity."}
          </p>
        </div>
      )}

      {/* ── Greeting ────────────────────────── */}
      <div>
        <h2 className="text-2xl font-black text-primary mb-1 font-h2">
          {greeting.heading.replace(
            "{username}",
            (user?.name || user?.username || "Operative")
              .trim()
              .split(/\s+/)[0],
          )}
        </h2>
        <p className="text-secondary text-sm">{greeting.subtext}</p>
        {deadlineNudge && (
          <div
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs font-semibold"
          >
            <FiClock className="shrink-0" />
            <span>{deadlineNudge}</span>
          </div>
        )}
      </div>

      {/* ── Continue Card ────────────────────── */}
      {(() => {
        const continueItem = drafts[0] || recentSubs.find(s => s.status === "Pending" || s.status === "Attempted");
        if (!continueItem) return null;
        const ch = continueItem.challengeId;
        const isDraft = continueItem.status === "Attempted";
        return (
          <Link
            to={`/challenge/${ch?._id}`}
            className="group surface-card flex items-center gap-4 p-4 hover:border-accent/40 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
              <FiArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-0.5">
                {isDraft ? "Continue where you left off" : "Pending Review"}
              </p>
              <p className="text-sm font-bold text-primary truncate group-hover:text-accent transition-colors">
                {ch?.title || "Unknown Challenge"}
              </p>
            </div>
            {ch?.difficulty && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ color: `rgb(${getDifficultyRGB(ch.difficulty)})`, backgroundColor: `rgba(${getDifficultyRGB(ch.difficulty)}, 0.15)` }}
              >
                {ch.difficulty}
              </span>
            )}
            {ch?.points > 0 && (
              <span className="text-xs font-bold text-accent shrink-0">{ch.points} XP</span>
            )}
          </Link>
        );
      })()}

      {/* ── Hero Carousel ────────────────────────── */}
      <div className="relative">
        {/* card shell */}
        <div
          className={`relative overflow-hidden rounded-2xl group transition-all duration-300 border transition-shadow duration-500
          ${
            isNewSet
              ? "dark:border-white/10 shadow-[0_0_25px_rgba(var(--accent-rgb),0.18)] dark:shadow-[0_0_30px_rgba(var(--accent-rgb),0.25)]"
              : "border-black/[0.12] dark:border-white/[0.07] shadow-[0_5px_10px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.05)] dark:shadow-[0_5px_10px_rgba(var(--accent-rgb),0.1),inset_0_1px_0_rgba(255,255,255,0.05)]"
          }`}
        >
          {/* glow orbs — static behind slides */}
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

          {/* slides */}
          <div className="relative overflow-hidden">
            {setsQ.isLoading ? (
              <div className="p-8 animate-pulse">
                <div className="relative z-30 flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1 min-w-0 space-y-4">
                    {/* Tag skeleton */}
                    <div className="h-3 w-32 bg-black/10 dark:bg-white/10 rounded-full" />

                    {/* Title skeleton */}
                    <div className="space-y-2">
                      <div className="h-8 md:h-10 w-2/3 bg-black/15 dark:bg-white/15 rounded-xl" />
                      <div className="h-8 md:h-10 w-1/2 bg-black/15 dark:bg-white/15 rounded-xl" />
                    </div>

                    {/* Description skeleton */}
                    <div className="space-y-2 max-w-md pt-2">
                      <div className="h-3 w-full bg-black/10 dark:bg-white/10 rounded-full" />
                      <div className="h-3 w-5/6 bg-black/10 dark:bg-white/10 rounded-full" />
                    </div>

                    {/* Action button + XP indicator skeleton */}
                    <div className="flex items-center gap-4 pt-4">
                      <div className="h-10 w-36 bg-black/15 dark:bg-white/15 rounded-xl" />
                      <div className="h-5 w-20 bg-black/10 dark:bg-white/10 rounded-full" />
                    </div>
                  </div>

                  {/* Watermark watermark CPU skeleton */}
                  <div className="hidden md:flex items-center justify-center flex-shrink-0 opacity-[0.03]">
                    <div className="w-40 h-40 bg-black/20 dark:bg-white/20 rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false} custom={heroDir}>
                <motion.div
                  key={clampedIdx}
                  custom={heroDir}
                  variants={{
                    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="p-8"
                >
                  <div className="relative z-30 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 min-w-0">
                      {/* deadline badge */}
                      {activeSet && (
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <span className="inline-block text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                            {activeSets.length > 1
                              ? `Challenge ${clampedIdx + 1} of ${activeSets.length}`
                              : "This Week's Challenge"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            <FiClock size={9} /> Due{" "}
                            {new Date(activeSet.deadline).toLocaleDateString(
                              "en-GB",
                              { day: "2-digit", month: "short" },
                            )}
                          </span>
                          {isNewSet && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse">
                              New Set
                            </span>
                          )}
                        </div>
                      )}
                      {!activeSet && (
                        <span className="inline-block text-[10px] font-black uppercase tracking-[0.35em] text-accent mb-4">
                          This Week's Challenge
                        </span>
                      )}

                      <h1 className="text-2xl md:text-3xl font-black leading-[1.1] dark:text-white text-black mb-3 font-h1">
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
                      </h1>

                      <p className="text-secondary text-sm leading-relaxed mb-6 max-w-md">
                        {activeSet
                          ? `Target Level: ${activeSet.targetLevel?.toLowerCase() === "both" ? "Beginner and intermediate" : activeSet.targetLevel} · ${activeSet.questions?.length || 0} questions `
                          : "Push your limits with this week's elite challenge. Solve complex optimizations and climb the global leaderboards."}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 z-10">
                        <Link
                          to={
                            activeSet
                              ? `/missions?setId=${activeSet._id}`
                              : "/missions"
                          }
                          className="inline-flex items-center gap-2 px-6 py-2.5 z-30 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-95"
                          style={{
                            background:
                              "linear-gradient(135deg, rgb(var(--accent-rgb)), rgba(168,85,247,0.9))",
                            boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.4)",
                          }}
                        >
                          Enter Arena <FiArrowRight size={14} />
                        </Link>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-tertiary">
                          <FiZap className="text-yellow-400" size={13} />+
                          {activeSet?.questions?.reduce(
                            (a, q) => a + (q.points || 0),
                            0,
                          ) || 50}{" "}
                          XP
                        </div>
                      </div>
                    </div>

                    {/* watermark */}
                    <div className="clip md:flex items-center justify-center flex-shrink-0 opacity-[0.08] group-hover:opacity-[0.4] transition-all duration-700 group-hover:rotate-6">
                      <HeroIcon size={180} className="text-accent" />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* edge-click navigation zones — only when multiple sets */}
          {activeSets.length > 1 && (
            <>
              {/* LEFT zone */}
              <div
                onClick={() => clampedIdx > 0 && goHero(-1)}
                className={`absolute inset-y-0 left-0 w-1/4 z-20 flex items-center justify-start group/left transition-all duration-300
                  ${clampedIdx === 0 ? "pointer-events-none" : "cursor-pointer"}`}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover/left:opacity-100 transition-opacity duration-300 rounded-l-2xl"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(0,0,0,0.35) 0%, transparent 100%)",
                  }}
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  className={`relative ml-3 w-5 h-5 transition-all duration-300
                    ${clampedIdx === 0 ? "text-white/0" : "text-black/35 dark:text-white/35 group-hover/left:text-accent group-hover/left:-translate-x-0.5"}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </div>

              {/* RIGHT zone */}
              <div
                onClick={() => clampedIdx < activeSets.length - 1 && goHero(1)}
                className={`absolute inset-y-0 right-0 w-1/4 z-20 flex items-center justify-end group/right transition-all duration-300
                  ${clampedIdx === activeSets.length - 1 ? "pointer-events-none" : "cursor-pointer"}`}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover/right:opacity-100 transition-opacity duration-300 rounded-r-2xl"
                  style={{
                    background:
                      "linear-gradient(to left, rgba(0,0,0,0.35) 0%, transparent 100%)",
                  }}
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  className={`relative mr-3 w-5 h-5 transition-all duration-300
                    ${clampedIdx === activeSets.length - 1 ? "text-white/0" : "text-black/35 dark:text-white/35 group-hover/right:text-accent group-hover/right:translate-x-0.5"}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* dot indicators */}
        {activeSets.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {activeSets.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setHeroDir(i > clampedIdx ? 1 : -1);
                  setHeroIdx(i);
                }}
                className={`rounded-full transition-all duration-300 ${
                  i === clampedIdx
                    ? "w-5 h-1.5 bg-accent"
                    : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Stat bar ────────────────────────── */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: FiTarget,
              label: "Total Challenges",
              value: total,
              color: "text-accent",
            },
            {
              icon: FiCheckCircle,
              label: "Solved",
              value: solved,
              color: "text-green-400",
            },
            {
              icon: FiClock,
              label: "Pending Reviews",
              value: pending,
              color: "text-yellow-400",
            },
            {
              icon: FiTrendingUp,
              label: "Solver Rate",
              value: `${solvedPct}%`,
              color: "text-purple-400",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="surface-card card-static flex items-center gap-3 p-4"
            >
              <Icon size={16} className={`${color} opacity-50 flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-[9px] text-tertiary uppercase tracking-widest font-bold mb-0.5 truncate font-h2">
                  {label}
                </p>
                <div className="flex items-baseline gap-2">
                  {summaryQ.isLoading || profileQ.isLoading ? (
                    <div className="h-6 w-12 bg-black/10 dark:bg-white/10 rounded-md animate-pulse mt-0.5" />
                  ) : (
                    <span className={`text-xl font-black ${color} font-h2`}>
                      {value}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column: Missions + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* LEFT: Available Missions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1 rounded-xl bg-white/[0.03] border border-black/[0.12] dark:border-white/[0.07] p-1">
              {[
                { id: "missions", label: "Missions" },
                { id: "domain", label: "Interview Prep" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setContentMode(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    contentMode === opt.id
                      ? "bg-accent text-white shadow-lg"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Link
              to={contentMode === "domain" ? "/interview-prep" : "/missions"}
              className="text-xs font-bold text-accent hover:text-accent/80 flex items-center gap-1"
            >
              View All <FiArrowRight size={12} />
            </Link>
          </div>

          {/* filters row (missions only) */}
          {contentMode === "missions" && (
          <>
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
            <div className="flex items-center bg-white/[0.03] border border-black/[0.12] dark:border-white/[0.06] rounded-xl px-2 h-8">
              <FiFilter size={10} className="text-tertiary ml-1 shrink-0" />
              <Select
                value={filters.sortBy}
                onValueChange={(val) => hf("sortBy", val)}
              >
                <SelectTrigger className="border-none bg-transparent h-full text-xs text-secondary font-semibold hover:bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none py-0 pl-1 pr-2 w-auto gap-1">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="difficulty">Difficulty</SelectItem>
                  <SelectItem value="createdAt">Newest</SelectItem>
                  <SelectItem value="points">XP</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
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
                : "bg-white/[0.03] border-black/[0.12] dark:border-white/[0.07] text-tertiary hover:text-secondary hover:border-white/20";
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
          </>
          )}

          {/* ── Domain question grid ── */}
          {contentMode === "domain" && (
            domainQ.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (domainQ.data || []).length === 0 ? (
              <EmptyState
                title="No domain questions yet"
                description="Interview-prep questions will appear here once an organiser adds them."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(domainQ.data || []).slice(0, 6).map((q) => {
                  const diff = getDifficultyRGB(q.difficulty);
                  const mastered = q.masteryStatus === "Mastered";
                  const due = q.masteryStatus === "NeedsReview" && !q.locked;
                  return (
                    <Link
                      key={q._id}
                      to={`/interview-prep/${q._id}`}
                      className={`group flex flex-col gap-3 rounded-2xl border p-5 transition-all ${
                        mastered
                          ? "border-green-500/20 bg-green-500/[0.04]"
                          : "surface-card border-black/[0.12] dark:border-white/[0.07] hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-tertiary">
                          {q.type === "mcq" ? "MCQ" : "Written"}
                        </span>
                        {mastered ? (
                          <span className="text-[9px] font-black uppercase text-green-500">Mastered</span>
                        ) : due ? (
                          <span className="text-[9px] font-black uppercase text-amber-500">Due now</span>
                        ) : q.locked ? (
                          <span className="text-[9px] font-black uppercase text-tertiary">Locked</span>
                        ) : null}
                      </div>
                      <h2 className="text-sm font-bold leading-snug text-primary group-hover:text-accent transition-colors line-clamp-2">
                        {q.title}
                      </h2>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        <span
                          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border"
                          style={{ color: `rgb(${diff})`, backgroundColor: `rgba(${diff},0.12)`, borderColor: `rgba(${diff},0.3)` }}
                        >
                          {q.difficulty}
                        </span>
                        <span className="text-[10px] font-black text-accent">{q.points} XP</span>
                        {(q.tags || []).slice(0, 2).map((t) => (
                          <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary">
                            {t}
                          </span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          )}

          {/* challenge grid 2×2 */}
          {contentMode === "missions" && (
          challengesQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : availableChallenges.length === 0 ? (
            <EmptyState
              title="No missions found"
              description="Adjust filters or check back later."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableChallenges.map((ch) => {
                const diffCls =
                  ch.difficulty === "Easy"
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : ch.difficulty === "Medium"
                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                      : "bg-red-500/15 text-red-400 border-red-500/25";
                const badge = getCardBadge(ch._id, subsMap, drafts);
                return (
                  <div key={ch._id}>
                    <Link
                      to={`/challenge/${ch._id}`}
                      className="group block h-full"
                    >
                      <ChallengeCard
                        className="h-full p-5 !rounded-2xl"
                        innerClassName="flex flex-col gap-3 h-full justify-between w-full"
                        difficultyColor={getDifficultyRGB(ch.difficulty)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${diffCls}`}
                            >
                              {ch.difficulty}
                            </span>
                            {badge && (
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-black text-accent">
                            {ch.points} XP
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="text-sm font-bold leading-snug text-primary group-hover:text-accent transition-colors line-clamp-2 flex-1 font-h2">
                            {ch.title}
                          </h2>
                          {/* eslint-disable-next-line */}
                          {new Date() - new Date(ch.createdAt || Date.now()) <
                            7 * 24 * 60 * 60 * 1000 && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-[0_0_8px_rgba(59,130,246,0.35)] animate-pulse flex-shrink-0 mt-0.5">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-auto pt-2">
                          {ch.tags &&
                            ch.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary border border-black/[0.1] dark:border-white/5"
                              >
                                {tag}
                              </span>
                            ))}
                          {(!ch.tags || ch.tags.length === 0) &&
                            ch.category &&
                            ch.category
                              .split(",")
                              .slice(0, 3)
                              .map((cat, idx) => (
                                <span
                                  key={`cat-${idx}`}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary border border-black/[0.1] dark:border-white/5"
                                >
                                  {cat.trim()}
                                </span>
                              ))}
                        </div>
                      </ChallengeCard>
                    </Link>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* RIGHT: Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-base font-black text-primary flex items-center gap-2 font-h2">
            <FiActivity className="text-accent" size={16} /> Recent Activity
          </h2>

          <div className="rounded-2xl border border-black/[0.12] dark:border-white/[0.06] overflow-hidden">
            {summaryQ.isLoading || profileQ.isLoading ? (
              <div className="divide-y divide-black/[0.08] dark:divide-white/[0.04]">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-4 animate-pulse"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="h-3.5 w-2/3 bg-black/10 dark:bg-white/10 rounded-full" />
                      <div className="h-2.5 w-1/3 bg-black/10 dark:bg-white/10 rounded-full" />
                    </div>
                    <div className="h-5 w-16 bg-black/10 dark:bg-white/10 rounded-md ml-3" />
                  </div>
                ))}
              </div>
            ) : recentSubs.length === 0 ? (
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
                  const att = sub.status === "Attempted";
                  const badgeCls = ac
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : wa
                      ? "bg-red-500/15 text-red-400 border-red-500/25"
                      : att
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/25"
                        : "bg-yellow-500/15 text-yellow-400 border-yellow-500/25";
                  const badgeLabel = ac
                    ? "SOLVED"
                    : wa
                      ? "REJECTED"
                      : att
                        ? "ATTEMPTED"
                        : "PENDING REVIEW";
                  return (
                    <Link
                      key={sub._id + i}
                      to={
                        att
                          ? `/challenge/${sub.challengeId?._id}`
                          : `/submission/${sub._id}`
                      }
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
