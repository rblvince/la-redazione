import { ListSkeleton } from '@/components/shell/ListSkeleton';

export default function Loading() {
  return <ListSkeleton current="persone" title="Persone" label="Carico le persone…" />;
}
