import { Suspense } from 'react';
import { ScheduleScreen } from '@/features/reservation/schedule-screen';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ScheduleScreen />
    </Suspense>
  );
}
