"use client";
import { useId, useState } from "react";
import { filterProvinces, isProvince } from "@/lib/provinces";

/** Free-typing combobox restricted to the 77 provinces. */
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

  // Follow external changes (e.g. OCR fills the value in).
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  const options = filterProvinces(text === value ? "" : text).slice(0, 8);
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
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + options.length) % options.length);
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
