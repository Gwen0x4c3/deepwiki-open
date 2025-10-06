'use client';

import React from 'react';
import { FaTrash, FaComments } from 'react-icons/fa';
import { ChatContext } from '@/utils/chatContext';

interface ChatHistoryListProps {
  contexts: ChatContext[];
  onSelect: (contextId: string) => void;
  onDelete: (contextId: string) => void;
  selectedContextId?: string;
}

const ChatHistoryList: React.FC<ChatHistoryListProps> = ({
  contexts,
  onSelect,
  onDelete,
  selectedContextId
}) => {
  if (contexts.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--muted)]">
        <FaComments className="mx-auto text-4xl mb-2 opacity-50" />
        <p className="text-sm">No chat history yet</p>
        <p className="text-xs mt-1">Start a conversation to see it here</p>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      {contexts.map((context) => (
        <div
          key={context.id}
          className={`group relative bg-[var(--card-bg)] rounded-lg border transition-all ${
            selectedContextId === context.id
              ? 'border-[var(--accent-primary)] shadow-sm'
              : 'border-[var(--border-color)] hover:border-[var(--accent-primary)]/50'
          }`}
        >
          <button
            onClick={() => onSelect(context.id)}
            className="w-full text-left p-3 pr-10"
          >
            <div className="flex items-start gap-2">
              <FaComments className="text-[var(--accent-primary)] mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {context.title}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {context.messages.length} messages • {formatDate(context.updatedAt)}
                </p>
              </div>
            </div>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this conversation? This cannot be undone.')) {
                onDelete(context.id);
              }
            }}
            className="absolute right-3 top-3 p-2 text-[var(--muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete conversation"
          >
            <FaTrash className="text-sm" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ChatHistoryList;
