'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Settings2, Save, Pencil, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';

type SettingsMap = Record<string, unknown>;

const pretty = (v: unknown) => {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

export default function AdminSettings() {
  const t = useTranslations('adminSettings');
  const qc = useQueryClient();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsMap>('/settings'),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api(`/settings/${key}`, { method: 'PUT', json: { value } }),
    onSuccess: () => {
      toast.success(t('saved'));
      setEditingKey(null);
      setDraft('');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('saveError'));
    },
  });

  const startEdit = (key: string, value: unknown) => {
    setEditingKey(key);
    setDraft(pretty(value));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft('');
  };

  const submit = (key: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      toast.error(t('invalidJson'));
      return;
    }
    save.mutate({ key, value: parsed });
  };

  const data = settings.data ?? {};
  const keys = Object.keys(data).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>
        <p className="text-slate-500">{t('subtitle')}</p>
      </div>

      {settings.isLoading ? (
        <ListSkeleton rows={4} />
      ) : keys.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <Settings2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy font-semibold">{t('emptyTitle')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => {
            const isEditing = editingKey === key;
            const value = data[key];
            return (
              <div key={key} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-bold text-navy text-sm break-all">{key}</code>
                      <Badge variant="secondary">{typeof value}</Badge>
                    </div>
                  </div>
                  {!isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(key, value)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('edit')}
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`val-${key}`} className="text-xs text-slate-500">
                      {t('valueJson')}
                    </Label>
                    <textarea
                      id={`val-${key}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={6}
                      spellCheck={false}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-navy outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => submit(key)}
                        disabled={save.isPending}
                        className="bg-primary hover:bg-primary-hover"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {save.isPending ? t('saving') : t('save')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        disabled={save.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="mt-3 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap break-all">
                    {pretty(value)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}