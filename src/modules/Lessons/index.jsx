// src/modules/Lessons/index.jsx
import { useLocation, useParams } from "react-router-dom";
import LessonsHome       from "./LessonsHome";
import LessonPlayer      from "./LessonPlayer";
import AssignmentsQueue  from "./AssignmentsQueue";
import LessonImport      from "./LessonImport";

export default function Lessons() {
  const location = useLocation();
  const path = location.pathname;

  if (path.startsWith("/lessons/play/"))      return <LessonPlayer />;
  if (path.startsWith("/lessons/assignments")) return <AssignmentsQueue />;
  if (path.startsWith("/lessons/import"))      return <LessonImport />;
  // Remaining sub-screens wired in later phases:
  // /lessons/roadmap/:roadmapId → RoadmapView (Phase 3F.3)

  return <LessonsHome />;
}