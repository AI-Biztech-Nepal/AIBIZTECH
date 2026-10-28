export function Notice({ error, message }: { error?: string; message?: string }) {
  if (error) return <p role="alert" className="error">{error}</p>;
  if (message) return <p role="status" className="message">{message}</p>;
  return null;
}

export type Search = Promise<{ error?: string; message?: string; next?: string; denied?: string; invite?: string }>;
