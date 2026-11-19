// Eigenaar: C. Ster om een conferentie op je shortlist te zetten.
type Props = {
  name: string;
  active: boolean;
  onToggle: () => void;
};

export function FavoriteButton({ name, active, onToggle }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      title={active ? 'Verwijder uit favorieten' : 'Zet in favorieten'}
      className={`focus:ring-signal flex size-8 shrink-0 items-center justify-center rounded-md text-lg leading-none transition-colors focus:ring-2 focus:outline-none ${
        active ? 'text-assess' : 'text-ink-muted hover:text-assess'
      }`}
    >
      <span aria-hidden="true">{active ? '★' : '☆'}</span>
      <span className="sr-only">
        {active ? 'Verwijder' : 'Zet'} {name} {active ? 'uit' : 'in'} favorieten
      </span>
    </button>
  );
}
