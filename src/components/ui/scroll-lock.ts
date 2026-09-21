/**
 * One counted lock on the page's scroll, shared by every dialog.
 *
 * Each dialog used to save `body.style.overflow`, set it to "hidden" and put
 * the saved value back on unmount. That is only right for one dialog at a
 * time. The details dialog opens inside the order modal, so it saved
 * "hidden"; when both unmounted in the same commit React cleaned the parent
 * first (restoring "") and the child second (restoring "hidden"), and the
 * page could not scroll again until a reload.
 *
 * Here the first lock stores what the body had and hides the overflow, the
 * locks in between only count, and the last release, in whatever order they
 * come, restores the stored value.
 *
 *   useEffect(() => lockBodyScroll(), []);
 *
 * The release is safe to call twice (StrictMode, or a cleanup that races an
 * explicit close): only its first call counts.
 */

type DocumentLike = { body: { style: { overflow: string } } };

type Lock = { count: number; previous: string };

/** Per document, so a test can bring its own. In a browser there is one. */
const locks = new WeakMap<DocumentLike, Lock>();

export function lockBodyScroll(doc: DocumentLike = document): () => void {
  let lock = locks.get(doc);
  if (!lock || lock.count === 0) {
    lock = { count: 0, previous: doc.body.style.overflow };
    locks.set(doc, lock);
    doc.body.style.overflow = "hidden";
  }
  lock.count += 1;

  const held = lock;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held.count -= 1;
    if (held.count === 0) doc.body.style.overflow = held.previous;
  };
}
