@echo off
rem Avvia il server e apre il browser solo quando il server risponde: prima
rem il browser arrivava per primo e trovava la pagina vuota.
cd /d "%~dp0"
start "Borgo 1997 - server" /min python -m http.server 8123 --bind 127.0.0.1
powershell -NoProfile -Command "for ($i = 0; $i -lt 40; $i++) { $c = New-Object Net.Sockets.TcpClient; try { if ($c.ConnectAsync('127.0.0.1', 8123).Wait(250)) { exit 0 } } catch {} finally { $c.Close() }; Start-Sleep -Milliseconds 250 }; exit 1"
if errorlevel 1 (
  echo Il server non risponde sulla porta 8123. Python e' installato?
  pause
  exit /b 1
)
start "" http://127.0.0.1:8123/
