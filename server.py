#!/usr/bin/env python3
"""
QWERTY Command - Game Server

A simple HTTP server that serves static files and provides an API for
persistent storage (high scores, leaderboards, etc.)

Usage:
    python3 server.py [port]

Default port is 8000.

The storage backend is abstracted so SQLite can be swapped for PostgreSQL,
MySQL, or any other database later.
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import sqlite3
from datetime import datetime
from abc import ABC, abstractmethod
import statistics


# =============================================================================
# Storage Backend Abstraction
# =============================================================================

class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    def init(self):
        """Initialize the storage (create tables, etc.)"""
        pass

    @abstractmethod
    def get_high_scores(self, limit=10):
        """Get top high scores."""
        pass

    @abstractmethod
    def save_score(self, score, wave, accuracy, difficulty, player_name=None):
        """Save a score. Returns the score ID."""
        pass

    @abstractmethod
    def get_player_best(self, player_name):
        """Get a player's best score."""
        pass


class SQLiteBackend(StorageBackend):
    """SQLite storage backend."""

    def __init__(self, db_path='game_data.db'):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init(self):
        conn = self._get_connection()
        cursor = conn.cursor()

        # Scores table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT DEFAULT 'Anonymous',
                score INTEGER NOT NULL,
                wave INTEGER NOT NULL,
                accuracy REAL,
                difficulty TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Players table (for future use)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Index for leaderboard queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_scores_score
            ON scores(score DESC)
        ''')

        # Per-difficulty stats tables for accuracy tracking
        for difficulty in ['beginner', 'normal', 'expert']:
            cursor.execute(f'''
                CREATE TABLE IF NOT EXISTS stats_{difficulty} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    accuracy REAL NOT NULL,
                    score INTEGER NOT NULL,
                    wave INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

        conn.commit()
        conn.close()
        print(f"SQLite database initialized: {self.db_path}")

    def get_high_scores(self, limit=10, difficulty=None):
        conn = self._get_connection()
        cursor = conn.cursor()

        if difficulty:
            cursor.execute('''
                SELECT id, player_name, score, wave, accuracy, difficulty, created_at
                FROM scores
                WHERE difficulty = ?
                ORDER BY score DESC
                LIMIT ?
            ''', (difficulty, limit))
        else:
            cursor.execute('''
                SELECT id, player_name, score, wave, accuracy, difficulty, created_at
                FROM scores
                ORDER BY score DESC
                LIMIT ?
            ''', (limit,))

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def save_score(self, score, wave, accuracy=None, difficulty=None, player_name=None):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO scores (player_name, score, wave, accuracy, difficulty)
            VALUES (?, ?, ?, ?, ?)
        ''', (player_name or 'Anonymous', score, wave, accuracy, difficulty))

        score_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return score_id

    def get_player_best(self, player_name):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, player_name, score, wave, accuracy, difficulty, created_at
            FROM scores
            WHERE player_name = ?
            ORDER BY score DESC
            LIMIT 1
        ''', (player_name,))

        row = cursor.fetchone()
        conn.close()

        return dict(row) if row else None

    def get_global_best(self):
        """Get the single highest score ever."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, player_name, score, wave, accuracy, difficulty, created_at
            FROM scores
            ORDER BY score DESC
            LIMIT 1
        ''')

        row = cursor.fetchone()
        conn.close()

        return dict(row) if row else None

    def save_stats(self, accuracy, score, wave, difficulty):
        """Save game stats and prune to most recent 200 games."""
        if difficulty not in ['beginner', 'normal', 'expert']:
            return

        conn = self._get_connection()
        cursor = conn.cursor()
        table = f'stats_{difficulty}'

        # Insert new record
        cursor.execute(f'''
            INSERT INTO {table} (accuracy, score, wave)
            VALUES (?, ?, ?)
        ''', (accuracy, score, wave))

        # Prune to most recent 200 games
        cursor.execute(f'''
            DELETE FROM {table}
            WHERE id NOT IN (
                SELECT id FROM {table}
                ORDER BY created_at DESC
                LIMIT 200
            )
        ''')

        conn.commit()
        conn.close()

    def get_stats(self, difficulty):
        """Get all stats for a difficulty level."""
        if difficulty not in ['beginner', 'normal', 'expert']:
            return []

        conn = self._get_connection()
        cursor = conn.cursor()
        table = f'stats_{difficulty}'

        cursor.execute(f'''
            SELECT accuracy, score, wave, created_at
            FROM {table}
            ORDER BY created_at DESC
        ''')

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def compute_stats(self, difficulty):
        """Compute accuracy statistics and return as a dict."""
        stats = self.get_stats(difficulty)
        if not stats:
            return None

        accuracies = [s['accuracy'] for s in stats if s['accuracy'] is not None]
        scores = [s['score'] for s in stats]
        waves = [s['wave'] for s in stats]
        if not accuracies:
            return None

        n = len(accuracies)
        sorted_acc = sorted(accuracies)

        avg = statistics.mean(accuracies)
        median = statistics.median(accuracies)
        stdev = statistics.stdev(accuracies) if n > 1 else 0
        min_acc = min(accuracies)
        max_acc = max(accuracies)

        def percentile(data, p):
            k = (len(data) - 1) * (p / 100)
            f = int(k)
            c = f + 1 if f + 1 < len(data) else f
            return data[f] + (data[c] - data[f]) * (k - f)

        result = {
            'difficulty': difficulty,
            'games': n,
            'accuracy': {
                'avg': round(avg, 1),
                'median': round(median, 1),
                'stdev': round(stdev, 1),
                'min': round(min_acc, 1),
                'max': round(max_acc, 1),
            },
            'percentiles': {
                'p10': round(percentile(sorted_acc, 10), 1),
                'p25': round(percentile(sorted_acc, 25), 1),
                'p75': round(percentile(sorted_acc, 75), 1),
                'p90': round(percentile(sorted_acc, 90), 1),
                'p95': round(percentile(sorted_acc, 95), 1),
            },
            'distribution': {
                '97-100': len([a for a in accuracies if a >= 97]),
                '95-97': len([a for a in accuracies if 95 <= a < 97]),
                '90-95': len([a for a in accuracies if 90 <= a < 95]),
                '80-90': len([a for a in accuracies if 80 <= a < 90]),
                'below_80': len([a for a in accuracies if a < 80]),
            },
            'score': {
                'avg': round(statistics.mean(scores)),
                'max': max(scores),
            },
            'wave': {
                'avg': round(statistics.mean(waves), 1),
                'max': max(waves),
            },
        }

        if n >= 20:
            recent_10 = statistics.mean(accuracies[:10])
            prev_10 = statistics.mean(accuracies[10:20])
            result['trend'] = round(recent_10 - prev_10, 1)

        return result

    def print_accuracy_stats(self, difficulty):
        """Compute and print accuracy statistics to stdout."""
        result = self.compute_stats(difficulty)
        if not result:
            print(f"\n[STATS] {difficulty.upper()}: No games recorded yet")
            return

        a = result['accuracy']
        p = result['percentiles']
        d = result['distribution']
        n = result['games']

        print(f"\n{'='*60}")
        print(f"[STATS] {difficulty.upper()} - Accuracy Report ({n} games)")
        print(f"{'='*60}")
        print(f"  Average: {a['avg']:.1f}%  |  Median: {a['median']:.1f}%  |  StdDev: {a['stdev']:.1f}%")
        print(f"  Min: {a['min']:.1f}%  |  Max: {a['max']:.1f}%")
        print(f"  Percentiles: P10={p['p10']:.1f}% P25={p['p25']:.1f}% P75={p['p75']:.1f}% P90={p['p90']:.1f}% P95={p['p95']:.1f}%")
        print(f"  Distribution: {d}")
        if 'trend' in result:
            print(f"  Trend (last 10 vs prev 10): {result['trend']:+.1f}%")
        print(f"{'='*60}\n")


# =============================================================================
# HTTP Request Handler
# =============================================================================

class GameServerHandler(SimpleHTTPRequestHandler):
    """HTTP handler that serves static files and API endpoints."""

    storage = None  # Set by server setup

    def __init__(self, *args, **kwargs):
        # Set directory to serve static files from
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)) or '.', **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith('/api/'):
            self.handle_api_get(parsed)
        else:
            # Serve static files
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith('/api/'):
            self.handle_api_post(parsed)
        else:
            self.send_error(405, 'Method Not Allowed')

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def handle_api_get(self, parsed):
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/api/scores':
            # Get high scores
            limit = int(query.get('limit', [10])[0])
            difficulty = query.get('difficulty', [None])[0]
            scores = self.storage.get_high_scores(limit=limit, difficulty=difficulty)
            self.send_json({'scores': scores})

        elif path == '/api/scores/best':
            # Get global best score
            best = self.storage.get_global_best()
            self.send_json({'best': best})

        elif path.startswith('/api/scores/player/'):
            # Get player's best score
            player_name = path.split('/')[-1]
            best = self.storage.get_player_best(player_name)
            self.send_json({'best': best})

        elif path == '/api/stats':
            # Get computed stats for a difficulty
            difficulty = query.get('difficulty', [None])[0]
            if not difficulty or difficulty not in ['beginner', 'normal', 'expert']:
                self.send_json({'error': 'Missing or invalid difficulty parameter'}, 400)
                return
            result = self.storage.compute_stats(difficulty)
            self.send_json({'stats': result})

        else:
            self.send_json({'error': 'Not found'}, 404)

    def handle_api_post(self, parsed):
        path = parsed.path

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.send_json({'error': 'Invalid JSON'}, 400)
            return

        if path == '/api/scores':
            # Save a new score
            required = ['score', 'wave']
            if not all(k in data for k in required):
                self.send_json({'error': 'Missing required fields: score, wave'}, 400)
                return

            score_id = self.storage.save_score(
                score=data['score'],
                wave=data['wave'],
                accuracy=data.get('accuracy'),
                difficulty=data.get('difficulty'),
                player_name=data.get('player_name')
            )

            # Save stats for accuracy tracking and print report
            difficulty = data.get('difficulty')
            accuracy = data.get('accuracy')
            if difficulty and accuracy is not None:
                self.storage.save_stats(
                    accuracy=accuracy,
                    score=data['score'],
                    wave=data['wave'],
                    difficulty=difficulty
                )
                self.storage.print_accuracy_stats(difficulty)

            # Return the new score and current best
            best = self.storage.get_global_best()
            self.send_json({
                'id': score_id,
                'saved': True,
                'best': best
            })

        else:
            self.send_json({'error': 'Not found'}, 404)

    def log_message(self, format, *args):
        # Custom log format
        if '/api/' in args[0]:
            print(f"[API] {args[0]} - {args[1]}")
        # Suppress static file logs for cleaner output


# =============================================================================
# Server Setup
# =============================================================================

def run_server(port=8000):
    # Initialize storage backend
    storage = SQLiteBackend()
    storage.init()

    # Set storage on handler class
    GameServerHandler.storage = storage

    # Create and run server
    server = HTTPServer(('', port), GameServerHandler)
    print(f"\n🎮 QWERTY Command Server")
    print(f"   http://localhost:{port}")
    print(f"   Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
