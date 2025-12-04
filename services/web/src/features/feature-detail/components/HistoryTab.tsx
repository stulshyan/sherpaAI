import clsx from 'clsx';
import {
  PlusCircle,
  Edit,
  MessageCircle,
  TrendingUp,
  ArrowUpCircle,
  CheckCircle,
  PlayCircle,
  CheckCircle2,
  Upload,
  Rocket,
  RefreshCw,
  User,
  Bot,
} from 'lucide-react';
import type { AuditLogEntry, AuditAction } from '../types';
import { formatDate, formatTime } from './helpers';

interface HistoryTabProps {
  history: AuditLogEntry[];
  isLoading?: boolean;
}

const actionIcons: Record<AuditAction, typeof PlusCircle> = {
  created: PlusCircle,
  updated: Edit,
  question_answered: MessageCircle,
  readiness_updated: TrendingUp,
  priority_override: ArrowUpCircle,
  approved: CheckCircle,
  loop_started: PlayCircle,
  loop_completed: CheckCircle2,
  deployed_staging: Upload,
  deployed_production: Rocket,
  status_changed: RefreshCw,
};

const actionLabels: Record<AuditAction, string> = {
  created: 'Feature Created',
  updated: 'Feature Updated',
  question_answered: 'Question Answered',
  readiness_updated: 'Readiness Updated',
  priority_override: 'Priority Override',
  approved: 'Approved',
  loop_started: 'Loop Started',
  loop_completed: 'Loop Completed',
  deployed_staging: 'Deployed to Staging',
  deployed_production: 'Deployed to Production',
  status_changed: 'Status Changed',
};

const actionColors: Record<AuditAction, string> = {
  created: 'text-green-500',
  updated: 'text-blue-500',
  question_answered: 'text-purple-500',
  readiness_updated: 'text-teal-500',
  priority_override: 'text-orange-500',
  approved: 'text-green-500',
  loop_started: 'text-green-500',
  loop_completed: 'text-green-500',
  deployed_staging: 'text-purple-500',
  deployed_production: 'text-emerald-500',
  status_changed: 'text-blue-500',
};

export function HistoryTab({ history, isLoading }: HistoryTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No history available.</p>
      </div>
    );
  }

  // Group by date
  const groupedHistory = history.reduce(
    (acc, entry) => {
      const date = formatDate(entry.timestamp);
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(entry);
      return acc;
    },
    {} as Record<string, AuditLogEntry[]>
  );

  return (
    <div className="space-y-6 p-4">
      {Object.entries(groupedHistory).map(([date, entries]) => (
        <div key={date}>
          <h4 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">{date}</h4>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute bottom-0 left-3 top-0 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Entries */}
            <div className="space-y-4">
              {entries.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryItem({ entry }: { entry: AuditLogEntry }) {
  const Icon = actionIcons[entry.action] || RefreshCw;
  const label = actionLabels[entry.action] || entry.action;
  const color = actionColors[entry.action] || 'text-gray-500';
  const isSystem = entry.actor.type === 'system';

  return (
    <div className="relative flex gap-4 pl-8">
      {/* Icon on timeline */}
      <div className={clsx('absolute left-0 rounded-full bg-white p-1 dark:bg-gray-900', color)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-medium text-gray-900 dark:text-white">{label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatTime(entry.timestamp)}
          </span>
        </div>

        {/* Details based on action type */}
        {entry.action === 'question_answered' && typeof entry.details.question === 'string' && (
          <div className="mt-2 text-sm">
            <p className="text-gray-500 dark:text-gray-400">Q: {entry.details.question}</p>
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              A: {String(entry.details.answer)}
            </p>
          </div>
        )}

        {entry.action === 'readiness_updated' && entry.previousValue !== undefined && (
          <div className="mt-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Score: {(entry.previousValue as number).toFixed(2)} →{' '}
              {(entry.newValue as number).toFixed(2)}
            </span>
            {typeof entry.details.reason === 'string' && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">{entry.details.reason}</p>
            )}
          </div>
        )}

        {entry.action === 'priority_override' && entry.previousValue !== undefined && (
          <div className="mt-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Priority: {(entry.previousValue as number).toFixed(2)} →{' '}
              {(entry.newValue as number).toFixed(2)}
            </span>
            {typeof entry.details.reason === 'string' && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">{entry.details.reason}</p>
            )}
          </div>
        )}

        {entry.action === 'created' && typeof entry.details.source === 'string' && (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            From: {entry.details.source}
          </div>
        )}

        {/* Actor */}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {isSystem ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
          <span>{entry.actor.name}</span>
        </div>
      </div>
    </div>
  );
}
