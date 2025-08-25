import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'

function uid(){
  const k='wd_uid'; let v=localStorage.getItem(k);
  if(!v){ v=crypto.randomUUID(); localStorage.setItem(k,v) }
  return v;
}
function apiBase(API) {
  const fromProp = (API || '').trim();
  const fromEnv  = (import.meta?.env?.VITE_API_BASE || '').trim();
  const base = fromProp || fromEnv || 'http://localhost:4000';
  return base.endsWith('/') ? base.slice(0,-1) : base;
}

/* ---------- code-focused markdown ---------- */
function renderMessage(text) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0; let m;
  while ((m = regex.exec(text)) !== null) {
    const [full, lang = '', code] = m;
    if (m.index > lastIndex) blocks.push({ type: 'text', content: text.slice(lastIndex, m.index) });
    blocks.push({ type: 'code', lang: lang.toLowerCase(), content: code.replace(/\s+$/,'') });
    lastIndex = m.index + full.length;
  }
  if (lastIndex < text.length) blocks.push({ type: 'text', content: text.slice(lastIndex) });

  const parts = [];
  for (const b of blocks) {
    if (b.type === 'code') { parts.push(b); continue; }
    const r2 = /`([^`]+)`/g; let li = 0, mm;
    while ((mm = r2.exec(b.content)) !== null) {
      if (mm.index > li) parts.push({ type:'text', content: b.content.slice(li, mm.index) });
      parts.push({ type:'inline', content: mm[1] });
      li = mm.index + mm[0].length;
    }
    if (li < b.content.length) parts.push({ type: 'text', content: b.content.slice(li) });
  }
  return parts;
}

const CodeBlock = memo(function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  async function copy(){ try{ await navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false), 1200);}catch{} }
  return (
    <div className="relative">
      <pre className="text-xs sm:text-sm whitespace-pre overflow-x-auto rounded-xl p-3 border
                      border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900
                      text-gray-900 dark:text-gray-100">
        <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{lang || 'code'}</div>
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded-md border
                   border-gray-300 dark:border-gray-600 bg-white/90 dark:bg-gray-800/90
                   hover:bg-white dark:hover:bg-gray-800"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ role, content }) {
  const chunks = renderMessage(content || '');
  const isUser = role === 'user';
  return (
    <div className={isUser ? 'text-right' : 'text-left'}>
      <div className={`inline-block max-w-[92%] px-3 py-2 rounded-2xl text-sm align-top
        ${isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-50 border border-gray-200 text-gray-900 ' +
            'dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100'}`}>
        {chunks.map((c, i) => {
          if (c.type === 'code')   return <div key={i} className="my-2"><CodeBlock code={c.content} lang={c.lang} /></div>;
          if (c.type === 'inline') return <code key={i} className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs">{c.content}</code>;
          return <span key={i}>{c.content}</span>;
        })}
      </div>
    </div>
  );
});

const MessagesList = memo(function MessagesList({ msgs }) {
  const listRef = useRef(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [msgs.length]);
  // IMPORTANT: h-full (not flex-1) because parent gives the height
  return (
    <div ref={listRef} className="h-full overflow-y-auto p-3 space-y-2">
      {msgs.map((m,i)=> <MessageBubble key={i} role={m.role} content={m.content} />)}
      {msgs.length===0 && (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          You can ask general questions or manage your cities. Try “What’s AI?” or “Add Ranchi”.
        </div>
      )}
    </div>
  );
});

const InputBar = memo(function InputBar({ value, onChange, onSubmit, busy }) {
  const inputRef = useRef(null);
  const composingRef = useRef(false);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const handleSubmit = useCallback((e)=>{
    e.preventDefault();
    if (composingRef.current) return;
    onSubmit();
    requestAnimationFrame(()=> inputRef.current?.focus());
  }, [onSubmit]);
  return (
    <form className="p-3 border-t border-gray-200 dark:border-gray-700" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700
                     text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder="Ask me anything…"
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          autoComplete="off" inputMode="text" spellCheck={false}
          onCompositionStart={()=>{composingRef.current = true}}
          onCompositionEnd={()=>{composingRef.current = false}}
        />
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
    </form>
  );
});

/* ---------- main ---------- */

export default function ChatDock({ API }){
  const BASE = apiBase(API);

  const [size, setSize] = useState('half');   // 'min' | 'half' | 'full'
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('menu');   // 'menu' | 'chat' | 'add' | 'delete'
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(localStorage.getItem('wd_chat') || '[]') } catch { return [] }});
  const [city, setCity] = useState(''); const [stateName, setStateName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const userId = useMemo(()=> uid(), []);

  useEffect(() => { localStorage.setItem('wd_chat', JSON.stringify(msgs.slice(-20))) }, [msgs.length]);

  const sendToAI = useCallback(async (history) => {
    setBusy(true); setError('');
    try{
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId, messages: history })
      });
      const text = await res.text();
      let data; try { data = JSON.parse(text) } catch { data = { reply: text } }
      if (!res.ok) {
        const msg = data?.error || `Error ${res.status}`;
        setMsgs(prev => [...prev, { role:'assistant', content: msg }]); setError(msg);
      } else {
        setMsgs(prev => [...prev, { role:'assistant', content: data?.reply || 'Okay.' }]);
      }
    } catch(e) {
      const msg = e?.message || 'Network error';
      setMsgs(prev => [...prev, { role:'assistant', content: msg }]); setError(msg);
    } finally { setBusy(false); }
  }, [BASE, userId]);

  const submitFreeText = useCallback(async () => {
    setMode('chat');
    const text = input.trim(); if(!text) return;
    setInput(''); const next = [...msgs, { role:'user', content:text }];
    setMsgs(next); await sendToAI(next);
  }, [input, msgs, sendToAI]);

  async function submitAdd(){
    if(!city.trim()) return;
    const q = stateName ? `${city}, ${stateName}` : city;
    const userText = `Add city: ${q} (default country India if not specified)`;
    const next = [...msgs, { role:'user', content: userText }];
    setMsgs(next); setMode('chat'); await sendToAI(next);
  }
  async function submitDelete(){
    if(!city.trim()) return;
    const q = stateName ? `${city}, ${stateName}` : city;
    const userText = `Delete city: ${q} (default country India if not specified)`;
    const next = [...msgs, { role:'user', content: userText }];
    setMsgs(next); setMode('chat'); await sendToAI(next);
  }

  function Header(){
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b
                      bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <div className="font-semibold text-gray-900 dark:text-gray-100">Assistant</div>
        <div className="flex gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <button
              className={`text-xs px-2 py-1 rounded-md border ${size==='min' ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
              onClick={()=>setSize('min')}>Min</button>
            <button
              className={`text-xs px-2 py-1 rounded-md border ${size==='half' ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
              onClick={()=>setSize('half')}>Half</button>
            <button
              className={`text-xs px-2 py-1 rounded-md border ${size==='full' ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800`}
              onClick={()=>setSize('full')}>Full</button>
          </div>
          <button
            className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100
                       dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            onClick={()=>{ localStorage.removeItem('wd_chat'); setMsgs([]); }}
          >Reset</button>
          {mode !== 'menu' && (
            <button className="text-xs text-gray-700 hover:underline dark:text-gray-300" onClick={()=>setMode('menu')}>Menu</button>
          )}
          <button className="text-sm text-gray-700 hover:underline dark:text-gray-300" onClick={()=>setOpen(false)}>Close</button>
        </div>
      </div>
    );
  }

  function Menu(){
    return (
      <div className={`p-4 space-y-3 ${mode==='menu' ? 'block' : 'hidden'}`}>
        <div className="text-sm text-gray-800 dark:text-gray-200">What do you want to do?</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={()=>setMode('add')}>➕ Add City</button>
          <button type="button" className="btn" onClick={()=>setMode('delete')}>🗑️ Delete City</button>
          <button type="button" className="btn" onClick={()=>setMode('chat')}>💬 Ask other question</button>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">Tip: For add/delete, just enter City and State. Country defaults to India.</div>
      </div>
    );
  }

  function AddForm(){
    const cityRef = useRef(null); const composingRef = useRef(false);
    useEffect(() => { if (open && size!=='min' && mode==='add') cityRef.current?.focus(); }, [open, size, mode]);
    return (
      <div className={`p-4 space-y-3 ${mode==='add' && size!=='min' ? 'block' : 'hidden'}`}>
        <div className="text-sm text-gray-800 dark:text-gray-200">Add a city</div>
        <div className="flex gap-2">
          <input ref={cityRef} className="flex-1 rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="City (e.g., Ranchi)" value={city} onChange={e=>setCity(e.target.value)}
            autoComplete="off" inputMode="text" spellCheck={false}
            onCompositionStart={()=>{composingRef.current = true}} onCompositionEnd={()=>{composingRef.current = false}} />
          <input className="flex-1 rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="State (optional)" value={stateName} onChange={e=>setStateName(e.target.value)}
            autoComplete="off" inputMode="text" spellCheck={false} />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={async ()=>{ if(!composingRef.current) await submitAdd() }}>Add</button>
          <button type="button" className="btn" onClick={()=>setMode('menu')}>Back</button>
        </div>
      </div>
    );
  }

  function DeleteForm(){
    const cityRef = useRef(null); const composingRef = useRef(false);
    useEffect(() => { if (open && size!=='min' && mode==='delete') cityRef.current?.focus(); }, [open, size, mode]);
    return (
      <div className={`p-4 space-y-3 ${mode==='delete' && size!=='min' ? 'block' : 'hidden'}`}>
        <div className="text-sm text-gray-800 dark:text-gray-200">Delete a city</div>
        <div className="flex gap-2">
          <input ref={cityRef} className="flex-1 rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="City (e.g., Ranchi)" value={city} onChange={e=>setCity(e.target.value)}
            autoComplete="off" inputMode="text" spellCheck={false}
            onCompositionStart={()=>{composingRef.current = true}} onCompositionEnd={()=>{composingRef.current = false}} />
          <input className="flex-1 rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="State (optional)" value={stateName} onChange={e=>setStateName(e.target.value)}
            autoComplete="off" inputMode="text" spellCheck={false} />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={async ()=>{ if(!composingRef.current) await submitDelete() }}>Delete</button>
          <button type="button" className="btn" onClick={()=>setMode('menu')}>Back</button>
        </div>
      </div>
    );
  }

  function ChatArea(){
    // NOTE: wrapper uses flex-1 min-h-0 so inner list can scroll; input stays pinned
    return (
      <div className={`${mode==='chat' && size!=='min' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
        {!!error && <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-t border-red-200">{error}</div>}
        <div className="flex-1 min-h-0">
          <MessagesList msgs={msgs} />
        </div>
        <InputBar value={input} onChange={setInput} onSubmit={submitFreeText} busy={busy} />
      </div>
    );
  }

  /* ---- Panels with overflow-hidden and min-h-0 content ---- */

  function Panel(){
    if (size === 'half') {
      return (
        <div className="w-[min(92vw,760px)] h-[80vh] sm:h-[78vh] flex flex-col rounded-2xl shadow-2xl
                        border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <Header />
          <div className="flex-1 min-h-0">
            <Menu />
            <AddForm />
            <DeleteForm />
            <ChatArea />
          </div>
        </div>
      );
    }
    if (size === 'full') {
      return (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-[min(100vw,1100px)] h-[min(100vh,92vh)] flex flex-col rounded-2xl shadow-2xl
                            border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <Header />
              <div className="flex-1 min-h-0">
                <Menu />
                <AddForm />
                <DeleteForm />
                <ChatArea />
              </div>
            </div>
          </div>
        </div>
      );
    }
    // min pill
    return (
      <div className="w-[280px] sm:w-[320px] rounded-full shadow-lg border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900 px-3 py-2 flex items-center justify-between">
        <div className="text-xs font-medium text-gray-900 dark:text-gray-100">Assistant (min)</div>
        <div className="flex items-center gap-2">
          <button className="text-xs underline text-gray-700 dark:text-gray-300" onClick={()=>{ setSize('half'); setMode('menu'); }}>Half</button>
          <button className="text-xs underline text-gray-700 dark:text-gray-300" onClick={()=>{ setSize('full'); setMode('chat'); }}>Full</button>
          <button className="text-xs underline text-gray-700 dark:text-gray-300" onClick={()=>setOpen(false)}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open ? (
        <Panel />
      ) : (
        <button
          type="button"
          className="btn rounded-full shadow-xl px-4 py-3"
          onClick={()=>{ setOpen(true); setSize('half'); }}
          title="Open Assistant"
        >
          🤖 Chat
        </button>
      )}
    </div>
  )
}
