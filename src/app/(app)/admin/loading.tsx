import { PanelSkeleton } from '@/components/shell/ListSkeleton';

export default function Loading() {
  return <PanelSkeleton current="admin" title="Amministrazione" label="Carico l’amministrazione…" />;
}
