import { useLocation } from "react-router-dom";
import VocabHome   from "./VocabHome";
import Session     from "./Session";
import Flashcards  from "./Flashcards";
import Dictionary  from "./Dictionary";
import Freeplay    from "./Freeplay";

export default function Vocabulary() {
  const { pathname } = useLocation();

  if (pathname === "/vocabulary/session" || pathname === "/vocabulary/explore") {
    return <Session />;
  }
  if (pathname === "/vocabulary/flashcards") {
    return <Flashcards />;
  }
  if (pathname === "/vocabulary/dictionary") {
    return <Dictionary />;
  }
  if (pathname === "/vocabulary/freeplay") {
    return <Freeplay />;
  }
  return <VocabHome />;
}