import { expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

async function removeTopicFiles(admin: SupabaseClient, topicId: string): Promise<void> {
  const { data, error } = await admin.storage.from('fonti').list(topicId, { limit: 100 });
  if (error && !/not found|does not exist/i.test(error.message)) {
    throw new Error('Lettura degli oggetti Storage di prova non riuscita.');
  }
  const paths = (data ?? []).filter((item) => item.name).map((item) => `${topicId}/${item.name}`);
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from('fonti').remove(paths);
    if (removeError) throw new Error('Rimozione degli oggetti Storage di prova non riuscita.');
  }
  const { data: remaining, error: verifyError } = await admin.storage.from('fonti').list(topicId, { limit: 100 });
  if (verifyError || (remaining ?? []).length > 0) {
    throw new Error('Sono rimasti oggetti Storage associati al tema di prova.');
  }
}

export async function cleanupRun(admin: SupabaseClient, prefix: string): Promise<void> {
  const { data: users, error: usersError } = await admin.from('profiles').select('id,email').like('email', `${prefix}-%@example.com`);
  if (usersError) throw new Error('Ricerca dei profili di prova per la pulizia non riuscita.');
  const userIds = (users ?? []).map((user) => user.id as string);
  const { data: topics, error: topicsError } = await admin.from('topics').select('id').like('title', `${prefix}:%`);
  if (topicsError) throw new Error('Ricerca dei temi di prova per la pulizia non riuscita.');
  const topicIds = (topics ?? []).map((topic) => topic.id as string);

  for (const topicId of topicIds) await removeTopicFiles(admin, topicId);

  // Gli eventi d’invito non hanno topic_id e puntano a profiles via actor_id: rimuoverli prima dei profili.
  if (userIds.length > 0) {
    const { data: invites } = await admin.from('invites').select('id').like('email', `${prefix}-%@example.com`);
    const inviteIds = (invites ?? []).map((invite) => invite.id as string);
    if (inviteIds.length > 0) {
      const { error } = await admin.from('events').delete().in('data->>invite_id', inviteIds);
      if (error) throw new Error('Rimozione degli eventi invito di prova non riuscita.');
    }
    const { error } = await admin.from('events').delete().in('actor_id', userIds);
    if (error) throw new Error('Rimozione degli eventi di prova non riuscita.');
  }

  if (topicIds.length > 0) {
    const { error } = await admin.from('topics').delete().in('id', topicIds);
    if (error) throw new Error('Rimozione dei temi di prova non riuscita.');
  }
  const { error: invitesError } = await admin.from('invites').delete().like('email', `${prefix}-%@example.com`);
  if (invitesError) throw new Error('Rimozione degli inviti di prova non riuscita.');

  if (userIds.length > 0) {
    const { error } = await admin.from('profiles').delete().in('id', userIds);
    if (error) throw new Error('Rimozione dei profili di prova non riuscita.');
  }
  const authUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Ricerca degli utenti Auth di prova per la pulizia non riuscita.');
    authUsers.push(...data.users.filter((user) => user.email?.startsWith(`${prefix}-`) && user.email.endsWith('@example.com')));
    if (data.users.length < 1000) break;
  }
  for (const user of authUsers) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error('Rimozione dell’utente Auth di prova non riuscita.');
  }

  const { data: remainingProfiles, error: profileCheckError } = await admin.from('profiles').select('id').like('email', `${prefix}-%@example.com`);
  const { data: remainingInvites, error: inviteCheckError } = await admin.from('invites').select('id').like('email', `${prefix}-%@example.com`);
  const { data: remainingTopics, error: topicCheckError } = await admin.from('topics').select('id').like('title', `${prefix}:%`);
  if (profileCheckError || inviteCheckError || topicCheckError) throw new Error('Verifica finale della pulizia non riuscita.');
  expect(remainingProfiles, 'Sono rimasti profili con il prefisso del run').toEqual([]);
  expect(remainingInvites, 'Sono rimasti inviti con il prefisso del run').toEqual([]);
  expect(remainingTopics, 'Sono rimasti temi con il prefisso del run').toEqual([]);

  const remainingAuthUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Verifica finale degli utenti Auth di prova non riuscita.');
    remainingAuthUsers.push(...data.users.filter((user) => user.email?.startsWith(`${prefix}-`) && user.email.endsWith('@example.com')));
    if (data.users.length < 1000) break;
  }
  expect(remainingAuthUsers, 'Sono rimasti utenti Auth con il prefisso del run').toEqual([]);
}
