export type RenderScale = 1 | 2 | 3 | 4;

export type BackgroundMode = 'white' | 'transparent';

export interface RenderOptions {
  scale: RenderScale;
  background: BackgroundMode;
}

export interface ConvertedPage {
  id: string;
  docId: string;
  docName: string;
  pageNumber: number;
  totalPages: number;
  width: number;
  height: number;
  blob: Blob;
  previewUrl: string;
  fileName: string;
  sizeBytes: number;
}

export type DocumentStatus = 'queued' | 'converting' | 'done' | 'error';

export interface PdfDocumentItem {
  id: string;
  file: File;
  name: string;
  baseName: string;
  sizeBytes: number;
  status: DocumentStatus;
  totalPages: number;
  completedPages: number;
  pages: ConvertedPage[];
  errorMessage?: string;
}
