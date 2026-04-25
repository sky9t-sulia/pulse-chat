// Think-tag delimiters — stored as char arrays to avoid backtick parsing issues.
const THINK_OPEN = ['<', 't', 'h', 'i', 'n', 'k', '>'];
const THINK_CLOSE = ['<', '/', 't', 'h', 'i', 'n', 'k', '>'];

export function buildThinkBuffer() {
  let buffer = '';
  let inside = false;

  const route = (chunk: string, onContent: (text: string) => void, onReasoning: (text: string) => void) => {
    buffer += chunk;
    while (buffer.length > 0) {
      if (inside) {
        const close = buffer.indexOf(THINK_CLOSE.join(''));
        if (close === -1) {
          const safe = buffer.length > 7 ? buffer.slice(0, -7) : '';
          if (safe) { onReasoning(safe); buffer = buffer.slice(safe.length); }
          break;
        }
        onReasoning(buffer.slice(0, close));
        buffer = buffer.slice(close + THINK_CLOSE.length);
        inside = false;
      } else {
        const open = buffer.indexOf(THINK_OPEN.join(''));
        if (open === -1) {
          const safe = buffer.length > 6 ? buffer.slice(0, -6) : '';
          if (safe) { onContent(safe); buffer = buffer.slice(safe.length); }
          break;
        }
        onContent(buffer.slice(0, open));
        buffer = buffer.slice(open + THINK_OPEN.length);
        inside = true;
      }
    }
  };

  const flush = (onContent: (text: string) => void, onReasoning: (text: string) => void) => {
    if (buffer.length > 0) {
      if (inside) {
        onReasoning(buffer);
      } else {
        onContent(buffer);
      }
    }
    buffer = '';
  };

  return { route, flush };
}
