"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { geocodeSearchAction } from "../app/actions";
import css from "./newProjectAddressForm.module.css";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

const MELBOURNE_FALLBACK = { lat: -37.8136, lng: 144.9631 };

function labelFor(item: Suggestion): string {
  // Nominatim often sets text to house number only — prefer a readable street line.
  const first = item.place_name.split(",").slice(0, 3).join(",").trim();
  if (!item.text || /^\d+$/.test(item.text.trim())) return first || item.place_name;
  if (item.place_name.toLowerCase().startsWith(item.text.toLowerCase())) {
    return first || item.place_name;
  }
  return `${item.text} — ${first}`;
}

export function NewProjectAddressForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
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
      setSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const results = await geocodeSearchAction(trimmed);
          if (requestId !== requestIdRef.current) return;
          setSuggestions(results);
          setHint(
            results.length === 0
              ? "No matches — continue still locates the typed address."
              : "Tap a match to locate the property.",
          );
        } catch {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          setHint("Search failed — continue still locates the typed address.");
        } finally {
          if (requestId === requestIdRef.current) setSearching(false);
        }
      })();
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  /** First create only — locate loader, then canvas. Reopening a project skips this. */
  function goLocate(address: string, lat: number, lng: number) {
    const params = new URLSearchParams({
      address,
      lat: String(lat),
      lng: String(lng),
    });
    router.push(`/confirm-pin?${params.toString()}`);
  }

  function pickSuggestion(item: Suggestion) {
    setSelected(item);
    setQuery(item.place_name);
    setSuggestions([]);
    setHint(null);
    goLocate(item.place_name, item.lat, item.lng);
  }

  function goOpen() {
    const trimmed = query.trim();
    if (trimmed.length < 5) return;

    if (selected) {
      goLocate(selected.place_name, selected.lat, selected.lng);
      return;
    }

    const fallback = suggestions[0];
    goLocate(
      trimmed,
      fallback?.lat ?? MELBOURNE_FALLBACK.lat,
      fallback?.lng ?? MELBOURNE_FALLBACK.lng,
    );
  }

  const canContinue = query.trim().length >= 5;

  return (
    <div className={css.form}>
      <div className={css.field}>
        <input
          className={css.input}
          type="text"
          id="project-address"
          aria-label="Project address"
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canContinue) {
              e.preventDefault();
              if (suggestions[0] && !selected) {
                pickSuggestion(suggestions[0]);
                return;
              }
              goOpen();
            }
          }}
          placeholder="Start typing — e.g. 6 Beatty Ave, Armadale"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={suggestions.length > 0 ? listId : undefined}
          aria-expanded={suggestions.length > 0}
        />
        {searching ? (
          <span className={css.spinner} aria-live="polite">
            Searching…
          </span>
        ) : null}

        {suggestions.length > 0 ? (
          <ul id={listId} className={css.list} role="listbox">
            {suggestions.map((item) => (
              <li key={item.id} role="option" aria-selected={selected?.id === item.id}>
                <button
                  type="button"
                  className={css.option}
                  onClick={() => pickSuggestion(item)}
                >
                  <span className={css.primary}>{labelFor(item)}</span>
                  <span className={css.secondary}>{item.place_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <p className={css.pinned}>
          {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
        </p>
      ) : null}

      {hint && !selected ? <p className={css.hint}>{hint}</p> : null}

      <button
        type="button"
        className={css.submit}
        disabled={!canContinue}
        onClick={goOpen}
      >
        Locate property →
      </button>
    </div>
  );
}
