import React from 'react';

const STATUS_MAP = {
  NEW: { label: 'New Intake', className: 'badge-new' },
  DOCUMENTS_PENDING: { label: 'Docs Pending', className: 'badge-pending' },
  PROCESSING: { label: 'Processing', className: 'badge-processing' },
  CLIENT_CONFIRMATION: { label: 'Client Confirm', className: 'badge-confirmation' },
  NAME_REVIEW: { label: 'SPICe+ Name Check', className: 'badge-namereview' },
  ADMIN_REVIEW: { label: 'Admin Review', className: 'badge-adminreview' },
  READY_FOR_EXTENSION: { label: 'Ready for Extension', className: 'badge-ready' },
  NEEDS_CORRECTION: { label: 'Needs Correction', className: 'badge-manual' },
  MANUAL_REVIEW: { label: 'Manual Review', className: 'badge-manual' },
  FAILED_RETRYABLE: { label: 'Failed (Retryable)', className: 'badge-failed' },
  CANCELLED: { label: 'Cancelled', className: 'badge-failed' }
};

export default function StatusBadge({ status }) {
  const item = STATUS_MAP[status] || { label: status, className: 'badge-pending' };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}
