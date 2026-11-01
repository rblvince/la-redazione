type Listed = { display_name: string; active: boolean; role: string };

/** I nomi sotto "Persone" nella barra laterale: solo chi è attivo, e mai il manutentore. */
export function sidebarNames(people: Listed[]): string[] {
  return people.filter((person) => person.active && person.role !== 'manutentore').map((person) => person.display_name);
}
