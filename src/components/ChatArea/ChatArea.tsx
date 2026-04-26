import { useApp } from '../../context/AppContext';
import type { LoadingPhase } from '../../hooks/useChat';
import { Plus, MessageSquare } from 'lucide-react';
import { MessageBubble, ToolInvocationRow } from './MessageBubble';
import { MessageContent } from './MessageContent';
import { LoadingIndicator } from './LoadingIndicator';
import { ReasoningBlock } from './ReasoningBlock';

export interface ChatAreaProps {
  streamingContent: string;
  streamingReasoningContent: string;
  isStreaming: boolean;
  loadingPhase: LoadingPhase;
  toolInvocations: import('../../hooks/useChat').ToolInvocation[];
  scrollRef: React.Ref<HTMLDivElement>;
  scrollContainerRef: React.Ref<HTMLDivElement>;
  onResendMessage?: (id: string) => void;
  onRegenerateMessage?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
}

export default function ChatArea({ streamingContent, streamingReasoningContent, isStreaming, loadingPhase, toolInvocations, scrollRef, scrollContainerRef, onResendMessage, onRegenerateMessage, onDeleteMessage }: ChatAreaProps) {
  const {
    activeConversationId,
    messages,
    conversations,
    createConversation,
    setActiveConversationId,
    activeProvider,
    userSettings,
  } = useApp();
  const showLoading = isStreaming && !streamingContent;

  function getGreeting() {
    const hour = new Date().getHours();
    let timeGreeting: string;
    if (hour < 6) timeGreeting = 'Good night';
    else if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    if (userSettings.name) {
      return `${timeGreeting}, ${userSettings.name}!`;
    }
    return timeGreeting;
  }

  if (!activeConversationId) {
    const recent = conversations.slice(0, 5);
    const handleNewChat = async () => {
      const conv = await createConversation('New Chat');
      setActiveConversationId(conv.id);
    };

    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <h1 className="text-3xl font-semibold theme-text-heading mb-2 text-center font-serif">
            {getGreeting()}
          </h1>
          <p className="text-sm theme-text-muted text-center mb-8">
            {activeProvider ? (
              <>Using <span className="theme-text-secondary">{activeProvider.name}</span></>
            ) : (
              'Configure a provider in Settings to get started.'
            )}
          </p>

          <button
            onClick={handleNewChat}
            disabled={!activeProvider}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border theme-border-light rounded-xl theme-text-primary hover-theme-sidebar-hover transition-all text-sm mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Start a new chat
          </button>

          {recent.length > 0 && (
            <div>
              <h3 className="text-xs theme-text-muted mb-2 px-1 uppercase tracking-wide">Recent</h3>
              <div className="space-y-1">
                {recent.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setActiveConversationId(conversation.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg theme-text-primary hover-theme-sidebar-hover transition-all text-left"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 theme-text-secondary" />
                    <span className="flex-1 text-sm truncate">{conversation.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !streamingContent && !showLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-medium theme-text-heading mb-3 font-serif">
            {getGreeting()}
          </h1>
          <p className="text-sm theme-text-muted">
            Start a conversation by typing a message below.
          </p>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && showLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingIndicator phase={loadingPhase} />
      </div>
    );
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative">
      {activeConversation && (
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <div className="px-6 py-3 theme-main pointer-events-auto">
            <h2 className="text-sm font-base-bold theme-text-primary truncate max-w-3xl" title={activeConversation.title}>
              {activeConversation.title}
            </h2>
          </div>
          <div
            className="h-7"
            style={{
              background: 'linear-gradient(to bottom, var(--bg-main), transparent)',
            }}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto scroll-smooth min-h-0" ref={scrollContainerRef}>
        <div className={`max-w-3xl mx-auto px-8 ${activeConversation ? 'pt-20' : 'pt-8'}`}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              disabled={isStreaming}
              onResend={onResendMessage}
              onRegenerate={onRegenerateMessage}
              onDelete={onDeleteMessage}
            />
          ))}

          {toolInvocations.length > 0 && (
            <div className="mb-4">
              {toolInvocations.map((inv) => (
                <ToolInvocationRow key={inv.id} inv={inv} />
              ))}
            </div>
          )}

          {streamingContent && (
            <div className="flex justify-start mb-4">
              <div className="chat-content max-w-[85%] w-full">
                {streamingReasoningContent && (
                  <ReasoningBlock reasoning={streamingReasoningContent} />
                )}
                <MessageContent content={streamingContent} />
              </div>
            </div>
          )}

          {showLoading && (
            <LoadingIndicator
              phase={loadingPhase}
              reasoning={streamingReasoningContent || undefined}
            />
          )}

          <div ref={scrollRef} />
        </div>
      </div>
    </div>
  );
}
