import { useState } from 'react'

const API = 'http://127.0.0.1:8000'

const SOURCES = [
  { id: 'WhatsApp', emoji: '💬', color: '#25D366' },
  { id: 'Telegram', emoji: '✈️', color: '#0088cc' },
  { id: 'Instagram', emoji: '📸', color: '#E1306C' },
  { id: 'Email', emoji: '📧', color: '#EA4335' },
  { id: 'General', emoji: '💼', color: '#666' },
]

export default function App() {
  const [inputMode, setInputMode] = useState('paste')
  const [file, setFile] = useState(null)
  const [pastedText, setPastedText] = useState('')
  const [source, setSource] = useState('WhatsApp')
  const [analysisType, setAnalysisType] = useState('standard')
  const [customQuestion, setCustomQuestion] = useState('')
  const [notifyEmails, setNotifyEmails] = useState('')
  const [results, setResults] = useState([])
  const [customResult, setCustomResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [analysed, setAnalysed] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  const analyse = async () => {
    if (inputMode === 'paste' && !pastedText.trim()) return alert('Please paste some text first')
    if (inputMode === 'file' && !file) return alert('Please select a file first')

    setLoading(true)
    setResults([])
    setCustomResult('')
    setAnalysed(false)
    setExportSuccess(false)

    try {
      if (inputMode === 'file') {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('source', source)

        const res = await fetch(`${API}/analyse`, {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        setResults(data.items)
        setAnalysed(true)

      } else {
        const text = pastedText
        if (analysisType === 'custom') {
          if (!customQuestion.trim()) return alert('Please enter your question')
          const res = await fetch(`${API}/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, question: customQuestion, source })
          })
          const data = await res.json()
          setCustomResult(data.answer)
        } else {
          const res = await fetch(`${API}/analyse-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, source })
          })
          const data = await res.json()
          setResults(data.items)
        }
        setAnalysed(true)
      }
    } catch (e) {
      alert('Error connecting to backend. Make sure server is running.')
    }
    setLoading(false)
  }

  const exportToSheets = async () => {
    setExporting(true)
    setExportSuccess(false)
    try {
      let text = pastedText
      if (inputMode === 'file' && file) {
        text = await file.text()
      }
      const emails = notifyEmails.split(',').map(e => e.trim()).filter(Boolean)
      const res = await fetch(`${API}/export-to-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source, notify_emails: emails })
      })
      const data = await res.json()
      if (data.success) setExportSuccess(true)
    } catch (e) {
      alert('Error exporting to sheets')
    }
    setExporting(false)
  }

  const download = async () => {
    let text = pastedText
    if (inputMode === 'file' && file) {
      text = await file.text()
    }
    const res = await fetch(`${API}/download-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source })
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cowrks_extraction.csv'
    a.click()
  }

  const totalValue = results.reduce((sum, item) => {
    const bid = item.final_bid?.replace(/[^0-9]/g, '')
    return sum + (bid ? parseInt(bid) : 0)
  }, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f7f6f3', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#1a1916', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>Cowrks Chat Analyser</div>
          <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>Extract business intelligence from any group chat</div>
        </div>
        <div style={{ background: '#00e5a0', color: '#000', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>AI Powered</div>
      </div>

      <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 20px' }}>

        {/* Source Selector */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e1', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Chat Source</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SOURCES.map(s => (
              <button key={s.id} onClick={() => setSource(s.id)}
                style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${source === s.id ? s.color : '#e8e6e1'}`, background: source === s.id ? s.color + '15' : '#fff', color: source === s.id ? s.color : '#888', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                {s.emoji} {s.id}
              </button>
            ))}
          </div>
        </div>

        {/* Input Mode */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['paste', 'file'].map(mode => (
            <button key={mode} onClick={() => setInputMode(mode)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: inputMode === mode ? '#1a1916' : '#fff', color: inputMode === mode ? '#fff' : '#888', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              {mode === 'paste' ? '📋 Paste Text' : '📁 Upload File'}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e1', marginBottom: 14, overflow: 'hidden' }}>
          {inputMode === 'paste' ? (
            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder={`Paste your ${source} group chat here...\n\nExample:\nJohn: Nike Air Max available, CP 4500\nMike: Final price 5000?\nJohn: Yes done at 5000 + GST 18%`}
              rows={8}
              style={{ width: '100%', padding: '16px', border: 'none', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.7, color: '#333', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Upload {source} chat export</div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>Supports .txt, .pdf, .zip</div>
              <input type="file" accept=".txt,.pdf,.zip" onChange={e => setFile(e.target.files[0])} style={{ fontSize: 13 }} />
              {file && <div style={{ marginTop: 8, fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ {file.name}</div>}
            </div>
          )}
        </div>

        {/* Analysis Type */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e1', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>What to extract?</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: analysisType === 'custom' ? 12 : 0 }}>
            {[{ id: 'standard', label: '🏷️ Products & Prices' }, { id: 'custom', label: '✏️ Custom Question' }].map(opt => (
              <button key={opt.id} onClick={() => setAnalysisType(opt.id)}
                style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${analysisType === opt.id ? '#1a1916' : '#e8e6e1'}`, background: analysisType === opt.id ? '#1a1916' : '#fff', color: analysisType === opt.id ? '#fff' : '#666', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                {opt.label}
              </button>
            ))}
          </div>
          {analysisType === 'custom' && (
            <input value={customQuestion} onChange={e => setCustomQuestion(e.target.value)}
              placeholder="e.g. How many products? / Find all delivery dates / List all sellers"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8e6e1', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          )}
        </div>

        {/* Notify Emails */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e1', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>📧 Notify on Export (optional)</div>
          <input value={notifyEmails} onChange={e => setNotifyEmails(e.target.value)}
            placeholder="Enter emails to notify — e.g. manager@company.com, you@gmail.com"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8e6e1', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={analyse} disabled={loading}
            style={{ flex: 1, background: '#1a1916', color: '#fff', border: 'none', padding: '13px', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Analysing...' : '🔍 Analyse Chat'}
          </button>
          {analysed && analysisType === 'standard' && (
            <>
              <button onClick={exportToSheets} disabled={exporting}
                style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', padding: '13px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
                {exporting ? '⏳ Exporting...' : '📊 Export to Sheets'}
              </button>
              <button onClick={download}
                style={{ padding: '13px 20px', background: '#fff', color: '#1a1916', border: '1.5px solid #1a1916', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ⬇️ CSV
              </button>
            </>
          )}
        </div>

        {/* Export Success */}
        {exportSuccess && (
          <div style={{ background: '#d1fae5', border: '1px solid #10b981', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 14, color: '#065f46', fontWeight: 500 }}>
            ✅ Successfully exported to Google Sheets! {notifyEmails && 'Email notifications sent.'}
          </div>
        )}

        {/* Custom Result */}
        {customResult && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e1', padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Answer</div>
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{customResult}</div>
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Items Found', value: results.length },
              { label: 'Total Deal Value', value: totalValue > 0 ? '₹' + totalValue.toLocaleString('en-IN') : '—' },
              { label: 'Chat Source', value: source }
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e6e1', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1916' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e1', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0eeea' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1916' }}>✅ {results.length} items extracted from {source}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7f6f3' }}>
                    {['#', 'Product', 'Price', 'Final Bid', 'Tax', 'Key Point'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e8e6e1' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0eeea' }}>
                      <td style={{ padding: '11px 14px', color: '#bbb', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1a1916' }}>{item.product || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#555' }}>{item.price || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#059669', fontWeight: 600 }}>{item.final_bid || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#555' }}>{item.tax || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#444', lineHeight: 1.5 }}>{item.key_point || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}