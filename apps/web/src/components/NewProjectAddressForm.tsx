"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { geocodeSearchAction } from "../app/actions";
import s from "../styles/app.module.css";
import d from "../app/dashboard.module.css";
import { Spinner } from "./Spinner";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

export function NewProjectAddressForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pendingSearch, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = "address-suggestions";

  useEffect(() => {
    if (selected && selected.place_name === query) return;
    if (selected && selected.place_name !== query) {
      setSelected(null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setHint(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await geocodeSearchAction(trimmed);
        setSuggestions(results);
        if (results.length === 0) {
          setHint(
            "No matches — check Mapbox in Settings, or type the full street address.",
          );
        } else {
          setHint("Pick an address from the list.");
        }
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  function pickSuggestion(item: Suggestion) {
    setSelected(item);
    setQuery(item.place_name);
    setSuggestions([]);
    setHint(null);
  }

  function goConfirm() {
    if (!selected) return;
    const params = new URLSearchParams({
      address: selected.place_name,
      lat: String(selected.lat),
      lng: String(selected.lng),
    });
    router.push(`/confirm-pin?${params.toString()}`);
  }

  return (
    <div className={d.form}>
      <div className={d.addressField}>
        <input
          className={`${s.input} ${d.formInput}`}
          type="text"
          id="project-address"
          aria-label="Project address"
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing — e.g. 36 Wrights Terrace, Prahran"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={suggestions.length > 0 ? listId : undefined}
          aria-expanded={suggestions.length > 0}
        />
        {pendingSearch && (
          <span className={d.addressSpinner} aria-live="polite">
            <Spinner size="sm" label="Searching addresses" />
            Searching
          </span>
        )}

        {suggestions.length > 0 && (
          <ul id={listId} className={d.suggestions} role="listbox">
            {suggestions.map((item) => (
              <li key={item.id} role="option" aria-selected={selected?.id === item.id}>
                <button
                  type="button"
                  className={d.suggestionBtn}
                  onClick={() => pickSuggestion(item)}
                >
                  <span className={d.suggestionPrimary}>{item.text}</span>
                  <span className={d.suggestionSecondary}>{item.place_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <p className={d.addressPinned}>
          {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
        </p>
      )}

      {hint && !selected && <p className={d.addressHint}>{hint}</p>}

      <button
        type="button"
        className={s.btn}
        disabled={!selected}
        onClick={goConfirm}
      >
        Confirm on aerial →
      </button>
    </div>
  );
}
