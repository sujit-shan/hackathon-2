@echo off
echo =======================================================
echo     AccessAble AI - Pretrained ISL Flask Service
echo =======================================================
echo.

set ISL_DIR="C:\Users\VIJAY NAVIN\Indian-Sign-Language-recognition-by-WORD"
set PYTHON_PATH="C:\Users\VIJAY NAVIN\Indian-Sign-Language-recognition-by-WORD\.venv\Scripts\python.exe"

if not exist %PYTHON_PATH% (
    echo [ERROR] Python environment not found at: %PYTHON_PATH%
    pause
    exit /b 1
)

echo Starting ISL Recognition Flask Service on port 5000...
start "AccessAble AI - ISL Flask Model (:5000)" cmd /k "cd /d %ISL_DIR% && %PYTHON_PATH% app.py"

echo.
echo ISL Service launching at: http://127.0.0.1:5000
echo Endpoint status:          http://127.0.0.1:5000/api/status
echo.
