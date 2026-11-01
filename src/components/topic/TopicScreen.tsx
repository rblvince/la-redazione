import type { ReactNode } from 'react';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { Icon } from '@/components/shell/Icon';
import { StageBar } from '@/components/shell/StageBar';
import type { Vote } from '@/components/shell/VoteSquares';
import { AssignPeople } from './AssignPeople';
import { CommentForm } from './CommentForm';
import { DecisionBar } from './DecisionBar';
import { Gate } from './Gate';
import { Properties } from './Properties';
import { PublishedSummary } from './PublishedSummary';
import { Section } from './Section';
import { SourceForm } from './SourceForm';
import { SourceList } from './SourceList';
import { Thread } from './Thread';
import { VerifyList } from './VerifyList';
import { peopleMap, personName, type TopicData } from './types';
import { viewerOf } from './viewer';
import { voteSummary } from './vote-summary';
import styles from './TopicScreen.module.css';

/** A quale vista della bacheca appartiene il tema: serve al "Temi" di ritorno e all'elenco accanto. */
export function viewForStage(stage: TopicData['topic']['stage']): 'da_decidere' | 'decisi' | 'parcheggiati' {
  if (stage === 'da_decidere') return 'da_decidere';
  if (stage === 'parcheggiato') return 'parcheggiati';
  return 'decisi';
}

export function backHref(stage: TopicData['topic']['stage']): string {
  const view = viewForStage(stage);
  return view === 'da_decidere' ? '/temi' : `/temi?vista=${view}`;
}

/**
 * La pagina del tema, in tutte le fasi. Server Component: compone; i pezzi che agiscono sono client.
 * Chi guarda determina solo quali comandi si vedono (`viewerOf`): i permessi veri restano nel database.
 */
export function TopicScreen({ data, list, now }: { data: TopicData; list: ReactNode; now: Date }) {
  const { topic, votes, comments, events, checks, sources, people, me, deciders, gate } = data;
  const viewer = viewerOf(data);
  const byId = peopleMap(data);
  const candidates = people.filter((person) => person.active);
  const stage = topic.stage;
  const working = stage === 'verifica' || stage === 'legale';
  const deciding = stage === 'da_decidere' || stage === 'parcheggiato';
  const reviewApproved = Boolean(topic.review_approved_at);

  const deciderList = deciders.map((id) => ({ id, name: personName(byId, id) }));
  const squares: Vote[] = deciderList.map((decider) => ({
    name: decider.name,
    value: votes.find((vote) => vote.voter_id === decider.id)?.value ?? null,
  }));
  const myVote = votes.find((vote) => vote.voter_id === me.id)?.value ?? null;
  const hasBar = deciding && !viewer.readOnly;

  const done = (kind: 'verifica' | 'legale') => checks.filter((check) => check.kind === kind).length;

  return (
    <DesktopShell
      current="temi"
      title="Temi"
      list={list}
      phoneShows="detail"
      back={{ href: backHref(stage), label: 'Temi' }}
      // Nel tema il "+" non serve e sul telefono copre spunte e barra di azioni: si nasconde sempre.
      hideFab
      canPropose={!viewer.readOnly}
      people={candidates.map((person) => person.display_name)}
    >
      <>
      <article className={styles.topic} aria-labelledby="tema-titolo">
        <header className={styles.head}>
          <h1 id="tema-titolo" className={styles.title}>
            {topic.title}
          </h1>
          <StageBar stage={stage} reviewApproved={reviewApproved} />
          {topic.body ? <p className={styles.body}>{topic.body}</p> : null}
          {viewer.readOnly ? (
            <p className={styles.readonly}>
              <Icon name="lock" size={16} />
              Sola lettura: da manutentore puoi guardare, non votare né modificare.
            </p>
          ) : null}
        </header>

        <Section id="proposta" title="Proposta">
          <Properties topic={topic} people={byId} meId={me.id} />
        </Section>

        {working ? (
          <>
            <Section id="persone" title="Chi scrive e chi rilegge">
              <AssignPeople
                topicId={topic.id}
                candidates={candidates}
                writerId={topic.writer_id}
                reviewerId={topic.reviewer_id}
                canEdit={viewer.isDecider}
                meId={me.id}
              />
            </Section>

            <Section id="verifica" title="Verifica" note={`${done('verifica')} di 5`}>
              <VerifyList topicId={topic.id} kind="verifica" checks={checks} people={byId} canEdit={!viewer.readOnly} now={now} />
            </Section>

            {stage === 'legale' ? (
              <Section id="legale" title="Controllo legale" note={`${done('legale')} di 5`}>
                <VerifyList topicId={topic.id} kind="legale" checks={checks} people={byId} canEdit={!viewer.readOnly} now={now} />
              </Section>
            ) : null}

            <Section id="fonti" title="Fonti" note={sources.length > 0 ? String(sources.length) : undefined}>
              <SourceList sources={sources} people={byId} meId={me.id} stage={stage} readOnly={viewer.readOnly} />
              {viewer.readOnly ? null : <SourceForm topicId={topic.id} />}
            </Section>

            {gate && !viewer.readOnly ? (
              <Section id="cancello" title="Cancello">
                <Gate
                  topicId={topic.id}
                  stage={stage}
                  gate={gate}
                  reviewerName={topic.reviewer_id ? personName(byId, topic.reviewer_id) : null}
                  reviewApproved={reviewApproved}
                  approvedBy={topic.review_approved_by ? personName(byId, topic.review_approved_by) : null}
                  isWriter={viewer.isWriter}
                  isReviewer={viewer.isReviewer}
                />
              </Section>
            ) : null}
          </>
        ) : null}

        {stage === 'pubblicato' ? (
          <>
            <PublishedSummary data={data} people={byId} readOnly={viewer.readOnly} />
            <Section id="fonti" title="Fonti" note={sources.length > 0 ? String(sources.length) : undefined}>
              <SourceList sources={sources} people={byId} meId={me.id} stage={stage} readOnly={viewer.readOnly} />
            </Section>
          </>
        ) : null}

        <Section id="discussione" title="Discussione" note={comments.length > 0 ? String(comments.length) : undefined}>
          <Thread comments={comments} events={events} people={byId} meId={me.id} now={now} showEvents={stage !== 'pubblicato'} />
          {viewer.readOnly ? null : <CommentForm topicId={topic.id} />}
        </Section>

      </article>
      {hasBar ? (
        <DecisionBar
          topicId={topic.id}
          stage={stage as 'da_decidere' | 'parcheggiato'}
          canVote={viewer.isDecider}
          canReactivate={me.role === 'decisore' || me.role === 'membro'}
          myVote={myVote}
          votes={squares}
          summary={voteSummary(votes, deciderList)}
        />
      ) : null}
      </>
    </DesktopShell>
  );
}
