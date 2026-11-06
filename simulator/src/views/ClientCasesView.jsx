import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import { Check, X, ShieldCheck } from 'lucide-react';

export default function ClientCasesView({ role }) {
  const [cases, setCases] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseDossier, setCaseDossier] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);

  const fetchCases = async () => {
    try {
      let url = '/api/admin/cases?';
      if (filterStatus) url += `status=${filterStatus}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
      const res = await fetch(url, { headers: { 'x-user-role': role } });
      const data = await res.json();
      setCases(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [filterStatus, searchTerm, role]);

  const openDossier = async (caseId) => {
    setSelectedCaseId(caseId);
    setLoadingDossier(true);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}`, {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      setCaseDossier(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleStateChange = async (newState) => {
    if (!selectedCaseId) return;
    try {
      await fetch(`/api/admin/cases/${selectedCaseId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ newState, reason: `State updated to ${newState} via CA dashboard` })
      });
      openDossier(selectedCaseId);
      fetchCases();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>MCA Client Cases</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Review dossier completeness, AI extracted values, and approve files for MCA SPICe+ filing.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by case number or company name..."
          style={{ width: '320px' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All States</option>
          <option value="NEW">New</option>
          <option value="DOCUMENTS_PENDING">Documents Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="CLIENT_CONFIRMATION">Client Confirmation</option>
          <option value="NAME_REVIEW">Name Review</option>
          <option value="ADMIN_REVIEW">Admin Review</option>
          <option value="READY_FOR_EXTENSION">Ready for Extension</option>
          <option value="MANUAL_REVIEW">Manual Review</option>
          <option value="NEEDS_CORRECTION">Needs Correction</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={fetchCases}>
          Refresh
        </button>
      </div>

      {/* Cases Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Proposed Company Name</th>
              <th>State</th>
              <th>Client Contact</th>
              <th>Confirmation</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No cases matching current criteria.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.case_number}</td>
                  <td style={{ fontWeight: 500 }}>{c.proposed_company_name || 'Pending Extraction'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.registered_office_state || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {c.client?.full_name} ({c.client?.phone_number})
                  </td>
                  <td>
                    {c.client_confirmed ? (
                      <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>Confirmed</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Pending</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openDossier(c.id)}>
                      Review Dossier
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Case Dossier Modal / Drawer */}
      {selectedCaseId && (
        <div className="modal-overlay" onClick={() => setSelectedCaseId(null)}>
          <div className="modal-content" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
            {loadingDossier || !caseDossier ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>Loading dossier...</div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '18px' }}>{caseDossier.case.case_number}</h3>
                      <StatusBadge status={caseDossier.case.status} />
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      {caseDossier.client?.full_name} • +{caseDossier.client?.phone_number}
                    </p>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelectedCaseId(null)}>
                    <X size={14} /> Close
                  </button>
                </div>

                {/* Workflow Actions Banner */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 'var(--r-sm)', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>CA Review Action:</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStateChange('READY_FOR_EXTENSION')}
                    >
                      <ShieldCheck size={14} /> Approve for MCA Extension
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleStateChange('NEEDS_CORRECTION')}
                    >
                      Request Correction
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleStateChange('MANUAL_REVIEW')}
                    >
                      Route to Manual Review
                    </button>
                  </div>
                </div>

                {/* AI Extracted Fields */}
                <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Extracted Dossier Fields</h4>
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '20px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Extracted Value</th>
                        <th>Confidence</th>
                        <th>Source File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseDossier.extractedFields.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                            No fields extracted yet. Client needs to upload documents.
                          </td>
                        </tr>
                      ) : (
                        caseDossier.extractedFields.map((f) => (
                          <tr key={f.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {f.field_key}
                            </td>
                            <td style={{ fontWeight: 600 }}>{f.verified_value || f.extracted_value}</td>
                            <td style={{ width: '130px' }}>
                              <ConfidenceBar score={f.confidence} />
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {f.source_document_name}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Uploaded Documents */}
                <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Uploaded Documents</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {caseDossier.documents.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No documents uploaded.</div>
                  ) : (
                    caseDossier.documents.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px',
                          background: 'var(--bg-card)',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{d.original_filename}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          Status: {d.processing_status} • Score: {Math.round(d.readability_score * 100)}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
