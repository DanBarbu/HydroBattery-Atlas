// Package cache wraps the edge SQLite store. Sprint 5.
//
// Schema: tracks (id, source, payload, observed_at, classification),
// outbox (id, kind, payload, created_at, sent_at NULL).
// Both tables are append-only; the outbox is drained by the sync loop.
package cache

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS tracks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source         TEXT NOT NULL,
    payload        TEXT NOT NULL,
    observed_at    TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'NESECRET',
    pushed         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tracks_pushed_idx ON tracks(pushed, id);

CREATE TABLE IF NOT EXISTS outbox (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    kind          TEXT NOT NULL,
    payload       TEXT NOT NULL,
    observed_at   TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at       TEXT
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(sent_at, id);
`

type DB struct {
	db *sql.DB
}

func Open(path string) (*DB, error) {
	if path == "" {
		return nil, errors.New("cache: empty path")
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}
	db.SetMaxOpenConns(1) // SQLite single-writer; deliberate.
	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("schema: %w", err)
	}
	return &DB{db: db}, nil
}

func (d *DB) Close() error { return d.db.Close() }

type Track struct {
	ID             int64
	Source         string
	Payload        string
	ObservedAt     time.Time
	Classification string
	Pushed         bool
}

func (d *DB) AppendTrack(ctx context.Context, t Track) (int64, error) {
	res, err := d.db.ExecContext(ctx,
		`INSERT INTO tracks(source, payload, observed_at, classification) VALUES (?, ?, ?, ?)`,
		t.Source, t.Payload, t.ObservedAt.UTC().Format(time.RFC3339Nano), t.Classification)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *DB) UnpushedTracks(ctx context.Context, limit int) ([]Track, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT id, source, payload, observed_at, classification FROM tracks WHERE pushed = 0 ORDER BY id LIMIT ?`,
		limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Track
	for rows.Next() {
		var t Track
		var obs string
		if err := rows.Scan(&t.ID, &t.Source, &t.Payload, &obs, &t.Classification); err != nil {
			return nil, err
		}
		t.ObservedAt, _ = time.Parse(time.RFC3339Nano, obs)
		out = append(out, t)
	}
	return out, rows.Err()
}

func (d *DB) MarkTracksPushed(ctx context.Context, lastID int64) error {
	_, err := d.db.ExecContext(ctx, `UPDATE tracks SET pushed = 1 WHERE id <= ?`, lastID)
	return err
}

type OutboxEntry struct {
	ID         int64
	Kind       string
	Payload    string
	ObservedAt time.Time
	CreatedAt  time.Time
	SentAt     *time.Time
}

func (d *DB) Enqueue(ctx context.Context, e OutboxEntry) (int64, error) {
	res, err := d.db.ExecContext(ctx,
		`INSERT INTO outbox(kind, payload, observed_at) VALUES (?, ?, ?)`,
		e.Kind, e.Payload, e.ObservedAt.UTC().Format(time.RFC3339Nano))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *DB) Pending(ctx context.Context, limit int) ([]OutboxEntry, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT id, kind, payload, observed_at, created_at FROM outbox WHERE sent_at IS NULL ORDER BY id LIMIT ?`,
		limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OutboxEntry
	for rows.Next() {
		var e OutboxEntry
		var obs, created string
		if err := rows.Scan(&e.ID, &e.Kind, &e.Payload, &obs, &created); err != nil {
			return nil, err
		}
		e.ObservedAt, _ = time.Parse(time.RFC3339Nano, obs)
		e.CreatedAt, _ = time.Parse(time.RFC3339, created)
		out = append(out, e)
	}
	return out, rows.Err()
}

func (d *DB) MarkSent(ctx context.Context, id int64, when time.Time) error {
	_, err := d.db.ExecContext(ctx,
		`UPDATE outbox SET sent_at = ? WHERE id = ? AND sent_at IS NULL`,
		when.UTC().Format(time.RFC3339Nano), id)
	return err
}

func (d *DB) PendingCount(ctx context.Context) (int, error) {
	var n int
	err := d.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM outbox WHERE sent_at IS NULL`).Scan(&n)
	return n, err
}

func (d *DB) UnpushedCount(ctx context.Context) (int, error) {
	var n int
	err := d.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tracks WHERE pushed = 0`).Scan(&n)
	return n, err
}
