'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaPlus, FaList } from 'react-icons/fa';
import ChatInput from './ChatInput';
import ChatHistoryList from './ChatHistoryList';
import Markdown from './Markdown';
import ThemeToggle from './theme-toggle';
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

type ResearchLevel = 'lite' | 'medium' | 'heavy';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoInfo: RepoInfo;
  initialQuestion?: string;
  initialContextId?: string | null;
  provider: string;
  model: string;
  isCustomModel: boolean;
  customModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onIsCustomModelChange: (isCustom: boolean) => void;
  onCustomModelChange: (model: string) => void;
  deepResearch: boolean;
  onDeepResearchChange: (enabled: boolean) => void;
  initialResearchLevel?: ResearchLevel;
}

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  repoInfo,
  initialQuestion,
  initialContextId,
  provider,
  model,
  isCustomModel,
  customModel,
  onProviderChange,
  onModelChange,
  onIsCustomModelChange,
  onCustomModelChange,
  deepResearch,
  onDeepResearchChange,
  initialResearchLevel = 'medium'
}) => {
  const [contexts, setContexts] = useState<ChatContext[]>([]);
  const [currentContext, setCurrentContext] = useState<ChatContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [maxHistoryMessages, setMaxHistoryMessages] = useState(10);
  const [researchLevel, setResearchLevel] = useState<ResearchLevel>(initialResearchLevel as ResearchLevel);
  
  const webSocketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef('');
  const hasInitialized = useRef(false);

  // Load contexts and handle initial state
  useEffect(() => {
    if (!isOpen) {
      hasInitialized.current = false;
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const loadedContexts = getAllChatContexts(repoInfo.owner, repoInfo.repo);
    setContexts(loadedContexts);
    
    // Handle initial context or question
    if (initialContextId) {
      const context = loadChatContext(initialContextId);
      if (context) {
        setCurrentContext(context);
        
        // If there's also an initial question, send it in this context
        if (initialQuestion) {
          setTimeout(() => {
            sendMessage(initialQuestion, context);
          }, 100);
        }
      }
    } else if (initialQuestion) {
      // Create new context with initial question
      // Add [DEEP RESEARCH] tag if enabled
      const questionWithTag = deepResearch ? `[DEEP RESEARCH] ${initialQuestion}` : initialQuestion;
      const newContext = createChatContext(repoInfo.owner, repoInfo.repo, repoInfo.type, questionWithTag);
      setCurrentContext(newContext);
      setContexts(prev => [newContext, ...prev]);
      
      // Send the message
      setTimeout(() => {
        sendMessageWithoutUserMessage(newContext);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialQuestion, initialContextId, repoInfo.owner, repoInfo.repo, repoInfo.type]);

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

  // Thinking timeline types and state
  interface ThinkingStep {
    id: string;
    content: string;
    timestamp: number;
    status: 'active' | 'completed' | 'error';
    duration?: number;
  }

  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [currentThinkingId, setCurrentThinkingId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Tick timer when a thinking step is active to update live duration
  useEffect(() => {
    if (currentThinkingId) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setNowTs(Date.now()), 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentThinkingId]);

  const resetThinking = () => {
    setThinkingSteps([]);
    setCurrentThinkingId(null);
  };

  const sendMessageWithoutUserMessage = async (context: ChatContext) => {
    setIsLoading(true);
    streamingMessageRef.current = '';
    
    try {
      const messagesForApi = context.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        // Strip <think> blocks before sending to backend
        content: msg.content.replace(/<think[\s\S]*?<\/think>/g, '')
      }));

      const requestBody: ChatCompletionRequest = {
        repo_url: getRepoUrl(repoInfo),
        type: repoInfo.type,
        messages: messagesForApi,
        provider: provider,
        model: isCustomModel ? customModel : model,
        language: 'en',
        research_level: researchLevel
      };

      if (repoInfo.token) {
        requestBody.token = repoInfo.token;
      }

      closeWebSocket(webSocketRef.current);

      let fullResponse = '';

      webSocketRef.current = createChatWebSocket(
        requestBody,
        (message: string) => {
          // Extract ALL <think ...>...</think> blocks and remove them from the content
          const thinkRegex = /<think[^>]*>([\s\S]*?)<\/think>/g;
          let residual = message as string;
          let match: RegExpExecArray | null;
          const nowMs = Date.now();
          while ((match = thinkRegex.exec(message as string)) !== null) {
            const tag = match[0];
            const inner = match[1];
            // Try to grab timestamp attribute
            const tsMatch = tag.match(/timestamp=\"(\d+)\"/);
            const ts = tsMatch ? parseInt(tsMatch[1]) : nowMs;
            const stepId = `step-${ts}`;

            // Complete previous active step
            if (currentThinkingId) {
              setThinkingSteps(prev => prev.map(step =>
                step.id === currentThinkingId
                  ? { ...step, status: 'completed', duration: ts - step.timestamp }
                  : step
              ));
            }

            // Add new step as active
            const newStep: ThinkingStep = {
              id: stepId,
              content: inner,
              timestamp: ts,
              status: 'active'
            };
            setThinkingSteps(prev => [...prev, newStep]);
            setCurrentThinkingId(stepId);

            // Remove this think block from residual content
            residual = residual.replace(tag, '');
          }

          // Append residual (non-think content)
          if (residual) {
            residual = residual.replace(thinkRegex, '');
            fullResponse += residual;
            streamingMessageRef.current = normalizeStreamingMarkdown(fullResponse);
            setCurrentContext(prev => prev ? { ...prev } : null);
          }
        },
        (error: Event) => {
          console.error('WebSocket error:', error);
          streamingMessageRef.current += '\n\n❌ Error: Connection failed. Please try again.';
          setCurrentContext(prev => prev ? { ...prev } : null);
          setIsLoading(false);
        },
        () => {
          // Close out all active/incomplete thinking steps as a safeguard
          const now = Date.now();
          setThinkingSteps(prev => prev.map(step =>
            step.status !== 'completed' ? { ...step, status: 'completed', duration: (step.duration ?? (now - step.timestamp)) } : step
          ));
          setCurrentThinkingId(null);

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
// @ts-expect-error - extend message with thinkings for persistence
            thinkings: thinkingSteps,
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
      // Add [DEEP RESEARCH] tag if enabled
      const questionWithTag = deepResearch ? `[DEEP RESEARCH] ${question}` : question;
      const newContext = createChatContext(repoInfo.owner, repoInfo.repo, repoInfo.type, questionWithTag);
      setCurrentContext(newContext);
      setContexts(prev => [newContext, ...prev]);
      sendMessageWithoutUserMessage(newContext);
      return;
    }

    setIsLoading(true);
    streamingMessageRef.current = '';
    
    try {
      const userMessage: ChatMessage = {
        role: 'user',
        content: deepResearch ? `[DEEP RESEARCH] ${question}` : question,
        timestamp: Date.now()
      };
      
      const updatedMessages = [...targetContext.messages, userMessage];
      const trimmedMessages = trimMessageHistory(updatedMessages, maxHistoryMessages + 2);
      
      const newContext: ChatContext = {
        ...targetContext,
        messages: trimmedMessages,
        updatedAt: Date.now()
      };
      
      setCurrentContext(newContext);
      updateChatContext(newContext.id, trimmedMessages);

      const messagesForApi = trimmedMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content.replace(/<think[\s\S]*?<\/think>/g, '')
      }));

      const requestBody: ChatCompletionRequest = {
        repo_url: getRepoUrl(repoInfo),
        type: repoInfo.type,
        messages: messagesForApi,
        provider: provider,
        model: isCustomModel ? customModel : model,
        language: 'en',
        research_level: researchLevel
      };

      if (repoInfo.token) {
        requestBody.token = repoInfo.token;
      }

      closeWebSocket(webSocketRef.current);

      let fullResponse = '';
      // Reset timeline for a new streaming session
      resetThinking();

      webSocketRef.current = createChatWebSocket(
        requestBody,
        (message: string) => {
          // Extract ALL <think ...>...</think> blocks and remove them from the content
          const thinkRegex = /<think[^>]*>([\s\S]*?)<\/think>/g;
          let residual = message as string;
          let match: RegExpExecArray | null;
          const nowMs = Date.now();
          while ((match = thinkRegex.exec(message as string)) !== null) {
            const tag = match[0];
            const inner = match[1];
            // Try to grab timestamp attribute
            const tsMatch = tag.match(/timestamp=\"(\d+)\"/);
            const ts = tsMatch ? parseInt(tsMatch[1]) : nowMs;
            const stepId = `step-${ts}`;

            // Complete previous active step
            if (currentThinkingId) {
              setThinkingSteps(prev => prev.map(step =>
                step.id === currentThinkingId
                  ? { ...step, status: 'completed', duration: ts - step.timestamp }
                  : step
              ));
            }

            // Add new step as active
            const newStep: ThinkingStep = {
              id: stepId,
              content: inner,
              timestamp: ts,
              status: 'active'
            };
            setThinkingSteps(prev => [...prev, newStep]);
            setCurrentThinkingId(stepId);

            // Remove this think block from residual content
            residual = residual.replace(tag, '');
          }

          // Append residual (non-think content)
          if (residual && residual.trim().length > 0) {
            residual = residual.replace(thinkRegex, '');
            fullResponse += residual;
            streamingMessageRef.current = normalizeStreamingMarkdown(fullResponse);
            setCurrentContext(prev => prev ? { ...prev } : null);
          }
        },
        (error: Event) => {
          console.error('WebSocket error:', error);
          streamingMessageRef.current += '\n\n❌ Error: Connection failed. Please try again.';
          setCurrentContext(prev => prev ? { ...prev } : null);
          setIsLoading(false);
        },
        () => {
          // Close out all active/incomplete thinking steps as a safeguard
          const now = Date.now();
          setThinkingSteps(prev => prev.map(step =>
            step.status !== 'completed' ? { ...step, status: 'completed', duration: (step.duration ?? (now - step.timestamp)) } : step
          ));
          setCurrentThinkingId(null);

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
// @ts-expect-error - extend message with thinkings for persistence
            thinkings: thinkingSteps,
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

  // Normalize streaming markdown display by auto-closing an odd code fence and normalizing line breaks
  const normalizeStreamingMarkdown = (s: string): string => {
    try {
      let t = s.replace(/\r\n?/g, '\n');
      const fenceCount = (t.match(/```/g) ?? []).length;
      if (fenceCount % 2 === 1) {
        t = t + '\n```';
      }
      return t;
    } catch {
      return s;
    }
  };

  const handleNewConversation = () => {
    setCurrentContext(null);
    streamingMessageRef.current = '';
  };

  const handleLoadContext = (contextId: string) => {
    const context = loadChatContext(contextId);
    if (context) {
      setCurrentContext(context);
      streamingMessageRef.current = '';
    }
  };

  const handleDeleteContext = (contextId: string) => {
    deleteChatContext(contextId, repoInfo.owner, repoInfo.repo);
    setContexts(prev => prev.filter(c => c.id !== contextId));
    
    if (currentContext?.id === contextId) {
      setCurrentContext(null);
      streamingMessageRef.current = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--card-bg)] border-b border-[var(--border-color)] px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-serif font-bold text-[var(--foreground)]">
              Chat: {repoInfo.owner}/{repoInfo.repo}
            </h1>
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
              onClick={handleNewConversation}
              className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-colors flex items-center gap-2"
            >
              <FaPlus />
              <span className="text-sm">New Chat</span>
            </button>
            <ThemeToggle />
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
              title="Close chat"
            >
              <FaTimes className="text-xl" />
            </button>
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
      <div className="flex-1 flex flex-col overflow-hidden relative">
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
                    Ask questions about {repoInfo.owner}/{repoInfo.repo} codebase
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentContext.messages.map((message, index) => {
                    // Inline timeline for stored assistant messages
const storedThinkings: ThinkingStep[] | undefined = (message as unknown as { thinkings?: ThinkingStep[] }).thinkings;
                    return (
                      <div key={index}>
                        {/* If this is an assistant message with stored thinkings, render timeline above it */}
                        {message.role === 'assistant' && storedThinkings && storedThinkings.length > 0 && (
                          <div className="mb-2 space-y-2">
{storedThinkings.map((step) => (
                              <div key={step.id} className={`flex items-center gap-2 text-xs ${step.status === 'completed' ? 'text-gray-500' : 'text-purple-700'}`}>
                                <div className={`w-2 h-2 rounded-full ${step.status === 'completed' ? 'bg-gray-400' : 'bg-purple-500 animate-pulse'}`}></div>
                                <div className="flex-1">
                                  <span className={`${step.status === 'completed' ? 'opacity-70' : ''}`}>{step.content}</span>
                                </div>
                                {step.status === 'completed' && step.duration != null ? (
                                  <span className="text-[10px] text-gray-500">⏱ {(step.duration/1000).toFixed(1)}s</span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-3xl rounded-2xl px-6 py-4 ${
                              message.role === 'user'
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)]'
                            }`}
                          >
                            {message.role === 'assistant' ? (
                              <Markdown content={message.content.replace(/<think[\s\S]*?<\/think>/g, '')} />
                            ) : (
                              <p className="whitespace-pre-wrap">{message.content.replace('[DEEP RESEARCH]', '').trim()}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline timeline for current streaming deep research (placed above streaming assistant bubble) */}
                  {thinkingSteps.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {thinkingSteps.map((step) => {
                        const isActive = currentThinkingId === step.id && step.status !== 'completed';
                        const liveDuration = isActive ? (nowTs - step.timestamp) : step.duration ?? 0;
                        return (
                          <div key={step.id} className={`flex items-center gap-2 text-xs ${isActive ? 'text-purple-700' : 'text-gray-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-purple-500 animate-pulse' : 'bg-gray-400'}`}></div>
                            <div className="flex-1">
                              <span className={`${isActive ? '' : 'opacity-70'}`}>{step.content}</span>
                            </div>
<span className={`text-[10px] ${isActive ? 'text-purple-600' : 'text-gray-500'}`}>{isActive ? `⏱ ${(liveDuration/1000).toFixed(1)}s` : (step.duration != null ? `⏱ ${(step.duration/1000).toFixed(1)}s` : '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
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
            onSubmit={(question) => sendMessage(question)}
            isLoading={isLoading}
            placeholder="Ask a follow-up question..."
            provider={provider}
            model={model}
            isCustomModel={isCustomModel}
            customModel={customModel}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onIsCustomModelChange={onIsCustomModelChange}
            onCustomModelChange={onCustomModelChange}
            deepResearch={deepResearch}
            onDeepResearchChange={onDeepResearchChange}
            researchLevel={researchLevel}
            onResearchLevelChange={setResearchLevel}
            maxHistoryMessages={maxHistoryMessages}
            onMaxHistoryMessagesChange={setMaxHistoryMessages}
            showHistoryConfig={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
