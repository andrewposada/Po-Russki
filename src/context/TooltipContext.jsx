// src/context/TooltipContext.jsx
import { createContext, useContext, useState, useCallback } from "react";

const TooltipContext = createContext(null);

export function TooltipProvider({ children }) {
  const [tooltip, setTooltip] = useState(null);
  // tooltip shape: { x, y, word, lemma, translation, isPhrase, wordBankStatus }
  // wordBankStatus: "none" | "active" | "mastered"

  const openTooltip  = useCallback((data) => setTooltip(data), []);
  const closeTooltip = useCallback(() => setTooltip(null), []);

  return (
    <TooltipContext.Provider value={{ tooltip, openTooltip, closeTooltip }}>
      {children}
    </TooltipContext.Provider>
  );
}

export const useTooltip = () => useContext(TooltipContext);