import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function ZugrioSelect({
  label,
  name,
  value,
  options,
  onChange,
  placeholder = "Choose",
  required = false,
}) {
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options.find(option => option.value === value);

  const listId = "zugrio-select-" + uid;
  const activeId = open && options[activeIndex] ? listId + "-option-" + activeIndex : undefined;

  useEffect(() => {
    function outside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  const labels = useMemo(() => options.map(option => option.label.toLowerCase()), [options]);

  function assessDirection() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimated = Math.min(300, options.length * 44 + 16);
    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    setDropUp(roomBelow < estimated && roomAbove > roomBelow);
  }

  function openMenu(index = selectedIndex) {
    assessDirection();
    setActiveIndex(Math.max(0, index));
    setOpen(true);
  }

  function choose(index) {
    const option = options[index];
    if (!option) return;
    onChange(name, option.value);
    setActiveIndex(index);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) return openMenu(selectedIndex);
      setActiveIndex(index => Math.min(options.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openMenu(selectedIndex);
      setActiveIndex(index => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !open) {
      event.preventDefault();
      openMenu(selectedIndex);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key.length === 1 && /[a-z0-9/ ]/i.test(event.key)) {
      typeaheadRef.current += event.key.toLowerCase();
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 650);
      const match = labels.findIndex(text => text.startsWith(typeaheadRef.current));
      if (match >= 0) {
        if (!open) openMenu(match);
        else setActiveIndex(match);
      }
    }
  }

  return (
    <div
      className={"zugrio-select " + (open ? "is-open " : "") + (dropUp ? "opens-up" : "opens-down")}
      ref={rootRef}
      data-field={name}
      onBlur={() => requestAnimationFrame(() => {
        if (!rootRef.current?.contains(document.activeElement)) setOpen(false);
      })}
    >
      <label id={listId + "-label"}>{label}{required && <span className="required-word" aria-hidden="true">REQUIRED</span>}</label>
      <button
        ref={triggerRef}
        type="button"
        className="zugrio-select-trigger"
        role="combobox"
        aria-labelledby={listId + "-label"}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={activeId}
        aria-required={required || undefined}
        onClick={() => open ? setOpen(false) : openMenu(selectedIndex)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "has-value" : "placeholder"}>{selected?.label || placeholder}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="zugrio-select-menu" id={listId} role="listbox" aria-labelledby={listId + "-label"}>
          <div className="zugrio-select-sheen" aria-hidden="true" />
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <div
                key={option.value}
                id={listId + "-option-" + index}
                role="option"
                aria-selected={isSelected}
                className={"zugrio-select-option " + (isSelected ? "is-selected " : "") + (isActive ? "is-active" : "")}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerDown={event => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                <Check size={14} aria-hidden="true" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
