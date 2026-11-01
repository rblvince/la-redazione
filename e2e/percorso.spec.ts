import { expect, test, type BrowserContext } from '@playwright/test';
import { createRunUsers, createDecider, createInvitedMember, loadEnvironment, type TestEnvironment, type TestUser } from './helpers/setup';
import { installSession } from './helpers/session';
import { cleanupRun } from './helpers/cleanup';

const run = createRunUsers(Date.now());
const topicTitle = `${run.prefix}: verifica del percorso editoriale`;
const contexts: BrowserContext[] = [];
let environment: TestEnvironment | undefined;
let marco: TestUser;
let giulia: TestUser;
let member: TestUser;

test.beforeAll(async () => {
  test.setTimeout(60_000);
  environment = loadEnvironment();
  marco = await createDecider(environment.admin, run.users.marco);
  giulia = await createDecider(environment.admin, run.users.giulia);
  member = await createInvitedMember(environment.admin, run.users.membro);
});

test.afterAll(async () => {
  test.setTimeout(60_000);
  try {
    for (const context of contexts) await context.close();
  } finally {
    if (environment) await cleanupRun(environment.admin, run.prefix);
  }
});

test('completa invito, proposta, verifica, pubblicazione e rettifica', async ({ browser }) => {
  if (!environment) throw new Error('Ambiente E2E non inizializzato.');

  async function userContext(user: TestUser) {
    const context = await browser.newContext();
    contexts.push(context);
    await installSession(context, environment!.appUrl, environment!.supabaseUrl, environment!.anonKey, environment!.admin, user.email);
    return { context, page: await context.newPage() };
  }

  const marcoBrowser = await userContext(marco);
  const giuliaBrowser = await userContext(giulia);

  // Un decisore invita dalla pagina Persone: /admin è intenzionalmente riservata al manutentore.
  await marcoBrowser.page.goto('/persone?invita=1');
  await marcoBrowser.page.getByLabel('Email della persona', { exact: true }).fill(member.email);
  await marcoBrowser.page.getByRole('radio', { name: /^Membro\b/ }).check();
  await marcoBrowser.page.getByRole('button', { name: 'Crea invito', exact: true }).click();
  const inviteLink = await marcoBrowser.page.getByLabel("Link d'invito", { exact: true }).inputValue();
  expect(new URL(inviteLink).pathname).toMatch(/^\/invito\/[A-Za-z0-9_-]{43}$/);

  // L’utente Auth esiste già e ha una sessione vera; la pagina usa quindi il ramo redeem_invite.
  const memberBrowser = await userContext(member);
  await memberBrowser.page.goto(inviteLink);
  await expect(memberBrowser.page.getByRole('heading', { name: 'Ultimo passo', exact: true })).toBeVisible();
  await memberBrowser.page.getByLabel('Come ti chiamano in redazione', { exact: true }).fill(member.name);
  await memberBrowser.page.getByRole('button', { name: 'Entra in redazione', exact: true }).click();
  await expect(memberBrowser.page).toHaveURL(/\/(?:temi)?$/);
  await memberBrowser.page.goto('/persone');
  await expect(memberBrowser.page.getByText(member.name, { exact: true })).toBeVisible();

  // marco propone; tutti i decisori creati dal run votano sì, senza cambiare la regola globale.
  await marcoBrowser.page.goto('/temi?nuovo=1');
  await marcoBrowser.page.getByLabel('Il tema', { exact: true }).fill(topicTitle);
  await marcoBrowser.page.getByRole('button', { name: 'Butta dentro', exact: true }).click();
  await expect(marcoBrowser.page).toHaveURL('/temi');
  const { data: topic, error: topicError } = await environment.admin.from('topics')
    .select('id,stage').eq('title', topicTitle).single();
  if (topicError || !topic) throw new Error('Il tema di prova non è stato creato.');
  const [{ data: settings, error: settingsError }, { data: deciders, error: decidersError }] = await Promise.all([
    environment.admin.from('settings').select('decision_rule').eq('id', 1).single(),
    environment.admin.from('profiles').select('id').eq('role', 'decisore').eq('active', true),
  ]);
  if (settingsError || decidersError || !settings) throw new Error('Lettura della regola di decisione non riuscita.');
  const yesVotesNeeded = settings.decision_rule === 'unanimita'
    ? deciders.length
    : Math.floor(deciders.length / 2) + 1;
  expect(yesVotesNeeded, `La regola ${settings.decision_rule} richiede più voti dei due decisori del run.`).toBeLessThanOrEqual(2);
  const topicPath = `/tema/${topic.id}`;

  await marcoBrowser.page.goto(topicPath);
  await marcoBrowser.page.getByRole('button', { name: 'Sì, si fa', exact: true }).click();
  await giuliaBrowser.page.goto(topicPath);
  await giuliaBrowser.page.getByRole('button', { name: 'Sì, si fa', exact: true }).click();
  await expect(giuliaBrowser.page.getByRole('heading', { name: 'Verifica', exact: true })).toBeVisible();

  await marcoBrowser.page.goto(topicPath);
  await marcoBrowser.page.getByLabel('Scrive', { exact: true }).selectOption({ label: 'Giulia' });
  await marcoBrowser.page.getByLabel('Rilegge', { exact: true }).selectOption({ label: 'Marco' });
  await marcoBrowser.page.getByRole('button', { name: 'Assegna', exact: true }).click();
  await expect(marcoBrowser.page.getByText('Assegnazione salvata.', { exact: true })).toBeVisible();

  const verification = [
    "Isolare l'affermazione centrale",
    'Trovare la fonte primaria, non un rilancio',
    'Leggere la fonte per intero',
    'Cercare un secondo riscontro se la notizia è delicata',
    'Fare il controllo legale prima di scrivere il giudizio',
  ];
  for (const label of verification) {
    const checkbox = marcoBrowser.page.getByRole('checkbox', { name: new RegExp(`^${escapeRegex(label)}`) });
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  }
  await expect(marcoBrowser.page.getByRole('heading', { name: 'Controllo legale', exact: true })).toBeVisible();

  const legal = [
    'Diffamazione: il giudizio finale è supportato da fatti verificati, non da supposizioni? (art. 595 c.p.)',
    'Continenza: il tono resta proporzionato al fatto, anche se crudo?',
    'GDPR / minori: ci sono volti, nomi o dati di persone comuni o di minori? Serve oscurare/anonimizzare?',
    'Copyright: immagini/video sono nostri, con licenza, o citati nei limiti del diritto di critica?',
    'Piano di rettifica: sappiamo come correggere se sbagliamo?',
  ];
  for (const label of legal) {
    const checkbox = marcoBrowser.page.getByRole('checkbox', { name: new RegExp(`^${escapeRegex(label)}`) });
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  }

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5Z8AAAAASUVORK5CYII=', 'base64');
  const sourceDetails = marcoBrowser.page.locator('details').filter({ hasText: 'Aggiungi fonte' });
  await sourceDetails.locator('summary').click();
  await sourceDetails.getByLabel('Titolo', { exact: true }).fill('Fonte E2E');
  await sourceDetails.getByLabel('Link', { exact: true }).fill('https://example.com');
  await sourceDetails.getByLabel(/^Screenshot\b/).setInputFiles({ name: 'prova.png', mimeType: 'image/png', buffer: png });
  await sourceDetails.locator('form').getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await expect(marcoBrowser.page.getByText('Fonte aggiunta.', { exact: true })).toBeVisible();
  const { data: source, error: sourceError } = await environment.admin.from('sources')
    .select('screenshot_path').eq('topic_id', topic.id).single();
  if (sourceError || !source?.screenshot_path) throw new Error('Lo screenshot non risulta salvato nel database.');

  await assertAnonymousStorageDenied(environment, topic.id, source.screenshot_path);

  // marco rilegge e approva; giulia, assegnato come scrittore, pubblica.
  await marcoBrowser.page.getByRole('button', { name: 'Approva la rilettura', exact: true }).click();
  await expect(marcoBrowser.page.getByText('Rilettura approvata.', { exact: true })).toBeVisible();
  await giuliaBrowser.page.goto(topicPath);
  await giuliaBrowser.page.getByLabel('Link del post pubblicato', { exact: true }).fill('https://example.com/articolo');
  await giuliaBrowser.page.getByRole('button', { name: 'Segna pubblicato', exact: true }).click();
  await expect(giuliaBrowser.page.getByRole('heading', { name: 'Pubblicazione', exact: true })).toBeVisible();
  await giuliaBrowser.page.goto('/archivio');
  await expect(
    giuliaBrowser.page.getByRole('link').filter({ has: giuliaBrowser.page.getByText(topicTitle, { exact: true }) }),
  ).toBeVisible();

  await memberBrowser.page.goto(topicPath);
  const correctionDetails = memberBrowser.page.locator('details').filter({ hasText: 'Aggiungi rettifica' });
  await correctionDetails.locator('summary').click();
  await correctionDetails.getByLabel('Che cosa correggi', { exact: true }).fill('Correzione di prova visibile nell’archivio.');
  await correctionDetails.getByLabel('Perché', { exact: true }).fill('Verifica E2E della rettifica.');
  await correctionDetails.locator('form').getByRole('button', { name: 'Aggiungi rettifica', exact: true }).click();
  await expect(memberBrowser.page.getByText('Correzione di prova visibile nell’archivio.', { exact: true })).toBeVisible();
});

async function assertAnonymousStorageDenied(
  env: TestEnvironment,
  topicId: string,
  path: string,
): Promise<void> {
  const headers = { apikey: env.anonKey, authorization: `Bearer ${env.anonKey}` };
  const origin = new URL(env.supabaseUrl);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const authenticatedObject = await fetch(new URL(`/storage/v1/object/fonti/${encodedPath}`, origin), { headers });
  expect(authenticatedObject.status, 'Anon non deve scaricare lo screenshot privato').not.toBe(200);

  const publicObject = await fetch(new URL(`/storage/v1/object/public/fonti/${encodedPath}`, origin), { headers });
  expect(publicObject.status, 'Il bucket fonti non deve esporre uno screenshot pubblico').not.toBe(200);

  const listing = await fetch(new URL('/storage/v1/object/list/fonti', origin), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: topicId, limit: 100 }),
  });
  if (listing.status === 200) {
    const objects: unknown = await listing.json();
    expect(JSON.stringify(objects), 'La lista anonima non deve contenere l’oggetto di prova').not.toContain(path);
    expect(Array.isArray(objects) ? objects : [], 'La lista anonima non deve restituire oggetti').toEqual([]);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
