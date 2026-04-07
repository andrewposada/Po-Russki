// src/modules/Lessons/index.jsx
import { useLocation, useParams } from "react-router-dom";
import LessonsHome  from "./LessonsHome";
import LessonPlayer from "./LessonPlayer";

export default function Lessons() {
  const location = useLocation();
  const path = location.pathname;

  if (path.startsWith("/lessons/play/")) return <LessonPlayer />;
  // Remaining sub-screens wired in later phases:
  // /lessons/roadmap/:roadmapId → RoadmapView (Phase 3F.3)
  // /lessons/assignments        → AssignmentsQueue (Phase 3F.7)
  // /lessons/import             → LessonImport (Phase 3F.8)

  return <LessonsHome />;
}