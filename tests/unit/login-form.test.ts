import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

vi.mock('@/app/accedi/actions', () => ({ loginAction: vi.fn(), verifyLoginCodeAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { LoginForm } from '@/components/auth/LoginForm';
import AccediPage from '@/app/accedi/page';

test('mostra un errore temporaneo nella segnalazione di accesso', () => {
  const html = renderToStaticMarkup(createElement(LoginForm, { error: 'temporaneo' }));
  expect(html).toContain('Non siamo riusciti a verificare il tuo accesso. Riprova tra poco.');
  expect(html).toContain('role="alert"');
});

test('la pagina accedi inoltra errore=temporaneo al form', async () => {
  const page = await AccediPage({ searchParams: Promise.resolve({ errore: 'temporaneo' }) });
  const html = renderToStaticMarkup(page);
  expect(html).toContain('Non siamo riusciti a verificare il tuo accesso. Riprova tra poco.');
});

test('il modulo chiede un codice invece del link', async () => {
  const page = await AccediPage({ searchParams: Promise.resolve({}) });
  const html = renderToStaticMarkup(page);
  expect(html).toContain('Mandami il codice');
  expect(html).not.toContain('Mandami il link');
});

test('i vecchi link rimandano al codice', () => {
  const html = renderToStaticMarkup(createElement(LoginForm, { error: 'link' }));
  expect(html).toContain('Quel link non funziona più: ora si entra con un codice. Scrivi la tua email qui sotto.');
});

test('accesso senza profilo invita ad aprire il link originale', () => {
  const html = renderToStaticMarkup(createElement(LoginForm, { error: 'accesso' }));
  expect(html).toContain('Sei entrato, ma il tuo invito non risulta accettato. Apri il link d’invito che hai ricevuto: ti fa entrare subito.');
});
