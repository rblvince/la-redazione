import 'server-only';

import { databaseErrorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import type { Topic } from '@/lib/queries/topic';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ArchiveTopic = Pick<Topic,
  'id' | 'title' | 'body' | 'format' | 'link_title' | 'link_site' | 'post_url' | 'published_at' | 'created_at'>;

export type ArchiveResult =
  | { ok: true; topics: ArchiveTopic[] }
  | { ok: false; message: string };

export function archiveFilter(q: string): string {
  const term = q.replace(/[%_*,()\\]/g, '').trim();
  return term ? `title.ilike.%${term}%,body.ilike.%${term}%` : '';
}

export async function loadArchive(q = ''): Promise<ArchiveResult> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('topics')
      .select('id,title,body,format,link_title,link_site,post_url,published_at,created_at')
      .eq('stage', 'pubblicato');
    const filter = archiveFilter(q);
    if (filter) query = query.or(filter);
    const { data, error } = await query.order('published_at', { ascending: false }).limit(100);
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (!data) return { ok: false, message: GENERIC_ERROR };
    return { ok: true, topics: data as ArchiveTopic[] };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
