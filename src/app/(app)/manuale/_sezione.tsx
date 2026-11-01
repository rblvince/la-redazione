import { Icon } from '@/components/shell/Icon';
import { Pill } from '@/components/shell/Pill';
import type { Block, Section } from '@/content/manuale';
import styles from './manuale.module.css';

const TONE = {
  good: { icon: 'ok', label: 'Via libera', cls: styles.good },
  warn: { icon: 'alert', label: 'Attenzione', cls: styles.warn },
  risk: { icon: 'x', label: 'Stop', cls: styles.risk },
} as const;

function Heading({ block }: { block: Extract<Block, { kind: 'h' }> }) {
  const level = block.level ?? 2;
  if (level === 4) return <p className={styles.h4}>{block.text}</p>;
  if (level === 3) {
    return (
      <h3 className={styles.h3}>
        <span>{block.text}</span>
        {block.tag ? <Pill>{block.tag}</Pill> : null}
      </h3>
    );
  }
  return <h2 className={styles.h2}>{block.text}</h2>;
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h':
      return <Heading block={block} />;
    case 'p': {
      if (!block.tone) return <p className={styles.p}>{block.text}</p>;
      const tone = TONE[block.tone];
      return (
        <p className={`${styles.verdict} ${tone.cls}`}>
          <Icon name={tone.icon} size={18} />
          <span className="sr-only">{tone.label}: </span>
          {block.text}
        </p>
      );
    }
    case 'list':
      return (
        <ul className={styles.list}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'link':
      // Il tipo garantisce https://, ma il controllo resta anche a runtime: un dato sporco non diventa un link.
      if (!block.href.startsWith('https://')) return null;
      return (
        <p className={styles.p}>
          <a className={styles.link} href={block.href} target="_blank" rel="noopener noreferrer">
            <Icon name="link" size={15} />
            {block.label}
            <span className="sr-only"> (si apre in una nuova scheda)</span>
          </a>
        </p>
      );
  }
}

/** Una scheda del Manuale. Tutto il testo passa come testo React: niente HTML dai dati. */
export function SezioneView({ section }: { section: Section }) {
  return (
    <article className={styles.article} aria-labelledby={`titolo-${section.id}`}>
      <h1 id={`titolo-${section.id}`} className={styles.title}>
        {section.title}
      </h1>
      {section.blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </article>
  );
}
