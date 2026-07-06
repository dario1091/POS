import { forwardRef } from "react";

interface CommandBarProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onSetSelectedIndex: (index: number) => void;
}

export const CommandBar = forwardRef<HTMLInputElement, CommandBarProps>(
  function CommandBar({ value, onChange, disabled, onSetSelectedIndex }, ref) {
    return (
      <div className="px-4 py-3 bg-card border-t border-border shrink-0">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value) onSetSelectedIndex(-1);
          }}
          placeholder="Código de barras | N*código | pv[código] | pv nombre"
          className="w-full px-4 py-3 rounded-md bg-input border-2 border-border text-foreground text-lg font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          autoFocus
          disabled={disabled}
        />
      </div>
    );
  }
);
