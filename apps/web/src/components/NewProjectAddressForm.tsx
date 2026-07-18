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

/** Melbourne CBD — only used if geocode returns nothing for a freeform address. */
const MELBOURNE_FALLBACK = { lat: -37.8136, lng: 144.9631 };

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
            "No list matches — you can still continue with this address and pin on the aerial.",
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
    const trimmed = query.trim();
    if (trimmed.length < 5) return;

    if (selected) {
      const params = new URLSearchParams({
        address: selected.place_name,
        lat: String(selected.lat),
        lng: String(selected.lng),
      });
      router.push(`/confirm-pin?${params.toString()}`);
      return;
    }

    // Freeform: use first suggestion match if any, else Melbourne pin for adjust.
    const fallback = suggestions[0];
    const params = new URLSearchParams({
      address: trimmed,
      lat: String(fallback?.lat ?? MELBOURNE_FALLBACK.lat),
      lng: String(fallback?.lng ?? MELBOURNE_FALLBACK.lng),
    });
    router.push(`/confirm-pin?${params.toString()}`);
  }

  const canContinue = query.trim().length >= 5;

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
          onKeyDown={(e) => {
            if (e.key === "Enter" && canContinue) {
              e.preventDefault();
              goConfirm();
            }
          }}
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
              <li
                key={item.id}
                role="option"
                aria-selected={selected?.id === item.id}
              >
                <button
                  type="button"
                  className={d.suggestionBtn}
                  onClick={() => pickSuggestion(item)}
                >
                  <span className={d.suggestionPrimary}>{item.text}</span>
                  <span className={d.suggestionSecondary}>
                    {item.place_name}
                  </span>
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
        className={s.btnAccent}
        disabled={!canContinue}
        onClick={goConfirm}
      >
        {selected ? "Pin garden on aerial →" : "Continue with this address →"}
      </button>
    </div>
  );
}
