import type { ReactElement } from 'react';

interface StepperProps {
  readonly label: string;
  readonly value: number;
  readonly canAdd: boolean;
  readonly onChange: (delta: number) => void;
}

/** Zähler mit − und +; die Grenzen kennt der Aufrufer. */
export function Stepper({ label, value, canAdd, onChange }: StepperProps): ReactElement {
  return (
    <div className="stepper">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`${label} −`}
        disabled={value <= 0}
        onClick={() => onChange(-1)}
      >
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button
        type="button"
        aria-label={`${label} +`}
        disabled={!canAdd}
        onClick={() => onChange(1)}
      >
        +
      </button>
    </div>
  );
}
