import { useState, useRef, useEffect, useCallback } from 'react';
import type { Provider } from '../types/types';

interface UseChatInputArgs {
  onSend: (content: string, provider: Provider, model: string, conversationId?: string) => void;
  activeConversationId: string | null;
  activeProvider: Provider | null;
  activeModel: string;
  setActiveModel: (model: string) => void;
  setActiveProvider: (provider: Provider | null) => void;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  createConversation: (title: string) => Promise<{ id: string }>;
  setActiveConversationId: (id: string | null) => void;
}

interface UseChatInputResult {
  input: string;
  setInput: (input: string) => void;
  showProviderDropdown: boolean;
  setShowProviderDropdown: (show: boolean) => void;
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  displayModelName: () => string;
  handleModelChange: (modelKey: string) => void;
  handleProviderSelect: (provider: Provider) => void;
  handleSubmit: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  availableModels: Array<{ key: string; enabled?: boolean }>;
}

export function useChatInput(args: UseChatInputArgs): UseChatInputResult {
  const {
    onSend, activeConversationId, activeProvider, activeModel,
    setActiveModel, setActiveProvider, updateConversationTitle,
    createConversation, setActiveConversationId,
  } = args;

  const [input, setInput] = useState('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const availableModels = (activeProvider?.models ?? []).filter(
    (model) => model.enabled !== false
  );

  const displayModelName = useCallback(() => {
    if (!activeProvider) return '';
    const exists = (key: string) => availableModels.some((model) => model.key === key);
    if (activeModel && exists(activeModel)) return activeModel;
    if (activeProvider.default_model && exists(activeProvider.default_model)) {
      return activeProvider.default_model;
    }
    return availableModels[0]?.key || activeProvider.default_model || '';
  }, [activeProvider, activeModel, availableModels]);

  const handleModelChange = useCallback((modelKey: string) => {
    setActiveModel(modelKey);
    setShowModelDropdown(false);
  }, [setActiveModel]);

  const handleProviderSelect = useCallback((provider: Provider) => {
    setActiveProvider(provider);
    setShowProviderDropdown(false);
  }, [setActiveProvider]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !activeProvider) return;

    const content = input.trim();
    setInput('');

    let conversationId = activeConversationId;
    if (!conversationId) {
      const conv = await createConversation('New Chat');
      conversationId = conv.id;
      setActiveConversationId(conv.id);
    }

    try {
      const messageCount = await window.chatApi.messages.get(conversationId);
      if (messageCount.length === 0) {
        await updateConversationTitle(conversationId, content.slice(0, 50));
      }
    } catch {
      // Title update is non-critical
    }

    const model = displayModelName();
    onSend(content, activeProvider, model, conversationId);
  }, [input, activeProvider, activeConversationId, createConversation, setActiveConversationId, updateConversationTitle, displayModelName, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return {
    input, setInput,
    showProviderDropdown, setShowProviderDropdown,
    showModelDropdown, setShowModelDropdown,
    displayModelName, handleModelChange, handleProviderSelect,
    handleSubmit, handleKeyDown, availableModels,
  };
}
