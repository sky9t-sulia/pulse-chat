import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';

const markdownComponents: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }: any) => {
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
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children, ...props }: any) => (
    <th
      className="border-b theme-border px-4 py-2 text-left font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td
      className="border-b theme-border px-4 py-2"
      {...props}
    >
      {children}
    </td>
  ),
  tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  h1: ({ children, ...props }: any) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b theme-border" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-xl font-semibold mt-5 mb-2 pb-1.5 border-b theme-border" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-lg font-semibold mt-4 mb-1.5" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: any) => (
    <h4 className="text-base font-semibold mt-3 mb-1" {...props}>
      {children}
    </h4>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote
      className="blockquote-content pl-4 my-4 theme-text-secondary italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc pl-6 my-3 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal pl-6 my-3 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => <li className="pl-1" {...props}>{children}</li>,
  hr: ({ ...props }: any) => <hr className="my-6 border-t theme-border" {...props} />,
  strong: ({ children, ...props }: any) => <strong className="font-semibold" {...props}>{children}</strong>,
  a: ({ children, ...props }: any) => (
    <a
      className="text-blue-400 hover:text-blue-300 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  img: ({ ...props }: any) => (
    <img
      className="max-w-full rounded-lg my-4 shadow-sm"
      {...props}
    />
  ),
  del: ({ children, ...props }: any) => <del className="line-through theme-text-muted" {...props}>{children}</del>,
};

export function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
