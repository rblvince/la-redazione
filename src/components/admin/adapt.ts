/** Le azioni dell'amministrazione rispondono `{ ok: boolean; message }`; `useAction` vuole un'unione discriminata. */
export async function outcome(task: Promise<{ ok: boolean; message: string }>): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await task;
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
