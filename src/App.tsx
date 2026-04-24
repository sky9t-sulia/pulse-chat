import { useRef, useEffect, useCallback } from 'react';
import { useApp } from './context/AppContext';
import { useChat } from './context/useChat';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import type { Provider } from './types';

function ChatContainer() {
  const { streamingContent, streamingReasoningContent, isStreaming, loadingPhase, tokenStats, scrollRef, scrollContainerRef, send, stop, resendMessage, regenerateMessage } = useChat();
  const { activeProvider, activeModel, deleteMessage } = useApp();
  const sendRef = useRef(send);

  const handleResendMessage = useCallback(
    (id: string) => {
      if (!activeProvider) return;
      resendMessage(id, activeProvider, activeModel || activeProvider.default_model);
    },
    [activeProvider, activeModel, resendMessage]
  );
  const handleRegenerateMessage = useCallback(
    (id: string) => {
      if (!activeProvider) return;
      regenerateMessage(id, activeProvider, activeModel || activeProvider.default_model);
    },
    [activeProvider, activeModel, regenerateMessage]
  );
  const handleDeleteMessage = useCallback(
    (id: string) => {
      deleteMessage(id);
    },
    [deleteMessage]
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { content, provider, model, conversationId } = (event as CustomEvent).detail as {
        content: string;
        provider: Provider;
        model?: string;
        conversationId?: string;
      };
      sendRef.current(content, provider, model, conversationId);
    };

    window.addEventListener('chat:send', handler);
    return () => window.removeEventListener('chat:send', handler);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full">
      <ChatArea
        streamingContent={streamingContent}
        streamingReasoningContent={streamingReasoningContent}
        isStreaming={isStreaming}
        loadingPhase={loadingPhase}
        scrollRef={scrollRef}
        scrollContainerRef={scrollContainerRef}
        onResendMessage={activeProvider ? handleResendMessage : undefined}
        onRegenerateMessage={activeProvider ? handleRegenerateMessage : undefined}
        onDeleteMessage={handleDeleteMessage}
      />
      <ChatInput onSend={send} tokenStats={tokenStats} isStreaming={isStreaming} onStop={stop} />
    </div>
  );
}

export default function App() {
  const { activeConversationId, messages } = useApp();
  const firstMessageHandled = useRef(false);

  useEffect(() => {
    if (
      activeConversationId &&
      messages.length === 1 &&
      messages[0]?.role === 'user' &&
      !firstMessageHandled.current
    ) {
      firstMessageHandled.current = true;
      window.chatApi.conversations.updateTitle(
        activeConversationId,
        messages[0].content.slice(0, 50)
      );
    }
  }, [messages, activeConversationId]);

  return (
    <div className="flex h-screen theme-main theme-text-primary">
      <Sidebar />
      <ChatContainer />
    </div>
  );
}
