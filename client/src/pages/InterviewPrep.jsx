import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiX, FiCheck, FiClock, FiLock, FiHelpCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import SkeletonCard from '../components/SkeletonCard';
import EmptyState from '../components/EmptyState';

// Friendly "unlocks in" string for a future timestamp.
const untilLabel = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const STATE_STYLES = {
  Mastered: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  NeedsReview: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  Unattempted: 'text-white/50 border-white/10 bg-white/5',
};

const StateBadge = ({ item }) => {
  const { masteryStatus, locked, nextAttemptAt } = item;
  if (masteryStatus === 'Mastered') {
    return <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES.Mastered}`}><FiCheck className="inline" /> Mastered</span>;
  }
  if (masteryStatus === 'NeedsReview') {
    return (
      <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES.NeedsReview}`}>
        {locked ? <><FiLock className="inline" /> {untilLabel(nextAttemptAt)}</> : <><FiClock className="inline" /> Due for review</>}
      </span>
    );
  }
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES.Unattempted}`}>Unattempted</span>;
};

const McqModal = ({ question, onClose, onGraded }) => {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (selected == null) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/submissions/mcq', {
        challengeId: question._id,
        selectedOption: selected,
      });
      setResult(res.data.data);
      onGraded();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const optionClass = (i) => {
    if (!result) return selected === i ? 'border-indigo-400 bg-indigo-400/10' : 'border-white/10 hover:border-white/25';
    if (i === result.correctOption) return 'border-emerald-400 bg-emerald-400/10';
    if (i === selected) return 'border-red-400 bg-red-400/10';
    return 'border-white/10 opacity-60';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-1 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-white">{question.title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><FiX /></button>
        </div>
        <p className="mb-4 whitespace-pre-wrap text-sm text-white/70">{question.description}</p>

        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm text-white/90 transition ${optionClass(i)}`}>
              <input
                type="radio"
                name="mcq"
                disabled={!!result}
                checked={selected === i}
                onChange={() => setSelected(i)}
              />
              {opt}
            </label>
          ))}
        </div>

        {result ? (
          <div className="mt-4 space-y-2 text-sm">
            {result.correct ? (
              <p className="text-emerald-400">Correct! +{result.awardedPoints} points — mastered.</p>
            ) : (
              <p className="text-red-400">
                Not quite. Locked for review — unlocks in {untilLabel(result.nextAttemptAt)}.
              </p>
            )}
            {result.explanation && <p className="text-white/60">{result.explanation}</p>}
            <button onClick={onClose} className="mt-2 w-full rounded-lg bg-white/10 py-2 text-white hover:bg-white/15">Close</button>
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={selected == null || submitting}
            className="mt-5 w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit answer'}
          </button>
        )}
      </div>
    </div>
  );
};

const WrittenModal = ({ question, onClose, onGraded }) => {
  const [answer, setAnswer] = useState('');
  const [modelAnswer, setModelAnswer] = useState(null); // set once submitted → reveals
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      const res = await api.post('/api/submissions/written', {
        challengeId: question._id,
        answerText: answer.trim(),
      });
      setModelAnswer(res.data.data.modelAnswer);
      onGraded();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit answer');
    } finally {
      setBusy(false);
    }
  };

  const selfAssess = async (gotIt) => {
    setBusy(true);
    try {
      await api.post('/api/challenges/domain/self-assess', { challengeId: question._id, gotIt });
      toast.success(gotIt ? 'Marked as mastered' : 'Saved for review');
      onGraded();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-1 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-white">{question.title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><FiX /></button>
        </div>
        <p className="mb-4 whitespace-pre-wrap text-sm text-white/70">{question.description}</p>

        {modelAnswer == null ? (
          <>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90 focus:border-indigo-400 focus:outline-none"
              rows={6}
              placeholder="Write your answer…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <button
              onClick={submit}
              disabled={!answer.trim() || busy}
              className="mt-4 w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit & reveal model answer'}
            </button>
          </>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-white/40">Your answer</p>
              <p className="whitespace-pre-wrap rounded-lg bg-white/5 p-3 text-white/80">{answer}</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-emerald-400/70">Model answer</p>
              <p className="whitespace-pre-wrap rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-white/80">{modelAnswer}</p>
            </div>
            <p className="text-white/50">How did you do? A reviewer will separately score your answer for points.</p>
            <div className="flex gap-3">
              <button onClick={() => selfAssess(true)} disabled={busy} className="flex-1 rounded-lg bg-emerald-500 py-2 font-medium text-white hover:bg-emerald-400 disabled:opacity-50">
                Got it
              </button>
              <button onClick={() => selfAssess(false)} disabled={busy} className="flex-1 rounded-lg bg-white/10 py-2 font-medium text-white hover:bg-white/15 disabled:opacity-50">
                Review later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InterviewPrep = () => {
  const queryClient = useQueryClient();
  const [activeTag, setActiveTag] = useState(null);
  const [openMcq, setOpenMcq] = useState(null);
  const [openWritten, setOpenWritten] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['domain-pool'],
    queryFn: async () => {
      const res = await api.get('/api/challenges/domain');
      return res.data.data.items || [];
    },
  });

  const tags = useMemo(() => {
    const set = new Set();
    items.forEach((it) => (it.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const visible = useMemo(
    () => (activeTag ? items.filter((it) => (it.tags || []).includes(activeTag)) : items),
    [items, activeTag]
  );

  const openQuestion = (item) => {
    if (item.masteryStatus === 'Mastered') return;
    if (item.locked) {
      toast(`Locked — unlocks in ${untilLabel(item.nextAttemptAt)}`);
      return;
    }
    if (item.type === 'mcq') setOpenMcq(item);
    else setOpenWritten(item);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader title="Interview Prep" subtitle="Practise domain questions — no deadline, just mastery." />

      {tags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-sm ${activeTag == null ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60'}`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              className={`rounded-full px-3 py-1 text-sm ${activeTag === t ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title="No questions yet" description="Domain questions will appear here once an organiser adds them." icon={FiHelpCircle} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const answerable = item.masteryStatus !== 'Mastered' && !item.locked;
            return (
              <button
                key={item._id}
                onClick={() => openQuestion(item)}
                className={`flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-surface-1 p-4 text-left transition ${answerable ? 'hover:border-indigo-400/40' : 'cursor-default'}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-white/50">
                    {item.type === 'mcq' ? 'MCQ' : 'Written'}
                  </span>
                  <StateBadge item={item} />
                </div>
                <h3 className="font-medium text-white">{item.title}</h3>
                <div className="mt-auto flex flex-wrap gap-1">
                  <span className="text-xs text-white/40">{item.difficulty} · {item.points} pts</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openMcq && (
        <McqModal
          question={openMcq}
          onClose={() => setOpenMcq(null)}
          onGraded={() => queryClient.invalidateQueries({ queryKey: ['domain-pool'] })}
        />
      )}

      {openWritten && (
        <WrittenModal
          question={openWritten}
          onClose={() => setOpenWritten(null)}
          onGraded={() => queryClient.invalidateQueries({ queryKey: ['domain-pool'] })}
        />
      )}
    </div>
  );
};

export default InterviewPrep;
