export function Stella({ dim = 19 }: { dim?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={dim} height={dim} aria-hidden="true">
      <path d="M12 0 L14.3 9.7 L24 12 L14.3 14.3 L12 24 L9.7 14.3 L0 12 L9.7 9.7 Z" fill="currentColor" />
    </svg>
  );
}
