import React from 'react';
import { Check, Download, Maximize2 } from 'lucide-react';
import type { BackgroundMode, ConvertedPage } from '../types/pdf';
import { formatBytes } from '../utils/pdfConverter';

interface PageCardProps {
  page: ConvertedPage;
  selected: boolean;
  backgroundMode: BackgroundMode;
  onToggleSelect: (pageId: string) => void;
  onPreview: (page: ConvertedPage) => void;
  onExportSingle: (page: ConvertedPage) => void;
}

export const PageCard: React.FC<PageCardProps> = ({
  page,
  selected,
  backgroundMode,
  onToggleSelect,
  onPreview,
  onExportSingle,
}) => {
  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white transition-colors duration-150 ${
        selected
          ? 'border-blue-600 ring-1 ring-blue-600'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div
        className={`relative aspect-[3/4] w-full overflow-hidden border-b border-slate-100 ${
          backgroundMode === 'transparent' ? 'checkerboard-bg' : 'bg-slate-100'
        }`}
      >
        <button
          type="button"
          onClick={() => onPreview(page)}
          className="block h-full w-full p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 cursor-zoom-in"
          aria-label={`Inspect ${page.fileName}`}
        >
          <img
            src={page.previewUrl}
            alt={`${page.docName} — Page ${page.pageNumber}`}
            loading="lazy"
            className="h-full w-full object-contain drop-shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition-transform duration-150 group-hover:scale-[1.015]"
          />
        </button>

        <button
          type="button"
          onClick={() => onToggleSelect(page.id)}
          aria-pressed={selected}
          aria-label={selected ? `Deselect page ${page.pageNumber}` : `Select page ${page.pageNumber}`}
          className={`absolute top-2.5 left-2.5 flex h-7 w-7 items-center justify-center rounded-md border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer ${
            selected
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white/95 text-transparent hover:border-slate-400'
          }`}
        >
          <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onPreview(page)}
          aria-label={`Full-size preview of page ${page.pageNumber}`}
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/95 text-slate-600 opacity-0 transition-opacity duration-150 hover:text-slate-900 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            Page <span className="font-mono tabular-nums">{String(page.pageNumber).padStart(2, '0')}</span>
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-500 tabular-nums">
            {page.width}×{page.height}
            <span className="mx-1.5 text-slate-300" aria-hidden="true">
              ·
            </span>
            {formatBytes(page.sizeBytes)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onExportSingle(page)}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap cursor-pointer"
          aria-label={`Export ${page.fileName}`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          PNG
        </button>
      </div>
    </article>
  );
};
