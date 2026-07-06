// EAP-Runtime — deterministic context-offload store (clean-room).
//
// Implements the offload primitive from layers/eap-runtime/DESIGN.md: index an
// oversized blob into a local full-text store behind a searchable pointer, then
// return exact matching chunks (lossless) on query. No LLM, no network, no
// third-party runtime dependency — built on Node's built-in `node:sqlite`.
//
// This is original clean-room code; no Elastic-Licensed upstream source was
// used. See docs/legal/ATTRIBUTION.md.

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

// Default size threshold (bytes) above which content is offloaded rather than
// returned inline. Matches DESIGN.md (~100 KB).
export const OFFLOAD_THRESHOLD_BYTES = 100 * 1024;

// Split text into overlapping-free chunks on paragraph/line boundaries, capped
// at ~maxChars so FTS rows stay small and retrieval is granular.
export function chunk(text, maxChars = 2000) {
  const out = [];
  const paras = String(text).split(/\n{2,}/);
  let buf = '';
  const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ''; };
  for (const p of paras) {
    if (p.length >= maxChars) {
      flush();
      for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars));
      continue;
    }
    if (buf.length + p.length + 2 > maxChars) flush();
    buf += (buf ? '\n\n' : '') + p;
  }
  flush();
  return out;
}

export class RuntimeStore {
  // dbPath: ':memory:' for tests, or an absolute path under .eap/ in production.
  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
        doc_id UNINDEXED, idx UNINDEXED, body,
        tokenize = 'porter unicode61'
      );
    `);
  }

  // Deterministic id from the source label + content hash (no clock, no random),
  // so re-indexing identical content is idempotent and reproducible.
  _id(source, content) {
    return 'eap_' + createHash('sha256')
      .update(source + '\0' + content).digest('hex').slice(0, 16);
  }

  // Index content and return a pointer descriptor. `createdAt` is injected (not
  // read from the clock) so callers control determinism; defaults to 0.
  index(source, content, { createdAt = 0 } = {}) {
    const body = String(content);
    const id = this._id(source, body);
    const existing = this.db.prepare('SELECT id, chunk_count, bytes FROM docs WHERE id = ?').get(id);
    if (existing) {
      return { id, source, bytes: existing.bytes, chunks: existing.chunk_count, deduped: true };
    }
    const parts = chunk(body);
    const insDoc = this.db.prepare(
      'INSERT INTO docs (id, source, bytes, chunk_count, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    const insChunk = this.db.prepare('INSERT INTO chunks (doc_id, idx, body) VALUES (?, ?, ?)');
    insDoc.run(id, source, Buffer.byteLength(body), parts.length, createdAt);
    parts.forEach((p, i) => insChunk.run(id, i, p));
    return { id, source, bytes: Buffer.byteLength(body), chunks: parts.length, deduped: false };
  }

  // Lossless retrieval: return exact matching chunk bodies with their source
  // span (doc id + chunk index) — never a summary. `limit` caps rows.
  search(query, { limit = 5, docId = null } = {}) {
    const q = String(query).trim();
    if (!q) return [];
    // Escape the query as an FTS5 string literal so punctuation/operators in the
    // user query are treated as data, not FTS syntax.
    const escaped = '"' + q.replace(/"/g, '""') + '"';
    let sql = `SELECT doc_id, idx, body, bm25(chunks) AS score
               FROM chunks WHERE chunks MATCH ?`;
    const args = [escaped];
    if (docId) { sql += ' AND doc_id = ?'; args.push(docId); }
    sql += ' ORDER BY score LIMIT ?'; args.push(limit);
    return this.db.prepare(sql).all(...args).map(r => ({
      docId: r.doc_id, chunk: r.idx, body: r.body, score: r.score,
    }));
  }

  // Measured bytes-kept-out-of-context: the real indexed byte total. Honest by
  // construction — it is a sum of actual bytes, not a modeled percentage.
  stats() {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS docs, COALESCE(SUM(bytes),0) AS bytes, COALESCE(SUM(chunk_count),0) AS chunks FROM docs'
    ).get();
    return { docs: row.docs, bytesKeptOut: row.bytes, chunks: row.chunks };
  }

  // The offload decision: inline small content, index+pointer for large content.
  // Returns either {inline:true, body} or {inline:false, pointer, hint}.
  offload(source, content, { threshold = OFFLOAD_THRESHOLD_BYTES, createdAt = 0 } = {}) {
    const bytes = Buffer.byteLength(String(content));
    if (bytes <= threshold) return { inline: true, body: String(content), bytes };
    const p = this.index(source, content, { createdAt });
    return {
      inline: false,
      pointer: p.id,
      bytes,
      hint: `Indexed ${p.chunks} section(s) from ${source} (${bytes} bytes kept out of context). ` +
            `Query with eap_search(query, { docId: "${p.id}" }).`,
    };
  }

  close() { this.db.close(); }
}
