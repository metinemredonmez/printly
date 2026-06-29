'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileCheck2, Check, X, Plus, ExternalLink } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type ProofStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
interface Proof {
  id: string;
  orderId: string;
  fileName: string;
  r2Key: string | null;
  note: string | null;
  status: ProofStatus;
  respondedAt: string | null;
  responseNote: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<ProofStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

export function OrderProofs({ orderId, staff = false }: { orderId: string; staff?: boolean }) {
  const t = useTranslations('proofs');
  const qc = useQueryClient();

  const { data: proofs, isLoading } = useQuery({
    queryKey: ['proofs', orderId],
    queryFn: () => api<Proof[]>(`/proofs?orderId=${orderId}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['proofs', orderId] });

  const respond = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      api(`/proofs/${id}/${action}`, { method: 'POST', json: note ? { note } : {} }),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'approve' ? t('approved') : t('rejected'));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('actionFailed')),
  });

  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const create = useMutation({
    mutationFn: () =>
      api('/proofs', {
        method: 'POST',
        json: { orderId, fileName: newName, note: newNote || undefined },
      }),
    onSuccess: () => {
      toast.success(t('created'));
      setNewName('');
      setNewNote('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('createFailed')),
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileCheck2 className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-navy dark:text-white">{t('title')}</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (proofs ?? []).length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-2">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          {(proofs ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy dark:text-white text-sm truncate">{p.fileName}</span>
                    <Badge variant={STATUS_VARIANT[p.status]}>{t(`status${p.status}`)}</Badge>
                  </div>
                  {p.note && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.note}</p>}
                  {p.responseNote && (
                    <p className="text-xs text-rose-500 dark:text-rose-300 mt-1">
                      {t('responseNote')}: {p.responseNote}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">{shortDate(p.createdAt)}</p>
                </div>
                {p.r2Key && (
                  <ProofFileLink proofId={p.id} label={t('viewFile')} />
                )}
              </div>

              {p.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => respond.mutate({ id: p.id, action: 'approve' })}
                    disabled={respond.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" /> {t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const note = window.prompt(t('rejectReason')) ?? undefined;
                      if (note === undefined) return;
                      respond.mutate({ id: p.id, action: 'reject', note });
                    }}
                    disabled={respond.isPending}
                  >
                    <X className="h-4 w-4 mr-1" /> {t('reject')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Personel: yeni prova ekle */}
      {staff && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('addProof')}</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('fileNamePlaceholder')}
          />
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={t('notePlaceholder')}
          />
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={create.isPending || !newName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" /> {t('add')}
          </Button>
        </div>
      )}
    </div>
  );
}

// Proof dosyasını indirme linki — tıklayınca presigned URL alır ve açar
function ProofFileLink({ proofId, label }: { proofId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/files/${proofId}/download-url`);
      window.open(url, '_blank', 'noopener');
    } catch {
      /* dosya henüz yüklenmemiş olabilir */
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={open}
      disabled={busy}
      className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
    >
      <ExternalLink className="h-3 w-3" /> {label}
    </button>
  );
}
