import { ListSkeleton } from '@/components/shell/ListSkeleton';

export default function Loading() {
  return <ListSkeleton current="in-lavoro" title="In lavoro" label="Carico i temi in lavoro…" groups={2} />;
}
