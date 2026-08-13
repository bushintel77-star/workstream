"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { geocodeSearchAction } from "../../app/actions";
import css from "../../app/landing.module.css";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

const MELBOURNE_FALLBACK = { lat: -37.8136, lng: 144.9631 };

function SearchGlyph() {
  return <span className={css.searchGlyph} aria-hidden="true" />;
}

function LaunchGlyph() {
  return (
    <span className={css.launchGlyph} aria-hidden="true">
      ↗
    </span>
  );
}

function labelFor(item: Suggestion): string {
  const first = item.place_name.split(",").slice(0, 3).join(",").trim();
  if (!item.text || /^\d+$/.test(item.text.trim())) return first || item.place_name;
  if (item.place_name.toLowerCase().startsWith(item.text.toLowerCase())) {
    return first || item.place_name;
  }
  return `${item.text} — ${first}`;
}

/**
 * Step 0 site-truth search — wired to the same geocode + confirm-pin
 * pipeline as the dashboard's NewProjectAddressForm, so "Initiate" lands
 * in the real acquisition/canvas flow instead of a dead link.
 */
export function SiteTruthSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const listId = "site-search-suggestions";

  useEffect(() => {
    if (selected && selected.place_name === query) return;
    if (selected && selected.place_name !== query) {
      window.setTimeout(() => setSelected(null), 0);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      window.setTimeout(() => setSuggestions([]), 0);
      return;
    }

    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const results = await geocodeSearchAction(trimmed);
          if (requestId !== requestIdRef.current) return;
          setSuggestions(results);
        } catch {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
        }
      })();
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

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
    goLocate(item.place_name, item.lat, item.lng);
  }

  function initiate() {
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

  const canInitiate = query.trim().length >= 5;

  return (
    <div className={css.searchField}>
      <label className={css.srOnly} htmlFor="site-search">
        Search site address
      </label>
      <SearchGlyph />
      <input
        id="site-search"
        className={css.searchInput}
        placeholder="e.g., 37.8136° S, 144.9631° E or 123 Main St..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && canInitiate) {
            event.preventDefault();
            if (suggestions[0] && !selected) {
              pickSuggestion(suggestions[0]);
              return;
            }
            initiate();
          }
        }}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={suggestions.length > 0 ? listId : undefined}
        aria-expanded={suggestions.length > 0}
      />
      <button
        type="button"
        className={css.initiateButton}
        onClick={initiate}
        disabled={!canInitiate}
      >
        <span>Initiate</span>
        <LaunchGlyph />
      </button>

      {suggestions.length > 0 ? (
        <ul id={listId} className={css.suggestionList} role="listbox">
          {suggestions.map((item) => (
            <li key={item.id} role="option" aria-selected={selected?.id === item.id}>
              <button
                type="button"
                className={css.suggestionOption}
                onClick={() => pickSuggestion(item)}
              >
                <span className={css.suggestionPrimary}>{labelFor(item)}</span>
                <span className={css.suggestionSecondary}>{item.place_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
