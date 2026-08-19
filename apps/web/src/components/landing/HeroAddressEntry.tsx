"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeSearchAction } from "../../app/actions";
import css from "../../app/landing.module.css";

export type AddressSuggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

function labelFor(item: AddressSuggestion): string {
  // Nominatim often sets text to house number only — prefer a readable street line.
  const first = item.place_name.split(",").slice(0, 3).join(",").trim();
  if (!item.text || /^\d+$/.test(item.text.trim())) return first || item.place_name;
  if (item.place_name.toLowerCase().startsWith(item.text.toLowerCase())) {
    return first || item.place_name;
  }
  return `${item.text} — ${first}`;
}

/**
 * The hero's only copy is this input. Type an address, pick the real GNAF
 * match, and the hero re-centres on the property and draws its live title
 * boundary — the product demonstrates itself without a single claim.
 */
export function HeroAddressEntry({
  onPick,
  onOpen,
  statusLabel,
}: {
  onPick: (item: AddressSuggestion) => void;
  onOpen: () => void;
  statusLabel: string | null;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selected, setSelected] = useState<AddressSuggestion | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = "hero-address-suggestions";

  // The entry is the page — land focus in it on pointer devices.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  useEffect(() => {
    if (selected && selected.place_name === query) return;
    if (selected && selected.place_name !== query) {
      window.setTimeout(() => setSelected(null), 0);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      window.setTimeout(() => {
        setSuggestions([]);
        setHint(null);
        setSearching(false);
      }, 0);
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
              ? "No verified match. Refine the street address."
              : null,
          );
        } catch {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          setHint("Address search is unavailable. Try again shortly.");
        } finally {
          if (requestId === requestIdRef.current) setSearching(false);
        }
      })();
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  function pickSuggestion(item: AddressSuggestion) {
    setSelected(item);
    setQuery(item.place_name);
    setSuggestions([]);
    setHint(null);
    onPick(item);
  }

  /** Enter: pick the first match (re-centres the hero). Open is explicit. */
  function commit() {
    const trimmed = query.trim();
    if (trimmed.length < 5) return;
    if (selected) {
      onOpen();
      return;
    }
    if (suggestions[0]) {
      pickSuggestion(suggestions[0]);
      return;
    }
    setSearching(true);
    setHint(null);
    void (async () => {
      try {
        const results = await geocodeSearchAction(trimmed);
        if (results[0]) {
          pickSuggestion(results[0]);
        } else {
          setHint("No verified match. Refine the street address.");
        }
      } catch {
        setHint("Address search is unavailable. Try again shortly.");
      } finally {
        setSearching(false);
      }
    })();
  }

  return (
    <div className={css.entryArea} data-testid="hero-address-entry">
      <div className={css.entryPanel}>
        <div className={css.entryRow}>
          <input
            ref={inputRef}
            className={css.entryInput}
            type="text"
            aria-label="Enter your address"
            role="combobox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="Enter your address"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls={suggestions.length > 0 ? listId : undefined}
            aria-expanded={suggestions.length > 0}
            data-testid="hero-address-input"
          />
          {searching ? (
            <span className={css.entrySpinner} aria-live="polite">
              Searching…
            </span>
          ) : null}
          <button
            type="button"
            className={css.entryButton}
            aria-label={selected ? "Open the site" : "Locate property"}
            disabled={query.trim().length < 5 || searching}
            onClick={() => commit()}
            data-testid="hero-address-submit"
          >
            {selected ? "Open the site" : "→"}
          </button>
        </div>

        {suggestions.length > 0 ? (
          <ul id={listId} className={css.entrySuggest} role="listbox">
            {suggestions.map((item) => (
              <li key={item.id} role="option" aria-selected={selected?.id === item.id}>
                <button
                  type="button"
                  className={css.entryOption}
                  onClick={() => pickSuggestion(item)}
                >
                  <span className={css.entryPrimary}>{labelFor(item)}</span>
                  <span className={css.entrySecondary}>{item.place_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {statusLabel ? <p className={css.entryStatus}>{statusLabel}</p> : null}
      {hint && !selected ? <p className={css.entryHint}>{hint}</p> : null}
    </div>
  );
}
