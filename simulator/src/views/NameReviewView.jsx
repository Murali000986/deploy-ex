import React, { useState } from 'react';

export default function NameReviewView({ role }) {
  const [proposedName, setProposedName] = useState('Apex Cloud Technologies Private Limited');
  const [reviewResult, setReviewResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRunCheck = async (nameToCheck = proposedName) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cases/case_demo/name-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ proposedName: nameToCheck })
      });
      const data = await res.json();
      setReviewResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>SPICe+ Part A Name Availability Engine</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Automated multi-source search across MCA Entity Registry, Rule 8 Restricted Words, and Nice Class Trademarks.
        </p>
      </div>

      {/* Input Checker Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Verify Proposed Company Name</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            style={{ flex: 1, fontSize: '14px' }}
            value={proposedName}
            onChange={(e) => setProposedName(e.target.value)}
            placeholder="e.g. Acme Tech Solutions Private Limited"
          />
          <button className="btn btn-primary" disabled={loading || !proposedName.trim()} onClick={() => handleRunCheck()}>
            {loading ? 'Searching Registry...' : 'Run SPICe+ Checks'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Try presets:</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setProposedName('Vyoma Quantum Technologies Private Limited'); handleRunCheck('Vyoma Quantum Technologies Private Limited'); }}
          >
            Clean Candidate (Passes)
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setProposedName('TATA CONSULTANCY SERVICES LIMITED'); handleRunCheck('TATA CONSULTANCY SERVICES LIMITED'); }}
          >
            Existing MCA Entity (Conflict)
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setProposedName('National Banking Advisory Private Limited'); handleRunCheck('National Banking Advisory Private Limited'); }}
          >
            Restricted Word (Flagged)
          </button>
        </div>
      </div>

      {/* Results Matrix */}
      {reviewResult && (
        <div>
          {/* Summary Alert */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--r-md)',
              border: `1px solid ${reviewResult.passed ? 'var(--wa-green)' : 'var(--color-red)'}`,
              background: reviewResult.passed ? '#f0fdf4' : '#fef2f2',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: reviewResult.passed ? '#15803d' : '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                {reviewResult.passed
                  ? 'Preliminary Name Search Passed (No Direct Conflict)'
                  : 'Conflicts Detected Under Rule 8 or Existing Trademarks'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {reviewResult.conflictReason || 'The proposed name is available for preliminary CRC filing.'}
              </div>
            </div>
            <span className={`badge ${reviewResult.passed ? 'badge-ready' : 'badge-failed'}`}>
              {reviewResult.passed ? 'PASSED' : 'FLAGGED'}
            </span>
          </div>

          {/* Detailed Verification Checks */}
          <div className="table-container" style={{ marginBottom: '20px' }}>
            <table>
              <thead>
                <tr>
                  <th>Check Source</th>
                  <th>Result</th>
                  <th>Match Score</th>
                  <th>Conflicting Entity / Notes</th>
                </tr>
              </thead>
              <tbody>
                {reviewResult.results.map((chk) => (
                  <tr key={chk.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '12px' }}>
                      {chk.check_source}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          chk.check_result === 'PASSED' ? 'badge-ready' : 'badge-failed'
                        }`}
                      >
                        {chk.check_result}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {Math.round(chk.match_score * 100)}%
                    </td>
                    <td style={{ fontSize: '13px', color: chk.check_result === 'PASSED' ? 'var(--text-secondary)' : '#f87171' }}>
                      {chk.conflicting_entity_name ? `Conflict with '${chk.conflicting_entity_name}' — ` : ''}
                      {chk.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legal Compliance Disclaimer */}
          <div className="card" style={{ background: 'var(--bg-tertiary)', borderLeft: '3px solid #ffffff' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
              Statutory Disclaimer
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {reviewResult.legalNotice}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
