@echo off
title Ledgerly MCA Automation Launcher
color 0A
set "PATH=C:\Program Files\nodejs;C:\Users\sumit\tools\node;%PATH%"

echo =======================================================
echo    LEDGERLY — UNIFIED MCA AUTOMATION PLATFORM
echo =======================================================
echo.
echo [1/3] Starting WhatsApp Automation Backend (Port 4000)...
start "Ledgerly Backend" cmd /k "title Ledgerly Backend (Port 4000) && set PATH=C:\Program Files\nodejs;C:\Users\sumit\tools\node;%%PATH%% && cd /d %~dp0backend && npm start"

timeout /t 2 /nobreak > nul

echo [2/3] Starting Next.js Admin Dashboard (Port 3000)...
start "Ledgerly Admin Dashboard" cmd /k "title Ledgerly Admin (Port 3000) && set PATH=C:\Program Files\nodejs;C:\Users\sumit\tools\node;%%PATH%% && cd /d %~dp0admin && npm run dev"

timeout /t 2 /nobreak > nul

echo [3/3] Starting WhatsApp Web Simulator (Port 5173)...
start "Ledgerly WhatsApp Simulator" cmd /k "title WhatsApp Simulator (Port 5173) && set PATH=C:\Program Files\nodejs;C:\Users\sumit\tools\node;%%PATH%% && cd /d %~dp0simulator && npm run dev"

echo.
echo =======================================================
echo  All services launched!
echo.
echo  - Admin Dashboard:       http://localhost:3000
echo    Login credentials:     superadmin@ledgerly.in / super123
echo                           priya@ledgerly.in / admin123
echo.
echo  - Backend API:           http://localhost:4000
echo  - WhatsApp Simulator:    http://localhost:5173
echo  - Chrome Extension:      chrome://extensions (Load unpacked -> %~dp0extension)
echo =======================================================
echo.
pause
