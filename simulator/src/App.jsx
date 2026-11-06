import React, { useState } from 'react';
import { ChevronRight, Shield } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardOverview from './views/DashboardOverview';
import WhatsAppSimulator from './views/WhatsAppStatusView';
import ClientCasesView from './views/ClientCasesView';
import NameReviewView from './views/NameReviewView';
import ManualReviewQueueView from './views/ManualReviewQueueView';
import AuditLogsView from './views/AuditLogsView';
import McaFilingView from './views/McaFilingView';
import SettingsView from './views/SettingsView';

export default function App() {
  const [currentView, setCurrentView] = useState('whatsapp'); // default to simulator
  const [role, setRole] = useState('ADMIN');

  const VIEW_LABELS = {
    overview:   'Dashboard Overview',
    whatsapp:   'WhatsApp Automation Simulator',
    cases:      'MCA Client Cases & Dossier Pipeline',
    namereview: 'SPICe+ Part A Name Review',
    manual:     'Manual Review Queue',
    mcafiling:  'MCA SPICe+ Filing Automation',
    audit:      'System Audit Trail',
    settings:   'Superadmin Settings & Integrations',
  };

  const renderView = () => {
    switch (currentView) {
      case 'overview':   return <DashboardOverview role={role} onNavigate={setCurrentView} />;
      case 'whatsapp':   return <WhatsAppSimulator role={role} />;
      case 'cases':      return <ClientCasesView role={role} />;
      case 'namereview': return <NameReviewView role={role} />;
      case 'manual':     return <ManualReviewQueueView role={role} />;
      case 'mcafiling':  return <McaFilingView role={role} />;
      case 'audit':      return <AuditLogsView role={role} />;
      case 'settings':   return <SettingsView role={role} />;
      default:           return <WhatsAppSimulator role={role} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onSelectView={setCurrentView} role={role} />

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Breadcrumb */}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Ledgerly</span>
            <ChevronRight size={13} color="var(--text-muted)" />
            <h1 className="page-title">{VIEW_LABELS[currentView]}</h1>
          </div>

          <div className="topbar-right">
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Shield size={13} /> Role:
            </span>
            <div className="role-switcher">
              <button
                id="role-btn-admin"
                className={`role-btn ${role === 'ADMIN' ? 'active' : ''}`}
                onClick={() => setRole('ADMIN')}
              >
                CA Admin
              </button>
              <button
                id="role-btn-superadmin"
                className={`role-btn ${role === 'SUPERADMIN' ? 'active' : ''}`}
                onClick={() => setRole('SUPERADMIN')}
              >
                Superadmin
              </button>
            </div>
            <div className="avatar-chip">
              {role === 'SUPERADMIN' ? 'SP' : 'CA'}
            </div>
          </div>
        </header>

        <main className="page-body">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
