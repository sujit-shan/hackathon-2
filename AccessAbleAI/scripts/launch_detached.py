import os
import sys
import time
import subprocess
import urllib.request
import webbrowser

CREATE_NEW_PROCESS_GROUP = 0x00000200
DETACHED_PROCESS = 0x00000008

py_exe = r"C:\Users\VIJAY NAVIN\Indian-Sign-Language-recognition-by-WORD\.venv\Scripts\python.exe"
base_dir = r"C:\Users\VIJAY NAVIN\AccessAbleAI"
backend_dir = os.path.join(base_dir, "backend")
frontend_dir = os.path.join(base_dir, "frontend")
isl_dir = r"C:\Users\VIJAY NAVIN\Indian-Sign-Language-recognition-by-WORD"

print("1. Launching FastAPI Backend on 127.0.0.1:8000...")
backend_proc = subprocess.Popen(
    [py_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=backend_dir,
    creationflags=CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

print("2. Launching Vite Frontend on 127.0.0.1:5173...")
npm_cmd = r"C:\Program Files\nodejs\npm.cmd"
if not os.path.exists(npm_cmd):
    npm_cmd = "npm.cmd"

frontend_proc = subprocess.Popen(
    [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
    cwd=frontend_dir,
    creationflags=CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

print("3. Launching Pretrained ISL Flask Service on 127.0.0.1:5000...")
isl_proc = subprocess.Popen(
    [py_exe, "app.py"],
    cwd=isl_dir,
    creationflags=CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

print("Waiting for services to initialize...")
time.sleep(5)

# Verify Backend
try:
    with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=4) as res:
        print("Backend Status:", res.status, res.read().decode("utf-8")[:60])
except Exception as e:
    print("Backend check:", e)

# Verify Frontend
try:
    with urllib.request.urlopen("http://127.0.0.1:5173", timeout=4) as res:
        print("Frontend Status:", res.status)
except Exception as e:
    print("Frontend check:", e)

# Verify ISL Model
try:
    with urllib.request.urlopen("http://127.0.0.1:5000/api/status", timeout=4) as res:
        print("ISL Model Status:", res.status, res.read().decode("utf-8")[:60])
except Exception as e:
    print("ISL Model check:", e)

print("\nOpening AccessAble AI in your default web browser...")
webbrowser.open("http://localhost:5173")
print("SUCCESS: Browser launched at http://localhost:5173")
