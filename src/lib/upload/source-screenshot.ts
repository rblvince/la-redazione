import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Validation = { ok: true; extension: 'png' | 'jpg' | 'webp' } | { ok: false; message: string };
type UploadResult = { ok: true; path: string } | { ok: false; message: string };

const extensions: Record<string, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};
const topicIdSchema = z.uuid();

export function validateSourceScreenshot(topicId: string, file: Pick<File, 'type' | 'size'>): Validation {
  if (!topicIdSchema.safeParse(topicId).success) return { ok: false, message: 'Tema non valido.' };
  if (!Object.hasOwn(extensions, file.type)) return { ok: false, message: 'Usa un’immagine PNG, JPEG o WebP.' };
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    return { ok: false, message: 'L’immagine deve essere più piccola di 5 MB.' };
  }
  return { ok: true, extension: extensions[file.type] };
}

export async function uploadSourceScreenshot(topicId: string, file: File): Promise<UploadResult> {
  const validation = validateSourceScreenshot(topicId, file);
  if (!validation.ok) return validation;
  const path = `${topicId}/${crypto.randomUUID()}.${validation.extension}`;
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.storage.from('fonti').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    return error ? { ok: false, message: 'Caricamento non riuscito. Riprova.' } : { ok: true, path };
  } catch {
    return { ok: false, message: 'Caricamento non riuscito. Riprova.' };
  }
}

export async function removeSourceScreenshot(path: string): Promise<void> {
  try {
    await createBrowserSupabaseClient().storage.from('fonti').remove([path]);
  } catch {
    // La pulizia è un tentativo: l'errore originale del salvataggio ha precedenza.
  }
}

export async function runWithScreenshotCleanup<T extends { ok: boolean }>(
  path: string | null, save: () => Promise<T>,
): Promise<T> {
  try {
    const result = await save();
    if (!result.ok && path !== null) await removeSourceScreenshot(path);
    return result;
  } catch (error) {
    if (path !== null) await removeSourceScreenshot(path);
    throw error;
  }
}
