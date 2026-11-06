import React, { useState, useEffect } from 'react';
import ConfidenceBar from '../components/ConfidenceBar';

export default function ManualReviewQueueView({ role }) {
  const [flaggedCases, setFlaggedCases] = useState([]);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchFlaggedCases = async () => {
    try {
      const res = await fetch('/api/admin/cases?status=MANUAL_REVIEW', {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      setFlaggedCases(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFlaggedCases();
  }, [role]);

  const handleVerifyField = async (fieldId, value) => {
    try {
      await fetch(`/api/admin/fields/${fieldId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ verifiedValue: value, status: 'HUMAN_VERIFIED' })
      });
      setEditingFieldId(null);
      fetchFlaggedCases();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveCase = async (caseId) => {
    try {
      await fetch(`/api/admin/cases/${caseId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ newState: 'READY_FOR_EXTENSION', reason: 'Verified by CA in Manual Review Queue' })
      });
      fetchFlaggedCases();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>CA Manual Review Queue</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Anomalies, low-confidence OCR scans, and client escalation requests requiring certified CA inspection.
        </p>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Proposed Entity</th>
              <th>Client Contact</th>
              <th>Flag Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flaggedCases.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  ✓ Review queue is clear! No unresolved conflicts or low-confidence documents.
                </td>
              </tr>
            ) : (
              flaggedCases.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.case_number}</td>
                  <td style={{ fontWeight: 500 }}>{c.proposed_company_name || 'Pending'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {c.client?.full_name} ({c.client?.phone_number})
                  </td>
                  <td style={{ color: '#f87171', fontSize: '12px' }}>
                    Low OCR clarity or client requested CA consultation
                  </td>
                  <td>
                    <span className="badge badge-manual">MANUAL REVIEW</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApproveCase(c.id)}
                      >
                        Approve & Clear
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
