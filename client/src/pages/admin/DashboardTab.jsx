import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FiUsers, FiShield, FiActivity, FiCode, FiPercent, FiClock, FiPlus, FiAlertCircle } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import SkeletonCard from '../../components/SkeletonCard';
import { api } from '../../lib/api';

const DashboardTab = ({ setActiveTab }) => {
  const summaryQ = useQuery({
    queryKey: ['admin-dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/admin-summary');
      return res.data.data;
    }
  });

  const stats = [
    { label: 'Total Members', value: summaryQ.data?.totalMembers || 0, icon: FiUsers, color: 'text-blue-400', bg: 'bg-blue-500/10', rgb: '96, 165, 250' },
    { label: 'Active Clans', value: summaryQ.data?.activeClans || 0, icon: FiShield, color: 'text-purple-400', bg: 'bg-purple-500/10', rgb: '192, 132, 252' },
    { label: 'Active This Week', value: summaryQ.data?.activeThisWeek || 0, icon: FiActivity, color: 'text-green-400', bg: 'bg-green-500/10', rgb: '74, 222, 128' },
    { label: 'Total Submissions', value: summaryQ.data?.totalSubmissions || 0, icon: FiCode, color: 'text-pink-400', bg: 'bg-pink-500/10', rgb: '244, 114, 182' },
    { label: 'Avg Completion', value: `${summaryQ.data?.avgCompletion || 0}%`, icon: FiPercent, color: 'text-yellow-400', bg: 'bg-yellow-500/10', rgb: '250, 204, 21' },
    { label: 'Pending Assign', value: summaryQ.data?.pendingAssignments || 0, icon: FiClock, color: 'text-orange-400', bg: 'bg-orange-500/10', rgb: '251, 146, 60' },
  ];

  return (
    <div className="space-y-6">
      {/* Unassigned Members Alert */}
      {summaryQ.data?.pendingAssignments > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 rounded-xl border border-orange-500/30 bg-orange-500/10"
        >
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-orange-400 text-xl" />
            <div>
              <p className="font-bold text-orange-400 text-sm">Action Required</p>
              <p className="text-orange-400/80 text-xs">There are {summaryQ.data.pendingAssignments} unassigned members awaiting a clan.</p>
            </div>
          </div>
          <button onClick={() => setActiveTab('members')} className="px-4 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors">
            Assign Now
          </button>
        </motion.div>
      )}

      {/* 6 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <BaseCard className="p-4 flex flex-col gap-3" accentColor={stat.rgb} >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <Icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className="text-2xl font-black text-primary">{summaryQ.isLoading ? '-' : stat.value}</p>
                  <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest">{stat.label}</p>
                </div>
              </BaseCard>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clan Performance Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-widest">Clan Performance Rankings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryQ.isLoading ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />) : 
             (summaryQ.data?.clanPerformance || []).map((clan, i) => (
              <motion.div key={clan.tag} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                <BaseCard className="p-5 relative overflow-hidden group">
                  <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${clan.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-primary">{clan.name}</h3>
                      <span className="text-xs font-mono text-tertiary">[{clan.tag}]</span>
                    </div>
                    <span className={`text-xl font-black bg-gradient-to-r ${clan.color} bg-clip-text text-transparent`}>
                      {clan.completion}%
                    </span>
                  </div>
                  {/* GDG Progress bar */}
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full bg-gradient-to-r ${clan.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${clan.completion}%` }}
                      transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                    />
                  </div>
                </BaseCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-widest">Quick Actions</h2>
          <BaseCard className="p-4 space-y-2">
            <button onClick={() => setActiveTab('sets')} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-accent/10 hover:border-accent/30 transition-all group">
              <span className="font-bold text-sm group-hover:text-accent transition-colors">Create Question Set</span>
              <FiPlus className="text-tertiary group-hover:text-accent transition-colors" />
            </button>
            <button onClick={() => setActiveTab('notices')} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-yellow-500/10 hover:border-yellow-500/30 transition-all group">
              <span className="font-bold text-sm group-hover:text-yellow-400 transition-colors">Post Notice</span>
              <FiPlus className="text-tertiary group-hover:text-yellow-400 transition-colors" />
            </button>
            <button onClick={() => setActiveTab('resources')} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group">
              <span className="font-bold text-sm group-hover:text-blue-400 transition-colors">Upload Resources</span>
              <FiPlus className="text-tertiary group-hover:text-blue-400 transition-colors" />
            </button>
            <button onClick={() => setActiveTab('members')} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-green-500/10 hover:border-green-500/30 transition-all group">
              <span className="font-bold text-sm group-hover:text-green-400 transition-colors">Manage Members</span>
              <FiUsers className="text-tertiary group-hover:text-green-400 transition-colors" />
            </button>
          </BaseCard>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
