"use client";

import React, { useState, useRef, useEffect } from "react";
import ModelSelectionModal from "./ModelSelectionModal";
import { ChatContext } from "@/utils/chatContext";

interface ChatInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
  placeholder?: string;
  // Model selection props
  provider: string;
  model: string;
  isCustomModel: boolean;
  customModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onIsCustomModelChange: (isCustom: boolean) => void;
  onCustomModelChange: (model: string) => void;
  // Deep research props
  deepResearch: boolean;
  onDeepResearchChange: (enabled: boolean) => void;
  // Additional configuration
  maxHistoryMessages?: number;
  onMaxHistoryMessagesChange?: (count: number) => void;
  showHistoryConfig?: boolean;
  // History selection
  contexts?: ChatContext[];
  selectedContextId?: string | null;
  onContextSelect?: (contextId: string | null) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  isLoading,
  placeholder = "Ask a question about this codebase...",
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
  maxHistoryMessages = 10,
  onMaxHistoryMessagesChange,
  showHistoryConfig = false,
  contexts = [],
  selectedContextId = null,
  onContextSelect,
}) => {
  const [question, setQuestion] = useState("");
  const [isModelSelectionModalOpen, setIsModelSelectionModalOpen] =
    useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [question]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    onSubmit(question.trim());
    setQuestion("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-8 pb-6 z-40">
      <div className="max-w-5xl mx-auto px-4">
        {/* Rectangular input box */}
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--card-bg)] rounded-2xl shadow-xl border border-[var(--border-color)] overflow-hidden"
        >
          {/* Textarea input area */}
          <div className="p-4 pb-1">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="w-full text-base bg-transparent text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none resize-none overflow-y-auto"
              style={{ maxHeight: "200px" }}
            />
          </div>

          {/* Control bar */}
          <div className="flex items-center justify-between px-4 pb-1 bg-[var(--background)]/30">
            <div className="flex items-center gap-3">
              {/* Deep Research toggle */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-xs text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                  Deep Search
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={deepResearch}
                    onChange={(e) => onDeepResearchChange(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-8 h-4 rounded-full transition-colors ${
                      deepResearch
                        ? "bg-[var(--accent-primary)]"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  ></div>
                  <div
                    className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      deepResearch ? "translate-x-4" : ""
                    }`}
                  ></div>
                </div>
              </label>

              {/* Model selection */}
              <button
                type="button"
                onClick={() => setIsModelSelectionModalOpen(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all flex items-center gap-1.5"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>
                  {provider}/{isCustomModel ? customModel : model}
                </span>
              </button>

              {/* History selection */}
              {contexts && contexts.length > 0 && onContextSelect && (
                <button
                  type="button"
                  onClick={() => setShowHistoryDialog(true)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    selectedContextId
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "border-[var(--border-color)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                  }`}
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    {selectedContextId ? "History Selected" : "History"}
                  </span>
                </button>
              )}

              {/* History message count */}
              {showHistoryConfig && onMaxHistoryMessagesChange && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[var(--muted)]">Max:</span>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    step="2"
                    value={maxHistoryMessages}
                    onChange={(e) => {
                      let value = parseInt(e.target.value);
                      if (value % 2 !== 0) value = value - 1;
                      if (value < 2) value = 2;
                      if (value > 50) value = 50;
                      onMaxHistoryMessagesChange(value);
                    }}
                    className="w-12 px-1.5 py-0.5 text-center rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <span className="text-[var(--muted)]">msgs</span>
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className={`w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center ${
                isLoading || !question.trim()
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 shadow-md hover:shadow-lg hover:scale-105"
              }`}
              title={isLoading ? "Sending..." : "Send message"}
            >
              {isLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Hint text */}
        {deepResearch && (
          <p className="text-xs text-center text-[var(--muted)] mt-2">
            Multi-turn research enabled (up to 5 iterations)
          </p>
        )}
      </div>

      {/* History Dialog */}
      {showHistoryDialog && contexts && onContextSelect && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHistoryDialog(false)}
        >
          <div
            className="bg-[var(--card-bg)] rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Chat History
              </h3>
              <button
                onClick={() => setShowHistoryDialog(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {/* New conversation option */}
                <button
                  onClick={() => {
                    onContextSelect(null);
                    setShowHistoryDialog(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    !selectedContextId
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-[var(--border-color)] hover:border-[var(--accent-primary)]/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[var(--accent-primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      New Conversation
                    </span>
                  </div>
                </button>

                {/* Context list */}
                {contexts.map((context) => (
                  <button
                    key={context.id}
                    onClick={() => {
                      onContextSelect(context.id);
                      setShowHistoryDialog(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedContextId === context.id
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-color)] hover:border-[var(--accent-primary)]/50"
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--foreground)] truncate mb-1">
                      {context.title}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {context.messages.length} messages
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Selection Modal */}
      <ModelSelectionModal
        isOpen={isModelSelectionModalOpen}
        onClose={() => setIsModelSelectionModalOpen(false)}
        provider={provider}
        setProvider={onProviderChange}
        model={model}
        setModel={onModelChange}
        isCustomModel={isCustomModel}
        setIsCustomModel={onIsCustomModelChange}
        customModel={customModel}
        setCustomModel={onCustomModelChange}
        isComprehensiveView={true}
        setIsComprehensiveView={() => {}}
        showFileFilters={false}
        onApply={() => {
          setIsModelSelectionModalOpen(false);
        }}
        showWikiType={false}
        authRequired={false}
        isAuthLoading={false}
      />
    </div>
  );
};

export default ChatInput;
