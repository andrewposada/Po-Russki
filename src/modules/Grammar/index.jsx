// src/modules/Grammar/index.jsx
import { useLocation } from "react-router-dom";
import GrammarHome     from "./GrammarHome";
import GrammarFreeplay from "./GrammarFreeplay";

export default function Grammar() {
  const location = useLocation();
  const path     = location.pathname;

  if (path.startsWith("/grammar/freeplay")) return <GrammarFreeplay />;

  return <GrammarHome />;
}