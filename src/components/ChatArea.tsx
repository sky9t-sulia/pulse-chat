import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { StopCircle, Loader2, ChevronDown, ChevronUp, Plus, MessageSquare, RotateCcw } from 'lucide-react';
import type { Message } from '../types';
import type { LoadingPhase } from '../context/useChat';

interface Props {
  streamingContent: string;
  streamingReasoningContent: string;
  isStreaming: boolean;
  loadingPhase: LoadingPhase;
  onStop: () => void;
  scrollRef: React.Ref<HTMLDivElement>;
  onRegenerate?: () => void;
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
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');

          if (!match) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          return <CodeBlock language={match[1]} code={codeStr} />;
        },
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border theme-border text-sm">
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
              className="border theme-border px-4 py-2 text-left font-semibold"
              {...props}
            >
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td
              className="border theme-border px-4 py-2"
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

function ReasoningBlock({
  reasoning,
  isStreaming,
}: {
  reasoning: string;
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2 rounded-lg border theme-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm theme-text-secondary hover-theme-text-primary theme-sidebar-hover transition-all"
      >
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
        <span className="font-medium">Reasoning{isStreaming ? ' (streaming…)' : ''}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 text-sm theme-text whitespace-pre-wrap border-t theme-border pt-3 max-h-[400px] overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div
        className={`chat-content ${
          isUser
            ? 'theme-input px-4 py-2.5 rounded-2xl rounded-br-md'
            : ''
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
    </div>
  );
}

function LoadingIndicator({ phase }: { phase: LoadingPhase }) {
  const messages: Record<string, string> = {
    model_load: 'Loading model...',
    prompt_processing: 'Processing prompt...',
  };

  const phaseLabel = messages[phase.kind] || '';
  const progress = phase.kind === 'model_load' || phase.kind === 'prompt_processing'
    ? Math.round((phase.progress ?? 0) * 100)
    : undefined;

  return (
    <div className="flex justify-center items-center gap-2 py-4">
      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      <span className="text-xs theme-text-muted">
        {phaseLabel}
        {progress !== undefined && ` ${progress}%`}
      </span>
    </div>
  );
}

export default function ChatArea({ streamingContent, streamingReasoningContent, isStreaming, loadingPhase, onStop, scrollRef, onRegenerate }: Props) {
  const {
    activeConversationId,
    messages,
    conversations,
    createConversation,
    setActiveConversationId,
    activeProvider,
  } = useApp();
  const showLoading = isStreaming && loadingPhase.kind !== 'idle' && loadingPhase.kind !== 'streaming';

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

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto scroll-smooth min-h-0">
        <div className="max-w-3xl mx-auto px-8">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {!isStreaming &&
            onRegenerate &&
            messages.length > 0 &&
            messages[messages.length - 1].role === 'assistant' && (
              <div className="flex justify-start mb-6 -mt-4">
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs theme-text-secondary hover-theme-text-primary theme-sidebar-hover border theme-border rounded-full transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              </div>
            )}

          {streamingReasoningContent && (
            <div className="flex justify-start mb-0">
              <div className="chat-content max-w-[85%]">
                <ReasoningBlock reasoning={streamingReasoningContent} isStreaming />
              </div>
            </div>
          )}

          {streamingContent && (
            <div className="flex justify-start mb-4">
              <div className="chat-content max-w-[85%]">
                <MessageContent content={streamingContent} />
              </div>
            </div>
          )}

          {showLoading && <LoadingIndicator phase={loadingPhase} />}

          <div ref={scrollRef} />
        </div>
      </div>

      {isStreaming && (
        <div className="flex justify-center pb-2">
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs theme-text-secondary hover-theme-text-primary theme-sidebar-hover border theme-border rounded-full transition-all"
          >
            <StopCircle className="w-3.5 h-3.5" />
            Stop generating
          </button>
        </div>
      )}
    </div>
  );
}
