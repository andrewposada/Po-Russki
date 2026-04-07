// src/modules/Lessons/blocks/RuleTableBlock.jsx
import styles from "./Blocks.module.css";

export default function RuleTableBlock({ block }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 20 }}>
      <table className={styles.ruleTable}>
        {block.caption && <caption>{block.caption}</caption>}
        <thead>
          <tr>
            {block.headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}