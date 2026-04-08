// src/modules/Lessons/VocabContext.jsx
import { createContext, useContext } from "react";

export const VocabContext = createContext([]);
export const useVocab = () => useContext(VocabContext);