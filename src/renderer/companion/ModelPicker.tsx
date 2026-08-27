import { useEffect, useRef, useState } from "react";
import type { ModelOption } from "../../shared/protocol";

export interface CompanionModelPickerProps {
  models: ModelOption[];
  value: string;
  disabled?: boolean;
  onSelect: (model: string) => void;
}

export function CompanionModelPicker({ models, value, disabled = false, onSelect }: CompanionModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const availableModels = models.filter((model) => model.available !== false);
  const selected = availableModels.find((model) => model.id === value) ?? availableModels[0];
  const selectedValue = selected?.id ?? value;
  const selectedLabel = selected?.label || selected?.id || value || "No models available";

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="companion-model-picker">
      <button
        type="button"
        className="companion-model-trigger"
        aria-label={`Model, currently ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selectedLabel}
        disabled={disabled || availableModels.length === 0}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel}</span>
        <span className="companion-model-chevron" aria-hidden="true">⌃</span>
      </button>
      {open && (
        <div className="companion-model-popover" role="listbox" aria-label="Models">
          {availableModels.map((model) => {
            const label = model.label || model.id;
            const isSelected = model.id === selectedValue;
            return (
              <button
                key={model.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="companion-model-option"
                onClick={() => {
                  setOpen(false);
                  onSelect(model.id);
                }}
              >
                <span>{label}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
