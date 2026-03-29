import styles from "./ReferenceSheet.module.css";
export default function ReferenceSheet({ onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p style={{ padding: 24, color: "#9a8e78" }}>Reference sheet — coming in Phase B+</p>
        <button onClick={onClose} style={{ margin: "0 24px 24px", background: "none", border: "none", color: "#9a8e78", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}