import React, { useState, useEffect } from 'react';

export default function AuditLogsView({ role }) {
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [role]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Security & Audit Trail</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Immutable chronological record of case modifications, state transitions, and extension data syncs.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchLogs}>
          Refresh Audit Trail
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor Role</th>
              <th>Action</th>
              <th>Case Reference</th>
              <th>Event Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No audit entries recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        log.actor_role === 'SUPERADMIN'
                          ? 'badge-ready'
                          : log.actor_role === 'ADMIN'
                          ? 'badge-confirmation'
                          : 'badge-pending'
                      }`}
                    >
                      {log.actor_role}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {log.action}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {log.case_id || 'SYSTEM_GLOBAL'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(log.details)}
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
