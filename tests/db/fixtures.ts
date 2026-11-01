import type { TestDb } from './harness';

export async function seedPeople(db: TestDb) {
  const people = {
    maintainer: '00000000-0000-0000-0000-000000000001',
    marco: '00000000-0000-0000-0000-000000000002',
    giulia: '00000000-0000-0000-0000-000000000003',
    membro: '00000000-0000-0000-0000-000000000004',
  };

  await db.admin.query(
    `insert into auth.users (id, email) values
      ($1, 'maintainer@example.test'), ($2, 'Marco@example.test'),
      ($3, 'Giulia@example.test'), ($4, 'membro@example.test')`,
    [people.maintainer, people.marco, people.giulia, people.membro],
  );
  await db.admin.query(
    `insert into public.profiles (id, display_name, email, role) values
      ($1, 'maintainer', 'maintainer@example.test', 'manutentore'),
      ($2, 'Marco', 'Marco@example.test', 'decisore'),
      ($3, 'Giulia', 'Giulia@example.test', 'decisore'),
      ($4, 'Membro', 'membro@example.test', 'membro')`,
    [people.maintainer, people.marco, people.giulia, people.membro],
  );

  return people;
}
