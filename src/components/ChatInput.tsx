import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Send, ChevronDown, ChevronUp, Brain, Square } from 'lucide-react';
import type { Provider } from '../types';
import type { TokenStats } from '../context/useChat';

interface Props {
  onSend: (content: string, provider: Provider, model: string, conversationId?: string) => void;
  tokenStats: TokenStats | null;
  isStreaming: boolean;
  onStop: () => void;
}

export default function ChatInput({ onSend, tokenStats, isStreaming, onStop }: Props) {
  const { activeConversationId, activeProvider, activeModel, setActiveModel, providers, updateConversationTitle, setActiveProvider, createConversation, setActiveConversationId } = useApp();
  const [input, setInput] = useState('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Get available models for the active provider (exclude disabled)
  const availableModels = (activeProvider?.models ?? []).filter(
    (m) => m.enabled !== false
  );
  const displayModelName = useCallback(() => {
    if (!activeProvider) return '';
    const exists = (key: string) => availableModels.some((m) => m.key === key);
    if (activeModel && exists(activeModel)) return activeModel;
    if (activeProvider.default_model && exists(activeProvider.default_model)) {
      return activeProvider.default_model;
    }
    return availableModels[0]?.key || activeProvider.default_model || '';
  }, [activeProvider, activeModel, availableModels]);

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
    setActiveModel(modelKey);
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
      : 32768; // fallback: 32k if nothing configured

  // Use exact token stats from the last response
  const inputTokens = tokenStats?.input_tokens ?? 0;
  const outputTokens = tokenStats?.total_output_tokens ?? 0;
  const reasoningTokens = tokenStats?.reasoning_output_tokens ?? 0;
  const usedTokens = inputTokens + outputTokens;

  if (!activeProvider) {
    return (
      <div className="border-t theme-border px-4 py-3">
        <div className="max-w-chat-input-max mx-auto text-center">
          <p className="text-xs text-gray-500">
            No provider configured. Go to Settings to add one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-main">
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Token stats (right-aligned, above input) */}
        {maxTokens && (
          <div className="text-xs font-mono flex items-center justify-center gap-3 mb-2">
            <span className="theme-text-muted">
              {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
              <span className="theme-text-muted ml-1">
                ({(((maxTokens - usedTokens) / maxTokens) * 100).toFixed(1)}% left)
              </span>
            </span>
            <span className="theme-text-muted">
              ↑ {inputTokens.toLocaleString()} · ↓ {outputTokens.toLocaleString()}
              {reasoningTokens > 0 && (
                <>
                  {' · '}
                  <Brain className="w-3 h-3 inline-block align-[-1px]" />
                  {' '}
                  {reasoningTokens.toLocaleString()}
                </>
              )}
            </span>
          </div>
        )}

        {/* Input area — textarea + integrated selectors and send button */}
        <div className="chat-input-container flex flex-col border theme-border-light rounded-2xl">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="chat-input bg-transparent text-sm px-4 pt-3 pb-2 focus:outline-none resize-none placeholder-gray-500"
          />
          {/* Bottom bar: provider + model on left, send on right */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-3 min-w-0">
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
                        className="w-full text-left px-3 py-2 text-xs theme-text-primary hover-theme-sidebar-hover transition-colors"
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
                <div className="relative min-w-0" ref={modelDropdownRef}>
                  <button
                    onClick={() => { setShowModelDropdown(!showModelDropdown); setShowProviderDropdown(false); }}
                    className="flex items-center gap-1 text-xs theme-text-secondary hover-theme-text-primary transition-colors min-w-0"
                  >
                    <span className="text-gray-500">model:</span>
                    <span className="font-mono text-[11px] truncate max-w-[180px]">{displayModelName()}</span>
                    {showModelDropdown ? (
                      <ChevronUp className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    )}
                  </button>

                  {showModelDropdown && (
                    <div className="absolute bottom-full mb-2 left-0 theme-sidebar border theme-border-light rounded-lg shadow-xl py-1 min-w-[220px] max-h-[240px] overflow-y-auto z-20">
                      {availableModels.map((m) => (
                        <button
                          key={m.key}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            m.key === displayModelName()
                              ? 'theme-sidebar-active theme-text-primary'
                              : 'theme-text-primary hover-theme-sidebar-hover'
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

            <button
              onClick={isStreaming ? onStop : handleSubmit}
              disabled={!isStreaming && !input.trim()}
              title={isStreaming ? 'Stop generating' : 'Send'}
              className={`p-2 rounded-full transition-all flex-shrink-0 ${
                isStreaming
                  ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
                  : input.trim()
                    ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
                    : 'bg-transparent theme-text-muted cursor-not-allowed'
              }`}
            >
              {isStreaming ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <p className="text-[10px] theme-text-muted text-center mt-2">
          AI responses generated by your configured provider.
        </p>
      </div>
    </div>
  );
}
