import { Suspense } from 'react';
import { NextStepScreen } from '@/features/reflection/next-step-screen';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <NextStepScreen recordId={id} />
    </Suspense>
  );
}
