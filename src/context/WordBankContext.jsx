// src/context/WordBankContext.jsx
import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "../AuthContext";
import { upsertWord, getWords } from "../storage";

const WordBankContext = createContext(null);

export function WordBankProvider({ children }) {
  const { user }          = useAuth();
  const [isOpen, setOpen] = useState(false);
  const [words,  setWords] = useState(null); // null = not yet loaded

  const open = useCallback(async () => {
    setOpen(true);
    if (!user || words !== null) return;
    const fetched = await getWords(user.uid);
    setWords(fetched ?? []);
  }, [user, words]);

  const close = useCallback(() => setOpen(false), []);

  const [enrichError, setEnrichError]   = useState(null); // { word, translation, isMastered }
  const [enrichPending, setEnrichPending] = useState(false);

  const _runEnrich = useCallback(async (userId, { word, translation, isMastered = false }) => {
    setEnrichPending(true);
    setEnrichError(null);
    try {
      const res  = await fetch("/api/enrich-word", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ word, translation }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const wordObj = {
        word:           data.word ?? word,
        translation:    data.translation ?? translation,
        part_of_speech: data.partOfSpeech ?? null,
        pronunciation:  data.pronunciation ?? null,
        etymology:      data.etymology ?? null,
        usage_example:  data.usage ?? null,
        is_mastered:    isMastered,
        proficiency:    isMastered ? 100 : 0,
      };

      await upsertWord(userId, wordObj);

      // Refresh local cache
      const updated = await getWords(userId);
      setWords(updated ?? []);
    } catch (err) {
      console.error("Enrich error:", err);
      setEnrichError({ userId, word, translation, isMastered });
    } finally {
      setEnrichPending(false);
    }
  }, []);

  // Called from TranslationTooltip — fires optimistically, returns immediately
  const enrich = useCallback((userId, opts) => {
    _runEnrich(userId, opts); // intentionally not awaited
  }, [_runEnrich]);

  const retryEnrich = useCallback(() => {
    if (!enrichError) return;
    const { userId, word, translation, isMastered } = enrichError;
    _runEnrich(userId, { word, translation, isMastered });
  }, [enrichError, _runEnrich]);

  const dismissEnrichError = useCallback(() => setEnrichError(null), []);

  return (
    <WordBankContext.Provider value={{ isOpen, words, open, close, enrich, setWords, enrichError, enrichPending, retryEnrich, dismissEnrichError }}>
      {children}
    </WordBankContext.Provider>
  );
}

export const useWordBank = () => useContext(WordBankContext);