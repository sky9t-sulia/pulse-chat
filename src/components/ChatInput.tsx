import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import type { Provider } from '../types';
import type { TokenStats } from '../context/useChat';

interface Props {
  onSend: (content: string, provider: Provider, model: string, conversationId?: string) => void;
  tokenStats: TokenStats | null;
}

function getStoredModel(providerId: string): string | null {
  try {
    return localStorage.getItem(`chat-model-${providerId}`);
  } catch {
    return null;
  }
}

function setStoredModel(providerId: string, model: string) {
  try {
    localStorage.setItem(`chat-model-${providerId}`, model);
  } catch {
    // ignore
  }
}

export default function ChatInput({ onSend, tokenStats }: Props) {
  const { activeConversationId, activeProvider, providers, updateConversationTitle, setActiveProvider, createConversation, setActiveConversationId } = useApp();
  const [input, setInput] = useState('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Get available models for the active provider
  const availableModels = activeProvider?.models ?? [];
  const displayModelName = useCallback(() => {
    if (!activeProvider) return '';
    // Prefer stored selection, then default_model, then first in list
    if (selectedModelKey) return selectedModelKey;
    const stored = getStoredModel(activeProvider.id);
    if (stored) return stored;
    return activeProvider.default_model || availableModels[0]?.key || '';
  }, [activeProvider, selectedModelKey, availableModels]);

  // Sync selected model when provider changes
  useEffect(() => {
    if (!activeProvider) {
      setSelectedModelKey('');
      return;
    }
    const stored = getStoredModel(activeProvider.id);
    if (stored) {
      setSelectedModelKey(stored);
    } else {
      setSelectedModelKey(activeProvider.default_model || availableModels[0]?.key || '');
    }
  }, [activeProvider?.id, availableModels.length]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    if (!showModelDropdown) return;
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelDropdown]);

  const handleModelChange = (modelKey: string) => {
    if (activeProvider) {
      setStoredModel(activeProvider.id, modelKey);
    }
    setSelectedModelKey(modelKey);
    setShowModelDropdown(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim() || !activeProvider) return;

    const content = input.trim();
    setInput('');

    // Auto-create conversation if none selected
    let conversationId = activeConversationId;
    if (!conversationId) {
      const conv = await createConversation('New Chat');
      conversationId = conv.id;
      setActiveConversationId(conv.id);
    }

    try {
      // If first message, update conversation title
      const messageCount = await window.chatApi.messages.get(conversationId);
      if (messageCount.length === 0) {
        await updateConversationTitle(conversationId, content.slice(0, 50));
      }
    } catch {
      // Title update is non-critical; proceed with sending anyway
    }

    const model = displayModelName();
    onSend(content, activeProvider, model, conversationId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Get model info for the currently selected model
  const selectedModelInfo = availableModels.find((m) => m.key === displayModelName())?.model_info;
  const maxTokens = selectedModelInfo?.max_context_length
    ? Number(selectedModelInfo.max_context_length)
    : activeProvider?.model_info?.max_context_length
      ? Number(activeProvider.model_info.max_context_length)
      : null;

  // Use exact token stats from the last response
  const inputTokens = tokenStats?.input_tokens ?? 0;
  const outputTokens = tokenStats?.total_output_tokens ?? 0;
  const reasoningTokens = tokenStats?.reasoning_output_tokens ?? 0;
  const usedTokens = inputTokens + outputTokens;
  const remainingTokens = maxTokens ? Math.max(0, maxTokens - usedTokens) : null;

  if (!activeProvider) {
    return (
      <div className="border-t theme-border px-4 py-3">
        <div className="max-w-chat-max mx-auto text-center">
          <p className="text-xs text-gray-500">
            No provider configured. Go to Settings to add one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t theme-border theme-main">
      <div className="max-w-chat-max mx-auto px-4 py-3">
        {/* Provider and model selector */}
        <div className="flex items-center justify-between mb-2">
          <div className="relative flex items-center gap-3">
            {/* Provider selector */}
            <div className="relative">
              <button
                onClick={() => { setShowProviderDropdown(!showProviderDropdown); setShowModelDropdown(false); }}
                className="flex items-center gap-1.5 text-xs theme-text-secondary hover-theme-text-primary transition-colors"
              >
                <span>{activeProvider.name}</span>
                {showProviderDropdown ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showProviderDropdown && providers.length > 1 && (
                <div className="absolute bottom-full mb-2 left-0 theme-sidebar border theme-border-light rounded-lg shadow-xl py-1 min-w-[200px] z-10">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 text-xs theme-text-primary hover:bg-sidebar-hover transition-colors"
                      onClick={() => {
                        setActiveProvider(p);
                        setShowProviderDropdown(false);
                      }}
                    >
                      <div className="font-medium">{p.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model selector */}
            {availableModels.length > 1 && (
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => { setShowModelDropdown(!showModelDropdown); setShowProviderDropdown(false); }}
                  className="flex items-center gap-1 text-xs theme-text-secondary hover-theme-text-primary transition-colors"
                >
                  <span className="text-gray-500">model:</span>
                  <span className="font-mono text-[11px] truncate max-w-[180px]">{displayModelName()}</span>
                  {showModelDropdown ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {showModelDropdown && (
                  <div className="absolute bottom-full mb-2 left-0 theme-sidebar border theme-border-light rounded-lg shadow-xl py-1 min-w-[220px] max-h-[240px] overflow-y-auto z-20">
                    {availableModels.map((m) => (
                      <button
                        key={m.key}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          m.key === displayModelName()
                            ? 'bg-gray-700 theme-text-primary'
                            : 'theme-text-primary hover:bg-sidebar-hover'
                        }`}
                        onClick={() => handleModelChange(m.key)}
                      >
                        <div className="font-medium truncate">{m.display_name || m.key}</div>
                        {m.model_info?.max_context_length && (
                          <div className="text-gray-500 text-[10px]">
                            {Number(m.model_info.max_context_length).toLocaleString()} tokens
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Context/tokens display */}
          {maxTokens && (inputTokens > 0 || outputTokens > 0) && remainingTokens !== null && (
            <div className={`text-xs font-mono flex flex-col items-end gap-0.5 ${
              remainingTokens < maxTokens * 0.8
                ? remainingTokens < maxTokens * 0.5
                  ? 'text-red-400'
                  : 'text-yellow-400'
                : 'text-gray-500'
            }`}>
              <div>
                {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
                {remainingTokens !== null && (
                  <span className="theme-text-muted ml-1">
                    ({(remainingTokens / maxTokens * 100).toFixed(1)}% left)
                  </span>
                )}
              </div>
              <div className="theme-text-muted">
                in: {inputTokens.toLocaleString()} · out: {outputTokens.toLocaleString()}
                {reasoningTokens > 0 && (
                  <>
                    {' · '}reasoning: {reasoningTokens.toLocaleString()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="relative flex items-end theme-input border theme-border-light rounded-2xl focus-within:border-gray-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="chat-input flex-1 bg-transparent text-sm px-4 py-3 pr-12 focus:outline-none resize-none placeholder-gray-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className={`absolute right-2 bottom-2 p-2 rounded-full transition-all ${
              input.trim()
                ? 'bg-gray-600 hover:bg-gray-500 theme-text-primary'
                : 'bg-transparent theme-text-muted cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] theme-text-muted text-center mt-2">
          AI responses generated by your configured provider.
        </p>
      </div>
    </div>
  );
}
