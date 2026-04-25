import { useState } from 'react';

export function CopyButton({ code }: { code: string }) {
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
