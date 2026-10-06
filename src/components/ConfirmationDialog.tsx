import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog> gives us focus trapping and Escape-to-close for free. */
export default function ConfirmationDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-line bg-card p-6 text-ink shadow-soft backdrop:bg-ink/30"
    >
      <h2 id="confirm-title" className="font-serif text-2xl font-semibold">
        {title}
      </h2>
      <p className="mt-2 leading-relaxed text-muted">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary" autoFocus>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#8c3b3b] px-5 text-[0.9rem] font-medium text-white hover:bg-[#743030]"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
