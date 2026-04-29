// src/hooks/useRussianKeyboard.js
import { useEffect } from "react";
import { QWERTY_TO_CYR } from "../constants";

/**
 * Intercepts keydown events on a given input ref and maps
 * QWERTY characters to their Cyrillic equivalents when enabled.
 *
 * Usage:
 *   const inputRef = useRef(null);
 *   useRussianKeyboard(inputRef, translitEnabled);
 *   return <input ref={inputRef} ... />;
 *
 * @param {React.RefObject} ref   - ref attached to the input or textarea
 * @param {boolean}         enabled - whether keyboard intercept is active
 */
export function useRussianKeyboard(ref, enabled, dep) {
  useEffect(() => {
    const el = ref?.current;
    if (!el || !enabled) return;

    const handler = (e) => {
      // Allow all modifier combos (Ctrl+C, Cmd+V, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Allow navigation and control keys
      if (e.key.length > 1) return;

      const cyr = QWERTY_TO_CYR[e.key];
      if (!cyr) return;

      e.preventDefault();

      // Insert Cyrillic character at cursor position
      const start = el.selectionStart ?? 0;
      const end   = el.selectionEnd   ?? 0;
      const val   = el.value;

      // Use execCommand for React-compatible input mutation
      el.focus();
      if (typeof el.setRangeText === "function") {
        el.setRangeText(cyr, start, end, "end");
        // Trigger React's onChange synthetic event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, "value"
        )?.set ?? Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, "value"
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, el.value);
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        // Fallback
        const newVal = val.slice(0, start) + cyr + val.slice(end);
        el.value = newVal;
        el.setSelectionRange(start + cyr.length, start + cyr.length);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [ref, enabled, dep]);
}