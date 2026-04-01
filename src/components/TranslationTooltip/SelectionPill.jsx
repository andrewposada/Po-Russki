// src/components/TranslationTooltip/SelectionPill.jsx
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../AuthContext";
import { useTooltip } from "../../context/TooltipContext";
import { getWords } from "../../storage";
import styles from "./SelectionPill.module.css";

// Snap a partial selection to the full word token
function snapToWord(text, anchorOffset, focusOffset) {
  if (!text) return null;
  // Walk back to word start, forward to word end
  let start = Math.min(anchorOffset, focusOffset);
  let end   = Math.max(anchorOffset, focusOffset);
  const isCyrillic = (ch) => /[а-яёА-ЯЁ]/.test(ch);

  // If not even one Cyrillic char in selection, bail
  const sel = text.slice(start, end);
  if (!sel || ![...sel].some(isCyrillic)) return null;

  // Find containing word boundaries
  while (start > 0 && isCyrillic(text[start - 1])) start--;
  while (end < text.length && isCyrillic(text[end])) end++;

  const word = text.slice(start, end);
  if (!word) return null;
  return word;
}

export default function SelectionPill() {
  const { user }        = useAuth();
  const { openTooltip } = useTooltip();
  const [pill, setPill] = useState(null);
  // pill: { x, y, selectedText, isPhrase, anchorNode, anchorOffset, focusOffset }
  const [loading, setLoading] = useState(false);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setPill(null); return; }

    const raw = sel.toString().trim();
    if (!raw || raw.length === 0) { setPill(null); return; }

    // Must contain at least one Cyrillic character
    if (!/[а-яёА-ЯЁ]/.test(raw)) { setPill(null); return; }

    const range    = sel.getRangeAt(0);
    const rect     = range.getBoundingClientRect();
    const isPhrase = raw.split(/\s+/).filter(Boolean).length > 1;

    // For single word: snap to full word
    let displayText = raw;
    if (!isPhrase) {
      const anchorNode = sel.anchorNode;
      const nodeText   = anchorNode?.textContent ?? "";
      const snapped    = snapToWord(nodeText, sel.anchorOffset, sel.focusOffset);
      if (snapped) displayText = snapped;
    }

    setPill({
      x:    rect.left + rect.width / 2 + window.scrollX,
      y:    rect.top + window.scrollY - 8,
      text: displayText,
      isPhrase,
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  // Dismiss on click outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest("[data-selection-pill]")) setPill(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!pill) return null;

  const handleTranslate = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/translate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: pill.text, isPhrase: pill.isPhrase }),
      });
      const data = await res.json();
      console.log("translate response:", res.status, data);
      if (!data.translation) { setLoading(false); return; }

      // Check word bank status against lemma (single words only)
      let wordBankStatus = "none";
      if (!pill.isPhrase && data.lemma) {
        const words = await getWords(user.uid);
        const match = words.find(w => w.word?.toLowerCase() === data.lemma.toLowerCase());
        if (match) {
          wordBankStatus = match.is_mastered ? "mastered" : "active";
        }
      }

      openTooltip({
        x:               pill.x,
        y:               pill.y,
        word:            data.lemma ?? pill.text,
        displayWord:     pill.text,
        translation:     data.translation,
        contextNote:     data.contextNote ?? null,
        isPhrase:        pill.isPhrase,
        wordBankStatus,
      });
      setPill(null);
    } catch (err) {
      console.error("Translate error:", err);
    }
    setLoading(false);
  };

  return (
    <div
      data-selection-pill
      className={styles.pill}
      style={{ left: pill.x, top: pill.y }}
    >
      <button
        className={styles.btn}
        onMouseDown={e => e.preventDefault()} // don't collapse selection
        onClick={handleTranslate}
        disabled={loading}
      >
        {loading ? "…" : "Translate"}
      </button>
    </div>
  );
}