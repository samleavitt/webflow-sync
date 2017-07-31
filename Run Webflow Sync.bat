@echo off
title Webflow Sync Program
echo All ready to begin syncing your Webflow CMS content.
echo For usage instructions and tips, see the README file.
echo If you wish to terminate the program at any time, press [ctrl] + [c], followed by [y] and [enter].
echo.
pause
node sync.js
echo.
echo The program has terminated.  Press any key to exit
pause >nul