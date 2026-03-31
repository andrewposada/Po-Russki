// src/modules/Library/LibraryShelf.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getBooks, updateBook, deleteBook } from "../../storage";
import { libCoverColor } from "../../constants";
import styles from "./LibraryShelf.module.css";
import PromptBuilder from "./PromptBuilder";
import StatsOverlay from "./StatsOverlay";

export default function LibraryShelf() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [books,       setBooks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showImport,  setShowImport]  = useState(false);
  const [error,       setError]       = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [statsBook,   setStatsBook]   = useState(null);
  const [confirmBook, setConfirmBook] = useState(null);
  const [confirmType, setConfirmType] = useState(null);

  const activeBooks   = books.filter(b => !b.is_archived);
  const archivedBooks = books.filter(b =>  b.is_archived);

  useEffect(() => {
    if (!user) return;
    loadBooks();
  }, [user]);

  async function loadBooks() {
    try {
      setLoading(true);
      const data = await getBooks(user.uid);
      setBooks(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(book) {
    try {
      await updateBook(user.uid, book.id, { is_archived: true });
      loadBooks();
    } catch (err) { console.error(err); }
  }

  async function handleUnarchive(book) {
    try {
      await updateBook(user.uid, book.id, {
        is_archived:      false,
        bookmark_chapter: null,
        bookmark_segment: null,
      });
      loadBooks();
    } catch (err) { console.error(err); }
  }

  async function handleDelete(book) {
    try {
      await deleteBook(user.uid, book.id);
      loadBooks();
    } catch (err) { console.error(err); }
  }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.dots}><span /><span /><span /></div>
      <p>Загрузка…</p>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Библиотека</h1>
          <p className={styles.subtitle}>Story Library</p>
        </div>
        <button className={styles.importBtn} onClick={() => setShowImport(true)}>
          + Import Book
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Active books grid */}
      {activeBooks.length === 0 ? (
        <EmptyState onImport={() => setShowImport(true)} />
      ) : (
        <div className={styles.grid}>
          {activeBooks.map(book => (
            <BookTile
              key={book.id}
              book={book}
              onOpen={() => navigate(`/library/${book.id}`)}
              onArchive={() => { setConfirmBook(book); setConfirmType("archive"); }}
              onDelete={() => { setConfirmBook(book); setConfirmType("delete"); }}
              onStats={() => setStatsBook(book)}
            />
          ))}
        </div>
      )}

      {/* Archive section */}
      {archivedBooks.length > 0 && (
        <div className={styles.archiveSection}>
          <button className={styles.archiveToggle} onClick={() => setShowArchive(s => !s)}>
            {showArchive ? "▾" : "▸"} Archived ({archivedBooks.length})
          </button>
          {showArchive && (
            <div className={styles.grid}>
              {archivedBooks.map(book => (
                <BookTile
                  key={book.id}
                  book={book}
                  archived
                  onOpen={() => navigate(`/library/${book.id}`)}
                  onUnarchive={() => handleUnarchive(book)}
                  onDelete={() => { setConfirmBook(book); setConfirmType("delete"); }}
                  onStats={() => setStatsBook(book)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <PromptBuilder
          onClose={() => setShowImport(false)}
          onImportComplete={() => { setShowImport(false); loadBooks(); }}
        />
      )}

      {/* Stats overlay */}
      {statsBook && (
        <StatsOverlay book={statsBook} onClose={() => setStatsBook(null)} />
      )}

      {/* Confirm dialog */}
      {confirmBook && (
        <ConfirmDialog
          title={confirmType === "delete"
            ? `Delete "${confirmBook.title}"?`
            : `Archive "${confirmBook.title}"?`}
          message={confirmType === "delete"
            ? "This permanently removes the book, all chapters, comprehension answers, and reading time. This cannot be undone."
            : "The book will move to your archive. All your progress is preserved."}
          onConfirm={() => {
            if (confirmType === "delete")  handleDelete(confirmBook);
            if (confirmType === "archive") handleArchive(confirmBook);
            setConfirmBook(null);
            setConfirmType(null);
          }}
          onCancel={() => { setConfirmBook(null); setConfirmType(null); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// BookTile
// ─────────────────────────────────────────────────────
function BookTile({ book, archived, onOpen, onArchive, onUnarchive, onDelete, onStats }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const coverColor = book.cover_color || libCoverColor(book.title);
  const progress   = book.total_chapters > 0
    ? (book.chapters_read ?? 0) / book.total_chapters
    : 0;

  return (
    <div
      className={`${styles.tile} ${archived ? styles.tileArchived : ""}`}
      onClick={onOpen}
      title={book.title}
    >
      {book.cover_image ? (
        <img src={book.cover_image} alt={book.title} className={styles.coverImg} />
      ) : (
        <div className={styles.coverColor} style={{ background: coverColor }}>
          <span className={styles.coverTitle}>{book.title}</span>
          {book.level && <span className={styles.levelBadge}>{book.level}</span>}
        </div>
      )}

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress * 100}%`, background: coverColor }}
        />
      </div>

      <button
        className={styles.tileMenu}
        onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
        title="Book options"
      >···</button>

      {menuOpen && (
        <div className={styles.tileDropdown} onClick={e => e.stopPropagation()}>
          {!archived && (
            <button onClick={() => { setMenuOpen(false); onArchive(); }}>📦 Archive</button>
          )}
          {archived && (
            <button onClick={() => { setMenuOpen(false); onUnarchive(); }}>↩ Re-read</button>
          )}
          <button onClick={() => { setMenuOpen(false); onStats(); }}>📊 Stats</button>
          <button
            className={styles.deleteBtn}
            onClick={() => { setMenuOpen(false); onDelete(); }}
          >🗑 Delete</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────
function EmptyState({ onImport }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyWatermark}>Библиотека</div>
      <p className={styles.emptyTitle}>Your story library is empty.</p>
      <p className={styles.emptySub}>Import your first book to start reading.</p>
      <button className={styles.importBtn} onClick={onImport}>+ Import Book</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className={styles.confirmBackdrop} onClick={onCancel}>
      <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
        <p className={styles.confirmTitle}>{title}</p>
        <p className={styles.confirmMsg}>{message}</p>
        <div className={styles.confirmBtns}>
          <button className={styles.confirmCancel} onClick={onCancel}>Cancel</button>
          <button className={styles.confirmDelete} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}