// src/modules/Lessons/blocks/MiniStoryBlock.jsx
import { useState, useRef } from "react";
import TappableWord from "./TappableWord";
import styles       from "./Blocks.module.css";

export default function MiniStoryBlock({ block }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [ttsState, setTtsState] = useState("idle"); // "idle" | "loading" | "ready" | "playing" | "error"
  const audioRef    = useRef(null);   // HTMLAudioElement
  const audioBlobRef = useRef(null);  // cached blob URL

  async function handlePlay() {
    // If already playing, pause and reset
    if (ttsState === "playing") {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setTtsState("ready");
      return;
    }

    // If we have cached audio, just play it
    if (audioBlobRef.current) {
      audioRef.current.src = audioBlobRef.current;
      audioRef.current.play();
      setTtsState("playing");
      return;
    }

    // Fetch from TTS API
    setTtsState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: block.story_ru }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const data = await res.json();

      // Convert base64 to blob URL for reliable playback
      const binary = atob(data.audioContent);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob   = new Blob([bytes], { type: "audio/mp3" });
      const url    = URL.createObjectURL(blob);
      audioBlobRef.current = url;

      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setTtsState("ready");
      audioRef.current.play();
      setTtsState("playing");
    } catch {
      setTtsState("error");
      setTimeout(() => setTtsState("idle"), 2000);
    }
  }

  const iconContent =
    ttsState === "loading" ? "…" :
    ttsState === "playing" ? "⏸" :
    ttsState === "error"   ? "✕" :
    "▶";

  return (
    <div className={styles.miniStory}>
      <div className={styles.miniStoryHeader}>
        <p className={styles.miniStoryRu}>
          <TappableWord text={block.story_ru} />
        </p>
        <button
          className={`${styles.miniStoryPlayBtn} ${ttsState === "playing" ? styles.miniStoryPlayBtnActive : ""} ${ttsState === "error" ? styles.miniStoryPlayBtnError : ""}`}
          onClick={handlePlay}
          disabled={ttsState === "loading"}
          aria-label={ttsState === "playing" ? "Pause audio" : "Play audio"}
        >
          {iconContent}
        </button>
      </div>

      <button
        className={styles.miniStoryToggle}
        onClick={() => setShowTranslation(v => !v)}
      >
        {showTranslation ? "Hide translation" : "Show translation"}
      </button>

      {showTranslation && (
        <p className={styles.miniStoryEn}>{block.story_en}</p>
      )}

      {block.focus_note && (
        <div className={styles.focusNote}>
          <span className={styles.focusNoteIcon}>👁</span>
          {block.focus_note}
        </div>
      )}
    </div>
  );
}