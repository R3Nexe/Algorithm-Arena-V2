import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiTrash2, FiClock, FiTarget, FiZap, FiCalendar, FiUploadCloud, FiX, FiSearch } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { api } from '../../lib/api';

const initialQuestionState = {
  title:'',difficulty:'Easy',points:100,category:'',description:'',
  hints:[''],leetcodeSlug:'',tags:[],codeSnippets:[],functionName:'',testCases:[]
};
const defaultChallengeForm = {
  title:'',description:'',link:'',difficulty:'Easy',points:100,
  category:'Logic',tags:[],codeSnippets:[],functionName:'',testCases:[]
};
const prepareTestCases = (raw) => raw.filter(tc=>tc.label.trim()).map(tc=>{
  let args=[]; try{args=JSON.parse(tc.args)}catch{} return{label:tc.label,args,expected:tc.expected};
});
const emptyTestCase = ()=>({label:'',args:'[]',expected:''});

const QuestionSetsTab = () => {
  const qc = useQueryClient();
  const [view,setView] = useState('list');
  const [importModalOpen,setImportModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [form,setForm] = useState({title:'',weekNumber:1,deadline:'',targetLevel:'Both',questions:[{...initialQuestionState}]});
  const [challengeFilters,setChallengeFilters] = useState({search:'',range:'all',from:'',to:''});
  const [createChallengeForm,setCreateChallengeForm] = useState(defaultChallengeForm);
  const [editingChallenge,setEditingChallenge] = useState(null);
  const [deleteTarget,setDeleteTarget] = useState(null);
  const [leetcodeInput,setLeetcodeInput] = useState('');
  const [isFetchingLC,setIsFetchingLC] = useState(false);
  const [snippetLang,setSnippetLang] = useState('');

  const setsQuery = useQuery({queryKey:['admin-question-sets'],queryFn:async()=>{try{const r=await api.get('/api/sets');return r.data.data||[]}catch{return[]}}});

  const createSetMutation = useMutation({
    mutationFn:async(d)=>(await api.post('/api/sets',d)).data,
    onSuccess:()=>{toast.success('Question Set published!');qc.invalidateQueries(['admin-question-sets']);setView('list');setForm({title:'',weekNumber:1,deadline:'',targetLevel:'Both',questions:[{...initialQuestionState}]})},
    onError:(e)=>toast.error(e.response?.data?.message||'Failed')
  });

  const importMutation = useMutation({
    mutationFn:async(f)=>{const fd=new FormData();fd.append('file',f);return(await api.post('/api/challenges/import',fd,{headers:{'Content-Type':'multipart/form-data'}})).data},
    onSuccess:(d)=>{toast.success(d.message||'Imported!');qc.invalidateQueries(['admin-question-sets']);setImportModalOpen(false)},
    onError:(e)=>toast.error(e.response?.data?.message||'Failed')
  });

  const fetchLeetCodeMutation = useMutation({
    mutationFn:async({slug,index})=>{const r=await api.get(`/api/challenges/fetch-leetcode-details?slug=${slug}`);return{data:r.data.data,index}},
    onSuccess:({data,index})=>{
      toast.success('LeetCode problem fetched!');const nq=[...form.questions];
      nq[index].title=data.title||'';nq[index].description=data.content||'';nq[index].difficulty=data.difficulty||'Easy';
      const tags=(data.topicTags||[]).map(t=>t.name);nq[index].category=tags[0]||'General';nq[index].tags=tags;
      nq[index].codeSnippets=data.codeSnippets||[];nq[index].functionName=data.functionName||'';
      nq[index].testCases=(data.testCases||[]).map(tc=>({...tc,args:JSON.stringify(tc.args)}));
      setForm({...form,questions:nq});
    },
    onError:(e)=>toast.error(e.response?.data?.message||'Failed to fetch')
  });

  const manageChallengesQuery = useQuery({
    queryKey:['admin-manage-challenges',challengeFilters],enabled:view==='challenges',
    queryFn:async()=>{try{const p=new URLSearchParams();p.set('page','1');p.set('limit','100');p.set('sortBy','createdAt');p.set('sortDir','desc');
      if(challengeFilters.search)p.set('search',challengeFilters.search);
      const r=await api.get(`/api/challenges?${p.toString()}`);return r.data.data||[]}catch{return[]}}
  });

  const createChallengeMutation = useMutation({
    mutationFn:async(d)=>api.post('/api/challenges',d),
    onSuccess:()=>{toast.success('Challenge created!');setCreateChallengeForm(defaultChallengeForm);setLeetcodeInput('');setView('challenges');qc.invalidateQueries(['admin-manage-challenges'])},
    onError:(e)=>toast.error(e.response?.data?.message||'Failed')
  });

  const updateChallengeMutation = useMutation({
    mutationFn:async(d)=>api.put(`/api/challenges/${d.id}`,d.body),
    onSuccess:()=>{toast.success('Updated!');setEditingChallenge(null);qc.invalidateQueries(['admin-manage-challenges'])},
    onError:(e)=>toast.error(e.response?.data?.message||'Failed')
  });

  const deleteChallengeMutation = useMutation({
    mutationFn:async(id)=>api.delete(`/api/challenges/${id}`),
    onSuccess:()=>{toast.success('Deleted!');setDeleteTarget(null);qc.invalidateQueries(['admin-manage-challenges'])},
    onError:(e)=>toast.error(e.response?.data?.message||'Failed')
  });

  const handleChallengeAutoFill = async()=>{
    if(!leetcodeInput)return toast.error('Enter a slug or URL');
    const slug=leetcodeInput.replace('https://leetcode.com/problems/','').split('/')[0].trim();
    setIsFetchingLC(true);
    try{
      const r=await api.get(`/api/challenges/fetch-leetcode-details?slug=${slug}`);
      const{title,content,difficulty,topicTags,codeSnippets,functionName,testCases}=r.data.data;
      const tags=(topicTags||[]).map(t=>t.name);
      setCreateChallengeForm(p=>({...p,title,description:content,difficulty,category:tags[0]||p.category,
        link:`https://leetcode.com/problems/${slug}/`,tags,codeSnippets:codeSnippets||[],
        functionName:functionName||'',testCases:(testCases||[]).map(tc=>({...tc,args:JSON.stringify(tc.args)}))}));
      if(codeSnippets?.length)setSnippetLang(codeSnippets[0].langSlug);
      toast.success('Fetched!');
    }catch(e){toast.error(e.response?.data?.message||'Failed')}finally{setIsFetchingLC(false)}
  };

  const handleFileChange=(e)=>{const f=e.target.files?.[0];if(f)importMutation.mutate(f)};
  const handleAddQuestion=()=>{if(form.questions.length>=5)return toast.error('Max 5');setForm(p=>({...p,questions:[...p.questions,{...initialQuestionState}]}))};
  const handleRemoveQuestion=(i)=>{if(form.questions.length===1)return;setForm(p=>({...p,questions:p.questions.filter((_,j)=>j!==i)}))};
  const updateQuestion=(i,f,v)=>{const nq=[...form.questions];nq[i][f]=v;setForm({...form,questions:nq})};
  const updateHint=(qi,hi,v)=>{const nq=[...form.questions];nq[qi].hints[hi]=v;setForm({...form,questions:nq})};
  const handlePublish=(e)=>{e.preventDefault();const fq=form.questions.map(q=>({...q,testCases:prepareTestCases(q.testCases||[])}));createSetMutation.mutate({...form,questions:fq})};
  const handleCreateChallengeSubmit=(e)=>{e.preventDefault();createChallengeMutation.mutate({...createChallengeForm,testCases:prepareTestCases(createChallengeForm.testCases)})};
  const handleUpdateChallengeSubmit=(e)=>{e.preventDefault();if(!editingChallenge)return;updateChallengeMutation.mutate({id:editingChallenge._id,body:{title:editingChallenge.title,description:editingChallenge.description,link:editingChallenge.link||'',difficulty:editingChallenge.difficulty,points:Number(editingChallenge.points),category:editingChallenge.category,functionName:editingChallenge.functionName||'',testCases:prepareTestCases(editingChallenge.testCases||[])}})};

  const TestCaseEditor = ({cases,onChange}) => (
    <div className="md:col-span-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="field-label text-[10px] mb-0">Test Cases</label>
        <button type="button" className="text-xs text-accent hover:underline font-bold" onClick={()=>onChange([...(cases||[]),emptyTestCase()])}>+ Add Case</button>
      </div>
      {(!cases||cases.length===0)?<p className="text-xs text-tertiary">No test cases — click Add Case.</p>:(
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {cases.map((tc,i)=>(
            <div key={i} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 items-start bg-white/5 rounded-xl p-3 border border-white/5">
              <div><p className="text-[10px] text-tertiary mb-1">Label</p><input className="field-input text-xs py-1" placeholder="Example 1" value={tc.label} onChange={e=>{const t=[...cases];t[i]={...t[i],label:e.target.value};onChange(t)}}/></div>
              <div><p className="text-[10px] text-tertiary mb-1">Args (JSON array)</p><input className="field-input text-xs py-1 font-mono" placeholder='[[2,7,11,15], 9]' value={tc.args} onChange={e=>{const t=[...cases];t[i]={...t[i],args:e.target.value};onChange(t)}}/></div>
              <div><p className="text-[10px] text-tertiary mb-1">Expected</p><input className="field-input text-xs py-1 font-mono" placeholder='[0,1]' value={tc.expected} onChange={e=>{const t=[...cases];t[i]={...t[i],expected:e.target.value};onChange(t)}}/></div>
              <button type="button" className="mt-5 text-secondary hover:text-red-400 transition-colors" onClick={()=>onChange(cases.filter((_,j)=>j!==i))}><FiTrash2 size={14}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={()=>setView('list')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view==='list'?'bg-accent text-white':'bg-white/5 text-secondary hover:text-primary'}`}>Active Sets</button>
        <button onClick={()=>setView('history')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view==='history'?'bg-accent text-white':'bg-white/5 text-secondary hover:text-primary'}`}>History</button>
        <button onClick={()=>setView('challenges')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view==='challenges'||view==='create_challenge'?'bg-accent text-white':'bg-white/5 text-secondary hover:text-primary'}`}>Manage Challenges</button>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={()=>setImportModalOpen(true)} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center gap-2"><FiUploadCloud /> Import</button>
          {view==='challenges'||view==='create_challenge'?(
            <button onClick={()=>setView(view==='create_challenge'?'challenges':'create_challenge')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${view==='create_challenge'?'bg-green-500 text-white':'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
              {view==='create_challenge'?'Back to Challenges':<><FiPlus /> New Challenge</>}
            </button>
          ):(
            <button onClick={()=>setView('create')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${view==='create'?'bg-green-500 text-white':'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}><FiPlus /> Create New Set</button>
          )}
        </div>
      </div>

      {/* Create Set */}
      {view === 'create' && (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="max-w-4xl mx-auto space-y-6">
          <form onSubmit={handlePublish} className="space-y-6">
            <BaseCard>
              <h2 className="text-xl font-black text-primary">Set Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="field-label">Set Title</label><input required className="field-input" placeholder="e.g. Dynamic Programming Basics" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
                <div><label className="field-label">Target Level</label>
                  <div className="flex bg-white/5 p-1 rounded-xl">
                    {['Beginner','Intermediate','Both'].map(lvl=>(<button type="button" key={lvl} onClick={()=>setForm({...form,targetLevel:lvl})} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${form.targetLevel===lvl?'bg-white/10 text-primary shadow':'text-tertiary hover:text-secondary'}`}>{lvl}</button>))}
                  </div>
                </div>
                <div><label className="field-label">Week Number</label>
                  <div className="relative"><FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"/><input required type="number" min="1" className="field-input pl-9" value={form.weekNumber} onChange={e=>setForm({...form,weekNumber:Number(e.target.value)})}/></div>
                </div>
                <div><label className="field-label">Deadline</label><input required type="date" className="field-input" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></div>
              </div>
            </BaseCard>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-primary">Questions ({form.questions.length}/5)</h2>
                {form.questions.length<5&&(<button type="button" onClick={handleAddQuestion} className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors flex items-center gap-1"><FiPlus /> Add Question</button>)}
              </div>
              <AnimatePresence>
                {form.questions.map((q,i)=>(
                  <motion.div key={i} initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}>
                    <BaseCard className="p-5 space-y-4 relative overflow-hidden group">

                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-primary flex items-center gap-2"><span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-secondary">{i+1}</span> Question Config</h3>
                        {form.questions.length>1&&(<button type="button" onClick={()=>handleRemoveQuestion(i)} className="text-red-400 hover:text-red-300 p-1"><FiTrash2 size={16}/></button>)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-3 bg-purple-500/5 border border-purple-500/20 p-3 rounded-lg flex flex-col md:flex-row gap-3 items-end">
                          <div className="flex-1 w-full"><label className="field-label text-[10px] text-purple-400">Fetch from LeetCode (Slug or URL)</label><input className="field-input text-sm border-purple-500/30 focus:border-purple-500/60" placeholder="e.g. two-sum" value={q.leetcodeSlug||''} onChange={e=>updateQuestion(i,'leetcodeSlug',e.target.value)}/></div>
                          <button type="button" disabled={fetchLeetCodeMutation.isLoading&&fetchLeetCodeMutation.variables?.index===i} onClick={()=>{let slug=q.leetcodeSlug.trim();if(slug.includes('leetcode.com/problems/'))slug=slug.split('leetcode.com/problems/')[1].split('/')[0];if(!slug)return toast.error('Enter a LeetCode slug or URL');fetchLeetCodeMutation.mutate({slug,index:i})}} className="bg-purple-500/20 text-purple-400 font-bold px-4 py-2 rounded-lg text-sm hover:bg-purple-500/30 transition-colors whitespace-nowrap">
                            {fetchLeetCodeMutation.isLoading&&fetchLeetCodeMutation.variables?.index===i?'Fetching...':'Fetch Details'}
                          </button>
                        </div>
                        <div className="md:col-span-2"><label className="field-label text-[10px]">Title</label><input required className="field-input text-sm" value={q.title} onChange={e=>updateQuestion(i,'title',e.target.value)}/></div>
                        <div><label className="field-label text-[10px]">Difficulty</label><select className="field-select text-sm" value={q.difficulty} onChange={e=>updateQuestion(i,'difficulty',e.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                        <div><label className="field-label text-[10px]">Points</label><input required type="number" className="field-input text-sm" value={q.points} onChange={e=>updateQuestion(i,'points',Number(e.target.value))}/></div>
                        <div><label className="field-label text-[10px]">Tags/Category</label><input className="field-input text-sm" placeholder="e.g. Arrays, Sorting" value={q.category} onChange={e=>updateQuestion(i,'category',e.target.value)}/></div>
                        <div className="md:col-span-3"><label className="field-label text-[10px]">Problem Description</label><textarea required rows="3" className="field-textarea text-sm" value={q.description} onChange={e=>updateQuestion(i,'description',e.target.value)}/></div>
                        <div className="md:col-span-3"><label className="field-label text-[10px]">Hints (optional)</label>{q.hints.map((hint,hi)=>(<input key={hi} className="field-input text-sm mb-2" placeholder="Hint..." value={hint} onChange={e=>updateHint(i,hi,e.target.value)}/>))}</div>
                        <div className="md:col-span-3"><label className="field-label text-[10px]">Solution Function Name</label><input className="field-input text-sm font-mono" placeholder="e.g. twoSum" value={q.functionName||''} onChange={e=>updateQuestion(i,'functionName',e.target.value.trim())}/></div>
                        <TestCaseEditor cases={q.testCases||[]} onChange={v=>updateQuestion(i,'testCases',v)}/>
                      </div>
                    </BaseCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex justify-end"><button type="submit" disabled={createSetMutation.isLoading} className="btn-primary w-full md:w-auto px-8 py-3 text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)]">{createSetMutation.isLoading?'Publishing...':'Publish Question Set & Notify'}</button></div>
          </form>
        </motion.div>
      )}

      {/* Active/History Sets */}
      {(view==='list'||view==='history')&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {setsQuery.data?.map((set,i)=>{
            const isHistory=new Date(set.deadline)<new Date();
            if(view==='list'&&isHistory)return null;
            if(view==='history'&&!isHistory)return null;
            return(
              <motion.div key={set._id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}>
                <BaseCard className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-lg text-primary">{set.title}</h3><p className="text-xs text-secondary font-mono flex items-center gap-2 mt-1"><FiTarget className="text-accent"/> Target: {set.targetLevel} <span className="text-white/20">|</span> <FiClock className="text-orange-400"/> Due: {new Date(set.deadline).toLocaleDateString()}</p></div>
                    <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">Week {set.weekNumber}</span>
                  </div>
                  <div className="h-px bg-white/5"/>
                  <div className="space-y-2">
                    {set.questions.map((q,qi)=>{
                      const dc=q.difficulty==='Easy'?'text-green-400':q.difficulty==='Medium'?'text-yellow-400':'text-red-400';
                      return(<div key={qi} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/5"><span className="text-secondary truncate pr-2 max-w-[60%] font-medium">{q.title}</span><div className="flex gap-3 text-xs font-bold"><span className={dc}>{q.difficulty}</span><span className="text-accent flex items-center gap-1"><FiZap size={10}/> {q.points} XP</span></div></div>)
                    })}
                  </div>
                </BaseCard>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Manage Challenges */}
      {view==='challenges'&&(
        <div className="space-y-6"><div className="macos-glass p-6">
          <h2 className="text-section-title font-bold mb-4 text-primary">Manage Challenges</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"/><input className="field-input pl-10" placeholder="Search challenges..." value={challengeFilters.search} onChange={e=>setChallengeFilters(p=>({...p,search:e.target.value}))}/></div>
            <select className="field-select" value={challengeFilters.range} onChange={e=>setChallengeFilters(p=>({...p,range:e.target.value}))}><option value="all">All Time</option><option value="weekly">Last 7 Days</option><option value="monthly">Last 30 Days</option></select>
          </div>
          {manageChallengesQuery.isLoading?<div className="space-y-3"><SkeletonCard/><SkeletonCard/></div>
          :(manageChallengesQuery.data||[]).length===0?<EmptyState title="No challenges match" description="Adjust filters or create a new challenge."/>
          :(<div className="space-y-3">{(manageChallengesQuery.data||[]).map(ch=>(
            <div key={ch._id} className="border border-glass-border rounded-xl p-4 flex flex-wrap gap-3 justify-between items-start hover:border-accent/20 transition-all duration-300 bg-white/[0.01]">
              <div><h3 className="font-semibold text-primary">{ch.title}</h3><p className="text-secondary text-sm">{ch.difficulty} - {ch.points} XP - {ch.category}</p></div>
              <div className="flex gap-2">
                <button className="btn-secondary py-1.5 px-4 text-xs font-bold hover:bg-accent/10 hover:text-accent transition-colors" onClick={()=>setEditingChallenge({...ch,testCases:(ch.testCases||[]).map(tc=>({...tc,args:JSON.stringify(tc.args??[])}))})}>Edit</button>
                <button className="btn-secondary py-1.5 px-4 text-xs font-bold hover:bg-red-500/10 hover:text-red-400 transition-colors" onClick={()=>setDeleteTarget(ch)}>Delete</button>
              </div>
            </div>
          ))}</div>)}
        </div></div>
      )}

      {/* Create Challenge */}
      {view==='create_challenge'&&(
        <div className="macos-glass p-8 max-w-2xl mx-auto"><div className="space-y-6">
          <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 mb-8">
            <label className="field-label text-accent font-bold">Import from LeetCode</label>
            <div className="flex gap-2"><input className="field-input border-accent/20" placeholder="Paste LeetCode URL or slug" value={leetcodeInput} onChange={e=>setLeetcodeInput(e.target.value)}/><button type="button" className="btn-secondary whitespace-nowrap" onClick={handleChallengeAutoFill} disabled={isFetchingLC}>{isFetchingLC?'Fetching...':'Auto-fill'}</button></div>
          </div>
          <form onSubmit={handleCreateChallengeSubmit} className="space-y-4">
            <h2 className="text-section-title font-bold text-primary">Create Challenge</h2>
            <div><label className="field-label">Title</label><input className="field-input" required value={createChallengeForm.title} onChange={e=>setCreateChallengeForm(p=>({...p,title:e.target.value}))}/></div>
            <div><label className="field-label">Description (HTML supported)</label><textarea className="field-textarea" required rows={8} value={createChallengeForm.description} onChange={e=>setCreateChallengeForm(p=>({...p,description:e.target.value}))}/></div>
            <div><label className="field-label">Original Question Link</label><input className="field-input" type="url" placeholder="https://leetcode.com/problems/..." value={createChallengeForm.link} onChange={e=>setCreateChallengeForm(p=>({...p,link:e.target.value}))}/></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="field-label">Difficulty</label><select className="field-select" value={createChallengeForm.difficulty} onChange={e=>setCreateChallengeForm(p=>({...p,difficulty:e.target.value}))}><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
              <div><label className="field-label">Points</label><input className="field-input" type="number" required value={createChallengeForm.points} onChange={e=>setCreateChallengeForm(p=>({...p,points:Number(e.target.value)}))}/></div>
              <div><label className="field-label">Category</label><input className="field-input" required value={createChallengeForm.category} onChange={e=>setCreateChallengeForm(p=>({...p,category:e.target.value}))}/></div>
            </div>
            {createChallengeForm.tags.length>0&&(<div><label className="field-label">Topic Tags</label><div className="flex flex-wrap gap-2">{createChallengeForm.tags.map(tag=>(<span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent/10 text-accent border border-accent/20">{tag}<button type="button" className="ml-0.5 hover:text-red-400 transition-colors" onClick={()=>setCreateChallengeForm(p=>({...p,tags:p.tags.filter(t=>t!==tag)}))}><FiX size={12}/></button></span>))}</div></div>)}
            {createChallengeForm.codeSnippets.length>0&&(<div><label className="field-label">Starter Code ({createChallengeForm.codeSnippets.length} languages)</label><div className="flex gap-2 mb-2 flex-wrap">{createChallengeForm.codeSnippets.map(s=>(<button key={s.langSlug} type="button" className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${snippetLang===s.langSlug?'bg-accent text-white':'bg-white/5 text-secondary hover:text-primary'}`} onClick={()=>setSnippetLang(s.langSlug)}>{s.lang}</button>))}</div><pre className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono"><code>{createChallengeForm.codeSnippets.find(s=>s.langSlug===snippetLang)?.code||'Select a language above'}</code></pre></div>)}
            <div><label className="field-label">Solution Function Name</label><input className="field-input font-mono" placeholder="e.g. twoSum" value={createChallengeForm.functionName} onChange={e=>setCreateChallengeForm(p=>({...p,functionName:e.target.value.trim()}))}/></div>
            <TestCaseEditor cases={createChallengeForm.testCases} onChange={v=>setCreateChallengeForm(p=>({...p,testCases:v}))}/>
            <button type="submit" disabled={createChallengeMutation.isLoading} className="btn-primary w-full shadow-[0_0_20px_rgba(168,85,247,0.4)]">{createChallengeMutation.isLoading?'Creating...':'Create Challenge'}</button>
          </form>
        </div></div>
      )}

      {/* Edit Challenge Modal */}
      {editingChallenge&&(
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 animate-fadeIn">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="macos-glass w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/5 pb-2"><h3 className="text-section-title font-bold text-primary">Edit Challenge</h3><button onClick={()=>setEditingChallenge(null)} className="text-tertiary hover:text-primary"><FiX size={20}/></button></div>
            <form onSubmit={handleUpdateChallengeSubmit} className="space-y-4">
              <div><label className="field-label text-xs">Title</label><input className="field-input text-sm" required value={editingChallenge.title} onChange={e=>setEditingChallenge(p=>({...p,title:e.target.value}))}/></div>
              <div><label className="field-label text-xs">Description</label><textarea className="field-textarea text-sm" required rows="4" value={editingChallenge.description} onChange={e=>setEditingChallenge(p=>({...p,description:e.target.value}))}/></div>
              <div><label className="field-label text-xs">Original Question Link</label><input className="field-input text-sm" type="url" value={editingChallenge.link||''} onChange={e=>setEditingChallenge(p=>({...p,link:e.target.value}))}/></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="field-label text-xs">Difficulty</label><select className="field-select text-sm" value={editingChallenge.difficulty} onChange={e=>setEditingChallenge(p=>({...p,difficulty:e.target.value}))}><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                <div><label className="field-label text-xs">Points</label><input className="field-input text-sm" type="number" required value={editingChallenge.points} onChange={e=>setEditingChallenge(p=>({...p,points:Number(e.target.value)}))}/></div>
                <div><label className="field-label text-xs">Category</label><input className="field-input text-sm" required value={editingChallenge.category} onChange={e=>setEditingChallenge(p=>({...p,category:e.target.value}))}/></div>
              </div>
              <div><label className="field-label text-xs">Solution Function Name</label><input className="field-input text-sm font-mono" placeholder="e.g. twoSum" value={editingChallenge.functionName||''} onChange={e=>setEditingChallenge(p=>({...p,functionName:e.target.value.trim()}))}/></div>
              <TestCaseEditor cases={editingChallenge.testCases||[]} onChange={v=>setEditingChallenge(p=>({...p,testCases:v}))}/>
              <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                <button type="button" className="btn-secondary py-2 px-4 text-sm font-bold" onClick={()=>setEditingChallenge(null)}>Cancel</button>
                <button type="submit" disabled={updateChallengeMutation.isLoading} className="btn-primary py-2 px-6 text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)]">{updateChallengeMutation.isLoading?'Saving...':'Save Changes'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deleteTarget&&<ConfirmDialog title="Delete Challenge" message={`Delete "${deleteTarget.title}"?`} onConfirm={()=>deleteChallengeMutation.mutate(deleteTarget._id)} onCancel={()=>setDeleteTarget(null)}/>}

      {/* Import Modal */}
      <AnimatePresence>
        {importModalOpen&&(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}} className="w-full max-w-md">
              <BaseCard className="p-6 space-y-4">
                <div className="flex justify-between items-center mb-2"><h3 className="text-lg font-black text-primary flex items-center gap-2"><FiUploadCloud className="text-purple-400"/> Import Questions</h3><button onClick={()=>setImportModalOpen(false)} className="text-tertiary hover:text-primary"><FiX size={20}/></button></div>
                <p className="text-sm text-secondary">Upload a <strong>.json</strong>, <strong>.csv</strong>, or <strong>.docx</strong> file to bulk import challenges.</p>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400/50 hover:bg-purple-400/5 transition-all text-center" onClick={()=>fileInputRef.current?.click()}>
                  <FiUploadCloud className="text-4xl text-tertiary mb-3"/>
                  <p className="font-bold text-primary mb-1">Click or drag file to upload</p>
                  <p className="text-xs text-tertiary">Supported: JSON, CSV, DOCX</p>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json,.csv,.docx" onChange={handleFileChange}/>
                </div>
                {importMutation.isLoading&&<div className="text-center text-sm text-purple-400 animate-pulse font-bold">Importing...</div>}
              </BaseCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionSetsTab;
