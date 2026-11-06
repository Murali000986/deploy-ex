import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Briefcase,
  Search,
  AlertTriangle,
  ShieldCheck,
  Settings,
  Circle,
  Globe,
} from 'lucide-react';

const MENU_ITEMS = [
  { id: 'overview',   label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'whatsapp',   label: 'WhatsApp Simulator', icon: MessageSquare, highlight: true },
  { id: 'cases',      label: 'Client Cases',        icon: Briefcase },
  { id: 'namereview', label: 'Name Screening',      icon: Search },
  { id: 'manual',     label: 'Manual Review',       icon: AlertTriangle },
  { id: 'mcafiling',  label: 'MCA Filing',           icon: Globe, highlight: true },
  { id: 'audit',      label: 'Audit Logs',          icon: ShieldCheck },
  { id: 'settings',   label: 'Settings',            icon: Settings, superadminOnly: true },
];

export default function Sidebar({ currentView, onSelectView, role }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">L</div>
        <div>
          <div className="brand-title">Ledgerly</div>
          <div className="brand-subtitle">MCA Automation</div>
        </div>
      </div>

      <nav className="nav-menu">
        {MENU_ITEMS.filter(item => !item.superadminOnly || role === 'SUPERADMIN').map(item => {
          const IconComp = item.icon;
          return (
            <div
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <span className="nav-icon">
                <IconComp size={16} strokeWidth={1.8} />
              </span>
              <span>{item.label}</span>
              {item.highlight && currentView !== item.id && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 9,
                  background: 'var(--wa-green)',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>LIVE</span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div>Ledgerly Engine v2.0</div>
        <div className="status-dot">
          <Circle size={8} fill="currentColor" /> Backend Active
        </div>
      </div>
    </aside>
  );
}
