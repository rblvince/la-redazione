'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import { databaseErrorMessage, errorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import { uuidSchema } from '@/lib/domain/invite';
import { cleanText, hasBidiControls, hasVisibleChar } from '@/lib/domain/text';
import { isAllowedCanonicalLink, parseHttpsUrl } from '@/lib/domain/url';
import { fetchPreview } from '@/lib/preview';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Result = { ok: true; id: string } | { ok: false; message: string };
const invalid: Result = { ok: false, message: errorMessage('dati_non_validi') };
const topicSchema = z.object({
  title: z.string().max(2000).transform(cleanText)
    .refine((value) => !hasBidiControls(value) && hasVisibleChar(value))
    .pipe(z.string().min(1).max(280)),
  body: z.string().max(8000).max(4000).nullable(),
  link: z.string().max(2048).nullable(),
  format: z.enum(['fonte_alla_mano', 'a_caldo', 'non_ti_hanno_detto', 'fuorigioco']).nullable(),
});

export async function proposeAction(formData: FormData): Promise<Result> {
  if (!(formData instanceof FormData)) return invalid;
  const parsed = topicSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body') || null,
    link: formData.get('link') || null,
    format: formData.get('format') || null,
  });
  if (!parsed.success) return invalid;
  const { title, body, link, format } = parsed.data;
  const url = link === null ? null : parseHttpsUrl(link);
  if (link !== null && (url === null || !isAllowedCanonicalLink(url))) return invalid;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { ok: false, message: GENERIC_ERROR };
    const { data, error } = await supabase.rpc('propose_topic', {
      p_title: title, p_body: body, p_link: url?.toString() ?? null, p_link_title: null,
      p_format: format,
    });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (typeof data !== 'string') return { ok: false, message: GENERIC_ERROR };
    if (url !== null) {
      const topicId = data;
      after(async () => {
        try {
          const claim = await supabase.rpc('claim_preview');
          if (claim.error) return;
          const preview = await fetchPreview(url);
          if (preview.title) await createAdminClient().rpc('set_link_title', {
            p_topic: topicId, p_actor: user.id, p_title: preview.title,
          });
        } catch {
          // La proposta resta salvata anche quando l'anteprima non è disponibile.
        }
      });
    }
    return { ok: true, id: data };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function proposeFormAction(_prev: Result, formData: FormData): Promise<Result> {
  const result = await proposeAction(formData);
  if (!result.ok) return result;
  revalidatePath('/temi');
  redirect('/temi');
}

export async function commentAction(topicId: string, body: string): Promise<Result> {
  const topic = uuidSchema.safeParse(topicId);
  const content = z.string().max(8000).transform(cleanText)
    .refine((value) => !hasBidiControls(value) && hasVisibleChar(value))
    .pipe(z.string().min(1).max(4000)).safeParse(body);
  if (!topic.success || !content.success) return invalid;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('add_comment', { p_topic: topic.data, p_body: content.data });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    return typeof data === 'string' ? { ok: true, id: data } : { ok: false, message: GENERIC_ERROR };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
