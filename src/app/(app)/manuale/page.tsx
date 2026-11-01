import type { Metadata } from 'next';
import { ManualeVista } from './_vista';

export const metadata: Metadata = { title: 'Manuale' };

export default function ManualePage() {
  return <ManualeVista sectionId="manifesto" explicit={false} />;
}
