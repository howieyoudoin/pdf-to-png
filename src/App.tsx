import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckSquare,
  FileText,
  FileUp,
  Loader2,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { DropZone } from './components/DropZone';
import { ExportMenuButton } from './components/ExportMenuButton';
import { PageCard } from './components/PageCard';
import { PageLightbox } from './components/PageLightbox';
import type {
  BackgroundMode,
  ConvertedPage,
  PdfDocumentItem,
  RenderOptions,
  RenderScale,
} from './types/pdf';
import {
  convertPdfToPngPages,
  downloadPagesIndividually,
  downloadSinglePage,
  exportPagesArchive,
  formatBytes,
  revokeDocumentUrls,
  sanitizeFileName,
  stripPdfExtension,
} from './utils/pdfConverter';

const SCALE_OPTIONS: Array<{ value: RenderScale; label: string; dpi: string }> = [
  { value: 1, label: '1x', dpi: '72 DPI' },
  { value: 2, label: '2x', dpi: '144 DPI' },
  { value: 3, label: '3x', dpi: '216 DPI' },
  { value: 4, label: '4x', dpi: '288 DPI' },
];

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export default function App() {
  const [documents, setDocuments] = useState<PdfDocumentItem[]>([]);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    scale: 2,
    background: 'white',
  });
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [lightboxPage, setLightboxPage] = useState<ConvertedPage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingSelected, setIsExportingSelected] = useState(false);
  const [exportingDocId, setExportingDocId] = useState<string | null>(null);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const documentsRef = useRef<PdfDocumentItem[]>([]);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
      documentsRef.current.forEach(revokeDocumentUrls);
    };
  }, []);

  const allPages = useMemo(
    () => documents.flatMap((doc) => doc.pages),
    [documents]
  );

  const totalPngBytes = useMemo(
    () => allPages.reduce((sum, page) => sum + page.sizeBytes, 0),
    [allPages]
  );

  const isAnyConverting = useMemo(
    () => documents.some((doc) => doc.status === 'queued' || doc.status === 'converting'),
    [documents]
  );

  const selectedPages = useMemo(
    () => allPages.filter((page) => selectedPageIds.has(page.id)),
    [allPages, selectedPageIds]
  );

  const runConversionForDoc = useCallback(
    async (docId: string, file: File, options: RenderOptions) => {
      const existingController = abortControllersRef.current.get(docId);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      abortControllersRef.current.set(docId, controller);

      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id !== docId) return doc;
          revokeDocumentUrls(doc);
          return {
            ...doc,
            status: 'converting',
            completedPages: 0,
            pages: [],
            errorMessage: undefined,
          };
        })
      );

      try {
        await convertPdfToPngPages(
          docId,
          file,
          options,
          (completed, total) => {
            if (controller.signal.aborted) return;
            setDocuments((prev) =>
              prev.map((doc) =>
                doc.id === docId
                  ? { ...doc, totalPages: total, completedPages: completed }
                  : doc
              )
            );
          },
          (newPage) => {
            if (controller.signal.aborted) return;
            setDocuments((prev) =>
              prev.map((doc) =>
                doc.id === docId
                  ? { ...doc, pages: [...doc.pages, newPage] }
                  : doc
              )
            );
          },
          controller.signal
        );

        if (!controller.signal.aborted) {
          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === docId ? { ...doc, status: 'done' } : doc
            )
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Could not read this PDF file. It may be corrupted or password-protected.';
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? { ...doc, status: 'error', errorMessage: message }
              : doc
          )
        );
      } finally {
        if (abortControllersRef.current.get(docId) === controller) {
          abortControllersRef.current.delete(docId);
        }
      }
    },
    []
  );

  const handleFilesSelected = useCallback(
    (fileList: FileList | File[]) => {
      dragCounterRef.current = 0;
      setIsWindowDragOver(false);

      const incoming = Array.from(fileList);
      const pdfFiles = incoming.filter(isPdfFile);
      const skippedCount = incoming.length - pdfFiles.length;

      if (skippedCount > 0 && pdfFiles.length === 0) {
        setNotice(
          `Skipped ${skippedCount} non-PDF ${skippedCount === 1 ? 'file' : 'files'}. Please drop PDF documents.`
        );
        return;
      }

      if (skippedCount > 0) {
        setNotice(
          `Added ${pdfFiles.length} PDF ${pdfFiles.length === 1 ? 'file' : 'files'} and skipped ${skippedCount} non-PDF ${skippedCount === 1 ? 'file' : 'files'}.`
        );
      } else {
        setNotice(null);
      }

      if (pdfFiles.length === 0) return;

      const newItems: PdfDocumentItem[] = pdfFiles.map((file, index) => ({
        id: `pdf-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        baseName: stripPdfExtension(file.name),
        sizeBytes: file.size,
        status: 'queued',
        totalPages: 0,
        completedPages: 0,
        pages: [],
      }));

      setDocuments((prev) => [...prev, ...newItems]);

      for (const item of newItems) {
        void runConversionForDoc(item.id, item.file, renderOptions);
      }
    },
    [renderOptions, runConversionForDoc]
  );

  useEffect(() => {
    const resetDragOverlay = () => {
      dragCounterRef.current = 0;
      setIsWindowDragOver(false);
    };

    const handleWindowDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsWindowDragOver(true);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      if (e.relatedTarget === null) {
        resetDragOverlay();
        return;
      }
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsWindowDragOver(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      resetDragOverlay();
      if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
        return;
      }
      e.preventDefault();
      handleFilesSelected(e.dataTransfer.files);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetDragOverlay();
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragend', resetDragOverlay);
    window.addEventListener('blur', resetDragOverlay);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragend', resetDragOverlay);
      window.removeEventListener('blur', resetDragOverlay);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFilesSelected]);

  const updateRenderOptions = (next: RenderOptions) => {
    if (
      next.scale === renderOptions.scale &&
      next.background === renderOptions.background
    ) {
      return;
    }

    setRenderOptions(next);
    setSelectedPageIds(new Set());
    setLightboxPage(null);

    for (const doc of documentsRef.current) {
      void runConversionForDoc(doc.id, doc.file, next);
    }
  };

  const handleScaleChange = (scale: RenderScale) => {
    updateRenderOptions({ ...renderOptions, scale });
  };

  const handleBackgroundChange = (background: BackgroundMode) => {
    updateRenderOptions({ ...renderOptions, background });
  };

  const handleRemoveDocument = (docId: string) => {
    const controller = abortControllersRef.current.get(docId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(docId);
    }

    const targetDoc = documents.find((d) => d.id === docId);
    if (targetDoc) {
      const removedIds = new Set(targetDoc.pages.map((p) => p.id));
      revokeDocumentUrls(targetDoc);
      setSelectedPageIds((prev) => {
        const next = new Set(prev);
        removedIds.forEach((id) => next.delete(id));
        return next;
      });
      if (lightboxPage && removedIds.has(lightboxPage.id)) {
        setLightboxPage(null);
      }
    }

    setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
  };

  const handleClearAll = () => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    documents.forEach(revokeDocumentUrls);
    setDocuments([]);
    setSelectedPageIds(new Set());
    setLightboxPage(null);
    setNotice(null);
  };

  const handleToggleSelectPage = (pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (allPages.length === 0) return;
    if (selectedPageIds.size === allPages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(allPages.map((p) => p.id)));
    }
  };

  const handleToggleSelectDoc = (doc: PdfDocumentItem) => {
    if (doc.pages.length === 0) return;
    const docPageIds = doc.pages.map((p) => p.id);
    const allDocSelected = docPageIds.every((id) => selectedPageIds.has(id));

    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (allDocSelected) {
        docPageIds.forEach((id) => next.delete(id));
      } else {
        docPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleExportSingle = (page: ConvertedPage) => {
    downloadSinglePage(page);
  };

  const handleExportDocumentZip = async (doc: PdfDocumentItem) => {
    if (doc.pages.length === 0) return;
    setExportingDocId(doc.id);
    setExportProgressText('Creating ZIP…');
    try {
      const archiveName = `${sanitizeFileName(doc.baseName)}-pngs.zip`;
      await exportPagesArchive(doc.pages, archiveName);
    } finally {
      setExportingDocId(null);
      setExportProgressText(null);
    }
  };

  const handleExportDocumentIndividual = async (doc: PdfDocumentItem) => {
    if (doc.pages.length === 0) return;
    setExportingDocId(doc.id);
    try {
      await downloadPagesIndividually(doc.pages, (saved, total) => {
        setExportProgressText(`Saving ${saved}/${total}…`);
      });
    } finally {
      setExportingDocId(null);
      setExportProgressText(null);
    }
  };

  const handleExportSelectedZip = async () => {
    if (selectedPages.length === 0) return;
    setIsExportingSelected(true);
    setExportProgressText('Creating ZIP…');
    try {
      await exportPagesArchive(selectedPages, 'foliopng-selected.zip');
    } finally {
      setIsExportingSelected(false);
      setExportProgressText(null);
    }
  };

  const handleExportSelectedIndividual = async () => {
    if (selectedPages.length === 0) return;
    setIsExportingSelected(true);
    try {
      await downloadPagesIndividually(selectedPages, (saved, total) => {
        setExportProgressText(`Saving ${saved}/${total}…`);
      });
    } finally {
      setIsExportingSelected(false);
      setExportProgressText(null);
    }
  };

  const handleExportAllZip = async () => {
    if (allPages.length === 0) return;
    setIsExportingAll(true);
    setExportProgressText('Creating ZIP…');
    try {
      const archiveName =
        documents.length === 1
          ? `${sanitizeFileName(documents[0].baseName)}-pngs.zip`
          : 'foliopng-all-pages.zip';
      await exportPagesArchive(allPages, archiveName);
    } finally {
      setIsExportingAll(false);
      setExportProgressText(null);
    }
  };

  const handleExportAllIndividual = async () => {
    if (allPages.length === 0) return;
    setIsExportingAll(true);
    try {
      await downloadPagesIndividually(allPages, (saved, total) => {
        setExportProgressText(`Saving ${saved}/${total}…`);
      });
    } finally {
      setIsExportingAll(false);
      setExportProgressText(null);
    }
  };

  const allSelected = allPages.length > 0 && selectedPageIds.size === allPages.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <input
        ref={headerFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
            e.target.value = '';
          }
        }}
        className="sr-only"
        aria-label="Select PDF files"
      />

      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Header Title */}
          <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            PDF to PNG Converter
          </h1>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {allPages.length > 0 ? (
              <ExportMenuButton
                count={allPages.length}
                label={`Export All (${allPages.length})`}
                singleLabel="Export PNG"
                variant="primary"
                size="md"
                busy={isExportingAll}
                busyLabel={exportProgressText ?? 'Exporting…'}
                onExportZip={() => void handleExportAllZip()}
                onExportIndividual={() => void handleExportAllIndividual()}
              />
            ) : (
              <button
                type="button"
                onClick={() => headerFileInputRef.current?.click()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Select PDFs
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {/* Drop Section */}
        <section id="dropzone" className="space-y-4">
          {documents.length > 0 && (
            <div className="flex justify-end">
              <p className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                <span className="mx-2 text-slate-300" aria-hidden="true">
                  ·
                </span>
                {allPages.length} {allPages.length === 1 ? 'PNG ready' : 'PNGs ready'}
                <span className="mx-2 text-slate-300" aria-hidden="true">
                  ·
                </span>
                {formatBytes(totalPngBytes)}
              </p>
            </div>
          )}

          <DropZone
            compact={documents.length > 0}
            onFilesSelected={handleFilesSelected}
          />

          {notice && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span className="truncate">{notice}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notice"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-amber-800 hover:bg-amber-100 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        {/* Output Settings & Batch Export Toolbar */}
        <section
          id="settings"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-4"
        >
          <div className="flex flex-wrap items-center gap-6">
            {/* Resolution Control */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Resolution
              </span>
              <div
                role="group"
                aria-label="PNG render scale"
                className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1"
              >
                {SCALE_OPTIONS.map((opt) => {
                  const active = renderOptions.scale === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleScaleChange(opt.value)}
                      aria-pressed={active}
                      className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="ml-1.5 hidden sm:inline font-mono text-[11px] text-slate-500 tabular-nums">
                        {opt.dpi}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Control */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Background
              </span>
              <div
                role="group"
                aria-label="PNG page background"
                className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1"
              >
                <button
                  type="button"
                  onClick={() => handleBackgroundChange('white')}
                  aria-pressed={renderOptions.background === 'white'}
                  className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    renderOptions.background === 'white'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  White Paper
                </button>
                <button
                  type="button"
                  onClick={() => handleBackgroundChange('transparent')}
                  aria-pressed={renderOptions.background === 'transparent'}
                  className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    renderOptions.background === 'transparent'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Transparent
                </button>
              </div>
            </div>
          </div>

          {/* Batch Actions */}
          {documents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              {allPages.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  )}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}

              {selectedPages.length > 0 && (
                <ExportMenuButton
                  count={selectedPages.length}
                  label={`Export Selected (${selectedPages.length})`}
                  singleLabel="Export Selected (1 PNG)"
                  variant="subtle"
                  size="sm"
                  busy={isExportingSelected}
                  busyLabel={exportProgressText ?? 'Exporting…'}
                  onExportZip={() => void handleExportSelectedZip()}
                  onExportIndividual={() => void handleExportSelectedIndividual()}
                />
              )}

              {allPages.length > 0 && (
                <ExportMenuButton
                  count={allPages.length}
                  label={`Export All (${allPages.length})`}
                  singleLabel="Export PNG"
                  variant="primary"
                  size="sm"
                  busy={isExportingAll}
                  busyLabel={exportProgressText ?? 'Exporting…'}
                  onExportZip={() => void handleExportAllZip()}
                  onExportIndividual={() => void handleExportAllIndividual()}
                />
              )}

              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear All
              </button>
            </div>
          )}
        </section>

        {/* Converted Pages Section */}
        <section id="pages" className="mt-8 space-y-10">
          {documents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No PDFs converted yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Drop one or more PDF files above to preview every page as a PNG and export individually or as a ZIP bundle.
              </p>
            </div>
          ) : (
            documents.map((doc) => {
              const docSelectedCount = doc.pages.filter((p) =>
                selectedPageIds.has(p.id)
              ).length;
              const allDocSelected =
                doc.pages.length > 0 && docSelectedCount === doc.pages.length;
              const docPngBytes = doc.pages.reduce((sum, p) => sum + p.sizeBytes, 0);
              const progressPct =
                doc.totalPages > 0
                  ? Math.round((doc.completedPages / doc.totalPages) * 100)
                  : 0;

              return (
                <div key={doc.id} className="space-y-4">
                  {/* Document Header Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-base font-semibold text-slate-900">
                          {doc.name}
                        </h2>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
                          <span>{formatBytes(doc.sizeBytes)} PDF</span>
                          {doc.totalPages > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {doc.pages.length} / {doc.totalPages}{' '}
                                {doc.totalPages === 1 ? 'page' : 'pages'}
                              </span>
                            </>
                          )}
                          {docPngBytes > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{formatBytes(docPngBytes)} PNG</span>
                            </>
                          )}
                          {doc.status === 'converting' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1.5 font-medium text-blue-700">
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                Converting ({progressPct}%)
                              </span>
                            </>
                          )}
                          {doc.status === 'done' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-emerald-700">Ready</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {doc.pages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleToggleSelectDoc(doc)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap cursor-pointer"
                        >
                          {allDocSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          )}
                          {allDocSelected ? 'Deselect PDF' : 'Select PDF'}
                        </button>
                      )}

                      {doc.pages.length > 0 && (
                        <ExportMenuButton
                          count={doc.pages.length}
                          label={`Export PDF (${doc.pages.length})`}
                          singleLabel="Export PNG"
                          variant="secondary"
                          size="sm"
                          busy={exportingDocId === doc.id}
                          busyLabel={exportProgressText ?? 'Exporting…'}
                          onExportZip={() => void handleExportDocumentZip(doc)}
                          onExportIndividual={() => void handleExportDocumentIndividual(doc)}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(doc.id)}
                        aria-label={`Remove ${doc.name}`}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Progress bar during conversion */}
                  {(doc.status === 'queued' || doc.status === 'converting') && (
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Converting ${doc.name}`}
                    >
                      <div
                        className="h-full bg-blue-600 transition-transform duration-150 origin-left"
                        style={{ transform: `scaleX(${Math.max(0.04, progressPct / 100)})` }}
                      />
                    </div>
                  )}

                  {/* Error State */}
                  {doc.status === 'error' && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-900"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium">Failed to convert {doc.name}</p>
                        <p className="mt-0.5 text-xs text-red-700">{doc.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Converted Pages Grid */}
                  {doc.pages.length > 0 && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {doc.pages.map((page) => (
                        <PageCard
                          key={page.id}
                          page={page}
                          selected={selectedPageIds.has(page.id)}
                          backgroundMode={renderOptions.background}
                          onToggleSelect={handleToggleSelectPage}
                          onPreview={setLightboxPage}
                          onExportSingle={handleExportSingle}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>

      <footer id="privacy" className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 text-xs text-slate-500">
          <p>
            PDF to PNG Converter · Local client-side rendering. Your documents never leave your device.
          </p>
          {isAnyConverting && (
            <p className="inline-flex items-center gap-1.5 font-medium text-blue-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Rendering pages…
            </p>
          )}
        </div>
      </footer>

      {/* Global Window Drag Overlay */}
      {isWindowDragOver && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-6 backdrop-blur-xs"
        >
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-blue-500 bg-white px-12 py-10 text-center shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="font-display text-lg font-semibold text-slate-900">
              Drop PDF files anywhere
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Pages will convert to PNG automatically
            </p>
          </div>
        </div>
      )}

      {/* Full-Resolution Page Inspector */}
      <PageLightbox
        page={lightboxPage}
        pages={allPages}
        backgroundMode={renderOptions.background}
        onClose={() => setLightboxPage(null)}
        onSelectPage={setLightboxPage}
        onExportSingle={handleExportSingle}
      />
    </div>
  );
}
