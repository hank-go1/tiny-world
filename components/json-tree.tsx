'use client';

import { memo, useMemo, useRef } from 'react';

function JsonField({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const compound = value !== null && typeof value === 'object';
  const entries = compound ? Object.entries(value) : [];
  const array = Array.isArray(value);
  const key = name === undefined ? null : <><span className="json-key">{JSON.stringify(name)}</span><span>: </span></>;
  if (!entries.length) return <div className="json-leaf">{key}<span className="json-value" data-type={value === null ? 'null' : typeof value}>{JSON.stringify(value)}</span></div>;
  const preview = compound && !array ? 'name' in value ? value.name : 'id' in value ? value.id : null : null;
  return <details className="json-branch" open={depth === 0 || depth === 1 && name === 'input'}>
    <summary>{key}<span className="json-bracket">{array ? '[' : '{'}</span><span className="json-count">{entries.length} {array ? 'items' : 'fields'}</span>{typeof preview === 'string' && <span className="json-preview">{preview}</span>}<span className="json-bracket">{array ? ']' : '}'}</span></summary>
    <div className="json-children">{entries.map(([field, child]) => <JsonField key={field} name={field} value={child} depth={depth + 1}/>)}</div>
  </details>;
}

export const JsonTree = memo(function JsonTree({ text, label }: { text: string; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => {
    try { return { valid: true, value: JSON.parse(text) as unknown }; }
    catch { return { valid: false, value: null }; }
  }, [text]);
  if (!parsed.valid) return <pre tabIndex={0} aria-label={label}><code>{text}</code></pre>;
  function setExpanded(expanded: boolean) { root.current?.querySelectorAll('details').forEach(details => { details.open = expanded; }); }
  return <div className="json-viewer" role="region" aria-label={label}>
    <div className="json-tools"><button type="button" onClick={() => setExpanded(true)}>Expand all</button><button type="button" onClick={() => setExpanded(false)}>Collapse all</button></div>
    <div ref={root} className="json-tree" tabIndex={0}><JsonField value={parsed.value} depth={0}/></div>
  </div>;
});
