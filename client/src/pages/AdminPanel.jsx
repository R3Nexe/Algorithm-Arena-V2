import React, { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, FiShield, FiActivity, FiCode, FiPercent, FiClock,
  FiPlus, FiFileText, FiFolder, FiBell, FiSearch, FiEdit2, FiTrash2, FiAlertCircle, FiCheck, FiX, FiInfo, FiEye, FiZap
} from 'react-icons/fi';
import { clsx } from 'clsx';

import PageHeader from '../components/PageHeader';

// --- Subcomponents for Tabs ---
import DashboardTab from './admin/DashboardTab';
import QuestionSetsTab from './admin/QuestionSetsTab';

import ClanManagerTab from './admin/ClanManagerTab';
import NoticeBoardTab from './admin/NoticeBoardTab';
import ResourcesTab from './admin/ResourcesTab';
import MembersTab from './admin/MembersTab';
import ReviewTab from './admin/ReviewTab';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: FiActivity },
    { id: 'review', label: 'Review Work', icon: FiEye },
    { id: 'sets', label: 'Question Sets', icon: FiCode },

    { id: 'clans', label: 'Clan Manager', icon: FiShield },
    { id: 'notices', label: 'Notice Board', icon: FiBell },
    { id: 'resources', label: 'Resources', icon: FiFolder },
    { id: 'members', label: 'Members', icon: FiUsers },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader 
          title="Command Center" 
          subtitle="Global platform administration and clan oversight."
          showBack={true}
          backUrl="/dashboard"
        />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.2)]">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          System Active
        </div>
      </div>

      {/* Futuristic Tabs Navigation */}
      <div className="flex overflow-x-auto custom-scrollbar pb-2 gap-2">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-300",
                isActive 
                  ? "bg-accent text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]" 
                  : "bg-white/[0.03] text-secondary hover:bg-white/[0.08] hover:text-primary border border-white/[0.05]"
              )}
            >
              <Icon size={16} className={isActive ? "text-white" : "text-tertiary"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'dashboard' && <DashboardTab setActiveTab={setActiveTab} />}
          {activeTab === 'review' && <ReviewTab />}
          {activeTab === 'sets' && <QuestionSetsTab />}

          {activeTab === 'clans' && <ClanManagerTab />}
          {activeTab === 'notices' && <NoticeBoardTab />}
          {activeTab === 'resources' && <ResourcesTab />}
          {activeTab === 'members' && <MembersTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
