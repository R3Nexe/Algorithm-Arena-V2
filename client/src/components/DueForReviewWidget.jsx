import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiClock, FiArrowRight } from 'react-icons/fi';
import { api } from '../lib/api';

// Pull-based reminder: domain questions whose review cooldown has expired.
const DueForReviewWidget = () => {
  const { data } = useQuery({
    queryKey: ['domain-due'],
    queryFn: async () => {
      const res = await api.get('/api/challenges/domain/due');
      return res.data.data;
    },
    staleTime: 60_000,
  });

  const count = data?.count || 0;
  if (count === 0) return null;

  return (
    <Link
      to="/interview-prep"
      className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 transition hover:border-amber-400/50"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
          <FiClock />
        </span>
        <div>
          <p className="font-semibold text-primary">
            {count} question{count === 1 ? '' : 's'} due for review
          </p>
          <p className="text-xs text-secondary">
            {(data.items || []).slice(0, 3).map((q) => q.title).join(' · ')}
            {count > 3 ? ` +${count - 3} more` : ''}
          </p>
        </div>
      </div>
      <span className="flex items-center gap-1 text-sm font-medium text-amber-400">
        Review now <FiArrowRight />
      </span>
    </Link>
  );
};

export default DueForReviewWidget;
