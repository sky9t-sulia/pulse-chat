import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { StopCircle } from 'lucide-react';
import type { Message } from '../types';

interface Props {
  streamingContent: string;
  isStreaming: boolean;
  onStop: () => void;
  scrollRef: React.Ref<HTMLDivElement>;
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
  const theme = document.documentElement.classList.contains('light') ? oneLight : oneDark;

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language || 'text'}</span>
        <CopyButton code={code} />
      </div>
      <SyntaxHighlighter
        style={theme}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          padding: '12px 16px',
          background: 'transparent',
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div
        className={`chat-content chat-text max-w-[85%] ${
          isUser
            ? 'bg-input text-gray-100 px-4 py-2.5 rounded-2xl rounded-br-md'
            : 'text-gray-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MessageContent content={message.content} />
        )}
      </div>
    </div>
  );
}

export default function ChatArea({ streamingContent, isStreaming, onStop, scrollRef }: Props) {
  const { activeConversationId, messages } = useApp();

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sidebar-active flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-400 mb-2">Welcome to Chat</h2>
          <p className="text-sm text-gray-600">
            Select or create a conversation to get started
          </p>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-medium text-gray-200 mb-3">
            What can I help with?
          </h1>
          <p className="text-sm text-gray-500">
            Start a conversation by typing a message below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-20 py-6">
        <div className="max-w-chat-max mx-auto">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streamingContent && (
            <div className="flex justify-start mb-6">
              <div className="chat-content chat-text text-gray-100 max-w-[85%]">
                <MessageContent content={streamingContent} />
                <span className="typing-cursor inline-block w-2 h-4 bg-gray-400 ml-0.5 align-middle" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {isStreaming && (
        <div className="flex justify-center pb-2">
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-sidebar-hover border border-border rounded-full transition-all"
          >
            <StopCircle className="w-3.5 h-3.5" />
            Stop generating
          </button>
        </div>
      )}
    </div>
  );
}
