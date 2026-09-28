"use client";
import { useId, useState, useSyncExternalStore } from "react";
import { PROVINCES, filterProvinces, isProvince } from "@/lib/provinces";

// Touch screens get the native picker: a custom dropdown under a text field can
// end up behind the on-screen keyboard, and on some phones never shows at all.
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

/** Province picker restricted to the 77 provinces: native select on touch, typed combobox otherwise. */
export default function ProvinceInput({
  value,
  onChange,
  placeholder = "พิมพ์ชื่อจังหวัด เช่น กทม, ชลบุรี",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const touch = useTouch();

  // Follow external changes (e.g. OCR fills the value in).
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  // All matches (all 77 when empty); the list scrolls.
  const options = filterProvinces(text === value ? "" : text);
  const invalid = text !== "" && !isProvince(text);

  function pick(p: string) {
    setText(p);
    setSynced(p);
    onChange(p);
    setOpen(false);
  }

  if (touch)
    return (
      <div className={className}>
        <select
          className={`field ${value ? "" : "text-ink-3"}`}
          value={value}
          onChange={(e) => {
            setText(e.target.value);
            setSynced(e.target.value);
            onChange(e.target.value);
          }}
        >
          <option value="">เลือกจังหวัด</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p} className="text-ink">
              {p}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <div className={`relative ${className}`}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        className={`field ${invalid ? "border-warn" : ""}`}
        value={text}
        placeholder={placeholder}
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
              key={p}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-brand/10 text-brand" : ""}`}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
