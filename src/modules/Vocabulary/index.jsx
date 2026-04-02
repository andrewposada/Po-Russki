import { useLocation } from "react-router-dom";
import VocabHome   from "./VocabHome";
import Session     from "./Session";
import Flashcards  from "./Flashcards";
import Dictionary  from "./Dictionary";

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
  return <VocabHome />;
}