// src/components/Skeleton/Skeleton.jsx
import styles from "./Skeleton.module.css";

/**
 * Skeleton loading placeholder.
 *
 * Usage:
 *   <Skeleton width="100%" height={20} borderRadius={6} />
 *   <Skeleton variant="text" lines={3} />
 *   <Skeleton variant="card" />
 */
export default function Skeleton({ variant, width, height = 16, borderRadius = 6, lines = 1 }) {
  if (variant === "text") {
    return (
      <div className={styles.group}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={styles.bar}
            style={{
              width:        i === lines - 1 && lines > 1 ? "70%" : "100%",
              height:       height,
              borderRadius: borderRadius,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={styles.card}>
        <div className={styles.bar} style={{ width: "60%", height: 18, borderRadius: 6, marginBottom: 10 }} />
        <div className={styles.bar} style={{ width: "100%", height: 12, borderRadius: 4, marginBottom: 6 }} />
        <div className={styles.bar} style={{ width: "85%",  height: 12, borderRadius: 4, marginBottom: 6 }} />
        <div className={styles.bar} style={{ width: "70%",  height: 12, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div
      className={styles.bar}
      style={{
        width:        width ?? "100%",
        height:       height,
        borderRadius: borderRadius,
      }}
    />
  );
}