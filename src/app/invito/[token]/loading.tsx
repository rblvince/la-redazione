import { AuthFrame } from '@/components/auth/AuthFrame';

export default function Loading() {
  return (
    <AuthFrame title="Controllo l’invito…">
      <p className="sr-only" role="status">
        Controllo l’invito…
      </p>
    </AuthFrame>
  );
}
