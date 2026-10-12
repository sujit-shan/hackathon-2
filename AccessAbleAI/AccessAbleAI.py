import os
import sys
import time
import subprocess
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

print("=" * 65)
print("       AccessAble AI — Unified Platform Launcher")
print("=" * 65)

python_executable = sys.executable
print(f"[Launcher] Using Python: {python_executable}")

# 1. Start FastAPI Backend as subprocess
print("[Backend] Starting FastAPI on http://127.0.0.1:8000...")
backend_proc = subprocess.Popen(
    [python_executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=BACKEND_DIR
)

# 2. Wait for backend to be ready
time.sleep(2)

# 3. Locate npm
npm_cmd = r"C:\Program Files\nodejs\npm.cmd"
if not os.path.exists(npm_cmd):
    npm_cmd = "npm.cmd"

# 4. Open web browser
def open_browser():
    time.sleep(2)
    print("\n[Browser] Opening AccessAble AI at http://localhost:5173...\n")
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

import threading
threading.Thread(target=open_browser, daemon=True).start()

# 5. Start Frontend dev server
print("[Frontend] Starting Vite dev server on http://127.0.0.1:5173...")
print("\nPress Ctrl+C to stop all services.\n")

try:
    frontend_proc = subprocess.run(
        [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
        cwd=FRONTEND_DIR
    )
except KeyboardInterrupt:
    print("\n[Launcher] Shutting down services...")
finally:
    backend_proc.terminate()
    print("[Launcher] AccessAble AI stopped cleanly.")
