import { AuthFrame } from '@/components/auth/AuthFrame';

export default function Loading() {
  return (
    <AuthFrame title="Entra in redazione">
      <p className="sr-only" role="status">
        Carico…
      </p>
    </AuthFrame>
  );
}
