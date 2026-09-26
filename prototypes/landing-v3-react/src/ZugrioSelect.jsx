import React, { useId } from "react";
import { ChevronDown } from "lucide-react";

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
  const selectId = "zugrio-select-" + uid;

  return (
    <div className="zugrio-select zugrio-select-native" data-field={name}>
      <label htmlFor={selectId}>
        {label}
        {required && <span className="required-word" aria-hidden="true">REQUIRED</span>}
      </label>

      <div className="zugrio-select-native-shell">
        <select
          className={value ? "has-value" : "placeholder"}
          id={selectId}
          name={name}
          value={value}
          required={required}
          aria-required={required || undefined}
          onChange={event => onChange(name, event.target.value)}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(option => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </div>
    </div>
  );
}
