import { ListSkeleton } from '@/components/shell/ListSkeleton';

export default function Loading() {
  return <ListSkeleton current="archivio" title="Archivio" label="Carico l’archivio…" search />;
}
