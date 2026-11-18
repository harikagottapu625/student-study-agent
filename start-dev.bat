@echo off
rem Starts the backend and frontend in two separate windows. Keep both windows open while using the app.
cd /d "%~dp0"
start "Student Study Agent - Backend" cmd /k "cd backend && npm run dev"
start "Student Study Agent - Frontend" cmd /k "cd frontend && npm run dev"
echo Backend: http://localhost:4000   Frontend: http://127.0.0.1:5173
