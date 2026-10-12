@echo off
echo =======================================================
echo          AccessAble AI - Development Launcher
echo =======================================================
echo.

set PYTHON_PATH="C:\Users\VIJAY NAVIN\Indian-Sign-Language-recognition-by-WORD\.venv\Scripts\python.exe"

if not exist %PYTHON_PATH% (
    set PYTHON_PATH=python
)

echo [1/3] Starting FastAPI Backend on port 8000...
start "AccessAble AI - FastAPI Backend (:8000)" cmd /k "cd /d %~dp0backend && %PYTHON_PATH% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting React / Vite Frontend on port 5173...
start "AccessAble AI - Vite Frontend (:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =======================================================
echo   Services Launched!
echo.
echo   - Frontend:    http://localhost:5173
echo   - Backend API: http://127.0.0.1:8000
echo   - API Docs:    http://127.0.0.1:8000/docs
echo.
echo   To launch the pretrained ISL Flask service (:5000):
echo   Run: start-isl.bat
echo.
echo   To stop a service, switch to its terminal and press
echo   Ctrl+C or close its window.
echo =======================================================
echo.
