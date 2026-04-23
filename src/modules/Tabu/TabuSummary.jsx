// src/modules/Tabu/TabuSummary.jsx
import styles from "./Tabu.module.css";

export default function TabuSummary({
  config,
  roundResult,
  scores,
  currentTeam,
  isGameOver,
  onNextTeam,
  onEndGame,
  onPlayAgain,
  onBack,
}) {
  const { teamNames, teamCount } = config;
  const nextTeamIndex = (currentTeam + 1) % teamCount;

  // ── Game over screen ─────────────────────────────────────────────────
  if (isGameOver) {
    const maxScore  = Math.max(...scores);
    const winnerIdx = scores.indexOf(maxScore);
    const isTie     = scores.filter(s => s === maxScore).length > 1;

    return (
      <div className={styles.page}>
        <div className={styles.gameOver}>
          <div className={styles.pageTitle}>Игра окончена!</div>
          <p className={styles.gameOverSub}>Итоговые результаты</p>

          {isTie ? (
            <div className={styles.winnerBadge}>Ничья!</div>
          ) : (
            <div className={styles.winnerBadge}>
              🏆 {teamNames[winnerIdx]}
            </div>
          )}

          <div className={styles.finalScoreBoard}>
            <div className={styles.cumulativeBoardLabel}>Финальный счёт</div>
            {teamNames.map((name, i) => (
              <div
                key={i}
                className={`${styles.cumulativeRow} ${i === winnerIdx && !isTie ? styles.cumulativeRowActive : ""}`}
              >
                <span>{name}</span>
                <span className={styles.cumulativeScore}>{scores[i] ?? 0} очков</span>
              </div>
            ))}
          </div>

          <button className={styles.playAgainBtn} onClick={onPlayAgain}>
            Играть снова
          </button>
          <button className={styles.backBtn} onClick={onBack}>
            ← На главную
          </button>
        </div>
      </div>
    );
  }

  // ── Round summary screen ─────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.summaryCard}>
        <div className={styles.summaryRoundLabel}>Конец раунда</div>
        <div className={styles.summaryTeamName}>{teamNames[currentTeam]}</div>

        <div className={styles.summaryStats}>
          <div className={styles.statBox}>
            <div className={`${styles.statNum} ${styles.statNumGreen}`}>
              {roundResult?.correct ?? 0}
            </div>
            <div className={styles.statLbl}>Угадали</div>
          </div>
          <div className={styles.statBox}>
            <div className={`${styles.statNum} ${styles.statNumRed}`}>
              {roundResult?.incorrect ?? 0}
            </div>
            <div className={styles.statLbl}>Не угадали / пропущено</div>
          </div>
        </div>

        {/* Cumulative scoreboard */}
        <div className={styles.cumulativeBoard}>
          <div className={styles.cumulativeBoardLabel}>Общий счёт</div>
          {teamNames.map((name, i) => (
            <div
              key={i}
              className={`${styles.cumulativeRow} ${i === currentTeam ? styles.cumulativeRowActive : ""}`}
            >
              <span>{name}</span>
              <span className={styles.cumulativeScore}>{scores[i] ?? 0} очков</span>
            </div>
          ))}
        </div>

        <button className={styles.nextTeamBtn} onClick={onNextTeam}>
          {teamNames[nextTeamIndex]} готова →
        </button>

        <button className={styles.endGameBtn} onClick={onEndGame}>
          Завершить игру
        </button>
      </div>
    </div>
  );
}