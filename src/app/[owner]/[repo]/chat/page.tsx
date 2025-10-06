'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaHome, FaGithub, FaGitlab, FaBitbucket, FaPlus, FaList } from 'react-icons/fa';
import ChatInput from '@/components/ChatInput';
import ChatHistoryList from '@/components/ChatHistoryList';
import Markdown from '@/components/Markdown';
import ThemeToggle from '@/components/theme-toggle';
import {
  ChatContext,
  ChatMessage,
  getAllChatContexts,
  loadChatContext,
  createChatContext,
  updateChatContext,
  deleteChatContext,
  trimMessageHistory
} from '@/utils/chatContext';
import { createChatWebSocket, closeWebSocket, ChatCompletionRequest } from '@/utils/websocketClient';
import getRepoUrl from '@/utils/getRepoUrl';
import { RepoInfo } from '@/types/repoinfo';

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const owner = params.owner as string;
  const repo = params.repo as string;
  const token = searchParams.get('token') || '';
  const repoUrl = searchParams.get('repo_url') ? decodeURIComponent(searchParams.get('repo_url') || '') : undefined;
  const providerParam = searchParams.get('provider') || 'google';
  const modelParam = searchParams.get('model') || '';
  const initialQuestion = searchParams.get('q') ? decodeURIComponent(searchParams.get('q') || '') : '';
  const contextIdParam = searchParams.get('context_id') || '';
  
  const repoType = repoUrl?.includes('bitbucket.org')
    ? 'bitbucket'
    : repoUrl?.includes('gitlab.com')
      ? 'gitlab'
      : repoUrl?.includes('github.com')
        ? 'github'
        : searchParams.get('type') || 'github';

  const repoInfo: RepoInfo = {
    owner,
    repo,
    type: repoType,
    token: token || null,
    localPath: null,
    repoUrl: repoUrl || null
  };

  // State
  const [contexts, setContexts] = useState<ChatContext[]>([]);
  const [currentContext, setCurrentContext] = useState<ChatContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(true);
  
  // Model configuration
  const [provider, setProvider] = useState(providerParam);
  const [model, setModel] = useState(modelParam);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModel, setCustomModel] = useState('');
  
  // Chat configuration
  const [deepResearch, setDeepResearch] = useState(false);
  const [maxHistoryMessages, setMaxHistoryMessages] = useState(10);
  
  const webSocketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef('');

  // Load contexts on mount
  useEffect(() => {
    const loadedContexts = getAllChatContexts(owner, repo);
    setContexts(loadedContexts);
    
    // Load specific context if provided
    if (contextIdParam) {
      const context = loadChatContext(contextIdParam);
      if (context) {
        setCurrentContext(context);
      }
    } else if (initialQuestion) {
      // Create new context with initial question
      const newContext = createChatContext(owner, repo, repoType, initialQuestion);
      setCurrentContext(newContext);
      setContexts(prev => [newContext, ...prev]);
      // Send the message directly without adding another user message
      sendMessageWithoutUserMessage(newContext);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, contextIdParam]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentContext?.messages]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      closeWebSocket(webSocketRef.current);
    };
  }, []);

  const handleNewConversation = (initialMsg?: string) => {
    if (!initialMsg) {
      setCurrentContext(null);
      streamingMessageRef.current = '';
    } else {
      const newContext = createChatContext(owner, repo, repoType, initialMsg);
      setCurrentContext(newContext);
      setContexts(prev => [newContext, ...prev]);
      
      // Send the initial message
      sendMessage(initialMsg, newContext);
    }
  };

  const handleLoadContext = (contextId: string) => {
    const context = loadChatContext(contextId);
    if (context) {
      setCurrentContext(context);
      streamingMessageRef.current = '';
      
      // Update URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('context_id', contextId);
      newUrl.searchParams.delete('q');
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  const handleDeleteContext = (contextId: string) => {
    deleteChatContext(contextId, owner, repo);
    setContexts(prev => prev.filter(c => c.id !== contextId));
    
    if (currentContext?.id === contextId) {
      setCurrentContext(null);
      streamingMessageRef.current = '';
    }
  };

  const sendMessageWithoutUserMessage = async (context: ChatContext) => {
    setIsLoading(true);
    streamingMessageRef.current = '';
    
    try {
      // Use existing messages from context (already has user message)
      const messagesForApi = context.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      const requestBody: ChatCompletionRequest = {
        repo_url: getRepoUrl(repoInfo),
        type: repoInfo.type,
        messages: messagesForApi,
        provider: provider,
        model: isCustomModel ? customModel : model,
        language: 'en'
      };

      if (repoInfo.token) {
        requestBody.token = repoInfo.token;
      }

      // Close existing WebSocket
      closeWebSocket(webSocketRef.current);

      let fullResponse = '';

      // Create WebSocket connection
      webSocketRef.current = createChatWebSocket(
        requestBody,
        // Message handler
        (message: string) => {
          fullResponse += message;
          streamingMessageRef.current = fullResponse;
          
          // Trigger re-render by updating context
          setCurrentContext(prev => prev ? { ...prev } : null);
        },
        // Error handler
        (error: Event) => {
          console.error('WebSocket error:', error);
          streamingMessageRef.current += '\n\n❌ Error: Connection failed. Please try again.';
          setCurrentContext(prev => prev ? { ...prev } : null);
          setIsLoading(false);
        },
        // Close handler
        () => {
          // Add assistant response to context
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now()
          };
          
          const finalMessages = [...context.messages, assistantMessage];
          const finalContext: ChatContext = {
            ...context,
            messages: finalMessages,
            updatedAt: Date.now()
          };
          
          setCurrentContext(finalContext);
          updateChatContext(finalContext.id, finalMessages);
          
          // Update contexts list
          setContexts(prev => {
            const filtered = prev.filter(c => c.id !== finalContext.id);
            return [finalContext, ...filtered];
          });
          
          streamingMessageRef.current = '';
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      streamingMessageRef.current = '';
    }
  };

  const sendMessage = async (question: string, context?: ChatContext) => {
    const targetContext = context || currentContext;
    
    if (!targetContext) {
      // Create new context if none exists
      handleNewConversation(question);
      return;
    }

    setIsLoading(true);
    streamingMessageRef.current = '';
    
    try {
      // Add user message to context
      const userMessage: ChatMessage = {
        role: 'user',
        content: deepResearch ? `[DEEP RESEARCH] ${question}` : question,
        timestamp: Date.now()
      };
      
      const updatedMessages = [...targetContext.messages, userMessage];
      
      // Trim history if needed
      const trimmedMessages = trimMessageHistory(updatedMessages, maxHistoryMessages + 2); // +2 for current Q&A
      
      // Update context
      const newContext: ChatContext = {
        ...targetContext,
        messages: trimmedMessages,
        updatedAt: Date.now()
      };
      
      setCurrentContext(newContext);
      updateChatContext(newContext.id, trimmedMessages);

      // Prepare request with message history
      const messagesForApi = trimmedMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      const requestBody: ChatCompletionRequest = {
        repo_url: getRepoUrl(repoInfo),
        type: repoInfo.type,
        messages: messagesForApi,
        provider: provider,
        model: isCustomModel ? customModel : model,
        language: 'en'
      };

      if (repoInfo.token) {
        requestBody.token = repoInfo.token;
      }

      // Close existing WebSocket
      closeWebSocket(webSocketRef.current);

      let fullResponse = '';

      // Create WebSocket connection
      webSocketRef.current = createChatWebSocket(
        requestBody,
        // Message handler
        (message: string) => {
          fullResponse += message;
          streamingMessageRef.current = fullResponse;
          
          // Trigger re-render by updating context
          setCurrentContext(prev => prev ? { ...prev } : null);
        },
        // Error handler
        (error: Event) => {
          console.error('WebSocket error:', error);
          streamingMessageRef.current += '\n\n❌ Error: Connection failed. Please try again.';
          setCurrentContext(prev => prev ? { ...prev } : null);
          setIsLoading(false);
        },
        // Close handler
        () => {
          // Add assistant response to context
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now()
          };
          
          const finalMessages = [...trimmedMessages, assistantMessage];
          const finalContext: ChatContext = {
            ...newContext,
            messages: finalMessages,
            updatedAt: Date.now()
          };
          
          setCurrentContext(finalContext);
          updateChatContext(finalContext.id, finalMessages);
          
          // Update contexts list
          setContexts(prev => {
            const filtered = prev.filter(c => c.id !== finalContext.id);
            return [finalContext, ...filtered];
          });
          
          streamingMessageRef.current = '';
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      streamingMessageRef.current = '';
    }
  };

  const handleSubmitQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className="h-screen paper-texture flex flex-col">
      {/* Header */}
      <header className="bg-[var(--card-bg)] border-b border-[var(--border-color)] px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-[var(--accent-primary)] hover:text-[var(--highlight)] flex items-center gap-2 transition-colors"
            >
              <FaHome className="text-lg" />
              <span className="font-serif font-medium">Home</span>
            </Link>
            <span className="text-[var(--muted)]">/</span>
            <Link
              href={`/${owner}/${repo}?${searchParams.toString()}`}
              className="text-[var(--foreground)] hover:text-[var(--accent-primary)] flex items-center gap-2 transition-colors"
            >
              {repoType === 'github' ? <FaGithub /> : repoType === 'gitlab' ? <FaGitlab /> : <FaBitbucket />}
              <span>{owner}/{repo}</span>
            </Link>
            <span className="text-[var(--muted)]">/</span>
            <span className="text-[var(--foreground)] font-medium">Chat</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent-primary)] transition-colors flex items-center gap-2"
            >
              <FaList />
              <span className="text-sm">History</span>
            </button>
            <button
              onClick={() => handleNewConversation()}
              className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-colors flex items-center gap-2"
            >
              <FaPlus />
              <span className="text-sm">New Chat</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* History Panel */}
        {showHistoryPanel && (
          <div className="w-80 bg-[var(--card-bg)] border-r border-[var(--border-color)] overflow-y-auto p-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Conversations</h2>
            <ChatHistoryList
              contexts={contexts}
              onSelect={handleLoadContext}
              onDelete={handleDeleteContext}
              selectedContextId={currentContext?.id}
            />
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto pb-48">
            <div className="max-w-4xl mx-auto px-4 py-6">
              {!currentContext ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💬</div>
                  <h2 className="text-2xl font-serif font-bold text-[var(--foreground)] mb-2">
                    Start a Conversation
                  </h2>
                  <p className="text-[var(--muted)]">
                    Ask questions about {owner}/{repo} codebase
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentContext.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-3xl rounded-2xl px-6 py-4 ${
                          message.role === 'user'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)]'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <Markdown content={message.content} />
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content.replace('[DEEP RESEARCH]', '').trim()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Streaming message */}
                  {isLoading && streamingMessageRef.current && (
                    <div className="flex justify-start">
                      <div className="max-w-3xl rounded-2xl px-6 py-4 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)]">
                        <Markdown content={streamingMessageRef.current} />
                      </div>
                    </div>
                  )}
                  
                  {/* Loading indicator */}
                  {isLoading && !streamingMessageRef.current && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl px-6 py-4 bg-[var(--card-bg)] border border-[var(--border-color)]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse delay-75"></div>
                          <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse delay-150"></div>
                          <span className="text-sm text-[var(--muted)] ml-2">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Chat Input */}
          <ChatInput
            onSubmit={handleSubmitQuestion}
            isLoading={isLoading}
            placeholder="Ask a follow-up question..."
            provider={provider}
            model={model}
            isCustomModel={isCustomModel}
            customModel={customModel}
            onProviderChange={setProvider}
            onModelChange={setModel}
            onIsCustomModelChange={setIsCustomModel}
            onCustomModelChange={setCustomModel}
            deepResearch={deepResearch}
            onDeepResearchChange={setDeepResearch}
            maxHistoryMessages={maxHistoryMessages}
            onMaxHistoryMessagesChange={setMaxHistoryMessages}
            showHistoryConfig={true}
          />
        </div>
      </div>
    </div>
  );
}
