"use client";

import s from "../designStudio.module.css";

export function KeyboardLegend() {
  return (
    <details className={s.keyboardLegend}>
      <summary>Keyboard shortcuts</summary>
      <ul>
        <li>
          <kbd>P</kbd> Place
        </li>
        <li>
          <kbd>D</kbd> Draw markup
        </li>
        <li>
          <kbd>V</kbd> Select
        </li>
        <li>
          <kbd>Esc</kbd> Cancel / deselect
        </li>
        <li>
          <kbd>Delete</kbd> Remove selected symbol
        </li>
        <li>
          <kbd>Ctrl</kbd>+<kbd>Z</kbd> Undo stroke
        </li>
      </ul>
    </details>
  );
}
