@echo off
echo STARTING...

:: Run server
start "" /min python -m http.server 8001

:: Open browser
start chrome "http://localhost:8001"

:: Gone
exit