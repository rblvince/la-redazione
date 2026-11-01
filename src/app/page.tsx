import { redirect } from 'next/navigation';

// La home rimanda alla bacheca dei temi; il proxy gestisce l'accesso.
export default function Home() {
  redirect('/temi');
}
