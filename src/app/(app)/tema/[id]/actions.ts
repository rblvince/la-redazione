'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { databaseErrorMessage, errorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import { uuidSchema } from '@/lib/domain/invite';
import { cleanText, hasBidiControls, hasVisibleChar } from '@/lib/domain/text';
import { parseHttpsUrl } from '@/lib/domain/url';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type MutationResult = { ok: true } | { ok: false; message: string };
type IdResult = { ok: true; id: string } | { ok: false; message: string };
type GateResult = { ok: true; status: { ok: boolean; missing: string[] } } | { ok: false; message: string };
type UrlResult = { ok: true; url: string } | { ok: false; message: string };

const invalid = { ok: false, message: errorMessage('dati_non_validi') } as const;
const checkKind = z.enum(['verifica', 'legale']);
const checkItem = z.enum([
  'isolare', 'fonte_primaria', 'lettura_intera', 'secondo_riscontro', 'controllo_legale',
  'diffamazione', 'continenza', 'gdpr_minori', 'copyright', 'rettifica',
]);
const visibleText = (max: number) => z.string().max(max * 2).transform(cleanText)
  .refine((value) => !hasBidiControls(value) && hasVisibleChar(value))
  .pipe(z.string().min(1).max(max));
const httpsUrl = z.string().max(2048).refine((value) => parseHttpsUrl(value) !== null);
const screenshotPathSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$/,
);

async function mutate(name: string, args: Record<string, unknown>, topicId?: string): Promise<MutationResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc(name, args);
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (topicId) {
      revalidatePath(`/tema/${topicId}`);
      revalidatePath('/temi');
    }
    return { ok: true };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function castVoteAction(topicId: string, value: boolean): Promise<MutationResult> {
  const parsed = z.object({ topicId: uuidSchema, value: z.boolean() }).safeParse({ topicId, value });
  if (!parsed.success) return invalid;
  return mutate('cast_vote', { p_topic: parsed.data.topicId, p_value: parsed.data.value }, parsed.data.topicId);
}

export async function parkTopicAction(topicId: string): Promise<MutationResult> {
  const parsed = uuidSchema.safeParse(topicId);
  if (!parsed.success) return invalid;
  return mutate('park_topic', { p_topic: parsed.data }, parsed.data);
}

export async function reactivateTopicAction(topicId: string): Promise<MutationResult> {
  const parsed = uuidSchema.safeParse(topicId);
  if (!parsed.success) return invalid;
  return mutate('reactivate_topic', { p_topic: parsed.data }, parsed.data);
}

export async function assignPeopleAction(
  topicId: string, writerId: string, reviewerId: string,
): Promise<MutationResult> {
  const parsed = z.object({ topicId: uuidSchema, writerId: uuidSchema, reviewerId: uuidSchema })
    .refine(({ writerId, reviewerId }) => writerId !== reviewerId)
    .safeParse({ topicId, writerId, reviewerId });
  if (!parsed.success) return invalid;
  return mutate('assign_people', {
    p_topic: parsed.data.topicId, p_writer: parsed.data.writerId, p_reviewer: parsed.data.reviewerId,
  }, parsed.data.topicId);
}

async function mutateId(name: string, args: Record<string, unknown>): Promise<IdResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc(name, args);
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    return typeof data === 'string' ? { ok: true, id: data } : { ok: false, message: GENERIC_ERROR };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function toggleCheckAction(topicId: string, kind: string, item: string, done: boolean): Promise<MutationResult> {
  const parsed = z.object({ topicId: uuidSchema, kind: checkKind, item: checkItem, done: z.boolean() })
    .safeParse({ topicId, kind, item, done });
  if (!parsed.success || (kind === 'verifica' && !['isolare', 'fonte_primaria', 'lettura_intera', 'secondo_riscontro', 'controllo_legale'].includes(item))
    || (kind === 'legale' && !['diffamazione', 'continenza', 'gdpr_minori', 'copyright', 'rettifica'].includes(item))) return invalid;
  return mutate('toggle_check', { p_topic: topicId, p_kind: kind, p_item: item, p_done: done });
}

export async function addSourceAction(
  topicId: string, title: string, url: string, kind: string, screenshotPath: string | null,
): Promise<IdResult> {
  const parsed = z.object({
    topicId: uuidSchema, title: visibleText(280), url: httpsUrl,
    kind: z.enum(['primaria', 'secondaria']), screenshotPath: screenshotPathSchema.nullable(),
  }).safeParse({ topicId, title, url, kind, screenshotPath });
  if (!parsed.success || (parsed.data.screenshotPath !== null
    && !parsed.data.screenshotPath.startsWith(`${parsed.data.topicId}/`))) return invalid;
  return mutateId('add_source', {
    p_topic: parsed.data.topicId, p_title: parsed.data.title, p_url: parsed.data.url,
    p_kind: parsed.data.kind, p_screenshot_path: parsed.data.screenshotPath,
  });
}

export async function deleteSourceAction(sourceId: string): Promise<MutationResult> {
  const parsed = uuidSchema.safeParse(sourceId);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: source } = await supabase.from('sources')
      .select('screenshot_path').eq('id', parsed.data).single();
    const { error } = await supabase.rpc('delete_source', { p_id: parsed.data });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (typeof source?.screenshot_path === 'string') {
      try {
        await supabase.storage.from('fonti').remove([source.screenshot_path]);
      } catch {
        // La fonte è già stata eliminata; la rimozione del file è facoltativa.
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function sourceScreenshotUrlAction(sourceId: string): Promise<UrlResult> {
  const parsed = uuidSchema.safeParse(sourceId);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: source, error: sourceError } = await supabase.from('sources')
      .select('screenshot_path').eq('id', parsed.data).single();
    if (sourceError) return { ok: false, message: databaseErrorMessage(sourceError) };
    if (typeof source?.screenshot_path !== 'string') return invalid;
    const { data, error } = await supabase.storage.from('fonti').createSignedUrl(source.screenshot_path, 600);
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    return typeof data?.signedUrl === 'string'
      ? { ok: true, url: data.signedUrl } : { ok: false, message: GENERIC_ERROR };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function approveReviewAction(topicId: string): Promise<MutationResult> {
  const parsed = uuidSchema.safeParse(topicId);
  if (!parsed.success) return invalid;
  return mutate('approve_review', { p_topic: parsed.data });
}

export async function gateStatusAction(topicId: string): Promise<GateResult> {
  const parsed = uuidSchema.safeParse(topicId);
  if (!parsed.success) return invalid;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('gate_status', { p_topic: parsed.data });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    const status = z.object({ ok: z.boolean(), missing: z.array(z.string()) }).safeParse(data);
    return status.success ? { ok: true, status: status.data } : { ok: false, message: GENERIC_ERROR };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function publishTopicAction(topicId: string, postUrl: string): Promise<MutationResult> {
  const parsed = z.object({ topicId: uuidSchema, postUrl: httpsUrl }).safeParse({ topicId, postUrl });
  if (!parsed.success) return invalid;
  return mutate('publish_topic', { p_topic: parsed.data.topicId, p_post_url: parsed.data.postUrl });
}

export async function addCorrectionAction(
  topicId: string, body: string, reason: string, newPostUrl: string | null,
): Promise<IdResult> {
  const parsed = z.object({
    topicId: uuidSchema, body: visibleText(4000), reason: visibleText(4000),
    newPostUrl: httpsUrl.nullable(),
  }).safeParse({ topicId, body, reason, newPostUrl });
  if (!parsed.success) return invalid;
  return mutateId('add_correction', {
    p_topic: parsed.data.topicId, p_body: parsed.data.body,
    p_reason: parsed.data.reason, p_new_post_url: parsed.data.newPostUrl,
  });
}
