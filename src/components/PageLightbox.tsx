import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { BackgroundMode, ConvertedPage } from '../types/pdf';
import { formatBytes } from '../utils/pdfConverter';

interface PageLightboxProps {
  page: ConvertedPage | null;
  pages: ConvertedPage[];
  backgroundMode: BackgroundMode;
  onClose: () => void;
  onSelectPage: (page: ConvertedPage) => void;
  onExportSingle: (page: ConvertedPage) => void;
}

export const PageLightbox: React.FC<PageLightboxProps> = ({
  page,
  pages,
  backgroundMode,
  onClose,
  onSelectPage,
  onExportSingle,
}) => {
  const currentIndex = page ? pages.findIndex((p) => p.id === page.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < pages.length - 1;

  useEffect(() => {
    if (!page) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onSelectPage(pages[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext) {
        onSelectPage(pages[currentIndex + 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page, pages, currentIndex, hasPrev, hasNext, onClose, onSelectPage]);

  if (!page) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${page.fileName}`}
      onClick={onClose}
    >
      <header
        className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/70 px-6 py-3.5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{page.fileName}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-300 tabular-nums">
            Page {page.pageNumber} of {page.totalPages}
            <span className="mx-2 text-slate-500" aria-hidden="true">
              ·
            </span>
            {page.width} × {page.height} px
            <span className="mx-2 text-slate-500" aria-hidden="true">
              ·
            </span>
            {formatBytes(page.sizeBytes)}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onExportSingle(page)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap cursor-pointer"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export PNG
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition-colors duration-150 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className="relative flex flex-1 items-center justify-center overflow-auto p-6 sm:p-10"
        onClick={onClose}
      >
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPage(pages[currentIndex - 1]);
            }}
            aria-label="Previous page"
            className="fixed left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-900/90 text-white transition-colors duration-150 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div
          className={`max-h-full max-w-5xl overflow-hidden rounded-lg shadow-2xl ${
            backgroundMode === 'transparent' ? 'checkerboard-bg' : 'bg-white'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={page.previewUrl}
            alt={`${page.docName} — Page ${page.pageNumber}`}
            className="max-h-[calc(100vh-140px)] w-auto object-contain"
          />
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPage(pages[currentIndex + 1]);
            }}
            aria-label="Next page"
            className="fixed right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-900/90 text-white transition-colors duration-150 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
