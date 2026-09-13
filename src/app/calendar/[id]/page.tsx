import { Suspense } from 'react';
import { CalendarScreen } from '@/features/calendar/calendar-screen';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <CalendarScreen actionId={id} />
    </Suspense>
  );
}
