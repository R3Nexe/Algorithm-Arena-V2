import React, { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  FiArrowRight,
  FiClock,
  FiActivity,
  FiZap,
  FiAward,
  FiUsers,
} from "react-icons/fi";
import Card from "../components/Card";
import SkeletonCard from "../components/SkeletonCard";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";
import Logo from "../components/Logo";


const MotionBlock = motion.div;

/* ── Animated grid background ── */
const GridBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {/* Perspective grid */}
    <svg
      className="absolute top-0 left-0 w-full h-full opacity-[.1] dark:opacity-[.1] transition-transform duration-300 ease-out"
      style={{
        transform: "translate(calc(var(--mouse-offset-x, 0) * -20px), calc(var(--mouse-offset-y, 0) * -20px))",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    {/* Spotlight on the grid */}
    <div
      className="absolute inset-0 opacity-45 dark:opacity-30 transition-opacity duration-300"
      style={{
        background: "radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(var(--accent-rgb), 0.15), transparent 90%)",
      }}
    />

    {/* Orbs */}
    <div
      className="orb orb-1 transition-transform duration-500 ease-out"
      style={{
        filter: "blur(80px)",
        opacity: 0.35,
        transform: "translate(calc(var(--mouse-offset-x, 0) * 40px), calc(var(--mouse-offset-y, 0) * 40px))",
      }}
    />
    <div
      className="orb orb-2 transition-transform duration-500 ease-out"
      style={{
        filter: "blur(100px)",
        opacity: 0.25,
        transform: "translate(calc(var(--mouse-offset-x, 0) * -40px), calc(var(--mouse-offset-y, 0) * -40px))",
      }}
    />

    {/* Accent cross-hair lines */}
    <div
      className="absolute top-1/2 left-0 w-full h-px"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(var(--accent-rgb), 0.08), transparent)",
      }}
    />
    <div
      className="absolute top-0 left-1/2 h-full w-px"
      style={{
        background:
          "linear-gradient(180deg, transparent, rgba(var(--accent-rgb), 0.06), transparent)",
      }}
    />
  </div>
);

/* ── Floating code snippets ── */
const SNIPPETS = [
  "O(n log n)",
  "adj[u].push_back(v)",
  "1 << n",
  "dp[mask][i]",
  "LCA(u, v)",
  "segmentTree.query(l, r)",
  "T(n) = 2T(n/2) + O(n)",
  "__builtin_popcount()",
  "priority_queue<int> pq",
  "dijkstra(source, target)",
  "gcd(a, b) = gcd(b, a % b)",
  "parent[find(i)] = find(j)",
  "while(t--) { solve(); }",
  "x ≡ a (mod m)",
  "n & (n - 1) == 0",
  "dist[v] > dist[u] + w",
  "topologicalSort()",
  "memo[i][j] != -1",
  "maxFlow / minCut",
  "std::next_permutation",
  "Φ(n) [Euler Totient]",
  "segmentTree.update(idx, val)",
  "O(V + E)",
  "fenwickTree[idx] += val",
  "nCr % (10⁹ + 7)",
  "stronglyConnectedComponents",
  "long long ll = 1e18",
  "BIT[i] & (-i)",
  "std::set_intersection",
  "O(sqrt(n))",
  "Floyd-Warshall",
  "2^n submasks",
  "isBipartite(G)",
  "std::unordered_map<k, v>",
  "Σ_{i=0}^{n} i²",
  "binarySearch(low, high)",
  "node->left->height",
];

const FloatingSnippet = ({ text, style, depth, rotation }) => (
  <span
    className="absolute font-mono text-[11px] font-bold select-none pointer-events-none transition-transform duration-300 ease-out"
    style={{
      color: `rgba(var(--accent-rgb), .2)`,
      letterSpacing: "0.05em",
      transform: `rotate(${rotation}deg) translate(calc(var(--mouse-offset-x, 0) * ${depth * -40}px), calc(var(--mouse-offset-y, 0) * ${depth * -40}px))`,
      ...style,
    }}
  >
    {text}
  </span>
);

/* ── Stat pill ── */
const StatPill = ({ icon: Icon, value, label, color }) => (
  <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/70 dark:bg-black/70 border border-black/[0.07] dark:border-white/10 shadow-sm dark:shadow-none">
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `rgba(${color}, 0.12)` }}
    >
      <Icon style={{ color: `rgba(${color}, 0.9)` }} className="text-sm" />
    </div>
    <div>
      <div className="text-lg font-black leading-none text-primary">
        {value}
      </div>
      <div className="text-[11px] text-secondary uppercase tracking-widest font-semibold mt-0.5">
        {label}
      </div>
    </div>
  </div>
);

const getDifficultyRGB = (diff) => {
  switch (diff) {
    case "Easy":
      return "34, 197, 94";
    case "Medium":
      return "234, 179, 8";
    case "Hard":
      return "239, 68, 68";
    default:
      return "0, 122, 255";
  }
};

/* ════════════════════════════════════════ */
const Home = () => {
  const { isAuthenticated } = useAuth();
  const heroRef = useRef(null);
  const homeRef = useRef(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.1]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const el = homeRef.current;
      if (!el) return;
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      el.style.setProperty("--mouse-x", `${e.clientX}px`);
      el.style.setProperty("--mouse-y", `${e.clientY}px`);
      el.style.setProperty("--mouse-offset-x", `${x}`);
      el.style.setProperty("--mouse-offset-y", `${y}`);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const challengesQuery = useQuery({
    queryKey: ["home-challenges"],
    queryFn: async () => {
      const res = await api.get(
        "/api/challenges?page=1&limit=6&sortBy=createdAt&sortDir=desc",
      );
      return res.data.data || [];
    },
  });

  const challenges = challengesQuery.data || [];

  const submissionsQuery = useQuery({
    queryKey: ["home-pending-tasks"],
    queryFn: async () => {
      const res = await api.get("/api/submissions?status=Pending");
      return res.data.data || [];
    },
    enabled: isAuthenticated,
  });


  const pendingTasks = submissionsQuery.data || [];

  return (
    <div ref={homeRef} className="min-h-screen flex flex-col relative overflow-hidden bg-app text-primary font-sans selection:bg-accent selection:text-white">
      <GridBackground />

      {/* Floating snippets — decorative only */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {SNIPPETS.map((s, i) => {
          const depth = 0.4 + (i % 4) * 0.2;
          const rotation = -8 + (i % 5) * 4;
          return (
            <FloatingSnippet
              key={i}
              text={s}
              depth={depth}
              rotation={rotation}
              style={{
                top: `${8 + ((i * 7.5) % 85)}%`,
                left: `${3 + ((i * 11) % 94)}%`,
                opacity: .6 + (i % 3) * 0.75,
              }}
            />
          );
        })}
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-10 flex justify-between items-center px-6 py-5 w-full">
        <Link to="/" className="group flex items-center">
          <Logo variant="arena" showText={true} size="sm" />
        </Link>

        <div className="flex gap-2 items-center">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-5 py-2 rounded-full font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, rgba(var(--accent-rgb), 1), rgba(var(--accent-rgb), 0.7))`,
                boxShadow: `0 4px 16px rgba(var(--accent-rgb), 0.3)`,
              }}
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-1.5 text-secondary hover:text-primary rounded-full font-semibold text-sm transition-all hover:bg-white/5"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 rounded-full text-white font-bold text-sm transition-all hover:-translate-y-0.5 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, rgba(var(--accent-rgb), 1) 0%, #a855f7 100%)`,
                  boxShadow: `0 4px 12px rgba(var(--accent-rgb), 0.25)`,
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <motion.div
        ref={heroRef}
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-16 pb-24"
      >
        {/* GDG badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col items-center gap-3">
            <Logo
              variant="hybrid"
              size="w-32 h-16"
              imgClassName="object-cover"
              style={{ filter: "drop-shadow(0 0 20px rgba(var(--accent-rgb),0.3))" }}
            />
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black tracking-[0.15em] uppercase backdrop-blur-md"
              style={{
                background: `rgba(var(--accent-rgb), 0.1)`,
                border: `1px solid rgba(var(--accent-rgb), 0.25)`,
                color: `rgb(var(--accent-rgb))`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: `rgb(var(--accent-rgb))` }} />
              GDG on Campus · SOA ITER
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-5xl mx-auto"
        >
          {/* Decorative rank label */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="h-px flex-1 max-w-[80px]"
              style={{ background: `rgba(var(--accent-rgb), 0.3)` }}
            />
            <span
              className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: `rgba(var(--accent-rgb), 0.6)` }}
            >
              Season 02
            </span>
            <div
              className="h-px flex-1 max-w-[80px]"
              style={{ background: `rgba(var(--accent-rgb), 0.3)` }}
            />
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-2">
            <span className="text-primary block">Compete.</span>
            <span className="text-primary block">
              Solve.{" "}
              <span
                className="relative inline-block"
                style={{
                  background: `linear-gradient(135deg, rgb(var(--accent-rgb)), #a855f7, #ec4899)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Dominate.
              </span>
            </span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-lg md:text-xl text-secondary max-w-xl mx-auto leading-relaxed mt-6"
        >
          The competitive programming arena built for ITER students. Sharpen
          your DSA skills, climb the ranks, and get interview-ready.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mt-10"
        >
          <Link
            to={isAuthenticated ? "/dashboard" : "/register"}
            className="group relative px-8 py-3.5 rounded-2xl text-white font-black text-base transition-all hover:-translate-y-1 flex items-center justify-center gap-2 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, rgb(var(--accent-rgb)), #7c3aed)`,
              boxShadow: `0 8px 32px rgba(var(--accent-rgb), 0.35), 0 2px 8px rgba(0,0,0,0.2)`,
            }}
          >
            <span className="relative z-10">
              {isAuthenticated ? "Resume Coding" : "Start Competing"}
            </span>
            <FiArrowRight className="relative z-10 group-hover:translate-x-1 transition-transform" />
            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </Link>

          <Link
            to="/leaderboard"
            className="px-8 py-3.5 rounded-2xl font-bold text-base transition-all hover:-translate-y-0.5 backdrop-blur-md border text-primary"
            style={{
              background: `rgba(var(--accent-rgb), 0.05)`,
              borderColor: `rgba(var(--accent-rgb), 0.2)`,
            }}
          >
            View Leaderboard
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-3 mt-12"
        >
          <StatPill
            icon={FiZap}
            value="50+"
            label="Challenges"
            color="234, 179, 8"
          />
          <StatPill
            icon={FiUsers}
            value="200+"
            label="Coders"
            color="34, 197, 94"
          />
          <StatPill
            icon={FiAward}
            value="1.5k"
            label="Submissions"
            color="var(--accent-rgb)"
          />
        </motion.div>
      </motion.div>

      {/* ── Difficulty legend strip ── */}

      {/* Divider */}
      <div
        className="relative z-10 mx-auto w-full max-w-6xl px-6"
        style={{
          height: "2px",
          background: `linear-gradient(90deg, transparent, rgba(var(--accent-rgb), 0.3), transparent)`,
          margin: "2rem auto",
        }}
      />

      {/* ── Authenticated sections ── */}
      {isAuthenticated && (
        <div className="relative z-10 px-6 pb-24">
          <div className="max-w-6xl mx-auto space-y-20">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <section className="space-y-8">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(234, 179, 8, 0.1)" }}
                  >
                    <FiClock className="text-yellow-500 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">Pending Tasks</h2>
                    <p className="text-secondary text-sm">
                      Under review — hang tight.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pendingTasks.map((task, i) => (
                    <MotionBlock
                      key={task._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                    >
                      <Link
                        to={`/submission/${task._id}`}
                        className="block group"
                      >
                        <Card difficultyColor="234, 179, 8" className="p-5">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-md">
                              Under Review
                            </span>
                            <span className="text-secondary text-[10px]">
                              {new Date(task.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-bold text-base group-hover:text-yellow-500 transition-colors">
                            {task.challengeId?.title || "Unknown Challenge"}
                          </h3>
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-secondary">
                              <FiActivity className="text-yellow-500" />
                              <span>View Status</span>
                            </div>
                            <FiArrowRight className="text-secondary group-hover:translate-x-1 transition-transform text-sm" />
                          </div>
                        </Card>
                      </Link>
                    </MotionBlock>
                  ))}
                </div>
              </section>
            )}

            {/* Available Missions */}
            <section className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  {/* Section eyebrow */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-px w-6"
                      style={{ background: `rgb(var(--accent-rgb))` }}
                    />
                    <span
                      className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase"
                      style={{ color: `rgba(var(--accent-rgb), 0.7)` }}
                    >
                      Active
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black leading-tight">
                    Available Missions
                  </h2>
                  <p className="text-secondary mt-1 text-sm">
                    Your next rank-up is one solve away.
                  </p>
                </div>
                <Link
                  to="/missions"
                  className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                  style={{
                    background: `rgba(var(--accent-rgb), 0.08)`,
                    border: `1px solid rgba(var(--accent-rgb), 0.2)`,
                    color: `rgb(var(--accent-rgb))`,
                  }}
                >
                  All Missions
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {challengesQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : challengesQuery.isError ? (
                <div className="rounded-2xl p-6 text-red-400 border border-red-500/20 bg-red-500/5">
                  {challengesQuery.error?.userMessage ||
                    "Failed to fetch challenges."}
                </div>
              ) : challenges.length === 0 ? (
                <div className="rounded-2xl p-10 text-center border border-white/5 bg-white/2">
                  <p className="text-secondary">
                    No missions yet. Check back soon.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {challenges.map((challenge, i) => (
                    <MotionBlock
                      key={challenge._id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Link
                        to={`/challenge/${challenge._id}`}
                        className="group block h-full"
                      >
                        <Card
                          className="h-full p-5 !rounded-2xl"
                          innerClassName="flex flex-col gap-3 h-full justify-between w-full"
                          difficultyColor={getDifficultyRGB(challenge.difficulty)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                challenge.difficulty === "Easy"
                                  ? "bg-green-500/15 text-green-400 border-green-500/25"
                                  : challenge.difficulty === "Medium"
                                    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                                    : "bg-red-500/15 text-red-400 border-red-500/25"
                              }`}
                            >
                              {challenge.difficulty}
                            </span>
                            <span className="text-[10px] font-black text-accent">
                              {challenge.points} XP
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-bold leading-snug text-primary group-hover:text-accent transition-colors line-clamp-2 flex-1">
                              {challenge.title}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-auto pt-2">
                            {challenge.tags && challenge.tags.length > 0 ? (
                              challenge.tags.slice(0, 3).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary border border-white/5"
                                >
                                  {tag}
                                </span>
                              ))
                            ) : challenge.category ? (
                              challenge.category.split(',').slice(0, 3).map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-secondary border border-white/5"
                                >
                                  {cat.trim()}
                                </span>
                              ))
                            ) : null}
                          </div>
                        </Card>
                      </Link>
                    </MotionBlock>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer
        className="relative z-10 mt-auto py-6 w-full"
        style={{
          borderTop: `1px solid rgba(var(--accent-rgb), 0.08)`,
          background: `rgba(var(--accent-rgb), 0.02)`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Logo variant="gdg" size="w-10 h-10" imgClassName="opacity-100" />
          <p className="text-xs text-secondary tracking-wide text-center">
            © 2026 Algorithm Arena ·{" "}
            <span className="text-primary font-bold">GDG On Campus – SOA ITER</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
