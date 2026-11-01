'use client';

import { useState } from 'react';
import { setDecisionRuleAction, setStaleDaysAction } from '@/app/(app)/admin/actions';
import common from '@/components/topic/common.module.css';
import { Notice } from '@/components/topic/Notice';
import { useAction } from '@/components/topic/useAction';
import type { AdminSettings } from '@/lib/queries/admin';
import { outcome } from './adapt';
import styles from './AdminScreen.module.css';

const RULES: { value: AdminSettings['decision_rule']; name: string; hint: string }[] = [
  { value: 'unanimita', name: 'Tutti d’accordo', hint: 'Il tema passa quando tutti i decisori attuali votano sì. Un no lo tiene in discussione.' },
  { value: 'maggioranza', name: 'Maggioranza', hint: 'Il tema passa con più della metà dei decisori attuali.' },
];

function DecisionRule({ value }: { value: AdminSettings['decision_rule'] }) {
  const { pending, notice, run } = useAction();
  const [choice, setChoice] = useState(value);
  return (
    <form
      className={styles.rule}
      onSubmit={(event) => {
        event.preventDefault();
        run(() => outcome(setDecisionRuleAction(choice)), 'Regola di decisione salvata. I temi aperti si ricalcolano.');
      }}
    >
      <fieldset className={styles.fieldset} disabled={pending}>
        <legend className={common.label}>Regola di decisione</legend>
        {RULES.map((rule) => (
          <label key={rule.value} className={styles.choice}>
            <input
              type="radio"
              name="decision_rule"
              value={rule.value}
              checked={choice === rule.value}
              onChange={() => setChoice(rule.value)}
              className={styles.radio}
            />
            <span>
              <span className={styles.choiceName}>{rule.name}</span>
              <span className={styles.choiceHint}>{rule.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Notice notice={notice} />
      <button type="submit" className={`${common.btn} ${common.sm} ${styles.save}`} disabled={pending || choice === value} aria-busy={pending}>
        {pending ? 'Salvo…' : 'Salva regola'}
      </button>
    </form>
  );
}

function StaleDays({ value }: { value: number }) {
  const { pending, notice, run } = useAction();
  const [days, setDays] = useState(String(value));
  const parsed = Number(days);
  const valid = days.trim() !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= 365;
  return (
    <form
      className={styles.rule}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        run(() => outcome(setStaleDaysAction(parsed)), 'Giorni salvati.');
      }}
    >
      <label htmlFor="stale-days" className={common.label}>
        Giorni prima che un tema risulti fermo
      </label>
      <input
        id="stale-days"
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        step={1}
        value={days}
        onChange={(event) => setDays(event.target.value)}
        className={`${common.field} ${styles.number}`}
        aria-describedby="stale-days-hint"
        aria-invalid={!valid ? true : undefined}
        disabled={pending}
      />
      <p id="stale-days-hint" className={common.hint}>
        Un tema senza attività da più di questi giorni compare come fermo. Da 1 a 365.
      </p>
      <Notice notice={notice} />
      <button
        type="submit"
        className={`${common.btn} ${common.sm} ${styles.save}`}
        disabled={pending || !valid || parsed === value}
        aria-busy={pending}
      >
        {pending ? 'Salvo…' : 'Salva giorni'}
      </button>
    </form>
  );
}

/** Le regole dell'app. Ogni modulo salva da solo e ha il suo avviso; il valore nuovo arriva dal server dopo il salvataggio. */
export function RulesForm({ settings }: { settings: AdminSettings }) {
  return (
    <div className={styles.rules}>
      <DecisionRule key={settings.decision_rule} value={settings.decision_rule} />
      <StaleDays key={settings.stale_days} value={settings.stale_days} />
    </div>
  );
}
