# QWERTY Command

A typing defense game where missiles rain down on your city and you destroy them by typing the words they carry. Built with vanilla JavaScript, HTML Canvas, and a Python backend for score persistence.

## Features

- **Three difficulty modes**: Beginner (home row drills), Normal (progressive word lists), Expert (high-speed endurance)
- **10 waves per difficulty** with escalating speed and complexity
- **UFO challenges**: Arithmetic equations, phrases, mixed case, symbols, and reverse words
- **Accuracy multipliers**: Up to 10x score bonus for perfect accuracy
- **Persistent high scores** via SQLite
- **Configurable**: All game parameters (speeds, spawning, waves, word lists) driven by `config.json`

## Requirements

- Python 3
- A modern web browser

No additional dependencies are needed. The server uses only Python standard library modules.

## Running

```bash
python3 server.py
```

Then open http://localhost:8000 in your browser.

To use a different port:

```bash
python3 server.py 3000
```

## Game Controls

- **Type** to target and destroy missiles
- **Backspace** to correct mistakes (when "Require Backspace" is on)
- **Enter** to clear current input
- **Escape** to pause/resume
