'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Store, Plus, Trash2, KeyRound, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';

interface EtsyStore {
  id: string;
  storeName?: string;
  name?: string;
  apiKey: string;
}

export default function StoresPage() {
  const t = useTranslations('stores');
  const qc = useQueryClient();
  const [storeName, setStoreName] = useState('');
  const [apiKey, setApiKey] = useState('');

  const stores = useQuery({
    queryKey: ['etsy-stores'],
    queryFn: () => api<EtsyStore[]>('/etsy-stores'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<EtsyStore>('/etsy-stores', {
        method: 'POST',
        json: { storeName, apiKey },
      }),
    onSuccess: () => {
      toast.success(t('created'));
      setStoreName('');
      setApiKey('');
      qc.invalidateQueries({ queryKey: ['etsy-stores'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('createFailed')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/etsy-stores/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleted'));
      qc.invalidateQueries({ queryKey: ['etsy-stores'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('deleteFailed')),
  });

  const list = stores.data ?? [];
  const canSubmit = storeName.trim().length > 0 && apiKey.trim().length > 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      {/* Yeni mağaza formu */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary dark:text-blue-300 flex items-center justify-center">
            <Plus className="h-5 w-5" />
          </div>
          <div className="font-semibold text-navy dark:text-white">{t('newStore')}</div>
        </div>
        <form
          className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="storeName">{t('storeName')}</Label>
            <Input
              id="storeName"
              value={storeName}
              placeholder={t('storeNamePlaceholder')}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">{t('apiKey')}</Label>
            <Input
              id="apiKey"
              value={apiKey}
              placeholder={t('apiKeyPlaceholder')}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!canSubmit || create.isPending}>
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t('add')}
          </Button>
        </form>
      </div>

      {/* Liste */}
      {stores.isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-10 text-center">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-navy dark:text-slate-200 flex items-center justify-center mx-auto">
            <Store className="h-6 w-6" />
          </div>
          <div className="font-semibold text-navy dark:text-white mt-4">{t('emptyTitle')}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('emptyDesc')}</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((s) => (
            <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-navy dark:text-white truncate">
                      {s.storeName ?? s.name ?? t('untitled')}
                    </div>
                    <Badge variant="secondary" className="mt-1 gap-1 font-mono">
                      <KeyRound className="h-3 w-3" />
                      {s.apiKey}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label={t('delete')}
                  disabled={remove.isPending && remove.variables === s.id}
                  onClick={() => remove.mutate(s.id)}
                >
                  {remove.isPending && remove.variables === s.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}