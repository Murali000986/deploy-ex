import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  FileText,
  Cpu,
  CheckCircle2,
  Search,
  UserCheck,
  Rocket,
  Send,
  Paperclip,
  CheckCheck,
  Check,
  AlertTriangle,
  AlertCircle,
  Play,
  Database,
  ExternalLink,
  Plug,
  Building2,
  ShieldCheck,
  Zap,
  X,
  FileUp,
  FileWarning,
  RefreshCw,
  Phone,
  MoreVertical,
  Edit3,
  UserPlus,
  Activity,
  FileCheck,
  Clock,
  Sparkles,
  Shield,
  BadgeCheck,
  Lock,
  ChevronDown,
  User,
  PanelRightClose,
  PanelRightOpen,
  ArrowRight,
  UploadCloud,
  FileCode,
  Eye,
  CheckCircle,
  Loader2
} from 'lucide-react';

/* ── Client profiles for simulation ───────────────────────── */
const CLIENT_PERSONAS = [
  { phone: '919876543210', name: 'Rajesh Sharma', initials: 'RS', color: '#0284c7', company: 'Apex Cloud Technologies' },
  { phone: '919811223344', name: 'Sunita Verma',  initials: 'SV', color: '#7c3aed', company: 'Zenith NextGen Logistics' },
  { phone: '919988776655', name: 'Vikram Malhotra',initials: 'VM',color: '#ea580c', company: 'National Infrastructure Advisory' },
  { phone: '919700001111', name: 'Aisha Patel',   initials: 'AP', color: '#db2777', company: 'GreenLeaf Ventures' },
];

const FLOW_STEPS = [
  { id: 'NEW',                 label: 'Client Inquiry',        sub: 'WhatsApp message received',   icon: MessageSquare },
  { id: 'DOCUMENTS_PENDING',  label: 'Docs Requested',         sub: 'Bot sent document checklist', icon: FileText },
  { id: 'PROCESSING',         label: 'AI Extraction',          sub: 'Groq LLM parsing documents',  icon: Cpu },
  { id: 'CLIENT_CONFIRMATION', label: 'Client Confirmation',   sub: 'Awaiting client sign-off',    icon: CheckCircle2 },
  { id: 'NAME_REVIEW',        label: 'Name Screening',         sub: 'MCA & Trademark check',       icon: Search },
  { id: 'ADMIN_REVIEW',       label: 'CA Review',              sub: 'Admin portal verification',   icon: UserCheck },
  { id: 'READY_FOR_EXTENSION', label: 'Extension Ready',       sub: 'SPICe+ autofill unlocked',    icon: Rocket },
];

const STATUS_TO_STEP = {
  NEW: 0, DOCUMENTS_PENDING: 1, PROCESSING: 2,
  CLIENT_CONFIRMATION: 3, NAME_REVIEW: 4,
  ADMIN_REVIEW: 5, READY_FOR_EXTENSION: 6,
  NEEDS_CORRECTION: 2, MANUAL_REVIEW: 3,
};

function timeStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderFormattedWhatsAppText(raw) {
  if (!raw || typeof raw !== 'string') return raw || null;
  const lines = raw.split('\n');
  return lines.map((line, li) => {
    if (line.startsWith('━━━━')) {
      return <div key={li} style={{ borderBottom: '1px solid #e2e8f0', margin: '6px 0' }} />;
    }
    const parts = line.split(/(\*[^*]+\*|_[^_]+_|`[^`]+`)/g);
    return (
      <div key={li} style={{ minHeight: line.trim() === '' ? '0.75em' : 'auto', margin: '1px 0' }}>
        {parts.map((p, pi) => {
          if (!p || typeof p !== 'string') return null;
          if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
            return <strong key={pi} style={{ fontWeight: 600, color: '#0f172a' }}>{p.slice(1, -1)}</strong>;
          }
          if (p.startsWith('_') && p.endsWith('_') && p.length > 2) {
            return <em key={pi} style={{ color: '#475569', fontSize: 12 }}>{p.slice(1, -1)}</em>;
          }
          if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
            return <code key={pi} style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 4, fontSize: 12, color: '#0369a1', fontFamily: 'var(--font-mono)' }}>{p.slice(1, -1)}</code>;
          }
          return p;
        })}
      </div>
    );
  });
}

function TypingBubble() {
  return (
    <div className="wa-msg inbound" style={{ marginTop: 4 }}>
      <div className="wa-bubble" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Ledgerly Assistant is typing</span>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 2 }}>
          <div className="wa-typing-dot" />
          <div className="wa-typing-dot" />
          <div className="wa-typing-dot" />
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppSimulator() {
  const [activeClient, setActiveClient] = useState(CLIENT_PERSONAS[0]);
  const [messages, setMessages] = useState({});
  const [caseStatus, setCaseStatus] = useState({});
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [scanningDocName, setScanningDocName] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [showExtPanel, setShowExtPanel] = useState(false);
  const [extDossier, setExtDossier] = useState(null);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);
  const [lastExtraction, setLastExtraction] = useState(null);

  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const addToast = useCallback((text, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  /* Auto-scroll to bottom of chat */
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeClient, isTyping, isScanningOcr]);

  /* Load messages for current client phone */
  const loadMessages = useCallback(async (phone) => {
    if (!phone) return;
    try {
      const res = await fetch(`/api/mock/outbound?phone=${phone}`);
      const data = await res.json();
      const converted = Array.isArray(data) ? data.map((m, idx) => ({
        id: m.wamid || `bot_msg_${idx}`,
        role: 'bot',
        text: m.type === 'text' ? m.text?.body : m.interactive?.body?.text || '',
        buttons: m.type === 'interactive' ? m.interactive?.action?.buttons?.map(b => b.reply) : null,
        time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : timeStr(),
        type: m.type,
      })) : [];

      setMessages(prev => {
        const existing = prev[phone] || [];

        // Initial default welcome if brand new contact has 0 messages
        if (existing.length === 0 && converted.length === 0) {
          const defaultGreeting = {
            id: 'init_welcome',
            role: 'bot',
            text: `Hello ${activeClient.name}! Welcome to Ledgerly — your MCA Company Incorporation Preparation Partner.\n\nWe assemble verified incorporation dossiers for MCA SPICe+ Part A & B filings.\n\nTo begin:\n1. Reply with your proposed Company Name(s).\n2. Upload Director Identity documents (PAN Card, Aadhaar).\n\nYou can reply with your company name below or click suggested prompt chips.`,
            buttons: [
              { id: 'BTN_START_APEX', title: `Register "${activeClient.company} Pvt Ltd"` },
              { id: 'BTN_STATUS', title: 'Check Case Status' },
              { id: 'BTN_TALK_CA', title: 'Talk to CA' }
            ],
            time: timeStr(),
            type: 'interactive',
          };
          return { ...prev, [phone]: [defaultGreeting] };
        }

        // Avoid duplicating bot messages that are already present
        const existingBotKeys = new Set(existing.filter(m => m.role === 'bot').map(m => m.id || m.text));
        const newBotMsgs = converted.filter(m => !existingBotKeys.has(m.id || m.text));

        if (newBotMsgs.length === 0) {
          return existing.length ? prev : { ...prev, [phone]: converted };
        }

        return { ...prev, [phone]: [...existing, ...newBotMsgs] };
      });
    } catch (e) { /* silent */ }
  }, [activeClient]);

  /* Load active case status for client */
  const loadCaseStatus = useCallback(async (phone) => {
    try {
      const res = await fetch(`/api/admin/cases`, { headers: { 'x-user-role': 'ADMIN' } });
      const data = await res.json();
      const clientCases = {};
      data.forEach(c => {
        if (c.client?.phone_number === phone || c.client?.phone_number === '+' + phone) {
          clientCases[phone] = { status: c.status, caseNumber: c.case_number, caseId: c.id };
        }
      });
      setCaseStatus(prev => ({ ...prev, ...clientCases }));
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    if (activeClient) {
      loadMessages(activeClient.phone);
      loadCaseStatus(activeClient.phone);
    }
  }, [activeClient, loadMessages, loadCaseStatus]);

  /* ── Send Message as Client (User POV) ───────────────────── */
  const sendMessageAsClient = useCallback(async (customPayload = null, displayText = null) => {
    if (!activeClient) return;
    const phone = activeClient.phone;
    const text = displayText || inputText.trim();
    if (!customPayload && !text) return;

    setIsSending(true);
    setShowAttachMenu(false);
    if (!customPayload) setInputText('');

    // Optimistically render green bubble on right as Client's message
    const clientBubble = { role: 'user', text: displayText || text, time: timeStr() };
    setMessages(prev => ({ ...prev, [phone]: [...(prev[phone] || []), clientBubble] }));

    const payload = customPayload || {
      senderPhone: phone,
      senderName: activeClient.name,
      type: 'text',
      text,
    };

    try {
      const res = await fetch('/api/mock/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      setIsTyping(true);
      await new Promise(r => setTimeout(r, 600 + Math.random() * 300));
      setIsTyping(false);

      await loadMessages(phone);

      if (result.caseStatus) {
        setCaseStatus(prev => ({
          ...prev,
          [phone]: { status: result.caseStatus, caseNumber: result.caseNumber, caseId: result.caseId },
        }));
      }
      await loadCaseStatus(phone);

      if (result.caseStatus === 'NAME_REVIEW') {
        addToast('Name screening check triggered automatically', 'info');
      }
      if (result.caseStatus === 'ADMIN_REVIEW') {
        addToast('Case moved to CA Admin Review queue', 'info');
      }
    } catch (e) {
      addToast('Backend not reachable — verify server is running on port 4000', 'error');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [activeClient, inputText, loadMessages, loadCaseStatus, addToast]);

  /* ── Upload Document as Client with Real Animation ───────── */
  const sendDocumentWithUploadAnimation = useCallback(async (docConfig) => {
    if (!activeClient) return;
    const phone = activeClient.phone;
    setShowAttachMenu(false);
    setIsSending(true);

    const filename = docConfig.filename || 'director_pan_card.pdf';
    const size = docConfig.size || '425 KB';
    const docId = 'doc_' + Date.now();

    // 1. Initial uploading bubble with progress bar starting at 15%
    const uploadBubble = {
      id: docId,
      role: 'user',
      isDocument: true,
      filename,
      size,
      progress: 25,
      isUploading: true,
      time: timeStr(),
    };

    setMessages(prev => ({ ...prev, [phone]: [...(prev[phone] || []), uploadBubble] }));

    // 2. Animate upload progression (Client POV)
    await new Promise(r => setTimeout(r, 250));
    setMessages(prev => ({
      ...prev,
      [phone]: prev[phone].map(m => m.id === docId ? { ...m, progress: 65 } : m)
    }));

    await new Promise(r => setTimeout(r, 250));
    setMessages(prev => ({
      ...prev,
      [phone]: prev[phone].map(m => m.id === docId ? { ...m, progress: 100, isUploading: false } : m)
    }));

    addToast(`Uploaded ${filename}`, 'success');

    // 3. Trigger live OCR scanning feedback
    setScanningDocName(filename);
    setIsScanningOcr(true);

    try {
      let res;
      if (docConfig.fileObject) {
        const formData = new FormData();
        formData.append('document', docConfig.fileObject);
        formData.append('senderPhone', phone);
        formData.append('senderName', activeClient.name);
        res = await fetch('/api/mock/upload-document', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/mock/simulate-inbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderPhone: phone,
            senderName: activeClient.name,
            type: 'document',
            filename,
          }),
        });
      }
      const result = await res.json();

      // Store extraction results for preview modal
      if (result.extraction) {
        setLastExtraction({ ...result.extraction, documentType: result.documentType, filename });
      }

      await new Promise(r => setTimeout(r, 800));
      setIsScanningOcr(false);

      await loadMessages(phone);

      if (result.caseStatus) {
        setCaseStatus(prev => ({
          ...prev,
          [phone]: { status: result.caseStatus, caseNumber: result.caseNumber, caseId: result.caseId },
        }));
      }
      await loadCaseStatus(phone);
      addToast('Document processed via Ledgerly AI OCR', 'info');
    } catch (e) {
      setIsScanningOcr(false);
      addToast('Upload failed to reach backend', 'error');
    } finally {
      setIsSending(false);
    }
  }, [activeClient, loadMessages, loadCaseStatus, addToast]);

  /* ── Real local file picker handler ──────────────────────── */
  const handleRealLocalFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeStr = file.size > 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : Math.round(file.size / 1024) + ' KB';
    sendDocumentWithUploadAnimation({
      filename: file.name,
      size: sizeStr,
      isReal: true,
      fileObject: file
    });
    e.target.value = '';
  };

  /* ── Automated End-to-End Client Upload Workflow ─────────── */
  const runAutomatedUploadFlow = async () => {
    if (!activeClient) return;
    setIsSending(true);
    const p = activeClient.phone;
    const n = activeClient.name;

    addToast('Starting automated client document upload intake...', 'info');

    // Step 1: Client submits company name
    const step1Msg = { role: 'user', text: `Hello, I want to incorporate "${activeClient.company} Private Limited" in Maharashtra.`, time: timeStr() };
    setMessages(prev => ({ ...prev, [p]: [...(prev[p] || []), step1Msg] }));

    await fetch('/api/mock/simulate-inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderPhone: p, senderName: n, type: 'text', text: step1Msg.text }),
    });
    await new Promise(r => setTimeout(r, 600));
    await loadMessages(p);
    await loadCaseStatus(p);

    // Step 2: Client uploads Director PAN Card with realistic animation
    await new Promise(r => setTimeout(r, 800));
    await sendDocumentWithUploadAnimation({
      filename: 'director_rajesh_pan.pdf',
      size: '428 KB',
    });

    // Step 3: Client clicks Confirm Details
    await new Promise(r => setTimeout(r, 1000));
    const confirmMsg = { role: 'user', text: `[Selected: Confirm Details]`, time: timeStr() };
    setMessages(prev => ({ ...prev, [p]: [...(prev[p] || []), confirmMsg] }));

    await fetch('/api/mock/simulate-inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderPhone: p, senderName: n, type: 'interactive', buttonId: 'BTN_CONFIRM_DETAILS' }),
    });

    setIsTyping(true);
    await new Promise(r => setTimeout(r, 800));
    setIsTyping(false);

    await loadMessages(p);
    await loadCaseStatus(p);

    setIsSending(false);
    addToast('All documents uploaded, OCR parsed, and details confirmed!', 'success');
  };

  /* ── Interactive button click handler ─────────────────────── */
  const sendInteractiveReply = (buttonId, title) => sendMessageAsClient({
    senderPhone: activeClient.phone,
    senderName: activeClient.name,
    type: 'interactive',
    buttonId,
  }, `[Selected: ${title}]`);

  /* ── Admin & Extension Bridge Helpers ───────────────────── */
  const fetchExtDossier = async () => {
    const cs = caseStatus[activeClient?.phone];
    if (!cs?.caseId) { addToast('No active case found for this client', 'error'); return; }
    try {
      const res = await fetch(`/api/extension/cases/${cs.caseId}/dossier`, {
        headers: { 'x-extension-key': 'ext_ledgerly_mca_bridge_token_2026' },
      });
      if (!res.ok) {
        const err = await res.json();
        addToast(err.message || 'Access restricted', 'error');
        return;
      }
      const data = await res.json();
      setExtDossier(data);
      setShowExtPanel(true);
      addToast('Extension dossier retrieved successfully', 'success');
    } catch (e) {
      addToast('Could not reach backend', 'error');
    }
  };

  const advanceCaseState = async (targetState) => {
    const cs = caseStatus[activeClient?.phone];
    if (!cs?.caseId) { addToast('No case found for this client.', 'error'); return; }
    try {
      const res = await fetch(`/api/admin/cases/${cs.caseId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({
          newState: targetState,
          reason: 'State transition from simulation console'
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        addToast(err.error || 'Transition not allowed', 'error');
        return;
      }
      addToast(`Case transitioned to ${targetState.replace(/_/g, ' ')}`, 'success');
      await loadCaseStatus(activeClient.phone);
    } catch (e) {
      addToast('Could not reach backend.', 'error');
    }
  };

  const fastTrackToReady = async () => {
    const cs = caseStatus[activeClient?.phone];
    if (!cs?.caseId) { addToast('No case found for this client.', 'error'); return; }
    addToast('Progressing case to Ready for Extension...', 'info');
    try {
      if (cs.status === 'CLIENT_CONFIRMATION') {
        await fetch(`/api/admin/cases/${cs.caseId}/state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
          body: JSON.stringify({ newState: 'NAME_REVIEW', reason: 'Fast-track transition' }),
        });
      }
      await fetch(`/api/admin/cases/${cs.caseId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ newState: 'ADMIN_REVIEW', reason: 'Fast-track transition' }),
      });
      await fetch(`/api/admin/cases/${cs.caseId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ newState: 'READY_FOR_EXTENSION', reason: 'CA Approved for MCA V3' }),
      });
      addToast('Case is now READY FOR EXTENSION', 'success');
      await loadCaseStatus(activeClient.phone);
    } catch (e) {
      addToast('Failed fast-tracking case', 'error');
    }
  };

  const simulateMcaFilingAndNotify = async () => {
    if (!activeClient) return;
    const cs = caseStatus[activeClient.phone];
    const srn = `SRN-MCA-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    setIsSending(true);
    addToast('Autofilling SPICe+ Part A & Part B on MCA V3...', 'info');

    await new Promise(r => setTimeout(r, 1000));

    try {
      const msgText = `MINISTRY OF CORPORATE AFFAIRS (MCA)\n\nDear ${activeClient.name},\nYour SPICe+ (INC-32) incorporation filing for ${activeClient.company} Private Limited has been submitted to ROC.\n\nSRN: ${srn}\nStatus: PENDING ROC APPROVAL\nCase Reference: ${cs?.caseNumber || 'MCA-2026'}\n\nYou can track real-time ROC scrutiny by replying with STATUS.`;

      await fetch('/api/mock/send-outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeClient.phone,
          text: msgText,
          buttons: [
            { id: 'BTN_STATUS', title: 'Check ROC Status' },
            { id: 'BTN_RECEIPT', title: 'Download Challan' }
          ]
        }),
      });

      await loadMessages(activeClient.phone);
      setShowExtPanel(false);
      addToast(`Filing complete! Official SRN dispatched to your WhatsApp (${srn})`, 'success');
    } catch (e) {
      addToast('Failed sending WhatsApp update', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const cs = caseStatus[activeClient?.phone];
  const currentStep = cs ? (STATUS_TO_STEP[cs.status] ?? 0) : -1;
  const activeMessages = messages[activeClient.phone] || [];

  return (
    <div style={{ height: 'calc(100vh - 58px)', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Hidden real file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        onChange={handleRealLocalFileSelected}
      />

      {/* ── Top Client Persona Selector Bar ─────────────────────── */}
      <div style={{
        padding: '8px 0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#ffffff',
            border: '1px solid var(--border-mid)',
            borderRadius: 8,
            padding: '4px 10px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>CLIENT POV:</span>
            <select
              value={activeClient.phone}
              onChange={e => {
                const found = CLIENT_PERSONAS.find(c => c.phone === e.target.value);
                if (found) setActiveClient(found);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--text-primary)',
                padding: '2px 4px',
                cursor: 'pointer',
                outline: 'none',
                width: 'auto',
              }}
            >
              {CLIENT_PERSONAS.map(c => (
                <option key={c.phone} value={c.phone}>
                  {c.name} — {c.company} (+{c.phone})
                </option>
              ))}
            </select>
          </div>

          {cs?.caseNumber && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: 'var(--wa-green-dark)',
              padding: '4px 10px',
              borderRadius: 8,
              fontWeight: 600,
            }}>
              <span>Case: {cs.caseNumber}</span>
              <span className={`badge badge-${cs.status === 'READY_FOR_EXTENSION' ? 'ready' : cs.status === 'MANUAL_REVIEW' ? 'manual' : cs.status === 'CLIENT_CONFIRMATION' ? 'confirmation' : 'processing'}`}>
                {cs.status?.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={runAutomatedUploadFlow}
            disabled={isSending}
            title="Auto-upload company name, director PAN & confirm details"
          >
            <UploadCloud size={14} /> {isSending ? 'Uploading...' : 'Auto-Upload All KYC'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowSidePanel(!showSidePanel)}
            title="Toggle Live Pipeline Companion"
          >
            {showSidePanel ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            <span>{showSidePanel ? 'Hide Companion' : 'Show Pipeline'}</span>
          </button>
        </div>
      </div>

      {/* ── Main WhatsApp Workspace ───────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border-mid)',
        minHeight: 0,
        boxShadow: 'var(--shadow-sm)',
        background: '#ffffff',
      }}>

        {/* ── Client WhatsApp Chat Interface (Client POV) ────── */}
        <div className="wa-chat" style={{ flex: 1 }}>
          {/* Authentic WhatsApp Business Header */}
          <div className="wa-chat-header">
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#00a884',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
              flexShrink: 0,
              boxShadow: '0 2px 5px rgba(0,168,132,0.2)',
            }}>
              L
            </div>

            <div className="wa-chat-header-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="wa-chat-header-name">Ledgerly MCA Assistant</span>
                <BadgeCheck size={16} color="#00a884" fill="#ecfdf5" title="Verified WhatsApp Business Account" />
              </div>
              <div className="wa-chat-header-status">
                {isScanningOcr
                  ? `AI OCR Scanning ${scanningDocName}...`
                  : isTyping
                  ? 'typing...'
                  : 'Official Business Account • Online'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <button
                className="wa-attach-btn"
                title="Reset conversation"
                onClick={async () => {
                  await fetch('/api/mock/reset', { method: 'POST' });
                  setMessages(prev => ({ ...prev, [activeClient.phone]: [] }));
                  loadMessages(activeClient.phone);
                  addToast('Conversation reset', 'info');
                }}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="wa-messages">
            {/* End-to-end encryption notification banner */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e9edef',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 11,
                color: '#54656f',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
                maxWidth: 480,
                textAlign: 'center',
              }}>
                <Lock size={12} color="#008069" style={{ flexShrink: 0 }} />
                <span>Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read them.</span>
              </div>
            </div>

            <div className="wa-date-divider">
              <div className="wa-date-pill">Today</div>
            </div>

            {/* Message bubbles */}
            {activeMessages.map((msg, idx) => {
              const isClient = msg.role === 'user';
              const isDocMessage = msg.isDocument || msg.text?.startsWith('DOC:');
              const docName = msg.filename || (msg.text?.startsWith('DOC:') ? msg.text.replace('DOC: ', '') : null);

              return (
                <div
                  key={msg.id || idx}
                  className={`wa-msg ${isClient ? 'outbound' : msg.role === 'system' ? 'system-msg' : 'inbound'}`}
                >
                  <div className="wa-bubble">
                    {/* Rich Document Card with Animated Progress and Lightbox Trigger */}
                    {isDocMessage ? (
                      <div
                        className="wa-doc-bubble"
                        onClick={() => setSelectedDocPreview({
                          filename: docName,
                          size: msg.size || '425 KB',
                          status: msg.isUploading ? 'Uploading' : 'Verified by AI'
                        })}
                        title="Click to preview document extraction"
                      >
                        <div className="wa-doc-bubble-body">
                          <div className="wa-doc-badge">PDF</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {docName}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{msg.size || '425 KB'}</span>
                              <span>•</span>
                              <span>{msg.isUploading ? `Uploading ${msg.progress || 40}%` : 'Uploaded'}</span>
                            </div>
                          </div>
                          <div style={{ color: '#64748b' }}>
                            <Eye size={15} />
                          </div>
                        </div>

                        {/* Upload progress bar if uploading */}
                        {msg.isUploading && (
                          <div className="wa-doc-progress-container">
                            <div
                              className="wa-doc-progress-fill"
                              style={{ width: `${msg.progress || 35}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      renderFormattedWhatsAppText(msg.text)
                    )}

                    {/* Interactive buttons in bot message */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="wa-buttons-group">
                        {msg.buttons.map((b, bi) => (
                          <button
                            key={bi}
                            className="wa-btn-reply"
                            disabled={isSending}
                            onClick={() => sendInteractiveReply(b.id, b.title)}
                          >
                            {b.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="wa-msg-meta">
                    <span>{msg.time}</span>
                    {isClient && (
                      msg.isUploading ? (
                        <Clock size={12} color="#94a3b8" />
                      ) : (
                        <CheckCheck size={14} className="wa-msg-tick" strokeWidth={2.2} />
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pulsing AI OCR Scanner Banner */}
            {isScanningOcr && (
              <div className="wa-ocr-banner">
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>
                  Ledgerly AI OCR: Parsing <strong>{scanningDocName}</strong> (extracting Name, PAN & registered office)...
                </span>
              </div>
            )}

            {isTyping && <TypingBubble />}
            <div ref={msgEndRef} />
          </div>

          {/* Quick client suggestion chips */}
          <div style={{
            padding: '8px 14px',
            background: '#ffffff',
            borderTop: '1px solid #e9edef',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Quick Upload:</span>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => sendDocumentWithUploadAnimation({ filename: 'director_pan_card.pdf', size: '425 KB' })}
              disabled={isSending}
            >
              <FileUp size={12} color="#0284c7" /> Upload PAN Card
            </button>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => sendDocumentWithUploadAnimation({ filename: 'director_aadhaar_card.pdf', size: '610 KB' })}
              disabled={isSending}
            >
              <FileUp size={12} color="#059669" /> Upload Aadhaar Card
            </button>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => sendDocumentWithUploadAnimation({ filename: 'electricity_bill.pdf', size: '315 KB' })}
              disabled={isSending}
            >
              <FileUp size={12} color="#7c3aed" /> Upload Address Proof
            </button>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => sendInteractiveReply('BTN_CONFIRM_DETAILS', 'Confirm Details')}
              disabled={isSending}
            >
              <CheckCircle2 size={12} color="#00a884" /> Confirm Details
            </button>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => sendMessageAsClient(null, 'STATUS')}
              disabled={isSending}
            >
              "Check Status"
            </button>
          </div>

          {/* WhatsApp Text Input Bar (Client Sender) */}
          <div className="wa-input-bar" style={{ position: 'relative' }}>
            {/* Attachment dropdown menu */}
            {showAttachMenu && (
              <div className="wa-attach-menu-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
                  Upload Document (Client POV)
                </div>

                {/* Browse Real File from disk */}
                <button
                  className="wa-attach-item"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={16} color="#0284c7" />
                  <div>
                    <div>Browse from Device</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Choose any PDF or image on your computer</div>
                  </div>
                </button>

                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />

                <button
                  className="wa-attach-item"
                  onClick={() => sendDocumentWithUploadAnimation({ filename: 'director_pan_card.pdf', size: '425 KB' })}
                >
                  <FileText size={16} color="#0284c7" />
                  <div>
                    <div>Director PAN Card</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>director_pan_card.pdf • 425 KB</div>
                  </div>
                </button>

                <button
                  className="wa-attach-item"
                  onClick={() => sendDocumentWithUploadAnimation({ filename: 'director_aadhaar_card.pdf', size: '610 KB' })}
                >
                  <FileText size={16} color="#059669" />
                  <div>
                    <div>Director Aadhaar Card</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>aadhaar_card.pdf • 610 KB</div>
                  </div>
                </button>

                <button
                  className="wa-attach-item"
                  onClick={() => sendDocumentWithUploadAnimation({ filename: 'electricity_bill.pdf', size: '315 KB' })}
                >
                  <FileText size={16} color="#7c3aed" />
                  <div>
                    <div>Utility Bill / Address Proof</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>electricity_bill.pdf • 315 KB</div>
                  </div>
                </button>

                <button
                  className="wa-attach-item"
                  style={{ color: '#b91c1c' }}
                  onClick={() => sendDocumentWithUploadAnimation({ filename: 'blurry_unreadable_scan.pdf', size: '180 KB' })}
                >
                  <FileWarning size={16} color="#b91c1c" />
                  <div>
                    <div>Blurry Scan (Test OCR Flag)</div>
                    <div style={{ fontSize: 10.5, color: '#f87171' }}>Low readability • triggers CA review</div>
                  </div>
                </button>
              </div>
            )}

            <button
              className="wa-attach-btn"
              title="Attach Document"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              disabled={isSending}
            >
              <Paperclip size={16} />
            </button>

            <input
              ref={inputRef}
              placeholder={`Message as ${activeClient.name} (e.g. "I want to incorporate...", "Here is my PAN card")`}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isSending && sendMessageAsClient()}
              disabled={isSending}
            />

            <button
              className="wa-send-btn"
              onClick={() => sendMessageAsClient()}
              disabled={isSending || !inputText.trim()}
              title="Send WhatsApp Message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* ── Operational Companion & Extension Panel ────────── */}
        {showSidePanel && (
          <div className="flow-panel" style={{ width: 310 }}>
            <div className="flow-panel-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Activity size={15} color="var(--wa-green-dark)" /> Live Case Flow
              </span>
              {cs && (
                <span className={`badge badge-${cs.status === 'READY_FOR_EXTENSION' ? 'ready' : cs.status === 'MANUAL_REVIEW' ? 'manual' : cs.status === 'CLIENT_CONFIRMATION' ? 'confirmation' : 'processing'}`}>
                  {cs.status?.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            <div className="flow-steps">
              {FLOW_STEPS.map((step, i) => {
                const IconComponent = step.icon;
                const stepState = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';
                return (
                  <div key={step.id} className={`flow-step ${stepState}`}>
                    <div className="flow-step-num">
                      {stepState === 'done' ? <Check size={11} strokeWidth={2.5} /> : i + 1}
                    </div>
                    <div className="flow-step-content">
                      <div className="flow-step-label">{step.label}</div>
                      <div className="flow-step-sub">{step.sub}</div>
                    </div>
                    <div className="flow-step-icon">
                      <IconComponent size={14} strokeWidth={1.8} />
                    </div>
                  </div>
                );
              })}
            </div>

            {cs && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-mid)', background: '#fafbfc' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                  Client Dossier Reference
                </div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--wa-green-dark)', fontWeight: 700 }}>
                  {cs.caseNumber}
                </div>
              </div>
            )}

            <div className="quick-actions">
              <div className="quick-action-title">Backend & Extension Testing</div>

              {/* Automated Upload Flow Button */}
              <button
                className="btn btn-primary btn-sm"
                onClick={runAutomatedUploadFlow}
                disabled={isSending}
                style={{ background: '#00a884', color: '#ffffff' }}
              >
                <UploadCloud size={13} /> Automate Full KYC Upload
              </button>

              {/* Workflow transitions */}
              {activeClient && cs && cs.status === 'CLIENT_CONFIRMATION' && (
                <button className="btn btn-secondary btn-sm" onClick={() => advanceCaseState('NAME_REVIEW')}>
                  <Search size={13} /> Advance to Name Screening
                </button>
              )}
              {activeClient && cs && cs.status === 'NAME_REVIEW' && (
                <button className="btn btn-secondary btn-sm" onClick={() => advanceCaseState('ADMIN_REVIEW')}>
                  <FileCheck size={13} /> Advance to CA Review
                </button>
              )}
              {activeClient && cs && cs.status === 'ADMIN_REVIEW' && (
                <button className="btn btn-primary btn-sm" onClick={() => advanceCaseState('READY_FOR_EXTENSION')}>
                  <ShieldCheck size={13} /> CA Approve for Extension
                </button>
              )}

              {/* Fast Track if not yet ready */}
              {activeClient && cs && cs.status !== 'READY_FOR_EXTENSION' && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={fastTrackToReady}
                  style={{ borderColor: 'var(--wa-green)', color: 'var(--wa-green-dark)' }}
                >
                  <Zap size={13} /> 1-Click Fast-Track Approval
                </button>
              )}

              {/* Ready for Extension Actions */}
              {activeClient && cs?.status === 'READY_FOR_EXTENSION' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={fetchExtDossier}>
                    <Plug size={13} /> Inspect Extension Dossier
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={simulateMcaFilingAndNotify}
                    style={{ background: '#00a884', color: '#ffffff', fontWeight: 600, border: 'none' }}
                  >
                    <Building2 size={13} /> Run MCA Filing & Send SRN
                  </button>
                </>
              )}

              <a href="http://localhost:3000" target="_blank" rel="noreferrer">
                <button className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                  <ExternalLink size={13} /> View Admin Dashboard
                </button>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Lightbox Preview Modal ────────────────────── */}
      {selectedDocPreview && (
        <div className="modal-overlay" onClick={() => setSelectedDocPreview(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="wa-doc-badge">PDF</div>
                <div>
                  <div className="modal-title" style={{ fontSize: 15, marginBottom: 2 }}>{selectedDocPreview.filename}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {selectedDocPreview.size} • 256-bit Encrypted • Verified KYC
                  </div>
                </div>
              </div>
              <button className="wa-attach-btn" onClick={() => setSelectedDocPreview(null)} style={{ width: 30, height: 30 }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--wa-green-dark)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={14} /> AI Vision Extraction Results (Confidence: 98%)
              </div>

              {(() => {
                const ext = lastExtraction || {};
                const docTypeLabels = {
                  PAN: 'Permanent Account Number (PAN)',
                  AADHAAR: 'Aadhaar Card',
                  DRIVING_LICENSE: 'Driving License',
                  GST: 'GST Certificate',
                  GENERAL: 'Identity Document'
                };
                const rows = [
                  { label: 'Document Type', value: docTypeLabels[ext.documentType] || ext.documentType || 'Identity Document' },
                  ext.director_name && { label: 'Name', value: ext.director_name, bold: true },
                  ext.director_pan && { label: 'PAN Number', value: ext.director_pan, mono: true },
                  ext.director_aadhaar && { label: 'Aadhaar', value: ext.director_aadhaar.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'), mono: true },
                  ext.director_dob && { label: 'Date of Birth', value: ext.director_dob },
                  ext.director_father_name && { label: "Father's Name", value: ext.director_father_name },
                  ext.director_address && { label: 'Address', value: ext.director_address },
                  ext.director_gender && { label: 'Gender', value: ext.director_gender },
                ].filter(Boolean);
                if (rows.length === 1) rows.push({ label: 'Status', value: 'No fields extracted', badge: true });
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                    {rows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                        {row.mono ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0284c7' }}>{row.value}</span>
                        ) : row.badge ? (
                          <span className="badge badge-pending">{row.value}</span>
                        ) : (
                          <span style={{ fontWeight: row.bold ? 700 : 600 }}>{row.value}</span>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Verification</span>
                      <span className="badge badge-ready">AI Verified</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDocPreview(null)}>
                Close Preview
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  sendInteractiveReply('BTN_CONFIRM_DETAILS', 'Confirm Details');
                  setSelectedDocPreview(null);
                }}
              >
                <CheckCircle2 size={13} /> Confirm Details in Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extension Dossier Inspection Modal ─────────────────── */}
      {showExtPanel && extDossier && (
        <div className="modal-overlay" onClick={() => setShowExtPanel(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plug size={18} color="var(--wa-green-dark)" /> MCA V3 SPICe+ Dossier Handoff
                </div>
                <div className="modal-sub">
                  Case {extDossier.case_reference} • Authorized for Chrome Extension Auto-fill
                </div>
              </div>
              <button className="wa-attach-btn" onClick={() => setShowExtPanel(false)} style={{ width: 30, height: 30 }}>
                <X size={15} />
              </button>
            </div>

            <div className="extension-panel">
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--wa-green-dark)' }}>
                SPICe+ Part A — Company Details
              </div>
              {[
                ['Proposed Name', extDossier.spice_plus_part_a?.proposed_name_primary],
                ['Company Type', extDossier.spice_plus_part_a?.company_type],
                ['Category', extDossier.spice_plus_part_a?.company_category],
                ['Class of Company', extDossier.spice_plus_part_a?.class_of_company],
                ['Activity Code', extDossier.spice_plus_part_a?.industrial_activity_code],
                ['Nature of Business', extDossier.spice_plus_part_a?.nature_of_business],
              ].map(([k, v]) => v && (
                <div key={k} className="ext-field-row">
                  <div className="ext-field-key">{k}</div>
                  <div className="ext-field-val">{v}</div>
                  <div className="ext-field-verified">
                    <Check size={11} strokeWidth={2.5} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--wa-green-dark)' }}>
                SPICe+ Part B — Office & Capital
              </div>
              {[
                ['State', extDossier.spice_plus_part_b?.registered_office?.state],
                ['District', extDossier.spice_plus_part_b?.registered_office?.district],
                ['ROC', extDossier.spice_plus_part_b?.registered_office?.ro_jurisdiction],
                ['Authorized Capital', '₹ ' + (extDossier.spice_plus_part_b?.capital_structure?.authorized_capital?.toLocaleString('en-IN') || '')],
                ['Paid-up Capital', '₹ ' + (extDossier.spice_plus_part_b?.capital_structure?.paid_up_capital?.toLocaleString('en-IN') || '')],
              ].map(([k, v]) => v && (
                <div key={k} className="ext-field-row">
                  <div className="ext-field-key">{k}</div>
                  <div className="ext-field-val">{v}</div>
                  <div className="ext-field-verified">
                    <Check size={11} strokeWidth={2.5} />
                  </div>
                </div>
              ))}

              {extDossier.spice_plus_part_b?.subscribers_and_directors?.map((d, i) => (
                <div key={i}>
                  <div style={{ marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--wa-green-dark)' }}>
                    Director {i + 1}
                  </div>
                  {[
                    ['Full Name', d.full_name],
                    ['PAN Card', d.pan],
                    ['Designation', d.designation],
                  ].map(([k, v]) => v && (
                    <div key={k} className="ext-field-row">
                      <div className="ext-field-key">{k}</div>
                      <div className="ext-field-val">{v}</div>
                      <div className="ext-field-verified">
                        <Check size={11} strokeWidth={2.5} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowExtPanel(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={simulateMcaFilingAndNotify}
              >
                <Building2 size={14} /> Auto-fill SPICe+ on MCA & Dispatch SRN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ───────────────────────────────── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? (
              <CheckCircle2 size={16} color="var(--wa-green)" style={{ flexShrink: 0 }} />
            ) : t.type === 'error' ? (
              <AlertCircle size={16} color="var(--color-red)" style={{ flexShrink: 0 }} />
            ) : (
              <Clock size={16} color="var(--color-blue)" style={{ flexShrink: 0 }} />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
