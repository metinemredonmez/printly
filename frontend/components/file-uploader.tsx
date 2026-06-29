'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, File as FileIcon, CheckCircle2, XCircle, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';

type Status = 'pending' | 'uploading' | 'done' | 'error';
interface FileState {
  id: string;
  file: File;
  status: Status;
  progress: number;
  error?: string;
}

interface InitiateSingle {
  mode: 'single';
  assetId: string;
  key: string;
  url: string;
}
interface InitiateMultipart {
  mode: 'multipart';
  assetId: string;
  key: string;
  uploadId: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
}
type InitiateRes = InitiateSingle | InitiateMultipart;

// R2 presigned akışı: initiate → R2'ye PUT → mark-ready (single) / complete (multipart)
async function uploadOne(
  file: File,
  orderId: string | undefined,
  onProgress: (p: number) => void,
): Promise<void> {
  const init = await api<InitiateRes>('files/initiate', {
    method: 'POST',
    json: {
      originalName: file.name,
      mime: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      role: 'PRODUCTION',
      ...(orderId ? { orderId } : {}),
    },
  });

  if (init.mode === 'single') {
    const put = await fetch(init.url, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type || 'application/octet-stream' },
    });
    if (!put.ok) throw new Error(`R2 PUT ${put.status}`);
    onProgress(100);
    await api(`files/${init.assetId}/mark-ready`, { method: 'POST' });
    return;
  }

  // multipart
  const parts: { partNumber: number; etag: string }[] = [];
  let uploaded = 0;
  for (const part of init.parts) {
    const start = (part.partNumber - 1) * init.partSize;
    const chunk = file.slice(start, Math.min(start + init.partSize, file.size));
    const put = await fetch(part.url, {
      method: 'PUT',
      body: chunk,
      headers: { 'content-type': file.type || 'application/octet-stream' },
    });
    if (!put.ok) throw new Error(`R2 part ${part.partNumber} ${put.status}`);
    const etag = put.headers.get('etag') ?? '';
    parts.push({ partNumber: part.partNumber, etag });
    uploaded += chunk.size;
    onProgress(Math.round((uploaded / file.size) * 100));
  }
  await api('files/complete', {
    method: 'POST',
    json: { assetId: init.assetId, uploadId: init.uploadId, parts },
  });
}

let _id = 0;
const nextId = () => `f${++_id}`;

export function FileUploader({
  orderId,
  onAllDone,
}: {
  orderId?: string;
  onAllDone?: () => void;
}) {
  const t = useTranslations('wizard');
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileState[]>([]);
  const [drag, setDrag] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      id: nextId(),
      file,
      status: 'pending' as Status,
      progress: 0,
    }));
    setFiles((f) => [...f, ...next]);
    next.forEach(run);
  }

  async function run(fs: FileState) {
    setFiles((prev) =>
      prev.map((x) => (x.id === fs.id ? { ...x, status: 'uploading' } : x)),
    );
    try {
      await uploadOne(fs.file, orderId, (p) =>
        setFiles((prev) => prev.map((x) => (x.id === fs.id ? { ...x, progress: p } : x))),
      );
      setFiles((prev) =>
        prev.map((x) => (x.id === fs.id ? { ...x, status: 'done', progress: 100 } : x)),
      );
      setFiles((prev) => {
        if (prev.every((x) => x.status === 'done')) onAllDone?.();
        return prev;
      });
    } catch (e) {
      setFiles((prev) =>
        prev.map((x) =>
          x.id === fs.id
            ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'error' }
            : x,
        ),
      );
    }
  }

  function remove(id: string) {
    setFiles((f) => f.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          drag ? 'border-primary bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }`}
      >
        <UploadCloud className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500" />
        <p className="mt-2 font-semibold text-navy dark:text-white">{t('uploadFiles')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('uploadHint')}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.ai,.eps,.png,.tif,.tiff"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5"
            >
              <FileIcon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-navy dark:text-white truncate">{f.file.name}</div>
                {f.status === 'uploading' && (
                  <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
                {f.status === 'error' && (
                  <div className="text-[11px] text-rose-500 truncate">{t('uploadFailed')}</div>
                )}
              </div>
              {f.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {f.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {f.status === 'error' && <XCircle className="h-4 w-4 text-rose-500" />}
              <button onClick={() => remove(f.id)} className="text-slate-300 hover:text-rose-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
