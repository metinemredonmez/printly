import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function DealerHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">Hoş geldiniz 👋</h1>
        <p className="text-slate-500">Sipariş verin, üretim durumunu takip edin.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/app/orders/new">
          <Card className="p-6 hover:shadow-xl transition-shadow border-2 border-primary/20">
            <div className="text-primary font-bold text-lg">+ Yeni Sipariş</div>
            <p className="text-sm text-slate-500 mt-1">
              Duvar kağıdı, decal veya ahşap siparişi oluştur.
            </p>
          </Card>
        </Link>
        <Link href="/app/orders">
          <Card className="p-6 hover:shadow-xl transition-shadow">
            <div className="font-bold text-lg text-navy">Siparişlerim</div>
            <p className="text-sm text-slate-500 mt-1">Tüm siparişlerini ve durumlarını gör.</p>
          </Card>
        </Link>
        <Link href="/app/credits">
          <Card className="p-6 hover:shadow-xl transition-shadow">
            <div className="font-bold text-lg text-navy">Bakiye & Üyelik</div>
            <p className="text-sm text-slate-500 mt-1">Bakiye yükle, üyelik planını yönet.</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
