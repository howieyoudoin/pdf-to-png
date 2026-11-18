import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import type { ConvertedPage, PdfDocumentItem, RenderOptions } from '../types/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function stripPdfExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '') || 'document';
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'document';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatPageFileName(
  baseName: string,
  pageNumber: number,
  totalPages: number
): string {
  const padLength = Math.max(2, String(totalPages).length);
  const padded = String(pageNumber).padStart(padLength, '0');
  return `${sanitizeFileName(baseName)}-page-${padded}.png`;
}

export function revokeDocumentUrls(doc: PdfDocumentItem): void {
  for (const page of doc.pages) {
    URL.revokeObjectURL(page.previewUrl);
  }
}

export async function convertPdfToPngPages(
  docId: string,
  file: File,
  options: RenderOptions,
  onProgress: (completed: number, total: number) => void,
  onPageReady: (page: ConvertedPage) => void,
  signal?: AbortSignal
): Promise<ConvertedPage[]> {
  const baseName = stripPdfExtension(file.name);
  const arrayBuffer = await file.arrayBuffer();

  if (signal?.aborted) {
    throw new DOMException('Conversion cancelled', 'AbortError');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        void loadingTask.destroy();
      },
      { once: true }
    );
  }

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages: ConvertedPage[] = [];

  onProgress(0, totalPages);

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (signal?.aborted) {
        throw new DOMException('Conversion cancelled', 'AbortError');
      }

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: options.scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const context = canvas.getContext('2d', { alpha: true });
      if (!context) {
        throw new Error('Unable to acquire 2D canvas context');
      }

      if (options.background === 'transparent') {
        context.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        background:
          options.background === 'transparent' ? 'rgba(0, 0, 0, 0)' : 'rgb(255, 255, 255)',
      }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error(`Failed to encode page ${pageNumber} as PNG`));
            }
          },
          'image/png',
          1.0
        );
      });

      const previewUrl = URL.createObjectURL(blob);
      const converted: ConvertedPage = {
        id: `${docId}-p${pageNumber}-${Date.now()}`,
        docId,
        docName: file.name,
        pageNumber,
        totalPages,
        width: canvas.width,
        height: canvas.height,
        blob,
        previewUrl,
        fileName: formatPageFileName(baseName, pageNumber, totalPages),
        sizeBytes: blob.size,
      };

      pages.push(converted);
      onPageReady(converted);
      onProgress(pageNumber, totalPages);

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await pdf.cleanup();
    await loadingTask.destroy();
  }

  return pages;
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSinglePage(page: ConvertedPage): void {
  triggerBlobDownload(page.blob, page.fileName);
}

export async function downloadPagesIndividually(
  pages: ConvertedPage[],
  onProgress?: (saved: number, total: number) => void
): Promise<void> {
  if (pages.length === 0) return;

  const usedNames = new Set<string>();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let targetName = page.fileName;

    if (usedNames.has(targetName)) {
      const extIndex = targetName.lastIndexOf('.png');
      const stem = extIndex >= 0 ? targetName.slice(0, extIndex) : targetName;
      let counter = 2;
      while (usedNames.has(`${stem}-${counter}.png`)) {
        counter += 1;
      }
      targetName = `${stem}-${counter}.png`;
    }

    usedNames.add(targetName);
    triggerBlobDownload(page.blob, targetName);
    onProgress?.(i + 1, pages.length);

    if (i < pages.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 140));
    }
  }
}

export async function exportPagesArchive(
  pages: ConvertedPage[],
  archiveName = 'foliopng-export.zip'
): Promise<void> {
  if (pages.length === 0) return;

  if (pages.length === 1) {
    downloadSinglePage(pages[0]);
    return;
  }

  const zip = new JSZip();
  const uniqueDocIds = new Set(pages.map((p) => p.docId));
  const useSubfolders = uniqueDocIds.size > 1;
  const usedPaths = new Set<string>();

  for (const page of pages) {
    let targetPath = useSubfolders
      ? `${sanitizeFileName(stripPdfExtension(page.docName))}/${page.fileName}`
      : page.fileName;

    if (usedPaths.has(targetPath)) {
      const extIndex = targetPath.lastIndexOf('.png');
      const stem = extIndex >= 0 ? targetPath.slice(0, extIndex) : targetPath;
      let counter = 2;
      while (usedPaths.has(`${stem}-${counter}.png`)) {
        counter += 1;
      }
      targetPath = `${stem}-${counter}.png`;
    }

    usedPaths.add(targetPath);
    zip.file(targetPath, page.blob);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  triggerBlobDownload(zipBlob, archiveName);
}
