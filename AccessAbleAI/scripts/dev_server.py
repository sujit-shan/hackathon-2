import os
import sys
import time
import threading
import subprocess
import webbrowser

# Add backend to sys.path
backend_dir = r"C:\Users\VIJAY NAVIN\AccessAbleAI\backend"
frontend_dir = r"C:\Users\VIJAY NAVIN\AccessAbleAI\frontend"
sys.path.insert(0, backend_dir)

import uvicorn
from app.main import app

def run_backend():
    print("[Backend] Starting FastAPI on http://127.0.0.1:8000...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

# 1. Start FastAPI in daemon thread
backend_thread = threading.Thread(target=run_backend, daemon=True)
backend_thread.start()

# 2. Open browser after brief delay
def open_browser():
    time.sleep(2.5)
    print("\n[Browser] Opening AccessAble AI at http://localhost:5173...")
    webbrowser.open("http://localhost:5173")

threading.Thread(target=open_browser, daemon=True).start()

# 3. Run Vite in foreground to keep server active
npm_cmd = r"C:\Program Files\nodejs\npm.cmd"
if not os.path.exists(npm_cmd):
    npm_cmd = "npm.cmd"

print("[Frontend] Starting Vite on http://127.0.0.1:5173...")
subprocess.run([npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], cwd=frontend_dir)
