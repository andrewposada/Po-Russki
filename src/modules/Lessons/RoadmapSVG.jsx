// src/modules/Lessons/RoadmapSVG.jsx
// Pure SVG roadmap renderer.
// Props:
//   nodes         — GRAMMAR_ROADMAP array
//   nodeStates    — { [nodeId]: 0|1|2|3|4 }  derived by computeNodeStates()
//   lessonStateMap — { [lessonId]: state }    raw completion states per lesson
//   onNodeTap     — (node) => void
//   maxY          — optional: clip to nodes with position.y <= maxY (for truncated view)

import { LESSON_STATE } from "../../constants";

// Inline CSS variable resolution for SVG — SVG doesn't inherit CSS vars in all
// contexts, so we map the project tokens to the values defined in index.css.
// If you change a token in index.css, update this map too.
const C = {
  bg:        "#f5f0e8",
  bgCard:    "#fffdf7",
  bgPanel:   "#eee8d8",
  bgDeep:    "#e8dfc8",
  border:    "#d4c9b0",
  sage:      "#7a9e7e",
  sageDark:  "#5a7a5e",
  sageLight: "#c8ddc8",
  sky:       "#7aaec8",
  orange:    "#d08030",
  textDark:  "#3a3020",
  textMid:   "#6a5e48",
  textLight: "#9a8e78",
  textXlight:"#b8ae98",
};

// Serpentine layout: nodes alternate left (x≈110) / right (x≈290)
// based on their index in the rendered (possibly filtered) list.
const LEFT_X  = 110;
const RIGHT_X = 290;
const SVG_W   = 400;

function nodeX(index) {
  return index % 2 === 0 ? LEFT_X : RIGHT_X;
}

// Derive a compact abbreviation for the node label inside the circle.
// Uses the first word of the title, capped at 4 chars, or the cefr level.
function nodeAbbr(node) {
  const words = node.title.split(" ");
  // For "Nominative Case" → "Ном", for "Type I Verbs" → "I"
  if (node.id.startsWith("conj")) return node.cefr;
  return words[0].slice(0, 4);
}

export default function RoadmapSVG({ nodes, nodeStates, lessonStateMap, onNodeTap, maxY }) {
  // Filter to visible nodes
  const visibleNodes = maxY !== undefined
    ? nodes.filter(n => n.position.y <= maxY)
    : nodes;

  if (visibleNodes.length === 0) return null;

  // Assign serpentine x positions based on render order
  const positioned = visibleNodes.map((node, i) => ({
    ...node,
    cx: nodeX(i),
    cy: 60 + i * 108,   // first node at y=60, each subsequent 108 units lower
  }));

  const svgHeight = positioned[positioned.length - 1].cy + 80;

  function getNodeStyle(state, status) {
    if (status === "coming_soon") {
      return { r: 17, fill: C.bgDeep, stroke: C.border, strokeWidth: 1.5, strokeDash: "4 3" };
    }
    switch (state) {
      case LESSON_STATE.MASTERED:
        return { r: 17, fill: "#d4aa30", stroke: "#a87e10", strokeWidth: 2, strokeDash: null };
      case LESSON_STATE.COMPLETED:
        return { r: 17, fill: C.sage, stroke: C.sageDark, strokeWidth: 2, strokeDash: null };
      case LESSON_STATE.IN_PROGRESS:
        return { r: 20, fill: C.bgCard, stroke: C.orange, strokeWidth: 2.5, strokeDash: null };
      case LESSON_STATE.AVAILABLE:
        return { r: 17, fill: "#eaf3ea", stroke: C.sage, strokeWidth: 2, strokeDash: null };
      case LESSON_STATE.LOCKED:
      default:
        return { r: 17, fill: C.bgDeep, stroke: "#c8bea8", strokeWidth: 1.5, strokeDash: null };
    }
  }

  // Build the bezier path string connecting all visible nodes
  function buildPath() {
    if (positioned.length < 2) return "";
    let d = `M ${positioned[0].cx} ${positioned[0].cy}`;
    for (let i = 1; i < positioned.length; i++) {
      const prev = positioned[i - 1];
      const curr = positioned[i];
      d += ` C ${prev.cx},${prev.cy + 70} ${curr.cx},${curr.cy - 70} ${curr.cx},${curr.cy}`;
    }
    return d;
  }

  // Build the completed-segment path overlay (only between consecutive done nodes)
  function buildCompletedPath() {
    if (positioned.length < 2) return "";
    let segments = "";
    for (let i = 1; i < positioned.length; i++) {
      const prevState = nodeStates[positioned[i - 1].id] ?? LESSON_STATE.LOCKED;
      const currState = nodeStates[positioned[i].id]     ?? LESSON_STATE.LOCKED;
      if (prevState >= LESSON_STATE.COMPLETED && currState >= LESSON_STATE.COMPLETED) {
        const prev = positioned[i - 1];
        const curr = positioned[i];
        segments += `M ${prev.cx} ${prev.cy} C ${prev.cx},${prev.cy + 70} ${curr.cx},${curr.cy - 70} ${curr.cx},${curr.cy} `;
      }
    }
    return segments.trim();
  }

  const fullPath      = buildPath();
  const completedPath = buildCompletedPath();

  function labelSide(cx) {
    return cx < SVG_W / 2 ? "right" : "left";
  }

  function isInteractive(node, state) {
    if (node.status === "coming_soon") return false;
    return state >= LESSON_STATE.AVAILABLE;
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${svgHeight}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Full dashed background path */}
      {fullPath && (
        <path
          d={fullPath}
          fill="none"
          stroke={C.border}
          strokeWidth="2.5"
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
      )}

      {/* Completed segment overlay */}
      {completedPath && (
        <path
          d={completedPath}
          fill="none"
          stroke={C.sage}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      )}

      {/* Nodes */}
      {positioned.map((node) => {
        const state  = nodeStates[node.id] ?? LESSON_STATE.LOCKED;
        const style  = getNodeStyle(state, node.status);
        const side   = labelSide(node.cx);
        const interactive = isInteractive(node, state);
        const abbr   = nodeAbbr(node);

        // Active node gets a pulsing ring
        const isActive = state === LESSON_STATE.IN_PROGRESS;
        // "Next" = first available node (AVAILABLE state)
        const isNext   = state === LESSON_STATE.AVAILABLE;
        // Done
        const isDone   = state >= LESSON_STATE.COMPLETED;
        // Coming soon
        const isComingSoon = node.status === "coming_soon";

        // Label text colour
        const labelColor = state === LESSON_STATE.LOCKED || isComingSoon
          ? C.textXlight
          : isDone
            ? C.textMid
            : C.textDark;
        const subColor = state === LESSON_STATE.LOCKED || isComingSoon ? "#c8bea8" : C.textLight;

        // Label anchor and x
        const labelAnchor = side === "right" ? "start" : "end";
        const labelX = side === "right"
          ? node.cx + style.r + 12
          : node.cx - style.r - 12;

        return (
          <g
            key={node.id}
            onClick={() => interactive && onNodeTap(node)}
            style={{ cursor: interactive ? "pointer" : "default" }}
          >
            {/* Outer ring for active nodes */}
            {isActive && (
              <circle
                cx={node.cx}
                cy={node.cy}
                r={style.r + 9}
                fill="none"
                stroke={C.sageLight}
                strokeWidth="4"
                opacity="0.7"
              />
            )}

            {/* Node circle */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r={style.r}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.strokeDash ?? undefined}
            />

            {/* Inner content */}
            {isDone && state < LESSON_STATE.MASTERED && (
              // White checkmark
              <polyline
                points={`${node.cx - 6},${node.cy} ${node.cx - 1},${node.cy + 5} ${node.cx + 7},${node.cy - 5}`}
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {state === LESSON_STATE.MASTERED && (
              // Gold star
              <text
                x={node.cx}
                y={node.cy + 5}
                textAnchor="middle"
                fontSize="14"
                fill="white"
              >★</text>
            )}

            {!isDone && (
              // Abbreviated topic label inside circle
              <text
                x={node.cx}
                y={node.cy + 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                fill={state === LESSON_STATE.LOCKED || isComingSoon ? C.textXlight : C.textDark}
              >
                {abbr}
              </text>
            )}

            {/* Node label (outside circle) */}
            <text
              x={labelX}
              y={node.cy - 5}
              textAnchor={labelAnchor}
              fontSize="12.5"
              fontWeight="600"
              fontFamily="Georgia, serif"
              fill={labelColor}
            >
              {node.title}
            </text>
            <text
              x={labelX}
              y={node.cy + 10}
              textAnchor={labelAnchor}
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              fill={subColor}
            >
              {isComingSoon ? "Coming soon" : node.subtitle}
            </text>

            {/* Active node progress tag */}
            {isActive && (() => {
              const lessonIds = node.lessons.map(l => l.id);
              const activeLessonId = lessonIds.find(id => {
                const s = lessonStateMap[id] ?? 0;
                return s === LESSON_STATE.IN_PROGRESS;
              }) ?? lessonIds.find(id => (lessonStateMap[id] ?? 0) < LESSON_STATE.COMPLETED);

              const activeLessonData = activeLessonId
                ? node.lessons.find(l => l.id === activeLessonId)
                : null;

              if (!activeLessonData) return null;

              // Preview card — rendered on the opposite side from the label
              const cardSide  = side === "right" ? "left" : "right";
              const cardX     = cardSide === "right" ? node.cx + style.r + 10 : node.cx - style.r - 10 - 167;
              const cardY     = node.cy - 34;
              const cardW     = 167;
              const cardH     = 52;

              return (
                <g>
                  <rect
                    x={cardX} y={cardY}
                    width={cardW} height={cardH}
                    rx="9"
                    fill={C.bgCard}
                    stroke={C.sage}
                    strokeWidth="1.5"
                  />
                  <text
                    x={cardX + 10} y={cardY + 16}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="Georgia, serif"
                    fill={C.textDark}
                  >
                    {activeLessonData.title.length > 20
                      ? activeLessonData.title.slice(0, 19) + "…"
                      : activeLessonData.title}
                  </text>
                  <text
                    x={cardX + 10} y={cardY + 29}
                    fontSize="9.5"
                    fontFamily="system-ui, sans-serif"
                    fill={C.textLight}
                  >
                    In progress · tap to continue
                  </text>
                  <line
                    x1={cardX + 10} y1={cardY + 36}
                    x2={cardX + cardW - 10} y2={cardY + 36}
                    stroke={C.border}
                    strokeWidth="1"
                  />
                  <rect
                    x={cardX + 10} y={cardY + 40}
                    width="68" height="8"
                    rx="4"
                    fill={C.sage}
                  />
                  <text
                    x={cardX + 44} y={cardY + 47.5}
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                    fill="white"
                  >
                    Continue →
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}