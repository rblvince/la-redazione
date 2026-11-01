export type VoteInput = { voter_id: string; value: boolean };
export type Decider = { id: string; name: string };

/**
 * Frase di stato dei voti del giro. Dice solo ciò che i dati dicono (chi ha votato, chi manca):
 * la regola con cui un tema passa non sta qui e non la inventiamo.
 */
export function voteSummary(votes: VoteInput[], deciders: Decider[]): string {
  if (deciders.length === 0) return 'Nessun decisore attivo.';
  const byVoter = new Map(votes.map((vote) => [vote.voter_id, vote.value]));
  const yes = deciders.filter((d) => byVoter.get(d.id) === true).length;
  const no = deciders.filter((d) => byVoter.get(d.id) === false).length;
  const missing = deciders.filter((d) => !byVoter.has(d.id)).map((d) => d.name);
  const count = `${yes} sì · ${no} no`;
  if (missing.length === 0) return `${count} · hanno votato tutti`;
  return `${count} · manca ${missing.join(', ')}`;
}
