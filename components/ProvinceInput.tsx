"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { filterProvinces, isProvince } from "@/lib/provinces";

// Touch screens get a full-screen picker with the search box on top: a dropdown
// under a text field can end up behind the on-screen keyboard.
const COARSE = "(pointer: coarse)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useTouch = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** Offer "" as a choice with this label (e.g. "ไม่ระบุจังหวัด", "ทุกจังหวัด"). */
  emptyLabel?: string;
};

/** Searchable picker over the 77 provinces (type "กทม", "ชล"…), optionally allowing none. */
export default function ProvinceInput(props: Props) {
  return useTouch() ? <ProvinceSheet {...props} /> : <ProvinceCombobox {...props} />;
}

function ProvinceCombobox({
  value,
  onChange,
  placeholder = "พิมพ์ชื่อจังหวัด เช่น กทม, ชลบุรี",
  className = "",
  emptyLabel,
}: Props) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  // Follow external changes (e.g. OCR fills the value in).
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  const query = text === value ? "" : text;
  // "" (no province) first when allowed and nothing typed; all matches after, the list scrolls.
  const options = [...(emptyLabel && !query ? [""] : []), ...filterProvinces(query)];
  const invalid = text !== "" && !isProvince(text);

  function pick(p: string) {
    setText(p);
    setSynced(p);
    onChange(p);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        className={`field ${invalid ? "border-warn" : ""}`}
        value={text}
        placeholder={emptyLabel && !value ? emptyLabel : placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setActive(0);
          setOpen(true);
          if (isProvince(v)) {
            setSynced(v);
            onChange(v);
          } else if (value) {
            setSynced("");
            onChange("");
          }
        }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const next = (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
            setActive(next);
            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface-2 py-1"
        >
          {options.map((p, i) => (
            <li
              key={p || "(none)"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-brand/10 text-brand" : ""} ${
                p ? "" : "text-ink-3"
              }`}
            >
              {p || emptyLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProvinceSheet({ value, onChange, placeholder = "เลือกจังหวัด", className = "", emptyLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const options = [...(emptyLabel && !query ? [""] : []), ...filterProvinces(query)];

  function pick(p: string) {
    onChange(p);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={className}>
      <button
        type="button"
        className={`field flex items-center justify-between text-left ${value ? "" : "text-ink-3"}`}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{value || emptyLabel || placeholder}</span>
        <span aria-hidden className="text-ink-3">
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="เลือกจังหวัด" className="fixed inset-0 z-[80] flex flex-col bg-paper">
            <div className="flex items-center gap-2 border-b border-line p-3">
              <input
                ref={input}
                type="search"
                className="field flex-1"
                placeholder="ค้นหาจังหวัด เช่น กทม, ชล, เชียง"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && options.length) {
                    e.preventDefault();
                    pick(options[0]);
                  }
                }}
              />
              <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => setOpen(false)}>
                ปิด
              </button>
            </div>
            <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto">
              {options.map((p) => (
                <li key={p || "(none)"} role="option" aria-selected={p === value}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className={`w-full border-b border-line/60 px-4 py-3 text-left ${
                      p === value ? "bg-brand/10 font-semibold text-brand" : p ? "" : "text-ink-3"
                    }`}
                  >
                    {p || emptyLabel}
                  </button>
                </li>
              ))}
              {options.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">ไม่พบจังหวัดนี้</li>}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
