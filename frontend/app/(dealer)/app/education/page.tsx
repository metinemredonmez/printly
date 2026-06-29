'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  GraduationCap,
  BookOpen,
  Clock,
  Layers,
  Check,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Category =
  | 'PLATFORM'
  | 'DIGITAL_ADS'
  | 'SOCIAL_MEDIA'
  | 'TRADE_FINANCE'
  | 'OTHER';

interface Course {
  id: string;
  title: string;
  titleEn?: string | null;
  summary?: string | null;
  description?: string | null;
  category: Category;
  level?: string | null;
  price: number;
  memberPrice: number;
  yourPrice: number;
  isMember: boolean;
  durationMin?: number | null;
  lessonCount?: number | null;
  imageUrl?: string | null;
  contentUrl: string | null;
  active: boolean;
  sortOrder: number;
  enrolled: boolean;
}

const CATEGORIES: Category[] = [
  'PLATFORM',
  'DIGITAL_ADS',
  'SOCIAL_MEDIA',
  'TRADE_FINANCE',
  'OTHER',
];

function categoryLabel(c: Category, tr: boolean): string {
  const map: Record<Category, [string, string]> = {
    PLATFORM: ['Platform Eğitimleri', 'Platform'],
    DIGITAL_ADS: ['Dijital Reklam', 'Digital Ads'],
    SOCIAL_MEDIA: ['Sosyal Medya', 'Social Media'],
    TRADE_FINANCE: ['Ticaret & Finans', 'Trade & Finance'],
    OTHER: ['Diğer', 'Other'],
  };
  return tr ? map[c][0] : map[c][1];
}

const CATEGORY_BADGE: Record<Category, string> = {
  PLATFORM: 'bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300',
  DIGITAL_ADS:
    'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  SOCIAL_MEDIA:
    'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  TRADE_FINANCE:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  OTHER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const money = (n: number) => `$${Number(n).toFixed(2)}`;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function EducationPage() {
  const tr = useLocale() === 'tr';
  const qc = useQueryClient();
  const [activeCat, setActiveCat] = useState<'ALL' | Category>('ALL');

  const {
    data: courses,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api<Course[]>('/courses'),
  });

  const { data: enrollments } = useQuery({
    queryKey: ['courses', 'me'],
    queryFn: () => api<unknown[]>('/courses/me/enrollments'),
  });

  const enrollMut = useMutation({
    mutationFn: (id: string) =>
      api(`/courses/${id}/enroll`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(tr ? 'Eğitime kayıt oldunuz' : 'Enrolled in course');
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['courses', 'me'] });
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error
          ? e.message
          : tr
            ? 'Kayıt başarısız'
            : 'Enrollment failed',
      );
    },
  });

  const list = courses ?? [];
  const showMemberBanner = list.some((c) => c.isMember === false);
  const enrolledCount = Array.isArray(enrollments)
    ? enrollments.length
    : list.filter((c) => c.enrolled).length;

  const filtered = useMemo(
    () => (activeCat === 'ALL' ? list : list.filter((c) => c.category === activeCat)),
    [list, activeCat],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">
            {tr ? 'Eğitim' : 'Education'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tr
              ? 'İşinizi büyütecek eğitimler. Ekip Üyeleri tüm eğitimlerde %50 indirim kazanır.'
              : 'Courses to grow your business. Team Members get 50% off every course.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300 flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {tr ? 'Kayıtlı eğitim' : 'Enrolled'}
            </div>
            <div className="text-lg font-semibold text-navy dark:text-white tabular-nums">
              {enrolledCount}
            </div>
          </div>
        </div>
      </div>

      {/* Member upsell pill */}
      {showMemberBanner && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {tr
              ? 'Ekip Üyesi olursan tüm eğitimlerde %50 indirim'
              : 'Become a Team Member for 50% off all courses'}
          </span>
        </div>
      )}

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          active={activeCat === 'ALL'}
          onClick={() => setActiveCat('ALL')}
          label={tr ? 'Tümü' : 'All'}
        />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            active={activeCat === c}
            onClick={() => setActiveCat(c)}
            label={categoryLabel(c, tr)}
          />
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden animate-pulse"
            >
              <div className="h-32 bg-slate-100 dark:bg-slate-800" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-9 w-full rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorBlock
          message={
            error instanceof Error
              ? error.message
              : tr
                ? 'Eğitimler yüklenemedi'
                : 'Failed to load courses'
          }
          retryLabel={tr ? 'Tekrar dene' : 'Try again'}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title={tr ? 'Eğitim bulunamadı' : 'No courses found'}
          description={
            activeCat === 'ALL'
              ? tr
                ? 'Yakında yeni eğitimler eklenecek.'
                : 'New courses will be added soon.'
              : tr
                ? 'Bu kategoride henüz eğitim yok.'
                : 'No courses in this category yet.'
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              tr={tr}
              onEnroll={() => enrollMut.mutate(course.id)}
              enrolling={enrollMut.isPending && enrollMut.variables === course.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Course card                                                          */
/* ------------------------------------------------------------------ */

function CourseCard({
  course,
  tr,
  onEnroll,
  enrolling,
}: {
  course: Course;
  tr: boolean;
  onEnroll: () => void;
  enrolling: boolean;
}) {
  const title = tr ? course.title : course.titleEn || course.title;
  const isFree = !(course.price > 0);

  return (
    <div className="group flex flex-col rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-shadow">
      {/* Image strip */}
      <div className="relative h-32 w-full overflow-hidden">
        {course.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.imageUrl}
            alt={title}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-primary/10 to-indigo-500/10 dark:from-primary/20 dark:to-indigo-500/10 flex items-center justify-center">
            <GraduationCap className="h-9 w-9 text-primary/70 dark:text-blue-300/70" />
          </div>
        )}
        <span
          className={`absolute top-3 left-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[course.category]}`}
        >
          {categoryLabel(course.category, tr)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          {course.level && (
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {course.level}
            </span>
          )}
          {course.durationMin != null && course.durationMin > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {course.durationMin} {tr ? 'dk' : 'min'}
            </span>
          )}
          {course.lessonCount != null && course.lessonCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {course.lessonCount} {tr ? 'ders' : 'lessons'}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mt-2 font-semibold text-navy dark:text-white leading-snug">
          {title}
        </h3>

        {/* Summary */}
        {course.summary && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
            {course.summary}
          </p>
        )}

        {/* Price */}
        <div className="mt-4 flex items-center gap-2">
          {isFree ? (
            <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              {tr ? 'Ücretsiz' : 'Free'}
            </span>
          ) : (
            <>
              <span className="text-base font-semibold text-primary">
                {money(course.yourPrice)}
              </span>
              {course.yourPrice < course.price && (
                <span className="text-xs text-slate-400 dark:text-slate-500 line-through">
                  {money(course.price)}
                </span>
              )}
              {course.isMember && (
                <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium">
                  %50 {tr ? 'üye' : 'member'}
                </span>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-col gap-2">
          {course.enrolled ? (
            <>
              <Button
                variant="outline"
                disabled
                className="h-9 w-full rounded-xl dark:border-slate-700 dark:text-slate-300"
              >
                <Check className="h-4 w-4" />
                {tr ? 'Kayıtlısın' : 'Enrolled'}
              </Button>
              {course.contentUrl && (
                <Button
                  render={
                    <a
                      href={course.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  className="h-9 w-full rounded-xl"
                >
                  <ExternalLink className="h-4 w-4" />
                  {tr ? 'İçeriğe git' : 'Open content'}
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={onEnroll}
              disabled={enrolling}
              className="h-9 w-full rounded-xl"
            >
              {enrolling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
              {tr ? 'Kayıt ol' : 'Enroll'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-xl px-3.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <BookOpen className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{title}</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
        {description}
      </p>
    </div>
  );
}

function ErrorBlock({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <p className="font-semibold text-navy dark:text-white">{message}</p>
      <Button
        variant="outline"
        onClick={onRetry}
        className="mt-4 h-9 rounded-xl dark:border-slate-700 dark:text-slate-200"
      >
        {retryLabel}
      </Button>
    </div>
  );
}
