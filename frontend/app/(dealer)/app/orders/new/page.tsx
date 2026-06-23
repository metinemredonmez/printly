'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Loader2, PartyPopper } from 'lucide-react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/file-uploader';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  basePricePerM2?: number;
  flatPrice?: number;
}
interface Extra {
  id: string;
  name: string;
  price: number;
}
interface Quote {
  subtotal: number;
  extrasTotal: number;
  discount40: number;
  total: number;
  totalSqm: number;
}

const CATEGORIES = [
  { key: 'WALLPAPER', tk: 'wallpaper', dk: 'wallpaperDesc', color: 'border-primary text-primary' },
  { key: 'WALL_DECAL', tk: 'decal', dk: 'decalDesc', color: 'border-emerald-500 text-emerald-600' },
  { key: 'WOOD', tk: 'wood', dk: 'woodDesc', color: 'border-amber-500 text-amber-600' },
];

export default function NewOrderWizard() {
  const t = useTranslations('wizard');
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(12);
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'BALANCE' | 'CARD'>('BALANCE');
  const [client, setClient] = useState({
    clientName: '',
    clientAddress: '',
    clientCity: '',
    clientCountry: '',
    clientZip: '',
    clientPhone: '',
  });

  const products = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('/products') });
  const extraList = useQuery({ queryKey: ['extras'], queryFn: () => api<Extra[]>('/extras') });
  const credits = useQuery({
    queryKey: ['credits', 'me'],
    queryFn: () => api<{ balance: number }>('/credits/me'),
  });

  const catProducts = (products.data ?? []).filter((p) => p.category === category);

  const extraPayload = useMemo(
    () => Object.entries(extras).filter(([, q]) => q > 0).map(([extraOptionId, quantity]) => ({ extraOptionId, quantity })),
    [extras],
  );

  const quote = useQuery({
    queryKey: ['quote', productId, width, height, qty, extraPayload],
    enabled: !!productId && width > 0 && height > 0 && qty > 0,
    queryFn: () =>
      api<Quote>('/pricing/quote', {
        method: 'POST',
        json: {
          items: [{ productId, widthInch: width, heightInch: height, quantity: qty }],
          extras: extraPayload,
        },
      }),
  });

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/orders', {
        method: 'POST',
        json: {
          category,
          paymentMethod,
          items: [{ productId, widthInch: width, heightInch: height, quantity: qty }],
          extras: extraPayload,
          ...client,
        },
      }),
    onSuccess: (o) => {
      toast.success(t('created'));
      setCreatedId(o.id);
      setStep(6);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('createFailed')),
  });

  const steps = ['stepCategory', 'stepProduct', 'stepSize', 'stepPayment', 'stepDelivery', 'stepFiles'];
  const canNext =
    (step === 1 && !!category) ||
    (step === 2 && !!productId) ||
    (step === 3 && width > 0 && height > 0 && qty > 0) ||
    step === 4 ||
    step === 5;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold text-navy">{t('title')}</h1>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i + 1 <= step ? 'bg-primary' : 'bg-slate-200'}`}
            />
            <div className={`text-[10px] mt-1.5 font-semibold ${i + 1 === step ? 'text-primary' : 'text-slate-400'}`}>
              {t(s)}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 min-h-[280px]">
        {/* Step 1: kategori */}
        {step === 1 && (
          <div className="grid sm:grid-cols-3 gap-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setCategory(c.key);
                  setProductId('');
                }}
                className={`rounded-2xl border-2 p-5 text-left transition-all ${
                  category === c.key ? c.color + ' bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-navy">{t(c.tk)}</div>
                <div className="text-xs text-slate-500 mt-1">{t(c.dk)}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: ürün + extra */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Label>{t('selectProduct')}</Label>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {catProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`rounded-xl border p-3 text-left text-sm ${
                      productId === p.id ? 'border-primary bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-navy">{p.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {p.unit === 'M2' ? `${money(p.basePricePerM2)}/m²` : money(p.flatPrice)}
                    </div>
                  </button>
                ))}
                {catProducts.length === 0 && (
                  <div className="text-sm text-slate-400">{t('selectFirst')}</div>
                )}
              </div>
            </div>
            <div>
              <Label>{t('extrasOptional')}</Label>
              <div className="space-y-2 mt-2">
                {(extraList.data ?? []).map((ex) => (
                  <label
                    key={ex.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={!!extras[ex.id]}
                        onChange={(e) =>
                          setExtras((p) => ({ ...p, [ex.id]: e.target.checked ? 1 : 0 }))
                        }
                      />
                      {ex.name}
                    </span>
                    <span className="text-slate-500">{money(ex.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: ölçü + canlı fiyat */}
        {step === 3 && (
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('widthInch')}</Label>
                <Input type="number" min={1} value={width} onChange={(e) => setWidth(+e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('heightInch')}</Label>
                <Input type="number" min={1} value={height} onChange={(e) => setHeight(+e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('quantity')}</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(+e.target.value)} />
              </div>
            </div>
            <div className="rounded-2xl bg-navy text-white p-5 flex flex-col justify-center">
              <div className="text-xs text-slate-400">{t('livePrice')}</div>
              {quote.isFetching ? (
                <div className="flex items-center gap-2 text-slate-300 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('calculating')}
                </div>
              ) : (
                <>
                  <div className="text-4xl font-extrabold mt-1">{money(quote.data?.total)}</div>
                  <div className="text-xs text-slate-400 mt-2">
                    {t('area')}: {(quote.data?.totalSqm ?? 0).toFixed(3)} m²
                  </div>
                  {(quote.data?.discount40 ?? 0) > 0 && (
                    <div className="text-xs text-brand-accent mt-1">
                      {t('discount')}: -{money(quote.data?.discount40)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: ödeme */}
        {step === 4 && (
          <div className="space-y-4">
            <Label>{t('paymentMethod')}</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('BALANCE')}
                className={`rounded-2xl border-2 p-5 text-left ${
                  paymentMethod === 'BALANCE' ? 'border-primary bg-blue-50' : 'border-slate-200'
                }`}
              >
                <div className="font-bold text-navy">{t('balance')}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('balanceAvailable')}: {money(credits.data?.balance)}
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`rounded-2xl border-2 p-5 text-left ${
                  paymentMethod === 'CARD' ? 'border-primary bg-blue-50' : 'border-slate-200'
                }`}
              >
                <div className="font-bold text-navy">{t('card')}</div>
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 flex justify-between items-center">
              <span className="text-sm text-slate-500">{t('livePrice')}</span>
              <span className="text-2xl font-extrabold text-navy">{money(quote.data?.total)}</span>
            </div>
          </div>
        )}

        {/* Step 5: teslimat */}
        {step === 5 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('clientName')}</Label>
              <Input value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('address')}</Label>
              <Input value={client.clientAddress} onChange={(e) => setClient({ ...client, clientAddress: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('city')}</Label>
              <Input value={client.clientCity} onChange={(e) => setClient({ ...client, clientCity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('country')}</Label>
              <Input value={client.clientCountry} onChange={(e) => setClient({ ...client, clientCountry: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('zip')}</Label>
              <Input value={client.clientZip} onChange={(e) => setClient({ ...client, clientZip: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input value={client.clientPhone} onChange={(e) => setClient({ ...client, clientPhone: e.target.value })} />
            </div>
          </div>
        )}

        {/* Step 6: dosya yükleme (sipariş oluşturulduktan sonra) */}
        {step === 6 && createdId && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <PartyPopper className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-emerald-800">{t('orderCreatedTitle')}</div>
                <div className="text-sm text-emerald-700">{t('orderCreatedDesc')}</div>
              </div>
            </div>
            <div>
              <Label>{t('filesOptional')}</Label>
              <div className="mt-2">
                <FileUploader orderId={createdId} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {step < 6 ? (
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            {t('prev')}
          </Button>
        ) : (
          <span />
        )}
        {step < 5 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {t('next')}
          </Button>
        ) : step === 5 ? (
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            {t('submit')}
          </Button>
        ) : (
          <Button onClick={() => router.replace(`/app/orders/${createdId}`)}>
            {t('goToOrder')}
          </Button>
        )}
      </div>
    </div>
  );
}
