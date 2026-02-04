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
