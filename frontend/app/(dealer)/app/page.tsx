import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';

export default async function DealerHome() {
  const t = await getTranslations('dealerHome');
  const nav = await getTranslations('nav');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">{t('welcome')}</h1>
        <p className="text-slate-500">{t('subtitle')}</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/app/orders/new">
          <Card className="p-6 hover:shadow-xl transition-shadow border-2 border-primary/20">
            <div className="text-primary font-bold text-lg">{t('newOrderCard')}</div>
            <p className="text-sm text-slate-500 mt-1">{t('newOrderDesc')}</p>
          </Card>
        </Link>
        <Link href="/app/orders">
          <Card className="p-6 hover:shadow-xl transition-shadow">
            <div className="font-bold text-lg text-navy">{nav('myOrders')}</div>
            <p className="text-sm text-slate-500 mt-1">{t('ordersDesc')}</p>
          </Card>
        </Link>
        <Link href="/app/credits">
          <Card className="p-6 hover:shadow-xl transition-shadow">
            <div className="font-bold text-lg text-navy">{nav('creditsMembership')}</div>
            <p className="text-sm text-slate-500 mt-1">{t('creditsDesc')}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
