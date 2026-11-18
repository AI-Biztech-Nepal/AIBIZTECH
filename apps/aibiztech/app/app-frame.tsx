// An app shown inside the portal's page area: same tab, the portal's sidebar and top bar stay around it.
export function AppFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      className="app-frame"
      src={src}
      title={title}
      allow="clipboard-read; clipboard-write; camera; microphone; geolocation; fullscreen; downloads"
    />
  );
}
