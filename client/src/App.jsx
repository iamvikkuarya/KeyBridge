import React, { useMemo, useRef, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function defaultSettings() {
  return { providers: {}, enabled: { openai: false, anthropic: false, google: false, xai: false, openrouter: false } }
}

function loadSettings() {
  try {
const raw = localStorage.getItem('keybridge_settings')
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw)
    // Ensure new provider keys exist
    parsed.enabled = { ...defaultSettings().enabled, ...(parsed.enabled || {}) }
    parsed.providers = { ...(parsed.providers || {}) }
    return parsed
  } catch {
    return defaultSettings()
  }
}

function saveSettings(s) {
localStorage.setItem('keybridge_settings', JSON.stringify(s))
}

function ProviderSwitch({ id, label, enabled, onToggle }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!enabled} onChange={e => onToggle(id, e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function Settings({ open, onClose, settings, setSettings }) {
  const [local, setLocal] = useState(settings)
  const [status, setStatus] = useState({ openai: 'idle', anthropic: 'idle', google: 'idle', xai: 'idle', openrouter: 'idle' })
  const [statusMsg, setStatusMsg] = useState({})
  const timersRef = useRef({})

  const StatusDot = ({ state = 'idle', title = '' }) => {
    let color = '#444'
    if (state === 'checking') color = '#e6c229' // yellow
    else if (state === 'ok') color = '#52c41a' // green
    else if (state === 'error' || state === 'idle') color = '#ff4d4f' // red
    return (
      <span title={title} aria-label={title} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid #2a2a2a' }} />
    )
  }

  const testKey = async (id, key) => {
    if (!key || !key.trim()) {
      setStatus(prev => ({ ...prev, [id]: 'idle' }))
      setStatusMsg(prev => ({ ...prev, [id]: '' }))
      return
    }
    setStatus(prev => ({ ...prev, [id]: 'checking' }))
    setStatusMsg(prev => ({ ...prev, [id]: 'Checking…' }))
    try {
      const res = await fetch(`${API_BASE}/api/check-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id, apiKey: key })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setStatus(prev => ({ ...prev, [id]: 'ok' }))
        setStatusMsg(prev => ({ ...prev, [id]: data.model ? `Model: ${data.model}` : 'Connected' }))
      } else {
        // Fallback for Google keys restricted to HTTP referrers: try browser-side check
        if (id === 'google') {
          try {
            const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
            const gdata = await gr.json().catch(() => ({}))
            if (gr.ok) {
              const models = (gdata?.models || []).map(m => m.name?.split('/').pop()).filter(Boolean)
              const prefer = ['gemini-2.5-pro', 'gemini-2.0-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
              const model = prefer.find(p => models.includes(p)) || models.find(id => /^gemini-/.test(id)) || models[0] || ''
              setStatus(prev => ({ ...prev, [id]: 'ok' }))
              setStatusMsg(prev => ({ ...prev, [id]: model ? `Model: ${model}` : 'Connected' }))
              return
            } else {
              const msg = gdata?.error?.message || data.error || 'Failed to connect'
              setStatus(prev => ({ ...prev, [id]: 'error' }))
              setStatusMsg(prev => ({ ...prev, [id]: msg }))
              return
            }
          } catch (e2) {
            setStatus(prev => ({ ...prev, [id]: 'error' }))
            setStatusMsg(prev => ({ ...prev, [id]: e2.message || data.error || 'Failed to connect' }))
            return
          }
        }
        setStatus(prev => ({ ...prev, [id]: 'error' }))
        setStatusMsg(prev => ({ ...prev, [id]: data.error || `Failed to connect` }))
      }
    } catch (e) {
      setStatus(prev => ({ ...prev, [id]: 'error' }))
      setStatusMsg(prev => ({ ...prev, [id]: e.message || 'Failed to connect' }))
    }
  }

  const scheduleTest = (id, key) => {
    if (timersRef.current[id]) clearTimeout(timersRef.current[id])
    timersRef.current[id] = setTimeout(() => {
      testKey(id, key)
    }, 500)
  }

  const updateProvider = (id, field, value) => {
    setLocal(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [id]: { ...(prev.providers?.[id] || {}), [field]: value }
      }
    }))
    if (field === 'apiKey') {
      scheduleTest(id, value)
    }
  }

  const updateEnabled = (id, value) => {
    setLocal(prev => ({ ...prev, enabled: { ...prev.enabled, [id]: value } }))
  }

  useEffect(() => {
    // On open, kick off checks for any existing keys
    if (open) {
      const p = local.providers || {}
      for (const id of ['openai','anthropic','google','xai','openrouter']) {
        const key = p?.[id]?.apiKey || ''
        if (key) scheduleTest(id, key)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const save = () => {
    const cleaned = {
      ...local,
      providers: Object.fromEntries(
        Object.entries(local.providers || {}).map(([k, v]) => [
          k,
          { apiKey: (v.apiKey || '').trim(), model: (v.model || '').trim() }
        ])
      )
    }
    saveSettings(cleaned)
    setSettings(cleaned)
    onClose()
  }
  if (!open) return null
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="panel modal">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Settings</div>
            <div className="small muted">Enter your API keys. Models are detected automatically from your key.</div>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="divider"></div>
        <div className="settings">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="openai" label="OpenAI (ChatGPT)" enabled={local.enabled?.openai} onToggle={updateEnabled} />
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <StatusDot state={status.openai} title={statusMsg.openai || (status.openai==='ok'?'Connected':'Not connected')} />
            <span className="pill provider-badge">Auto</span>
          </div>
        </div>
        <div className="field">
<input placeholder='OpenAI API Key' value={local.providers?.openai?.apiKey || ''} onChange={e => updateProvider('openai', 'apiKey', e.target.value)} />
          {statusMsg.openai && <span className="small muted">{statusMsg.openai}</span>}
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="anthropic" label="Anthropic (Claude)" enabled={local.enabled?.anthropic} onToggle={updateEnabled} />
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <StatusDot state={status.anthropic} title={statusMsg.anthropic || (status.anthropic==='ok'?'Connected':'Not connected')} />
            <span className="pill provider-badge">Auto</span>
          </div>
        </div>
        <div className="field">
<input placeholder='Anthropic API Key' value={local.providers?.anthropic?.apiKey || ''} onChange={e => updateProvider('anthropic', 'apiKey', e.target.value)} />
          {statusMsg.anthropic && <span className="small muted">{statusMsg.anthropic}</span>}
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="google" label="Google (Gemini)" enabled={local.enabled?.google} onToggle={updateEnabled} />
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <StatusDot state={status.google} title={statusMsg.google || (status.google==='ok'?'Connected':'Not connected')} />
            <span className="pill provider-badge">Auto</span>
          </div>
        </div>
        <div className="field">
<input placeholder='Google API Key' value={local.providers?.google?.apiKey || ''} onChange={e => updateProvider('google', 'apiKey', e.target.value)} />
          {statusMsg.google && <span className="small muted">{statusMsg.google}</span>}
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="xai" label="xAI (Grok)" enabled={local.enabled?.xai} onToggle={updateEnabled} />
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <StatusDot state={status.xai} title={statusMsg.xai || (status.xai==='ok'?'Connected':'Not connected')} />
            <span className="pill provider-badge">Auto</span>
          </div>
        </div>
        <div className="field">
<input placeholder='xAI API Key' value={local.providers?.xai?.apiKey || ''} onChange={e => updateProvider('xai', 'apiKey', e.target.value)} />
          {statusMsg.xai && <span className="small muted">{statusMsg.xai}</span>}
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="openrouter" label="OpenRouter" enabled={local.enabled?.openrouter} onToggle={updateEnabled} />
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <StatusDot state={status.openrouter} title={statusMsg.openrouter || (status.openrouter==='ok'?'Connected':'Not connected')} />
            <span className="pill provider-badge">Auto</span>
          </div>
        </div>
        <div className="field">
<input placeholder='OpenRouter API Key' value={local.providers?.openrouter?.apiKey || ''} onChange={e => updateProvider('openrouter', 'apiKey', e.target.value)} />
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="small muted">Model: {local.providers?.openrouter?.model || 'Select a model'}</span>
            <select
              value={local.providers?.openrouter?.model || ''}
              onChange={e => updateProvider('openrouter', 'model', e.target.value)}
              style={{ appearance: 'none', background: '#1e1e1e', color: '#e6e6e6', border: '1px solid #2a2a2a', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}
            >
              <option value="">Select a model</option>
              <option value="x-ai/grok-4-fast:free">Grok 4 Fast (free)</option>
              <option value="openai/gpt-oss-20b:free">GPT-OSS 20B (free)</option>
            </select>
          </div>
          <span className="small muted">Only these free models are supported for now.</span>
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => { localStorage.removeItem('keybridge_settings'); const cleared = defaultSettings(); setLocal(cleared); setSettings(cleared); }}>Reset</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={save}>Save</button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function copyText(text) {
  try { navigator.clipboard.writeText(text || ''); } catch {}
}

function ProviderCard({ it, onRetry, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const content = it.text || it.error || ''
  const isLong = content.length > 1200
  const shown = expanded || !isLong ? content : content.slice(0, 1200) + '…'

  useEffect(() => {
    // Lazy-highlight code blocks after render
    document.querySelectorAll('pre code').forEach((el) => {
      try { hljs.highlightElement(el) } catch {}
    })
  }, [shown])

  return (
    <div className={`card ${it.ok ? 'provider-ok' : 'provider-error'}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h4>{it.label}</h4>
        <div className="row">
          {it.ok && <button className="btn" onClick={() => copyText(it.text || '')}>Copy</button>}
          <button className="btn" onClick={() => onRetry?.(it)}>Retry</button>
          <button className="btn" onClick={() => onDelete?.(it)}>Delete</button>
        </div>
      </div>
      {it.ok ? (
        <div>
          {it.streaming ? (
            // Simple text display while streaming - no markdown parsing
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {shown || '…'}
            </div>
          ) : (
            // Full markdown after streaming completes
            String(shown || '').trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({node, inline, className, children, ...props}) {
                  return !inline ? (
                    <pre className="code"><code className={className} {...props}>{children}</code></pre>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  )
                }
              }}>{shown}</ReactMarkdown>
            ) : (
              <div className="small muted">No content</div>
            )
          )}
          {isLong && !it.streaming && (
            <button className="btn" style={{ marginTop: 8 }} onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      ) : (
        <div className="small" style={{ color: '#ffb4b0' }}>{it.error || 'Error'}</div>
      )}
      <div className="small muted" style={{ marginTop: 8 }}>{it.model}</div>
    </div>
  )
}

function Message({ m, onRetryProvider, onDeleteProvider }) {
  if (m.role === 'user') {
    return (
      <div className="user-msg">
        <div className="small muted">You</div>
        <div>{m.content}</div>
        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
            {m.attachments.map((a, i) => (
              <img key={i} src={a.dataUrl} alt={a.name || `image-${i}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #2a2a2a' }} />
            ))}
          </div>
        )}
      </div>
    )
  }
  if (m.role === 'multi') {
    return (
      <div className="grid">
        {m.items.map((it, idx) => (
          <ProviderCard key={idx} it={it} onRetry={prov => onRetryProvider?.(prov)} onDelete={prov => onDeleteProvider?.(prov)} />
        ))}
      </div>
    )
  }
  return null
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings())
  const [showSettings, setShowSettings] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploads, setUploads] = useState([]) // {name,mime,data(base64),dataUrl}
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => localStorage.getItem('keybridge_welcome_dismissed') === '1')
  const [streaming, setStreaming] = useState(true)
  const [toasts, setToasts] = useState([])
  const abortRef = useRef(null)
  const fileRef = useRef(null)
  const inputRef = useRef(null)
  const placeholderIdxRef = useRef(-1)

  const activeProviders = useMemo(() => Object.entries(settings.enabled || {}).filter(([, v]) => v).map(([k]) => k), [settings])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [input])

  const onFiles = async (files) => {
    const list = Array.from(files || [])
    const newOnes = await Promise.all(list.map(file => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result
        const [prefix, b64] = String(dataUrl).split(',')
        const mime = prefix.substring(prefix.indexOf(':') + 1, prefix.indexOf(';'))
        resolve({ name: file.name, mime, data: b64, dataUrl })
      }
      reader.readAsDataURL(file)
    })))
    setUploads(prev => [...prev, ...newOnes])
  }

  const send = async (opts={}) => {
    const question = input.trim()
    if (!question && uploads.length === 0) return
    if (!activeProviders.length) {
      alert('Please enable at least one provider and set API keys in Settings.')
      return
    }
    if (!opts.retry) setInput('')
    const userMsg = { role: 'user', content: question || '(image)', attachments: uploads }
    if (!opts.retry) setMessages(prev => [...prev, userMsg])
    setBusy(true)
    try {
      const providers = {}
      for (const id of activeProviders) {
        providers[id] = {
          apiKey: settings.providers?.[id]?.apiKey || '',
          model: settings.providers?.[id]?.model || ''
        }
      }
      const attachments = uploads.map(u => ({ mime: u.mime, data: u.data }))

      if (abortRef.current) { try { abortRef.current.abort() } catch {} }
      const controller = new AbortController()
      abortRef.current = controller

      if (streaming) {
        const res = await fetch(`${API_BASE}/api/chat?stream=1`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: question }], providers, attachments }),
          signal: controller.signal
        })
        if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        // create placeholder cards
        const placeholder = Object.keys(providers).map(id => ({ ok: false, label: id==='openai'?'OpenAI': id==='anthropic'?'Claude': id==='google'?'Gemini': id==='xai'?'Grok': id==='openrouter'?'OpenRouter':'Provider', text: '', error: 'Waiting…', model: '', ms: null }))
        setMessages(prev => {
          const idx = prev.length
          placeholderIdxRef.current = idx
          return [...prev, { role: 'multi', items: placeholder }]
        })
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n')
          buffer = parts.pop() || ''
          for (const line of parts) {
            if (!line.trim()) continue
            try {
              const frame = JSON.parse(line)
              if (frame.type === 'result') {
                const r = frame.result
                setMessages(prev => {
                  const copy = prev.slice()
                  const targetIdx = (placeholderIdxRef.current >= 0 && placeholderIdxRef.current < copy.length)
                    ? placeholderIdxRef.current
                    : (() => {
                        for (let i = copy.length - 1; i >= 0; i--) {
                          if (copy[i].role === 'multi') return i
                        }
                        return -1
                      })()
                  if (targetIdx !== -1) {
                    const list = copy[targetIdx].items.slice()
                    const label = r.provider==='openai'?'OpenAI': r.provider==='anthropic'?'Claude': r.provider==='google'?'Gemini': r.provider==='xai'?'Grok': r.provider==='openrouter'?'OpenRouter':'Provider'
                    // find existing item for this provider, or a waiting placeholder
                    let pos = list.findIndex(it => it.label === label)
                    if (pos === -1) pos = list.findIndex(it => it.label === label && it.text==='' && it.error==='Waiting…')
                    const prevItem = pos !== -1 ? list[pos] : null
                    if (r.ok) {
                      // For partial updates, just replace the text (sentence-level updates from server)
                      const newText = r.partial ? r.text : (r.text || prevItem?.text || '')
                      const isStreaming = !!r.partial
                      const newItem = { ok: true, label, text: newText, streaming: isStreaming, ms: r.ms ?? prevItem?.ms ?? null, model: r.model || prevItem?.model || '' }
                      if (pos !== -1) list[pos] = newItem
                      else list.push(newItem)
                    } else {
                      const newItem = { ok: false, label, error: r.error || 'Error', streaming: false, ms: r.ms ?? prevItem?.ms ?? null, model: r.model || prevItem?.model || '' }
                      if (pos !== -1) list[pos] = newItem
                      else list.push(newItem)
                    }
                    copy[targetIdx] = { ...copy[targetIdx], items: list }
                  }
                  return copy
                })
              }
            } catch {}
          }
        }
        // Finalize: mark any leftover placeholders
        const finalizeIdx = placeholderIdxRef.current
        setMessages(prev => {
          const copy = prev.slice()
          const idx = (finalizeIdx >= 0 && finalizeIdx < copy.length)
            ? finalizeIdx
            : (() => { for (let i = copy.length - 1; i >= 0; i--) { if (copy[i].role === 'multi') return i } return -1 })()
          if (idx !== -1) {
            const list = copy[idx].items.map(it => {
              if (it.text === '' && it.error === 'Waiting…') return { ...it, ok: false, error: 'No response', streaming: false }
              if (it.streaming) return { ...it, streaming: false }
              return it
            })
            copy[idx] = { ...copy[idx], items: list }
          }
          return copy
        })
        // Reset placeholder index after stream completes
        placeholderIdxRef.current = -1
      } else {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: question }], providers, attachments }),
          signal: controller.signal
        })
        const data = await res.json()
        const items = (data.results || []).map(r => {
          const id = r.provider
          const label = id === 'openai' ? 'OpenAI' : id === 'anthropic' ? 'Claude' : id === 'google' ? 'Gemini' : id === 'xai' ? 'Grok' : id === 'openrouter' ? 'OpenRouter' : 'Provider'
          return r.ok ? { ok: true, label, text: r.text, ms: r.ms, model: r.model } : { ok: false, label, error: r.error || 'Error', ms: r.ms, model: r.model || '' }
        })
        setMessages(prev => [...prev, { role: 'multi', items }])
      }
    } catch (e) {
      setToasts(t => [...t, { id: Date.now().toString(), text: e.message || 'Request failed', action: 'Retry', onAction: () => send({ retry: true }) }])
      if (!streaming) setMessages(prev => [...prev, { role: 'multi', items: [{ ok: false, label: 'Error', error: e.message, model: '', ms: null }] }])
    } finally {
      setBusy(false)
      setUploads([])
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeUpload = (idx) => {
    setUploads(prev => prev.filter((_, i) => i !== idx))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo"></div>
          <div>
            <div className="title">KeyBridge</div>
            <div className="subtitle">Compare answers side-by-side across LLMs</div>
          </div>
        </div>
        <div className="row">
          <span className="pill">{activeProviders.length} providers</span>
          <button className="btn" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </div>

      {!welcomeDismissed && (
        <div className="welcome-overlay">
          <div className="welcome">
            <div className="title">Welcome to KeyBridge</div>
            <div className="small hint">KeyBridge lets you compare answers from multiple LLMs side-by-side for better clarity and judgment. Enter your API keys in Settings, ask a question, and (optionally) attach images to see how each model responds.</div>
            <div className="welcome-actions">
              <button className="btn pulse" onClick={() => setShowSettings(true)}>Open Settings</button>
              <button className="btn" onClick={() => { localStorage.setItem('keybridge_welcome_dismissed', '1'); setWelcomeDismissed(true); }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <div className="chat">
        <div className="messages">
          {messages.map((m, i) => <Message key={i} m={m} />)}
        </div>
        <div className="panel">
          <div className="input-bar" style={{ alignItems: 'flex-start' }}>
            <textarea ref={inputRef} className="input" rows={1} placeholder="Type your question..." value={input} onChange={e => setInput(e.target.value)} onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} onKeyDown={onKeyDown} />
            <div className="row" style={{ flexDirection: 'column', gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
                <button className="btn icon-btn" title="Upload" aria-label="Upload" onClick={() => fileRef.current?.click()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 16V4" stroke="#e6e6e6" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M8 8L12 4L16 8" stroke="#e6e6e6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#e6e6e6" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
                <button className="send-btn" onClick={send} disabled={busy}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 12L20 4L12 20L10 14L4 12Z" stroke="#cfcfcf" stroke-width="1.5" stroke-linejoin="round"/>
                    </svg>
                    {busy ? 'Sending…' : 'Send'}
                  </span>
                </button>
              </div>
              {uploads.length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {uploads.map((u, i) => (
                    <div key={i} className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <img src={u.dataUrl} alt={u.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #2a2a2a' }} />
                      <button className="btn" onClick={() => removeUpload(i)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>Keys are stored locally in your browser and sent only to your local KeyBridge server for the current request.</div>
        </div>
      </div>

      <Settings open={showSettings} onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} />
    </div>
  )
}
