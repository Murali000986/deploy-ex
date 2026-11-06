import React from 'react';

export default function ConfidenceBar({ score = 0.9 }) {
  const percentage = Math.round(score * 100);
  const isLow = score < 0.85;

  return (
    <div className="confidence-container" title={`AI Confidence: ${percentage}%`}>
      <div className="confidence-track">
        <div
          className={`confidence-fill ${isLow ? 'low' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: isLow ? '#f87171' : 'var(--text-secondary)' }}>
        {percentage}%
      </span>
    </div>
  );
}
