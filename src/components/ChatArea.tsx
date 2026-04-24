import { memo, useState } from 'react';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChevronDown, ChevronUp, Plus, MessageSquare, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import type { Message } from '../types';
import type { LoadingPhase } from '../context/useChat';

interface Props {
  streamingContent: string;
  streamingReasoningContent: string;
  isStreaming: boolean;
  loadingPhase: LoadingPhase;
  scrollRef: React.Ref<HTMLDivElement>;
  scrollContainerRef: React.Ref<HTMLDivElement>;
  onResendMessage?: (id: string) => void;
  onRegenerateMessage?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="copy-button"
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CodeBlock({
  language,
  code,
}: {
  language?: string;
  code: string;
}) {
  const { theme: appTheme } = useApp();
  const baseTheme = appTheme === 'light' ? oneLight : oneDark;

  // Strip the theme's hardcoded background so CSS handles it
  const strippedTheme = { ...baseTheme };
  for (const key of Object.keys(strippedTheme)) {
    if (typeof strippedTheme[key] === 'object' && strippedTheme[key] !== null && 'background' in strippedTheme[key]) {
      strippedTheme[key] = { ...strippedTheme[key], background: undefined };
    }
  }

  return (
    <div className="code-block-wrapper my-4 rounded-lg border theme-border overflow-hidden">
      <div className="code-block-header">
        <span>{language || 'text'}</span>
        <CopyButton code={code} />
      </div>
      <SyntaxHighlighter
        style={strippedTheme}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          padding: '12px 16px',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children, ...props }) {
          const lang = className?.replace(/^language-/, '') || '';
          const codeStr = String(children).replace(/\n$/, '');

          if (!lang) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          return <CodeBlock language={lang} code={codeStr} />;
        },
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead>{children}</thead>;
        },
        th({ children, ...props }) {
          return (
            <th
              className="border-b theme-border px-4 py-2 text-left font-semibold"
              {...props}
            >
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td
              className="border-b theme-border px-4 py-2"
              {...props}
            >
              {children}
            </td>
          );
        },
        tr({ children, ...props }) {
          return <tr {...props}>{children}</tr>;
        },
        h1({ children, ...props }) {
          return (
            <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b theme-border" {...props}>
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2 className="text-xl font-semibold mt-5 mb-2 pb-1.5 border-b theme-border" {...props}>
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3 className="text-lg font-semibold mt-4 mb-1.5" {...props}>
              {children}
            </h3>
          );
        },
        h4({ children, ...props }) {
          return (
            <h4 className="text-base font-semibold mt-3 mb-1" {...props}>
              {children}
            </h4>
          );
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="blockquote-content pl-4 my-4 theme-text-secondary italic"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        ul({ children, ...props }) {
          return (
            <ul className="list-disc pl-6 my-3 space-y-1" {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-6 my-3 space-y-1" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return <li className="pl-1" {...props}>{children}</li>;
        },
        hr({ ...props }) {
          return <hr className="my-6 border-t theme-border" {...props} />;
        },
        strong({ children, ...props }) {
          return <strong className="font-semibold" {...props}>{children}</strong>;
        },
        a({ children, ...props }) {
          return (
            <a
              className="text-blue-400 hover:text-blue-300 underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          );
        },
        img({ ...props }) {
          return (
            <img
              className="max-w-full rounded-lg my-4 shadow-sm"
              {...props}
            />
          );
        },
        del({ children, ...props }) {
          return <del className="line-through theme-text-muted" {...props}>{children}</del>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="text-xs theme-text-muted">Reasoning</span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 theme-text-muted" />
          : <ChevronDown className="w-3.5 h-3.5 theme-text-muted" />}
      </button>
      {expanded && (
        <div className="mt-2 px-4 py-3 text-sm theme-text whitespace-pre-wrap border theme-border rounded-lg max-h-[400px] overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  disabled,
  onResend,
  onRegenerate,
  onDelete,
}: {
  message: Message;
  disabled?: boolean;
  onResend?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`group flex flex-col w-full min-w-0 ${isUser ? 'items-end' : 'items-start'} mb-6`}>
      <div
        className={`chat-content max-w-full min-w-0 ${
          isUser
            ? 'theme-input px-4 py-2.5 rounded-2xl rounded-br-md'
            : 'w-full'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.reasoning && <ReasoningBlock reasoning={message.reasoning} />}
            <MessageContent content={message.content} />
          </>
        )}
      </div>

      <div className="mt-1 h-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isUser && onResend && (
          <button
            type="button"
            onClick={() => onResend(message.id)}
            disabled={disabled}
            title="Resend"
            className="p-1 rounded theme-text-muted hover-theme-text-primary hover:theme-sidebar-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {!isUser && onRegenerate && (
          <button
            type="button"
            onClick={() => onRegenerate(message.id)}
            disabled={disabled}
            title="Regenerate"
            className="p-1 rounded theme-text-muted hover-theme-text-primary hover:theme-sidebar-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            disabled={disabled}
            title="Delete"
            className="p-1 rounded theme-text-muted hover:text-red-400 hover:theme-sidebar-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {!isUser && message.output_tokens && message.duration_ms ? (
          <span
            className="ml-1 text-[10px] font-mono theme-text-muted"
            title={`${message.output_tokens} tokens in ${(message.duration_ms / 1000).toFixed(2)}s`}
          >
            {(message.output_tokens / (message.duration_ms / 1000)).toFixed(1)} tok/s
          </span>
        ) : null}
      </div>
    </div>
  );
});

function LoadingIndicator({
  phase,
  reasoning,
}: {
  phase: LoadingPhase;
  reasoning?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const labels: Record<string, string> = {
    waiting: 'Thinking',
  };

  const phaseLabel = labels[phase.kind] || 'Thinking';

  const hasReasoning = !!reasoning;
  const Wrapper: React.ElementType = hasReasoning ? 'button' : 'div';

  return (
    <div className="mb-6">
      <Wrapper
        type={hasReasoning ? 'button' : undefined}
        onClick={hasReasoning ? () => setExpanded((v) => !v) : undefined}
        className={`flex items-center gap-3 ${
          hasReasoning ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-current theme-text-secondary thinking-dot" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-current theme-text-secondary thinking-dot" style={{ animationDelay: '160ms' }} />
          <span className="w-2 h-2 rounded-full bg-current theme-text-secondary thinking-dot" style={{ animationDelay: '320ms' }} />
        </div>
        <span className="text-xs theme-text-muted">
          {phaseLabel}
        </span>
        {hasReasoning && (
          expanded
            ? <ChevronUp className="w-3.5 h-3.5 theme-text-muted" />
            : <ChevronDown className="w-3.5 h-3.5 theme-text-muted" />
        )}
      </Wrapper>
      {hasReasoning && expanded && (
        <div className="mt-2 px-4 py-3 text-sm theme-text whitespace-pre-wrap border theme-border rounded-lg max-h-[400px] overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ streamingContent, streamingReasoningContent, isStreaming, loadingPhase, scrollRef, scrollContainerRef, onResendMessage, onRegenerateMessage, onDeleteMessage }: Props) {
  const {
    activeConversationId,
    messages,
    conversations,
    createConversation,
    setActiveConversationId,
    activeProvider,
  } = useApp();
  const showLoading = isStreaming && !streamingContent;

  if (!activeConversationId) {
    const recent = conversations.slice(0, 5);
    const handleNewChat = async () => {
      const conv = await createConversation('New Chat');
      setActiveConversationId(conv.id);
    };

    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <h1 className="text-3xl font-semibold theme-text-heading mb-2 text-center">
            What can I help with?
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 theme-input border theme-border-light rounded-xl theme-text-primary hover-theme-sidebar-hover transition-all text-sm mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Start a new chat
          </button>

          {recent.length > 0 && (
            <div>
              <h3 className="text-xs theme-text-muted mb-2 px-1 uppercase tracking-wide">Recent</h3>
              <div className="space-y-1">
                {recent.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg theme-text-primary hover-theme-sidebar-hover transition-all text-left"
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0 theme-text-secondary" />
                    <span className="flex-1 text-sm truncate">{conv.title}</span>
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
          <h1 className="text-2xl font-medium theme-text-heading mb-3">
            What can I help with?
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

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

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
