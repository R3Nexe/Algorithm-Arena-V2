import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiTrash2, FiClock, FiTarget, FiZap, FiEdit3, FiCalendar, FiUploadCloud, FiX } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import { api } from '../../lib/api';

const initialQuestionState = {
  title: '',
  difficulty: 'Easy',
  points: 100,
  category: '',
  description: '',
  hints: ['']
};

const QuestionSetsTab = () => {
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list', 'history', 'create'
  const [importModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const setsQuery = useQuery({
    queryKey: ['admin-question-sets'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/sets');
        return res.data.data || [];
      } catch {
        return [];
      }
    }
  });

  const [form, setForm] = useState({
    title: '',
    weekNumber: 1,
    deadline: '',
    targetLevel: 'Both',
    questions: [{ ...initialQuestionState }]
  });

  const createSetMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/api/sets', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Question Set published! Emails sent to members.');
      queryClient.invalidateQueries(['admin-question-sets']);
      setView('list');
      setForm({
        title: '', weekNumber: 1, deadline: '', targetLevel: 'Both', questions: [{ ...initialQuestionState }]
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to publish set');
    }
  });

  const importMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/challenges/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Challenges imported successfully!');
      queryClient.invalidateQueries(['admin-question-sets']);
      setImportModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to import challenges');
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
  };

  const handleAddQuestion = () => {
    if (form.questions.length >= 5) {
      toast.error('Maximum 5 questions per set allowed.');
      return;
    }
    setForm(prev => ({ ...prev, questions: [...prev.questions, { ...initialQuestionState }] }));
  };

  const handleRemoveQuestion = (index) => {
    if (form.questions.length === 1) return;
    setForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }));
  };

  const updateQuestion = (index, field, value) => {
    const newQs = [...form.questions];
    newQs[index][field] = value;
    setForm({ ...form, questions: newQs });
  };

  const updateHint = (qIndex, hIndex, value) => {
    const newQs = [...form.questions];
    newQs[qIndex].hints[hIndex] = value;
    setForm({ ...form, questions: newQs });
  };

  const handlePublish = (e) => {
    e.preventDefault();
    createSetMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex gap-2">
        <button onClick={() => setView('list')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'list' ? 'bg-accent text-white' : 'bg-white/5 text-secondary hover:text-primary'}`}>Active Sets</button>
        <button onClick={() => setView('history')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'history' ? 'bg-accent text-white' : 'bg-white/5 text-secondary hover:text-primary'}`}>History</button>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setImportModalOpen(true)} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center gap-2">
            <FiUploadCloud /> Import
          </button>
          <button onClick={() => setView('create')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${view === 'create' ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
            <FiPlus /> Create New Set
          </button>
        </div>
      </div>

      {view === 'create' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
          <form onSubmit={handlePublish} className="space-y-6">
            <BaseCard className="p-6 space-y-4 border-l-4 border-l-accent">
              <h2 className="text-xl font-black text-primary">Set Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Set Title</label>
                  <input required className="field-input" placeholder="e.g. Dynamic Programming Basics" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                </div>
                <div>
                  <label className="field-label">Target Level</label>
                  <div className="flex bg-white/5 p-1 rounded-xl">
                    {['Beginner', 'Intermediate', 'Both'].map(lvl => (
                      <button type="button" key={lvl} onClick={() => setForm({...form, targetLevel: lvl})} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${form.targetLevel === lvl ? 'bg-white/10 text-primary shadow' : 'text-tertiary hover:text-secondary'}`}>{lvl}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Week Number</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
                    <input required type="number" min="1" className="field-input pl-9" value={form.weekNumber} onChange={e => setForm({...form, weekNumber: Number(e.target.value)})} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Deadline</label>
                  <input required type="date" className="field-input" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
                </div>
              </div>
            </BaseCard>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-primary">Questions ({form.questions.length}/5)</h2>
                {form.questions.length < 5 && (
                  <button type="button" onClick={handleAddQuestion} className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors flex items-center gap-1">
                    <FiPlus /> Add Question
                  </button>
                )}
              </div>

              <AnimatePresence>
                {form.questions.map((q, i) => (
                  <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <BaseCard className="p-5 space-y-4 relative overflow-hidden group">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-primary flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-secondary">{i+1}</span>
                          Question Config
                        </h3>
                        {form.questions.length > 1 && (
                          <button type="button" onClick={() => handleRemoveQuestion(i)} className="text-red-400 hover:text-red-300 p-1">
                            <FiTrash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="field-label text-[10px]">Title</label>
                          <input required className="field-input text-sm" value={q.title} onChange={e => updateQuestion(i, 'title', e.target.value)} />
                        </div>
                        <div>
                          <label className="field-label text-[10px]">Difficulty</label>
                          <select className="field-select text-sm" value={q.difficulty} onChange={e => updateQuestion(i, 'difficulty', e.target.value)}>
                            <option>Easy</option><option>Medium</option><option>Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="field-label text-[10px]">Points</label>
                          <input required type="number" className="field-input text-sm" value={q.points} onChange={e => updateQuestion(i, 'points', Number(e.target.value))} />
                        </div>
                        <div>
                          <label className="field-label text-[10px]">Tags/Category</label>
                          <input className="field-input text-sm" placeholder="e.g. Arrays, Sorting" value={q.category} onChange={e => updateQuestion(i, 'category', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="field-label text-[10px]">Problem Description</label>
                          <textarea required rows="3" className="field-textarea text-sm" value={q.description} onChange={e => updateQuestion(i, 'description', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="field-label text-[10px]">Hints (optional)</label>
                          {q.hints.map((hint, hi) => (
                            <input key={hi} className="field-input text-sm mb-2" placeholder="Hint..." value={hint} onChange={e => updateHint(i, hi, e.target.value)} />
                          ))}
                        </div>
                      </div>
                    </BaseCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={createSetMutation.isLoading} className="btn-primary w-full md:w-auto px-8 py-3 text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                {createSetMutation.isLoading ? 'Publishing...' : 'Publish Question Set & Notify'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {(view === 'list' || view === 'history') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {setsQuery.data?.map((set, i) => {
            const isHistory = new Date(set.deadline) < new Date();
            if (view === 'list' && isHistory) return null;
            if (view === 'history' && !isHistory) return null;

            return (
              <motion.div key={set._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <BaseCard className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-primary">{set.title}</h3>
                      <p className="text-xs text-secondary font-mono flex items-center gap-2 mt-1">
                        <FiTarget className="text-accent"/> Target: {set.targetLevel}
                        <span className="text-white/20">|</span>
                        <FiClock className="text-orange-400"/> Due: {new Date(set.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                      Week {set.weekNumber}
                    </span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="space-y-2">
                    {set.questions.map((q, qi) => {
                      const diffColor = q.difficulty === 'Easy' ? 'text-green-400' : q.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400';
                      return (
                        <div key={qi} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/5">
                          <span className="text-secondary truncate pr-2 max-w-[60%] font-medium">{q.title}</span>
                          <div className="flex gap-3 text-xs font-bold">
                            <span className={diffColor}>{q.difficulty}</span>
                            <span className="text-accent flex items-center gap-1"><FiZap size={10}/> {q.points} XP</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </BaseCard>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md">
              <BaseCard className="p-6 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-primary flex items-center gap-2"><FiUploadCloud className="text-purple-400"/> Import Questions</h3>
                  <button onClick={() => setImportModalOpen(false)} className="text-tertiary hover:text-primary"><FiX size={20} /></button>
                </div>

                <p className="text-sm text-secondary">Upload a <strong>.json</strong>, <strong>.csv</strong>, or <strong>.docx</strong> file to bulk import challenges into the database.</p>

                <div
                  className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400/50 hover:bg-purple-400/5 transition-all text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiUploadCloud className="text-4xl text-tertiary mb-3" />
                  <p className="font-bold text-primary mb-1">Click or drag file to upload</p>
                  <p className="text-xs text-tertiary">Supported: JSON, CSV, DOCX</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json,.csv,.docx"
                    onChange={handleFileChange}
                  />
                </div>

                {importMutation.isLoading && (
                  <div className="text-center text-sm text-purple-400 animate-pulse font-bold">
                    Importing... Please wait...
                  </div>
                )}
              </BaseCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionSetsTab;
