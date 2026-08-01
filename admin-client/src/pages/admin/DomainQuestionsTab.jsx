import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiUploadCloud, FiEdit2, FiX } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import { api } from '../../lib/api';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const emptyForm = () => ({
  type: 'mcq',
  title: '',
  description: '',
  difficulty: 'Easy',
  tags: '',
  options: ['', ''],
  correctOption: 0,
  explanation: '',
  modelAnswer: '',
});

const formFromQuestion = (q) => ({
  type: q.type,
  title: q.title || '',
  description: q.description || '',
  difficulty: q.difficulty || 'Easy',
  tags: (q.tags || []).join(', '),
  options: q.options?.length ? q.options : ['', ''],
  correctOption: q.correctOption ?? 0,
  explanation: q.explanation || '',
  modelAnswer: q.modelAnswer || '',
});

// Pull a readable list of messages out of the API's validation-error response.
const extractErrors = (err) => {
  const data = err?.response?.data;
  if (!data) return [err?.message || 'Request failed'];
  const out = [];
  if (Array.isArray(data.errors)) {
    for (const e of data.errors) out.push(e.message || `${e.path || ''} invalid`);
  } else if (data.errors && typeof data.errors === 'object') {
    for (const [k, v] of Object.entries(data.errors)) out.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  if (!out.length) out.push(data.message || 'Validation failed');
  return out;
};

const inputCls =
  'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90 focus:border-indigo-400 focus:outline-none';

const DomainQuestionsTab = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const questionsQuery = useQuery({
    queryKey: ['admin-domain-questions'],
    queryFn: async () => {
      const res = await api.get('/api/challenges/domain/manage');
      return res.data.data.items || [];
    },
  });
  const questions = questionsQuery.data || [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-domain-questions'] });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setOption = (i, val) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? val : o)) }));
  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, ''] }));
  const removeOption = (i) =>
    setForm((f) => {
      const options = f.options.filter((_, idx) => idx !== i);
      const correctOption = f.correctOption >= options.length ? 0 : f.correctOption;
      return { ...f, options, correctOption };
    });

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setErrors([]);
  };

  const startEdit = (q) => {
    setForm(formFromQuestion(q));
    setEditingId(q._id);
    setErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildPayload = () => {
    const base = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      difficulty: form.difficulty,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    if (form.type === 'mcq') {
      return {
        ...base,
        options: form.options.map((o) => o.trim()).filter(Boolean),
        correctOption: Number(form.correctOption),
        explanation: form.explanation.trim(),
      };
    }
    return { ...base, modelAnswer: form.modelAnswer.trim() };
  };

  const onSave = async (e) => {
    e.preventDefault();
    setErrors([]);
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/challenges/${editingId}`, buildPayload());
        toast.success('Question updated');
      } else {
        await api.post('/api/challenges', buildPayload());
        toast.success('Question created');
      }
      resetForm();
      refresh();
    } catch (err) {
      const msgs = extractErrors(err);
      setErrors(msgs);
      toast.error(msgs[0]);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (q) => {
    if (!window.confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/challenges/${q._id}`);
      toast.success('Question deleted');
      if (editingId === q._id) resetForm();
      refresh();
    } catch (err) {
      toast.error(extractErrors(err)[0]);
    }
  };

  const onBulk = async () => {
    setBulkResult(null);
    let parsed;
    try {
      parsed = JSON.parse(bulkText);
    } catch {
      toast.error('Bulk input is not valid JSON');
      return;
    }
    const bulkQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(bulkQuestions) || bulkQuestions.length === 0) {
      toast.error('Provide a JSON array of questions (or { "questions": [...] })');
      return;
    }
    setBulkBusy(true);
    try {
      const res = await api.post('/api/challenges/domain/bulk', { questions: bulkQuestions });
      setBulkResult(res.data.data);
      toast.success(res.data.message || 'Uploaded');
      refresh();
    } catch (err) {
      toast.error(extractErrors(err)[0]);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Authoring / editing ───────────────────────────────────── */}
        <BaseCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {editingId ? 'Edit domain question' : 'New domain question'}
            </h3>
            {editingId && (
              <button onClick={resetForm} className="flex items-center gap-1 text-sm text-white/50 hover:text-white">
                <FiX /> Cancel edit
              </button>
            )}
          </div>
          <form onSubmit={onSave} className="space-y-4">
            <div className="flex gap-2">
              {['mcq', 'written'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set({ type: t })}
                  className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                    form.type === t ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60'
                  }`}
                >
                  {t === 'mcq' ? 'Multiple choice' : 'Written'}
                </button>
              ))}
            </div>

            <input className={inputCls} placeholder="Title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            <textarea className={inputCls} rows={3} placeholder="Question / prompt" value={form.description} onChange={(e) => set({ description: e.target.value })} />

            <div className="flex gap-3">
              <select className={inputCls} value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                {DIFFICULTIES.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <input className={inputCls} placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
            </div>

            {form.type === 'mcq' ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-white/40">Options (select the correct one)</p>
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correctOption" checked={Number(form.correctOption) === i} onChange={() => set({ correctOption: i })} />
                    <input className={inputCls} placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => setOption(i, e.target.value)} />
                    {form.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-white/40 hover:text-red-400"><FiTrash2 /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addOption} className="flex items-center gap-1 text-sm text-indigo-300"><FiPlus /> Add option</button>
                <textarea className={inputCls} rows={2} placeholder="Explanation (shown after a graded attempt, optional)" value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} />
              </div>
            ) : (
              <textarea className={inputCls} rows={5} placeholder="Model answer (revealed to the participant after they submit)" value={form.modelAnswer} onChange={(e) => set({ modelAnswer: e.target.value })} />
            )}

            {errors.length > 0 && (
              <ul className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {errors.map((msg, i) => (<li key={i}>• {msg}</li>))}
              </ul>
            )}

            <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update question' : 'Create question'}
            </button>
          </form>
        </BaseCard>

        {/* ── Bulk upload ───────────────────────────────────────────── */}
        <BaseCard className="p-5">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white"><FiUploadCloud /> Bulk upload</h3>
          <p className="mb-3 text-sm text-white/50">Paste a JSON array of questions. Valid entries are created; invalid ones are reported below.</p>
          <textarea
            className={`${inputCls} font-mono`}
            rows={12}
            placeholder={'[\n  { "type": "mcq", "title": "...", "description": "...", "difficulty": "Easy",\n    "options": ["A","B"], "correctOption": 0, "tags": ["databases"] }\n]'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <button type="button" onClick={onBulk} disabled={bulkBusy} className="mt-3 w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50">
            {bulkBusy ? 'Uploading…' : 'Upload'}
          </button>
          {bulkResult && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-emerald-300">Created {bulkResult.createdCount} question(s).</p>
              {bulkResult.failures?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                  <p className="mb-1 font-medium">{bulkResult.failures.length} failed:</p>
                  <ul className="space-y-1">
                    {bulkResult.failures.map((f) => (
                      <li key={f.index}>#{f.index + 1}: {f.errors.map((e) => `${e.path} — ${e.message}`).join('; ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </BaseCard>
      </div>

      {/* ── Existing questions ──────────────────────────────────────── */}
      <BaseCard className="p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Existing questions <span className="text-sm font-normal text-white/40">({questions.length})</span>
        </h3>
        {questionsQuery.isLoading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-white/40">No domain questions yet. Create one above or bulk upload.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {questions.map((q) => (
              <div key={q._id} className="flex items-center gap-3 py-3">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${q.type === 'mcq' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'}`}>
                  {q.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{q.title}</p>
                  <p className="text-xs text-white/40">{q.difficulty} · {(q.tags || []).join(', ') || 'no tags'}</p>
                </div>
                <button onClick={() => startEdit(q)} className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-indigo-300" title="Edit"><FiEdit2 /></button>
                <button onClick={() => onDelete(q)} className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-red-400" title="Delete"><FiTrash2 /></button>
              </div>
            ))}
          </div>
        )}
      </BaseCard>
    </div>
  );
};

export default DomainQuestionsTab;
