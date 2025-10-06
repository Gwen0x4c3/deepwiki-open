/**
 * Chat context management utilities for localStorage persistence
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatContext {
  id: string;
  title: string; // First user message (truncated)
  messages: ChatMessage[];
  repoOwner: string;
  repoName: string;
  repoType: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = 'deepwiki_chat_context_';
const CONTEXT_LIST_KEY = 'deepwiki_chat_contexts';

/**
 * Generate a unique ID for a chat context
 */
export function generateContextId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the storage key for a specific context
 */
function getContextStorageKey(contextId: string): string {
  return `${STORAGE_KEY_PREFIX}${contextId}`;
}

/**
 * Get list of all context IDs
 */
export function getContextList(repoOwner: string, repoName: string): string[] {
  try {
    const listKey = `${CONTEXT_LIST_KEY}_${repoOwner}_${repoName}`;
    const stored = localStorage.getItem(listKey);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting context list:', error);
    return [];
  }
}

/**
 * Save context list
 */
function saveContextList(repoOwner: string, repoName: string, contextIds: string[]): void {
  try {
    const listKey = `${CONTEXT_LIST_KEY}_${repoOwner}_${repoName}`;
    localStorage.setItem(listKey, JSON.stringify(contextIds));
  } catch (error) {
    console.error('Error saving context list:', error);
  }
}

/**
 * Load a specific chat context
 */
export function loadChatContext(contextId: string): ChatContext | null {
  try {
    const stored = localStorage.getItem(getContextStorageKey(contextId));
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error loading chat context:', error);
    return null;
  }
}

/**
 * Save a chat context
 */
export function saveChatContext(context: ChatContext): void {
  try {
    // Save the context
    localStorage.setItem(getContextStorageKey(context.id), JSON.stringify(context));
    
    // Update context list
    const contextIds = getContextList(context.repoOwner, context.repoName);
    if (!contextIds.includes(context.id)) {
      contextIds.unshift(context.id); // Add to beginning
      saveContextList(context.repoOwner, context.repoName, contextIds);
    }
  } catch (error) {
    console.error('Error saving chat context:', error);
  }
}

/**
 * Delete a chat context
 */
export function deleteChatContext(contextId: string, repoOwner: string, repoName: string): void {
  try {
    // Remove the context
    localStorage.removeItem(getContextStorageKey(contextId));
    
    // Update context list
    const contextIds = getContextList(repoOwner, repoName);
    const updatedIds = contextIds.filter(id => id !== contextId);
    saveContextList(repoOwner, repoName, updatedIds);
  } catch (error) {
    console.error('Error deleting chat context:', error);
  }
}

/**
 * Get all chat contexts for a repository
 */
export function getAllChatContexts(repoOwner: string, repoName: string): ChatContext[] {
  const contextIds = getContextList(repoOwner, repoName);
  return contextIds
    .map(id => loadChatContext(id))
    .filter((context): context is ChatContext => context !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt); // Most recent first
}

/**
 * Update an existing chat context with new messages
 */
export function updateChatContext(contextId: string, messages: ChatMessage[]): void {
  const context = loadChatContext(contextId);
  if (context) {
    context.messages = messages;
    context.updatedAt = Date.now();
    saveChatContext(context);
  }
}

/**
 * Create a new chat context
 */
export function createChatContext(
  repoOwner: string,
  repoName: string,
  repoType: string,
  initialMessage: string
): ChatContext {
  const contextId = generateContextId();
  const title = truncateTitle(initialMessage);
  
  const context: ChatContext = {
    id: contextId,
    title,
    messages: [
      {
        role: 'user',
        content: initialMessage,
        timestamp: Date.now()
      }
    ],
    repoOwner,
    repoName,
    repoType,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  saveChatContext(context);
  return context;
}

/**
 * Truncate title to a reasonable length with ellipsis
 */
function truncateTitle(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Trim message history to keep only the last N messages
 * @param messages All messages in the conversation
 * @param maxMessages Maximum number of messages to keep (must be even for balanced user/assistant pairs)
 * @returns Trimmed message array
 */
export function trimMessageHistory(messages: ChatMessage[], maxMessages: number): ChatMessage[] {
  // Ensure maxMessages is even for balanced pairs
  const maxEven = maxMessages % 2 === 0 ? maxMessages : maxMessages - 1;
  
  if (messages.length <= maxEven) {
    return messages;
  }
  
  // Keep the most recent messages
  return messages.slice(-maxEven);
}
