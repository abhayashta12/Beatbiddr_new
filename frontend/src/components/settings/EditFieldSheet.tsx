import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface EditField {
  key: string;
  label: string;
  value: string;
  maxLength: number;
  /** Blank is allowed (e.g. an optional venue) */
  optional?: boolean;
  inputMode?: 'text' | 'tel';
  onSave: (value: string) => Promise<void>;
}

interface EditFieldSheetProps {
  field: EditField | null;
  onClose: () => void;
}

/**
 * Edits a single value. One field at a time keeps the keyboard, the label and
 * the save button all on screen together on a phone — a full form in a sheet
 * pushes the button under the keyboard.
 */
const EditFieldSheet: React.FC<EditFieldSheetProps> = ({ field, onClose }) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (field) {
      setValue(field.value);
      setError(null);
      setSaving(false);
      // Focus after the sheet has begun animating, or iOS ignores it
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [field]);

  useEffect(() => {
    if (!field) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [field, onClose]);

  if (!field) return null;

  const trimmed = value.trim();
  const unchanged = trimmed === field.value.trim();
  const empty = trimmed.length === 0;
  const canSave = !saving && !unchanged && (field.optional || !empty);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await field.onSave(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={field.label}
        className="relative bg-dark-500 rounded-t-3xl animate-sheet-up motion-reduce:animate-none
                   p-5 pt-3 flex flex-col gap-4 safe-bottom"
      >
        <div className="w-9 h-1 rounded-full bg-white/15 mx-auto" />

        <div>
          <label htmlFor="edit-field" className="label">
            {field.label}
          </label>
          <input
            id="edit-field"
            ref={inputRef}
            type="text"
            inputMode={field.inputMode ?? 'text'}
            maxLength={field.maxLength}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleSave()}
            className="input w-full mt-2.5"
          />
          <p className="text-[12px] muted mt-2">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : empty && !field.optional ? (
              'This cannot be empty.'
            ) : (
              `${trimmed.length} / ${field.maxLength}`
            )}
          </p>
        </div>

        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-ghost flex-1 py-3.5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="btn-primary flex-1 py-3.5 flex items-center justify-center"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditFieldSheet;
