// src/modules/Vocabulary/index.jsx
// Route entry — renders sub-screens based on current path.

import { useLocation } from "react-router-dom";
import VocabHome  from "./VocabHome";
import Session    from "./Session";
import Flashcards from "./Flashcards";

export default function Vocabulary() {
  const { pathname } = useLocation();

  if (pathname === "/vocabulary/session" || pathname === "/vocabulary/explore") {
    return <Session />;
  }
  if (pathname === "/vocabulary/flashcards") {
    return <Flashcards />;
  }
  return <VocabHome />;
}