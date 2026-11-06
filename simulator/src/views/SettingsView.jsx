import React, { useState, useEffect } from 'react';

export default function SettingsView({ role }) {
  const [settings, setSettings] = useState(null);
  const [team, setTeam] = useState([]);
  const [mockMode, setMockMode] = useState(true);
  const [llmProvider, setLlmProvider] = useState('mock');
  const [ocrProvider, setOcrProvider] = useState('mock');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const [sRes, tRes] = await Promise.all([
        fetch('/api/superadmin/settings', { headers: { 'x-user-role': role } }),
        fetch('/api/superadmin/team', { headers: { 'x-user-role': role } })
      ]);
      if (sRes.ok) {
        const sData = await sRes.json();
        setSettings(sData);
        setMockMode(sData.whatsapp.mockMode);
        setLlmProvider(sData.ai.llmProvider);
        setOcrProvider(sData.ai.ocrProvider);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTeam(tData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ mockMode, llmProvider, ocrProvider })
      });
      const data = await res.json();
      setStatusMsg(data.message || 'Saved successfully');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e) {
      setStatusMsg('Error saving settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'SUPERADMIN') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h3 style={{ fontSize: '18px', color: '#f87171', marginBottom: '8px' }}>Restricted Access</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '460px', margin: '0 auto 16px' }}>
          System integration settings and Meta Business credentials can only be modified by Superadmin accounts.
        </p>
        <span className="badge badge-manual">Current Role: {role}</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Superadmin & Integration Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Configure Meta WhatsApp Business Platform, AI model adapters, and staff permissions.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {statusMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid #ffffff', marginBottom: '16px', fontSize: '13px' }}>
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* WhatsApp Business API Config */}
        <div className="card">
          <h3 style={{ fontSize: '14px', marginBottom: '14px' }}>WhatsApp Business Credentials</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Phone Number ID
              </label>
              <input
                type="text"
                readOnly
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                value={settings?.whatsapp.phoneNumberId || 'Loading...'}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Business Account ID (WABA)
              </label>
              <input
                type="text"
                readOnly
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                value={settings?.whatsapp.businessAccountId || 'Loading...'}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Development Mock Mode</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Operate with local simulator without Meta token</div>
              </div>
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* AI & OCR Adapters */}
        <div className="card">
          <h3 style={{ fontSize: '14px', marginBottom: '14px' }}>AI Document Pipeline Adapters</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                LLM Entity Extraction Provider
              </label>
              <select
                style={{ width: '100%' }}
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
              >
                <option value="mock">Built-in Production Heuristic / Mock (Zero-Cost)</option>
                <option value="gemini">Google Gemini 1.5 Pro</option>
                <option value="openai">OpenAI GPT-4o</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                OCR Text Recognition Provider
              </label>
              <select
                style={{ width: '100%' }}
                value={ocrProvider}
                onChange={(e) => setOcrProvider(e.target.value)}
              >
                <option value="mock">Built-in Smart Document Parser / Mock</option>
                <option value="tesseract">Tesseract OCR Engine</option>
                <option value="vision">Google Cloud Vision OCR</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Staff & Roles Table */}
      <div className="table-container">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '14px' }}>CA Firm User Accounts & Roles</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Account Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'SUPERADMIN' ? 'badge-ready' : 'badge-confirmation'}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span style={{ color: '#22c55e', fontSize: '12px' }}>● {u.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
