import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Key, Play, CheckCircle, XCircle, RefreshCw, Monitor,
  ChevronRight, AlertTriangle, Loader2, Eye, X, FileText
} from 'lucide-react';

const API = 'http://localhost:4000/api/mca';

export default function McaFilingView({ role }) {
  // Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credsSaved, setCredsSaved] = useState(false);

  // Automation state
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [browserOpen, setBrowserOpen] = useState(false);

  // Case selection
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  // Screenshot
  const [screenshot, setScreenshot] = useState(null);
  const [showScreenshot, setShowScreenshot] = useState(false);

  // Fill results
  const [fillResults, setFillResults] = useState(null);

  const logsEndRef = useRef(null);

  // Fetch cases on mount
  useEffect(() => {
    fetch(`${API}/cases`).then(r => r.json()).then(setCases).catch(() => {});
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Poll status while active
  useEffect(() => {
    if (status === 'idle') return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/status`);
        const data = await r.json();
        setStatus(data.status);
        setStatusMessage(data.message);
        setLogs(data.logs || []);
        setBrowserOpen(data.browserOpen);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [status]);

  const saveCredentials = async () => {
    const r = await fetch(`${API}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (data.success) setCredsSaved(true);
  };

  const startLogin = async () => {
    setStatus('launching');
    setStatusMessage('Launching browser...');
    try {
      const r = await fetch(`${API}/start-login`, { method: 'POST' });
      const data = await r.json();
      if (data.error) {
        setStatus('error');
        setStatusMessage(data.error);
      } else {
        setStatus(data.status);
        setStatusMessage(data.message);
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage(err.message);
    }
  };

  const confirmLogin = async () => {
    const r = await fetch(`${API}/confirm-login`, { method: 'POST' });
    const data = await r.json();
    setStatus(data.status);
    setStatusMessage(data.loggedIn ? 'Logged in successfully!' : 'Still on login page — please complete login on MCA site.');
  };

  const fillForm = async () => {
    if (!selectedCase) return;
    setStatus('filling_form');
    setStatusMessage('Filling SPICe+ form...');
    try {
      const r = await fetch(`${API}/fill-spice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: selectedCase.id }),
      });
      const data = await r.json();
      setFillResults(data);
      setStatus(data.status || 'form_filled');
      setStatusMessage(data.error || `Filled ${data.success}/${data.total} fields`);
    } catch (err) {
      setStatus('error');
      setStatusMessage(err.message);
    }
  };

  const takeScreenshot = async () => {
    try {
      const r = await fetch(`${API}/screenshot`);
      const data = await r.json();
      if (data.screenshot) {
        setScreenshot(data.screenshot);
        setShowScreenshot(true);
      }
    } catch {}
  };

  const closeBrowser = async () => {
    await fetch(`${API}/close`, { method: 'POST' });
    setStatus('idle');
    setStatusMessage('Browser closed');
    setBrowserOpen(false);
  };

  const statusColor = {
    idle: '#6b7280',
    launching: '#f59e0b',
    login_page: '#3b82f6',
    waiting_captcha: '#f97316',
    logged_in: '#10b981',
    filling_form: '#8b5cf6',
    form_filled: '#10b981',
    error: '#ef4444',
  };

  const statusLabel = {
    idle: 'Idle',
    launching: 'Launching Browser...',
    login_page: 'On Login Page',
    waiting_captcha: 'Waiting for CAPTCHA / OTP',
    logged_in: 'Logged In',
    filling_form: 'Filling Form...',
    form_filled: 'Form Filled',
    error: 'Error',
  };

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', padding: 0 }}>
      {/* Left Panel — Controls */}
      <div style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Status Banner */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: statusColor[status] || '#6b7280',
            boxShadow: status !== 'idle' ? `0 0 8px ${statusColor[status]}` : 'none',
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{statusLabel[status] || status}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{statusMessage}</div>
          </div>
          {browserOpen && (
            <button onClick={closeBrowser} style={{
              marginLeft: 'auto', background: '#fee2e2', color: '#dc2626',
              border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}>
              <X size={12} /> Close Browser
            </button>
          )}
        </div>

        {/* Step 1: Credentials */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: credsSaved ? '1px solid #10b981' : '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Key size={16} color={credsSaved ? '#10b981' : '#6b7280'} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Step 1: MCA Login Credentials</span>
            {credsSaved && <CheckCircle size={14} color="#10b981" style={{ marginLeft: 'auto' }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="MCA Username / Email"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                fontSize: 13, outline: 'none',
              }}
            />
            <input
              type="password"
              placeholder="MCA Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={saveCredentials}
              disabled={!username || !password}
              style={{
                background: username && password ? '#1d4ed8' : '#d1d5db',
                color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0',
                fontWeight: 600, fontSize: 13, cursor: username && password ? 'pointer' : 'not-allowed',
              }}
            >
              Save Credentials
            </button>
          </div>
        </div>

        {/* Step 2: Login */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: status === 'logged_in' ? '1px solid #10b981' : '1px solid #e5e7eb',
          opacity: credsSaved ? 1 : 0.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Globe size={16} color={status === 'logged_in' ? '#10b981' : '#6b7280'} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Step 2: Login to MCA Portal</span>
            {status === 'logged_in' && <CheckCircle size={14} color="#10b981" style={{ marginLeft: 'auto' }} />}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={startLogin}
              disabled={!credsSaved || ['launching', 'login_page'].includes(status)}
              style={{
                flex: 1, background: credsSaved ? '#2563eb' : '#d1d5db',
                color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0',
                fontWeight: 600, fontSize: 13,
                cursor: credsSaved ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {['launching', 'login_page'].includes(status) ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
              Open MCA & Login
            </button>
          </div>

          {status === 'waiting_captcha' && (
            <div style={{
              marginTop: 12, padding: 12, background: '#fef3c7', borderRadius: 8,
              border: '1px solid #f59e0b', fontSize: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#b45309', marginBottom: 4 }}>
                <AlertTriangle size={13} /> CAPTCHA + OTP Required
              </div>
              <div style={{ color: '#92400e' }}>
                Please solve the CAPTCHA and enter the OTP in the Chrome window that opened. Then click below:
              </div>
              <button
                onClick={confirmLogin}
                style={{
                  marginTop: 10, width: '100%', background: '#f59e0b', color: '#fff',
                  border: 'none', borderRadius: 6, padding: '8px 0',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                I've Completed Login
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Select Case & Fill Form */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: status === 'form_filled' ? '1px solid #10b981' : '1px solid #e5e7eb',
          opacity: status === 'logged_in' || status === 'form_filled' ? 1 : 0.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FileText size={16} color={status === 'form_filled' ? '#10b981' : '#6b7280'} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Step 3: Fill SPICe+ Part A</span>
            {status === 'form_filled' && <CheckCircle size={14} color="#10b981" style={{ marginLeft: 'auto' }} />}
          </div>

          {/* Case selector */}
          <select
            value={selectedCase?.id || ''}
            onChange={e => setSelectedCase(cases.find(c => c.id === e.target.value) || null)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: 13, marginBottom: 10,
              background: '#fff',
            }}
          >
            <option value="">Select a client case...</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} — {c.companyName} ({c.clientName})
              </option>
            ))}
          </select>

          {selectedCase && (
            <div style={{
              padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 12,
              marginBottom: 10, border: '1px solid #bbf7d0',
            }}>
              <div style={{ fontWeight: 600, color: '#166534' }}>{selectedCase.companyName}</div>
              <div style={{ color: '#15803d', marginTop: 4 }}>
                Client: {selectedCase.clientName} | Status: {selectedCase.status}
              </div>
              {selectedCase.directors?.length > 0 && (
                <div style={{ color: '#15803d', marginTop: 2 }}>
                  Directors: {selectedCase.directors.join(', ')}
                </div>
              )}
            </div>
          )}

          <button
            onClick={fillForm}
            disabled={!selectedCase || !['logged_in', 'form_filled'].includes(status)}
            style={{
              width: '100%',
              background: selectedCase && ['logged_in', 'form_filled'].includes(status) ? '#059669' : '#d1d5db',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0',
              fontWeight: 600, fontSize: 13,
              cursor: selectedCase && ['logged_in', 'form_filled'].includes(status) ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {status === 'filling_form' ? <Loader2 size={14} className="spin" /> : <ChevronRight size={14} />}
            Auto-Fill SPICe+ Form
          </button>

          {/* Fill Results */}
          {fillResults && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                Fill Results: {fillResults.success}/{fillResults.total} fields
              </div>
              {fillResults.results?.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: r.success ? '#059669' : '#dc2626',
                  padding: '3px 0',
                }}>
                  {r.success ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  <span>{r.type}: {r.value || r.selector.split('-').pop()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Screenshot button */}
        {browserOpen && (
          <button
            onClick={takeScreenshot}
            style={{
              background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8,
              padding: '10px 0', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              color: '#374151',
            }}
          >
            <Eye size={14} /> Take Screenshot
          </button>
        )}
      </div>

      {/* Right Panel — Logs + Screenshot */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Screenshot Preview */}
        {showScreenshot && screenshot && (
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Browser Screenshot</span>
              <button onClick={() => setShowScreenshot(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
              }}>
                <X size={16} />
              </button>
            </div>
            <img src={screenshot} alt="MCA Browser" style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        {/* Live Logs */}
        <div style={{
          background: '#1e293b', borderRadius: 12, flex: 1, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #334155',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Monitor size={14} color="#94a3b8" />
            <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>Automation Logs</span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, color: '#64748b',
              background: '#334155', padding: '2px 8px', borderRadius: 4,
            }}>
              {logs.length} entries
            </span>
          </div>
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12,
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: 40 }}>
                Automation logs will appear here...
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{
                  padding: '4px 0', color: '#e2e8f0',
                  borderBottom: '1px solid #1e293b22',
                }}>
                  <span style={{ color: '#64748b', fontSize: 10, marginRight: 8 }}>
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                  <span style={{
                    color: log.message.includes('Error') || log.message.includes('Failed')
                      ? '#f87171'
                      : log.message.includes('success') || log.message.includes('filled') || log.message.includes('confirmed')
                        ? '#4ade80'
                        : '#e2e8f0',
                  }}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Screenshot Modal */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
