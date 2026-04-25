import { useApp } from '../../context/AppContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyButton } from './CopyButton';

export function CodeBlock({
  language,
  code,
}: {
  language?: string;
  code: string;
}) {
  const { theme: appTheme } = useApp();
  const baseTheme = appTheme === 'light' ? oneLight : oneDark;

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
