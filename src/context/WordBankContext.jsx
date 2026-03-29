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

  // Called from TranslationTooltip when user saves a word
  const enrich = useCallback(async (userId, { word, translation, isMastered = false }) => {
    try {
      const res  = await fetch("/api/enrich-word", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ word, translation }),
      });
      const data = await res.json();

      const wordObj = {
        word:          data.word ?? word,
        translation:   data.translation ?? translation,
        part_of_speech: data.partOfSpeech ?? null,
        pronunciation: data.pronunciation ?? null,
        etymology:     data.etymology ?? null,
        usage_example: data.usage ?? null,
        is_mastered:   isMastered,
        proficiency:   isMastered ? 100 : 0,
      };

      await upsertWord(userId, wordObj);

      // Refresh local cache
      const updated = await getWords(userId);
      setWords(updated ?? []);
    } catch (err) {
      console.error("Enrich error:", err);
    }
  }, []);

  return (
    <WordBankContext.Provider value={{ isOpen, words, open, close, enrich, setWords }}>
      {children}
    </WordBankContext.Provider>
  );
}

export const useWordBank = () => useContext(WordBankContext);