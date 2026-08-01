import React, { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiChevronLeft,
  FiCheck,
  FiX,
  FiLock,
  FiClock,
  FiZap,
  FiAward,
} from "react-icons/fi";
import { api } from "../lib/api";
import { getDifficultyRGB } from "../constants/difficulty";
import SkeletonCard from "../components/SkeletonCard";

const untilLabel = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ── MCQ ─────────────────────────────────────────── */
const McqSolver = ({ question, onGraded }) => {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (selected == null) return;
    setSubmitting(true);
    try {
      const res = await api.post("/api/submissions/mcq", {
        challengeId: question._id,
        selectedOption: selected,
      });
      setResult(res.data.data);
      onGraded();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  const rowState = (i) => {
    if (!result) return selected === i ? "selected" : "idle";
    if (i === result.correctOption) return "correct";
    if (i === selected) return "wrong";
    return "muted";
  };
  const rowCls = {
    idle: "border-subtle hover:border-accent/40 hover:bg-white/[0.03]",
    selected: "border-accent bg-accent/10 ring-1 ring-accent/40",
    correct: "border-green-500/50 bg-green-500/10",
    wrong: "border-red-500/50 bg-red-500/10",
    muted: "border-subtle opacity-55",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {question.options.map((opt, i) => {
          const st = rowState(i);
          return (
            <button
              key={i}
              type="button"
              disabled={!!result}
              onClick={() => setSelected(i)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium text-primary transition-all ${rowCls[st]}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  st === "correct"
                    ? "bg-green-500 text-white"
                    : st === "wrong"
                      ? "bg-red-500 text-white"
                      : st === "selected"
                        ? "bg-accent text-white"
                        : "bg-white/5 text-tertiary"
                }`}
              >
                {st === "correct" ? <FiCheck /> : st === "wrong" ? <FiX /> : String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`rounded-2xl border p-5 ${
              result.correct
                ? "border-green-500/30 bg-green-500/[0.07]"
                : "border-amber-500/30 bg-amber-500/[0.07]"
            }`}
          >
            {result.correct ? (
              <div className="flex items-start gap-3">
                <FiAward className="mt-0.5 shrink-0 text-green-400" size={20} />
                <div>
                  <p className="font-bold text-primary">Mastered — nice recall.</p>
                  <p className="mt-0.5 text-sm text-secondary">
                    +{result.awardedPoints} XP added to your score.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <FiClock className="mt-0.5 shrink-0 text-amber-400" size={20} />
                <div>
                  <p className="font-bold text-primary">Not this time — you'll see it again.</p>
                  <p className="mt-0.5 text-sm text-secondary">
                    Comes back for review in {untilLabel(result.nextAttemptAt)}. The answer's
                    marked above so it sticks.
                  </p>
                </div>
              </div>
            )}
            {result.explanation && (
              <p className="mt-3 border-t border-black/5 pt-3 text-sm leading-relaxed text-secondary dark:border-white/5">
                {result.explanation}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="submit"
            type="button"
            onClick={submit}
            disabled={selected == null || submitting}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
            style={{ boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.35)" }}
          >
            {submitting ? "Checking…" : "Submit answer"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Written ─────────────────────────────────────── */
const WrittenSolver = ({ question, onGraded }) => {
  const navigate = useNavigate();
  const [answer, setAnswer] = useState("");
  const [modelAnswer, setModelAnswer] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      const res = await api.post("/api/submissions/written", {
        challengeId: question._id,
        answerText: answer.trim(),
      });
      setModelAnswer(res.data.data.modelAnswer);
      onGraded();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not submit answer");
    } finally {
      setBusy(false);
    }
  };

  const selfAssess = async (gotIt) => {
    setBusy(true);
    try {
      await api.post("/api/challenges/domain/self-assess", {
        challengeId: question._id,
        gotIt,
      });
      toast.success(gotIt ? "Marked as mastered" : "Saved for review");
      onGraded();
      navigate("/interview-prep");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (modelAnswer == null) {
    return (
      <div className="space-y-4">
        <textarea
          className="min-h-[220px] w-full rounded-xl border border-subtle bg-black/5 p-4 text-sm leading-relaxed text-primary placeholder:text-tertiary focus:border-accent focus:outline-none dark:bg-white/5"
          placeholder="Explain it in your own words, like you would in an interview…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!answer.trim() || busy}
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
          style={{ boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.35)" }}
        >
          {busy ? "Submitting…" : "Submit & reveal model answer"}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-subtle p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-tertiary">
            Your answer
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">{answer}</p>
        </div>
        <div className="rounded-xl border border-green-500/25 bg-green-500/[0.05] p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-green-500/80">
            Model answer
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">{modelAnswer}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-subtle p-5">
        <p className="text-sm font-semibold text-primary">How did you do?</p>
        <p className="mt-0.5 text-xs text-tertiary">
          This tracks your own mastery. A reviewer separately scores your submitted answer for XP.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => selfAssess(true)}
            disabled={busy}
            className="flex-1 rounded-xl bg-green-500/15 py-2.5 text-sm font-bold text-green-500 transition-colors hover:bg-green-500/25 disabled:opacity-50"
          >
            I got it
          </button>
          <button
            onClick={() => selfAssess(false)}
            disabled={busy}
            className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-bold text-secondary transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Review later
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Page ────────────────────────────────────────── */
const DomainQuestionSolve = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: question, isLoading, isError } = useQuery({
    queryKey: ["domain-question", id],
    queryFn: async () => {
      const res = await api.get(`/api/challenges/domain/${id}`);
      return res.data.data;
    },
  });

  const onGraded = () => {
    queryClient.invalidateQueries({ queryKey: ["domain-pool"] });
    queryClient.invalidateQueries({ queryKey: ["domain-due"] });
    queryClient.invalidateQueries({ queryKey: ["domain-due-count"] });
    queryClient.invalidateQueries({ queryKey: ["domain-question", id] });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SkeletonCard />
      </div>
    );
  }
  if (isError || !question) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-primary">Question not available</h2>
        <Link to="/interview-prep" className="mt-4 inline-block text-sm font-semibold text-accent">
          ← Back to Interview Prep
        </Link>
      </div>
    );
  }

  const diff = getDifficultyRGB(question.difficulty);
  const locked = question.locked && question.masteryStatus !== "Mastered";
  const mastered = question.masteryStatus === "Mastered";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        to="/interview-prep"
        className="inline-flex items-center gap-1 text-sm text-secondary transition-colors hover:text-accent"
      >
        <FiChevronLeft size={15} /> Interview Prep
      </Link>

      {/* Question header */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-tertiary">
          {question.type === "mcq" ? "Multiple choice" : "Written"}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ color: `rgb(${diff})`, backgroundColor: `rgba(${diff},0.15)` }}
        >
          {question.difficulty}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
          <FiZap size={11} /> {question.points} XP
        </span>
        {(question.tags || []).map((t) => (
          <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-secondary">
            {t}
          </span>
        ))}
        {mastered && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-[10px] font-bold text-green-500">
            <FiCheck size={11} /> Mastered
          </span>
        )}
      </div>

      <h1 className="mt-3 text-xl font-black leading-snug text-primary sm:text-2xl">
        {question.title}
      </h1>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-secondary">
        {question.description}
      </p>

      <div className="mt-7">
        {mastered ? (
          <div className="rounded-2xl border border-green-500/25 bg-green-500/[0.05] p-6 text-center">
            <FiAward className="mx-auto text-green-400" size={26} />
            <p className="mt-2 font-bold text-primary">You've mastered this one.</p>
            <Link to="/interview-prep" className="mt-4 inline-block text-sm font-semibold text-accent">
              Back to the pool →
            </Link>
          </div>
        ) : locked ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 text-center">
            <FiLock className="mx-auto text-amber-400" size={24} />
            <p className="mt-2 font-bold text-primary">Cooling down.</p>
            <p className="mt-1 text-sm text-secondary">
              This question reopens for review in {untilLabel(question.nextAttemptAt)}.
            </p>
            <Link to="/interview-prep" className="mt-4 inline-block text-sm font-semibold text-accent">
              Back to the pool →
            </Link>
          </div>
        ) : question.type === "mcq" ? (
          <McqSolver question={question} onGraded={onGraded} />
        ) : (
          <WrittenSolver question={question} onGraded={onGraded} />
        )}
      </div>
    </div>
  );
};

export default DomainQuestionSolve;
