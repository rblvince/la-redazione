import type { TopicData } from './types';

/** Che cosa può fare chi guarda la pagina. Serve solo a mostrare i comandi giusti: i permessi veri sono nel database. */
export type Viewer = {
  /** Il manutentore vede tutto e non tocca niente. */
  readOnly: boolean;
  /** Decisore attivo: vota, parcheggia, assegna chi scrive e chi rilegge. */
  isDecider: boolean;
  isWriter: boolean;
  isReviewer: boolean;
};

export function viewerOf(data: Pick<TopicData, 'me' | 'deciders' | 'topic'>): Viewer {
  const { me, deciders, topic } = data;
  return {
    readOnly: me.role === 'manutentore',
    isDecider: me.role === 'decisore' && deciders.includes(me.id),
    isWriter: topic.writer_id === me.id,
    isReviewer: topic.reviewer_id === me.id,
  };
}
