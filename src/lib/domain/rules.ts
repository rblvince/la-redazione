export type DecisionRule = 'unanimita' | 'maggioranza';
export type DecisionOutcome = 'passa' | 'in_discussione';

export function decisionOutcome(
  rule: DecisionRule,
  deciders: number,
  yes: number,
  no: number,
): DecisionOutcome {
  if (deciders === 0) return 'in_discussione';
  if (rule === 'unanimita') return yes === deciders && no === 0 ? 'passa' : 'in_discussione';
  return yes > deciders / 2 ? 'passa' : 'in_discussione';
}
