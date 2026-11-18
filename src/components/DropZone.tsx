import React, { useRef, useState } from 'react';
import { FileUp, Plus } from 'lucide-react';

interface DropZoneProps {
  compact?: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  compact = false,
  onFilesSelected,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = '';
    }
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  if (compact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed px-5 py-4 transition-colors duration-150 ${
          isDragOver
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleInputChange}
          className="sr-only"
          aria-label="Add more PDF files"
        />
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <FileUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              Drop additional PDFs here to add them to the queue
            </p>
            <p className="text-xs text-slate-500">
              All pages render automatically in your browser · No file upload required
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openFilePicker}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add PDFs
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors duration-150 ${
        isDragOver
          ? 'border-blue-600 bg-blue-50/60'
          : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Select PDF files to convert"
      />

      <div
        className={`mb-5 flex h-14 w-14 items-center justify-center rounded-xl border transition-colors duration-150 ${
          isDragOver
            ? 'border-blue-200 bg-blue-100 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        <FileUp className="h-6 w-6" aria-hidden="true" />
      </div>

      <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
        Drop one or more PDF files here
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Pages convert automatically into lossless PNG images as soon as you drop them. Export
        individual pages or download everything in one archive.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={openFilePicker}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          Select PDF Files
        </button>
      </div>

      <p className="mt-5 text-xs text-slate-500">
        Multi-file &amp; multi-page supported · Runs 100% locally in your browser
      </p>
    </div>
  );
};
