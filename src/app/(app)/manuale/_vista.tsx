import Link from 'next/link';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { Icon } from '@/components/shell/Icon';
import { manuale, type Section } from '@/content/manuale';
import { SezioneView } from './_sezione';
import styles from './manuale.module.css';

function intro(section: Section): string | null {
  const first = section.blocks.find((b) => b.kind === 'p');
  return first && first.kind === 'p' ? first.text : null;
}

function Indice({ activeId, explicit }: { activeId: string; explicit: boolean }) {
  return (
    <nav aria-label="Schede del Manuale">
      <ul className={styles.index}>
        {manuale.map((section) => {
          const active = section.id === activeId;
          const text = intro(section);
          return (
            <li key={section.id}>
              <Link
                href={`/manuale/${section.id}`}
                className={`${styles.item} ${active ? styles.sel : ''}`}
                aria-current={active && explicit ? 'page' : undefined}
              >
                <span className={styles.itemBody}>
                  <span className={styles.itemTitle}>{section.title}</span>
                  {text ? <span className={styles.itemMeta}>{text}</span> : null}
                </span>
                <Icon name="chev" size={15} className={styles.itemChev} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** `/manuale` mostra l'indice (telefono) e il Manifesto accanto all'elenco (da 1024px). `/manuale/[sezione]` apre la scheda. */
export function ManualeVista({ sectionId, explicit }: { sectionId: string | null; explicit: boolean }) {
  // `sectionId` nullo = la scheda sta arrivando (guscio mostrato mentre `params` si risolve).
  const section = sectionId === null ? null : (manuale.find((s) => s.id === sectionId) ?? manuale[0]);
  return (
    <DesktopShell
      current="manuale"
      title="Manuale"
      list={<Indice activeId={section?.id ?? ''} explicit={explicit} />}
      phoneShows={explicit ? 'detail' : 'list'}
      back={{ href: '/manuale', label: 'Manuale' }}
    >
      {section ? (
        <SezioneView section={section} />
      ) : (
        <p className={styles.loading} role="status">
          Carico la scheda…
        </p>
      )}
    </DesktopShell>
  );
}
