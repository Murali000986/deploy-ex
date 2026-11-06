import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { Database, ArrowRight } from 'lucide-react';

export default function DashboardOverview({ role, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, casesRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { 'x-user-role': role } }),
        fetch('/api/admin/cases', { headers: { 'x-user-role': role } })
      ]);
      const statsData = await statsRes.json();
      const casesData = await casesRes.json();
      setStats(statsData);
      setRecentCases(casesData.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  const handleSeedDemo = async () => {
    try {
      await fetch('/api/mock/seed-demo', { method: 'POST' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>CA Firm MCA Operations</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Automated WhatsApp intake, AI dossier extraction, and SPICe+ Part A preparation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSeedDemo}>
            <Database size={13} /> Seed Sample Cases
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('cases')}>
            View All Cases
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-metrics">
        <div className="metric-card">
          <div className="metric-label">Active Cases</div>
          <div className="metric-value">{stats?.activeCases ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending Confirmation</div>
          <div className="metric-value">{stats?.pendingConfirmation ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: '#f87171' }}>Manual Review Flagged</div>
          <div className="metric-value" style={{ color: '#f87171' }}>{stats?.manualReview ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: '#22c55e' }}>Ready for Extension</div>
          <div className="metric-value" style={{ color: '#22c55e' }}>{stats?.readyExtension ?? 0}</div>
        </div>
      </div>

      {/* Pipeline Stages Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Intake Workflow Pipeline</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div className="badge badge-new" style={{ padding: '6px 12px' }}>1. New Intake</div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <div className="badge badge-pending" style={{ padding: '6px 12px' }}>2. Docs Pending</div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <div className="badge badge-processing" style={{ padding: '6px 12px' }}>3. AI Extraction</div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <div className="badge badge-confirmation" style={{ padding: '6px 12px' }}>4. Client Confirmation</div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <div className="badge badge-namereview" style={{ padding: '6px 12px' }}>5. SPICe+ Name Check</div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <div className="badge badge-adminreview" style={{ padding: '6px 12px' }}>6. CA Signoff</div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <div className="badge badge-ready" style={{ padding: '6px 12px' }}>7. Ready for Extension</div>
        </div>
      </div>

      {/* Recent Cases */}
      <div className="table-container">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px' }}>Recent Cases</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Auto-refreshed</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Proposed Entity Name</th>
              <th>Client Phone</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentCases.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No cases recorded yet. Click "Seed Sample Cases" or test via WhatsApp simulator.
                </td>
              </tr>
            ) : (
              recentCases.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.case_number}</td>
                  <td style={{ fontWeight: 500 }}>{c.proposed_company_name || 'Pending Extraction'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {c.client?.phone_number || 'N/A'}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
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
