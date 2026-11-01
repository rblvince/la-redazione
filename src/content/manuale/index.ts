import { glossario } from './glossario';
import { legislazione } from './legislazione';
import { manifesto } from './manifesto';
import { tono } from './tono';
import { verifica } from './verifica';

// Estensione dei blocchi del piano ('p' | 'list' | 'link'): 'h' per i sottotitoli,
// 'tone' sui paragrafi di verdetto. Il testo si rende sempre come testo React.
export type Block =
  | { kind: 'p'; text: string; tone?: 'good' | 'warn' | 'risk' }
  | { kind: 'h'; text: string; level?: 2 | 3 | 4; tag?: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'link'; label: string; href: `https://${string}` };

export type Section = { id: string; title: string; blocks: Block[] };

export const manuale: Section[] = [manifesto, tono, verifica, legislazione, glossario];
