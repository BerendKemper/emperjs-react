import { useEffect, useRef, useState, type ReactNode } from "react";
import "./InlineNotePopover.css";

type InlineNotePopoverProps = {
  triggerLabel: string;
  children: ReactNode;
  className?: string;
};

export function InlineNotePopover({ triggerLabel, children, className }: InlineNotePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === `Escape`) setIsOpen(false);
    };

    window.addEventListener(`mousedown`, handlePointerDown);
    window.addEventListener(`keydown`, handleEscape);
    return () => {
      window.removeEventListener(`mousedown`, handlePointerDown);
      window.removeEventListener(`keydown`, handleEscape);
    };
  }, [isOpen]);

  return (
    <div className={`inline-note-popover ${className ?? ``}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="inline-note-popover__trigger"
        onClick={() => setIsOpen(previous => !previous)}
        aria-expanded={isOpen}
      >
        {triggerLabel}
      </button>
      {isOpen ? (
        <div className="inline-note-popover__panel">
          {children}
        </div>
      ) : null}
    </div>
  );
}

