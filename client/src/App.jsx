import React, { useMemo, useRef, useState, useEffect } from 'react'

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
  const updateProvider = (id, field, value) => {
    setLocal(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [id]: { ...(prev.providers?.[id] || {}), [field]: value }
      }
    }))
  }
  const updateEnabled = (id, value) => {
    setLocal(prev => ({ ...prev, enabled: { ...prev.enabled, [id]: value } }))
  }
  const save = () => {
    // Drop any model names, we auto-select based on API key
    const cleaned = {
      ...local,
      providers: Object.fromEntries(Object.entries(local.providers || {}).map(([k, v]) => [k, { apiKey: v.apiKey || '' }]))
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
          <span className="pill provider-badge">Auto</span>
        </div>
        <div className="field">
          <input placeholder="OpenAI API Key" value={local.providers?.openai?.apiKey || ''} onChange={e => updateProvider('openai', 'apiKey', e.target.value)} />
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="anthropic" label="Anthropic (Claude)" enabled={local.enabled?.anthropic} onToggle={updateEnabled} />
          <span className="pill provider-badge">Auto</span>
        </div>
        <div className="field">
          <input placeholder="Anthropic API Key" value={local.providers?.anthropic?.apiKey || ''} onChange={e => updateProvider('anthropic', 'apiKey', e.target.value)} />
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="google" label="Google (Gemini)" enabled={local.enabled?.google} onToggle={updateEnabled} />
          <span className="pill provider-badge">Auto</span>
        </div>
        <div className="field">
          <input placeholder="Google API Key" value={local.providers?.google?.apiKey || ''} onChange={e => updateProvider('google', 'apiKey', e.target.value)} />
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="xai" label="xAI (Grok)" enabled={local.enabled?.xai} onToggle={updateEnabled} />
          <span className="pill provider-badge">Auto</span>
        </div>
        <div className="field">
          <input placeholder="xAI API Key" value={local.providers?.xai?.apiKey || ''} onChange={e => updateProvider('xai', 'apiKey', e.target.value)} />
        </div>

        <div className="divider"></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ProviderSwitch id="openrouter" label="OpenRouter" enabled={local.enabled?.openrouter} onToggle={updateEnabled} />
          <span className="pill provider-badge">Auto</span>
        </div>
        <div className="field">
          <input placeholder="OpenRouter API Key" value={local.providers?.openrouter?.apiKey || ''} onChange={e => updateProvider('openrouter', 'apiKey', e.target.value)} />
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

function Message({ m }) {
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
          <div key={idx} className={`card ${it.ok ? 'provider-ok' : 'provider-error'}`}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h4>{it.label}</h4>
              <span className="pill">{it.ms != null ? `${it.ms} ms` : ''}</span>
            </div>
            {it.ok ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{it.text || ''}</div>
            ) : (
              <div className="small" style={{ color: '#ffb4b0' }}>{it.error || 'Error'}</div>
            )}
            <div className="small muted" style={{ marginTop: 8 }}>{it.model}</div>
          </div>
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
  const fileRef = useRef(null)
  const inputRef = useRef(null)

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

  const send = async () => {
    const question = input.trim()
    if (!question && uploads.length === 0) return
    if (!activeProviders.length) {
      alert('Please enable at least one provider and set API keys in Settings.')
      return
    }
    setInput('')
    const userMsg = { role: 'user', content: question || '(image)', attachments: uploads }
    setMessages(prev => [...prev, userMsg])
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
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content: question }], providers, attachments })
      })
      const data = await res.json()
      const items = (data.results || []).map(r => {
        const id = r.provider
        const label = id === 'openai' ? 'OpenAI' : id === 'anthropic' ? 'Claude' : id === 'google' ? 'Gemini' : id === 'xai' ? 'Grok' : id === 'openrouter' ? 'OpenRouter' : 'Provider'
        return r.ok ? { ok: true, label, text: r.text, ms: r.ms, model: r.model } : { ok: false, label, error: r.error || 'Error', ms: r.ms, model: r.model || '' }
      })
      setMessages(prev => [...prev, { role: 'multi', items }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'multi', items: [{ ok: false, label: 'Error', error: e.message, model: '', ms: null }] }])
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
