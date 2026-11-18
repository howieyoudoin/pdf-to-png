import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileArchive, Images, Loader2 } from 'lucide-react';

interface ExportMenuButtonProps {
  count: number;
  label: string;
  singleLabel?: string;
  variant?: 'primary' | 'secondary' | 'subtle';
  size?: 'md' | 'sm';
  busy?: boolean;
  busyLabel?: string;
  align?: 'left' | 'right';
  onExportZip: () => void;
  onExportIndividual: () => void;
}

export const ExportMenuButton: React.FC<ExportMenuButtonProps> = ({
  count,
  label,
  singleLabel = 'Export PNG',
  variant = 'secondary',
  size = 'sm',
  busy = false,
  busyLabel,
  align = 'right',
  onExportZip,
  onExportIndividual,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const baseButtonStyles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 border border-transparent'
      : variant === 'subtle'
        ? 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
        : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50';

  const sizeStyles =
    size === 'md'
      ? 'min-h-[40px] px-4 py-2 text-sm font-medium'
      : 'min-h-[36px] px-3.5 py-1.5 text-xs font-semibold';

  if (count <= 1) {
    return (
      <button
        type="button"
        onClick={onExportIndividual}
        disabled={busy || count === 0}
        className={`inline-flex items-center gap-2 rounded-lg transition-colors duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 whitespace-nowrap shrink-0 cursor-pointer ${baseButtonStyles} ${sizeStyles}`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {busy && busyLabel ? busyLabel : singleLabel}
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-lg transition-colors duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 whitespace-nowrap shrink-0 cursor-pointer ${baseButtonStyles} ${sizeStyles}`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{busy && busyLabel ? busyLabel : label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportZip();
            }}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none cursor-pointer"
          >
            <FileArchive className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                Download as ZIP
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                All {count} PNGs bundled in one archive
              </p>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportIndividual();
            }}
            className="mt-0.5 flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none cursor-pointer"
          >
            <Images className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                Save each file individually
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                {count} separate .png downloads
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
