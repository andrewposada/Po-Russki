// src/modules/Muzyka/index.jsx
// Route dispatcher for the Музыка module.
// /muzyka              → MuzykaHome
// /muzyka/song/:songId → SongStudy

import { useLocation, useParams } from "react-router-dom";
import MuzykaHome from "./MuzykaHome";
import SongStudy  from "./SongStudy";

export default function Muzyka() {
  const { pathname } = useLocation();

  if (pathname.startsWith("/muzyka/song/")) return <SongStudy />;
  return <MuzykaHome />;
}