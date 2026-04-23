import { useRef, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { useChat } from './context/useChat';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import type { Provider } from './types';

function ChatContainer() {
  const { streamingContent, isStreaming, scrollRef, send, stop } = useChat();
  const sendRef = useRef(send);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { content, provider } = (event as CustomEvent).detail as {
        content: string;
        provider: Provider;
      };
      sendRef.current(content, provider);
    };

    window.addEventListener('chat:send', handler);
    return () => window.removeEventListener('chat:send', handler);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full">
      <ChatArea
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        onStop={stop}
        scrollRef={scrollRef}
      />
      <ChatInput onSend={send} />
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
    <div className="flex h-screen bg-main text-gray-100">
      <Sidebar />
      <ChatContainer />
    </div>
  );
}
