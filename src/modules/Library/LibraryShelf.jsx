// src/modules/Library/LibraryShelf.jsx
import { useState, useEffect, useRef } from "react";
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
  const [coverBook,   setCoverBook]   = useState(null);

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
              onCoverChange={() => setCoverBook(book)}
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
                  onCoverChange={() => setCoverBook(book)}
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

      {/* Cover image modal */}
      {coverBook && (
        <CoverModal
          book={coverBook}
          userId={user.uid}
          onClose={() => setCoverBook(null)}
          onSaved={() => { setCoverBook(null); loadBooks(); }}
        />
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
function BookTile({ book, archived, onOpen, onArchive, onUnarchive, onDelete, onStats, onCoverChange }) {
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

      <div className={styles.tileFooter}>
        <span className={styles.tileTitle}>{book.title}</span>
        {book.level && <span className={styles.tileLevelBadge}>{book.level}</span>}
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
          <button onClick={() => { setMenuOpen(false); onCoverChange(); }}>🖼 Change Cover</button>
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

// ─────────────────────────────────────────────────────
// CoverModal
// ─────────────────────────────────────────────────────
function CoverModal({ book, userId, onClose, onSaved }) {
  const fileInputRef        = useRef(null);
  const [copied,   setCopied]   = useState(false);
  const [preview,  setPreview]  = useState(book.cover_image ?? null);
  const [pending,  setPending]  = useState(null);   // resized base64 not yet saved
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const synopsis = book.synopsis
    ? book.synopsis.split(/[.!?]/)[0].trim() + "."
    : "";

  const dallePrompt =
`Create a portrait-format book cover illustration (output size: 1024×1792) for a Russian-language learner's story.

Title: "${book.title}"${synopsis ? `\nStory: ${synopsis}` : ""}

Style guidelines:
- Painterly, warm, storybook illustration
- Rich, saturated colors with a slightly vintage feel
- Centered composition with clear focal subject
- No text, lettering, or writing of any kind anywhere in the image
- Suitable for a book cover — evocative, not literal

Output size: 1024×1792 (portrait). Select this size in the DALL·E interface before generating.`;

  async function handleCopy() {
    await navigator.clipboard.writeText(dallePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 300, MAX_H = 420;
      const scale  = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const resized = canvas.toDataURL("image/jpeg", 0.85);
      setPreview(resized);
      setPending(resized);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handleSave() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      await updateBook(userId, book.id, { cover_image: pending });
      onSaved();
    } catch (err) {
      setError(err.message || "Save failed. Please try again.");
      setSaving(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setPending("");   // empty string signals "remove cover"
  }

  async function handleSaveRemove() {
    setSaving(true);
    setError(null);
    try {
      await updateBook(userId, book.id, { cover_image: null });
      onSaved();
    } catch (err) {
      setError(err.message || "Save failed. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.coverBackdrop} onClick={onClose}>
      <div className={styles.coverModal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.coverModalHeader}>
          <p className={styles.coverModalTitle}>🖼 Change Cover</p>
          <p className={styles.coverModalBook}>{book.title}</p>
          <button className={styles.coverModalClose} onClick={onClose}>✕</button>
        </div>

        {/* Step 1 — DALL·E prompt */}
        <div className={styles.coverSection}>
          <p className={styles.coverSectionLabel}>Step 1 — Generate with DALL·E</p>
          <p className={styles.coverSectionHint}>
            Copy this prompt, paste it into{" "}
            <a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a>{" "}
            or the DALL·E interface, and select <strong>1024×1792</strong> (portrait) before generating.
          </p>
          <div className={styles.promptBox}>
            <pre className={styles.promptText}>{dallePrompt}</pre>
          </div>
          <button className={styles.copyPromptBtn} onClick={handleCopy}>
            {copied ? "✓ Copied!" : "📋 Copy Prompt"}
          </button>
        </div>

        {/* Divider */}
        <div className={styles.coverDivider} />

        {/* Step 2 — Upload */}
        <div className={styles.coverSection}>
          <p className={styles.coverSectionLabel}>Step 2 — Upload the image</p>
          <p className={styles.coverSectionHint}>
            Save the generated image to your device, then upload it here.
          </p>

          {preview && pending !== "" ? (
            <div className={styles.coverPreviewWrap}>
              <img src={preview} alt="Cover preview" className={styles.coverPreviewImg} />
              <div className={styles.coverPreviewActions}>
                <button
                  className={styles.coverChangeBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  ↩ Choose different image
                </button>
                <button className={styles.coverRemoveBtn} onClick={handleRemove}>
                  🗑 Remove cover
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.uploadBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              📂 Choose Image
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          {error && <p className={styles.coverError}>{error}</p>}
        </div>

        {/* Footer */}
        <div className={styles.coverFooter}>
          <button className={styles.coverCancelBtn} onClick={onClose}>Cancel</button>
          {pending === "" ? (
            <button
              className={styles.coverSaveBtn}
              onClick={handleSaveRemove}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save (no cover)"}
            </button>
          ) : (
            <button
              className={styles.coverSaveBtn}
              onClick={handleSave}
              disabled={!pending || saving}
            >
              {saving ? "Saving…" : "✓ Save Cover"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}