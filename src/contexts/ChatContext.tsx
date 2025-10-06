'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatState {
  initialQuestion?: string;
  contextId?: string | null;
  repoOwner?: string;
  repoName?: string;
  provider?: string;
  model?: string;
  isCustomModel?: boolean;
  customModel?: string;
  deepResearch?: boolean;
}

interface ChatContextType {
  chatState: ChatState | null;
  setChatState: (state: ChatState | null) => void;
  clearChatState: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatState, setChatState] = useState<ChatState | null>(null);

  const clearChatState = () => {
    setChatState(null);
  };

  return (
    <ChatContext.Provider value={{ chatState, setChatState, clearChatState }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
