@echo off
setlocal
set PY=python
where python >nul 2>&1 || set PY=python3
where python3 >nul 2>&1 || set PY=py

if "%PY%"=="" (
    start chrome "file:///%CD%\index.html"
    exit
)

:: Clear port 8008
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8008') do taskkill /f /pid %%a >nul 2>&1

:: Start and Open
start /b %PY% -m http.server 8008
timeout /t 1 /nobreak >nul
start chrome "http://localhost:8008"
exit
