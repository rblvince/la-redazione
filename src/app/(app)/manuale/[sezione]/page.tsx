import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { manuale } from '@/content/manuale';
import { ManualeVista } from '../_vista';

export function generateStaticParams() {
  return manuale.map((section) => ({ sezione: section.id }));
}

export async function generateMetadata({ params }: PageProps<'/manuale/[sezione]'>): Promise<Metadata> {
  const { sezione } = await params;
  const section = manuale.find((s) => s.id === sezione);
  return { title: section?.title ?? 'Manuale' };
}

async function Scheda({ params }: { params: PageProps<'/manuale/[sezione]'>['params'] }) {
  const { sezione } = await params;
  if (!manuale.some((s) => s.id === sezione)) notFound();
  return <ManualeVista sectionId={sezione} explicit />;
}

// `params` si legge dentro Suspense: il guscio non dipende dall'URL e resta condiviso tra le schede.
export default function SezionePage({ params }: PageProps<'/manuale/[sezione]'>) {
  return (
    <Suspense fallback={<ManualeVista sectionId={null} explicit />}>
      <Scheda params={params} />
    </Suspense>
  );
}
