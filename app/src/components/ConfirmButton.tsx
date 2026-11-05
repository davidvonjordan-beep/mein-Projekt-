import { useState, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  question: string;
  confirmLabel: string;
  className?: string;
  onConfirm: () => void;
}

/** Zweistufiger Knopf: erst fragen, dann ausführen (statt Browser-Dialog). */
export function ConfirmButton({ label, question, confirmLabel, className = 'link-btn', onConfirm }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="confirm-row" role="group" aria-label={question}>
      <span>{question}</span>
      <button
        type="button"
        className="btn primary small-btn"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn small-btn" onClick={() => setAsking(false)}>
        Abbrechen
      </button>
    </div>
  );
}
