// Pre-bundled base64/SVG icons for 0ms instant display without network lag or flash of fallback
export const BUNDLED_ICONS: Record<string, string> = {
  "google": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTIzLjc0NSAxMi4yN2MwLS43LS4wNi0xLjQtLjE5LTIuMDdIMTJ2NC41MWg2LjZjLS4yOSAxLjUyLTEuMTQgMi44LTIuNCAzLjY1djMuMDNoMy44OGMyLjI3LTIuMDkgMy42NjUtNS4xNyAzLjY2NS05LjEyeiIvPjxwYXRoIGZpbGw9IiMzNEE4NTMiIGQ9Ik0xMiAyNGMzLjI0IDAgNS45NS0xLjA4IDcuOTMtMi45MWwtMy44OC0zLjAzYy0xLjA4LjcyLTIuNDUgMS4xNi00LjA1IDEuMTYtMy4xMiAwLTUuNzctMi4xLTYuNzItNC45M0gxLjI1djMuMTNDMy4yNiAyMS4zNiA3LjMzIDI0IDEyIDI0eiIvPjxwYXRoIGZpbGw9IiNGQkJDMDUiIGQ9Ik01LjI4IDE0LjI5Yy0uMjUtLjcyLS4zOC0xLjQ5LS4zOC0yLjI5cy4xNC0xLjU3LjM4LTIuMjlWNi41OEgxLjI1Qy40NSA4LjE3IDAgOS45OSAwIDEycy40NSAzLjgzIDEuMjUgNS40Mmw0LjAzLTMuMTN6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTEyIDQuNzVjMS43NyAwIDMuMzUuNjEgNC42IDEuOGwzLjQyLTMuNDJDMTcuOTUgMS4xOSAxNS4yNCAwIDEyIDAgNy4zMyAwIDMuMjYgMi42NCAxLjI1IDYuNThsNC4wMyAzLjEzYy45NS0yLjgzIDMuNi00Ljk2IDYuNzItNC45NnoiLz48L3N2Zz4=",
  "youtube": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGMDAwMCIgZD0iTTIzLjQ5OCA2LjE4NmEzLjAxNiAzLjAxNiAwIDAgMC0yLjEyMi0yLjEzNkMxOS41MDUgMy41NDUgMTIgMy41NDUgMTIgMy41NDVzLTcuNTA1IDAtOS4zNzcuNTA1QTMuMDE3IDMuMDE3IDAgMCAwIC41MDIgNi4xODZDMCA4LjA3IDAgMTIgMCAxMnMwIDMuOTMuNTAyIDUuODE0YTMuMDE2IDMuMDE2IDAgMCAwIDIuMTIyIDIuMTM2YzEuODcxLjUwNSA5LjM3Ni41MDUgOS4zNzYuNTA1czcuNTA1IDAgOS4zNzctLjUwNWEzLjAxNSAzLjAxNSAwIDAgMCAyLjEyMi0yLjEzNkMyNCAxNS45MyAyNCAxMiAyNCAxMnMwLTMuOTMtLjUwMi01LjgxNHoiLz48cG9seWdvbiBmaWxsPSIjRkZGRkZGIiBwb2ludHM9IjkuNTQ1LDE1LjU2OCAxNS44MTgsMTIgOS41NDUsOC40MzIiLz48L3N2Zz4=",
  "gmail": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTIwIDRINGEyIDIgMCAwIDAtMiAydjEuNWwxMCA2LjUgMTAtNi41VjZhMiAyIDAgMCAwLTItMnoiLz48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNMiA4LjVWMThhMiAyIDAgMCAwIDIgMmg0di03LjVsLTYtNC41eiIvPjxwYXRoIGZpbGw9IiMzNEE4NTMiIGQ9Ik0xNiAxMi41VjIwaDRhMiAyIDAgMCAwIDItMlY4LjVsLTYgNHoiLz48cGF0aCBmaWxsPSIjRkJCQzA1IiBkPSJNOCAxMi41VjIwaDh2LTcuNWwtNC0yLjgtNCAyLjh6Ii8+PC9zdmc+",
  "drive": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTcuNyAyLjVMMS41IDEzLjJoNi4ybDYuMi0xMC43eiIvPjxwYXRoIGZpbGw9IiM0Q0FGNTAiIGQ9Ik0xNi4zIDIuNUg3LjdsNi4yIDEwLjdoOC42eiIvPjxwYXRoIGZpbGw9IiMyMTk2RjMiIGQ9Ik0xMy45IDEzLjJIMS41TDQuNiAxOC41aDE0Ljh6Ii8+PC9zdmc+",
  "docs": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTE0IDJINmEyIDIgMCAwIDAtMiAydjE2YTIgMiAwIDAgMCAyIDJoMTJhMiAyIDAgMCAwIDItMlY4bC02LTZ6Ii8+PHBhdGggZmlsbD0iI0ExQzJGQSIgZD0iTTE0IDJ2Nmg2eiIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik04IDEyaDh2MS41SDh6bTAgM2g4djEuNUg4em0wLTZoNHYxLjVIOHoiLz48L3N2Zz4=",
  "calendar": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB4PSIyIiB5PSIyIiByeD0iNCIgZmlsbD0iIzQyODVGNCIvPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik02IDhoMTJ2MTFhMSAxIDAgMCAxLTEgMUg3YTEgMSAwIDAgMS0xLTFWOHptMi00djJoMlY0aDR2MmgyVjRoMmEyIDIgMCAwIDEgMiAydjJINFY2YTIgMiAwIDAgMSAyLTJoMnoiLz48dGV4dCB4PSIxMiIgeT0iMTYiIGZpbGw9IiM0Mjg1RjQiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNyIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPjMxPC90ZXh0Pjwvc3ZnPg==",
  "meet": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjEzIiBoZWlnaHQ9IjEyIiB4PSIyIiB5PSI2IiByeD0iMiIgZmlsbD0iIzAwQUM0NyIvPjxwYXRoIGZpbGw9IiMwMDgzMkQiIGQ9Ik0xNSA5LjVsNi0zLjV2MTJsLTYtMy41eiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjEyIiByPSIyIiBmaWxsPSIjZmZmZmZmIi8+PC9zdmc+",
  "maps": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDljMCA1LjI1IDcgMTMgNyAxM3M3LTcuNzUgNy0xM2MwLTMuODctMy4xMy03LTctN3ptMCA5LjVhMi41IDIuNSAwIDEgMSAwLTUgMi41IDIuNSAwIDAgMSAwIDV6Ii8+PC9zdmc+",
  "translate": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB4PSIyIiB5PSIyIiByeD0iNCIgZmlsbD0iIzFBNzNFOCIvPjx0ZXh0IHg9IjciIHk9IjE1IiBmaWxsPSIjZmZmZmZmIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iYm9sZCI+RzwvdGV4dD48dGV4dCB4PSIxNCIgeT0iMTYiIGZpbGw9IiNmZmZmZmYiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iOCI+5paHPC90ZXh0Pjwvc3ZnPg==",
  "bitwarden": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzE3NUREQyIgZD0iTTEyIDEuNzVMMy41IDUuNXY2LjJjMCA1LjQgMy42IDEwLjQgOC41IDExLjggNC45LTEuNCA4LjUtNi40IDguNS0xMS44VjUuNUwxMiAxLjc1eiIvPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik0xMiA1LjJhNCA0IDAgMCAwLTQgNGMwIDEuNyAxIDMuMSAyLjUgMy43VjE3aDN2LTQuMWMxLjUtLjYgMi41LTIgMi41LTMuN2E0IDQgMCAwIDAtNC00em0wIDIuNWExLjUgMS41IDAgMSAxIDAgMyAxLjUgMS41IDAgMCAxIDAtM3oiLz48L3N2Zz4=",
  "speedtest": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzE0MTUyNiIvPjxwYXRoIGZpbGw9IiMwMEU1RkYiIGQ9Ik0xMiA0YTggOCAwIDAgMC04IDhjMCAyLjQgMSA0LjUgMi42IDZsMS40LTEuNEE2IDYgMCAxIDEgMTggMTJjMCAuOS0uMiAxLjgtLjYgMi42bDEuNiAxQTggOCAwIDAgMCAxMiA0em0wIDRhNCA0IDAgMCAwLTMuNSA2bDQuOS00LjljLS40LS43LS45LTEuMS0xLjQtMS4xeiIvPjwvc3ZnPg==",
  "github": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMyNDI5MmUiLz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMTIgMkM2LjQ3NyAyIDIgNi40ODQgMiAxMi4wMTdjMCA0LjQyNSAyLjg2NSA4LjE4IDYuODM5IDkuNTA0LjUuMDkyLjY4Mi0uMjE3LjY4Mi0uNDgzIDAtLjIzNy0uMDA4LS44NjgtLjAxMy0xLjcwMy0yLjc4Mi42MDUtMy4zNjktMS4zNDMtMy4zNjktMS4zNDMtLjQ1NC0xLjE1OC0xLjExLTEuNDY2LTEuMTEtMS40NjYtLjkwOC0uNjIuMDY5LS42MDguMDY5LS42MDggMS4wMDMuMDcgMS41MyAxLjAzMiAxLjUzIDEuMDMyLjg5MiAxLjUzIDIuMzQxIDEuMDg4IDIuOTEuODMyLjA5Mi0uNjQ3LjM1LTEuMDg4LjYzNi0xLjMzOC0yLjIyLS4yNTMtNC41NTUtMS4xMTMtNC41NTUtNC45NTEgMC0xLjA5My4zOS0xLjk4OCAxLjAyOS0yLjY4OC0uMTAzLS4yNTMtLjQ0Ni0xLjI3Mi4wOTgtMi42NSAwIDAgLjg0LS4yNyAyLjc1IDEuMDI2QTkuNTY0IDkuNTY0IDAgMCAxIDEyIDYuODQ0Yy44NS4wMDQgMS43MDUuMTE1IDIuNTA0LjMzNyAxLjkwOS0xLjI5NiAyLjc0Ny0xLjAyNyAyLjc0Ny0xLjAyNy41NDYgMS4zNzkuMjAyIDIuMzk4LjEgMi42NTEuNjQuNyAxLjAyOCAxLjU5NSAxLjAyOCAyLjY4OCAwIDMuODQ4LTIuMzM5IDQuNjk1LTQuNTY2IDQuOTQzLjM1OS4zMDkuNjc4LjkyLjY3OCAxLjg1NSAwIDEuMzM4LS4wMTIgMi40MTktLjAxMiAyLjc0NyAwIC4yNjguMTguNTguNjg4LjQ4MkExMC4wMTkgMTAuMDE5IDAgMCAwIDIyIDEyLjAxN0MyMiA2LjQ4NCAxNy41MjIgMiAxMiAyeiIvPjwvc3ZnPg==",
  "chatgpt": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzEwQTM3RiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjYiIGZpbGw9IiNmZmZmZmYiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIiBmaWxsPSIjMTBBMzdGIi8+PC9zdmc+",
  "spotify": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMxRUQ3NjAiLz48cGF0aCBmaWxsPSIjMDAwMDAwIiBkPSJNMTcuOSAxNi45YS43NS43NSAwIDAgMS0xIC4yNWMtMi44LTEuNy02LjMtMi4xLTEwLjQtMS4yYS43NS43NSAwIDEgMS0uMy0xLjQ2YzQuNi0xLjA0IDguNS0uNiAxMS41IDEuMy4zNS4yLjQ1LjY3LjIgMS4xMXptMS41LTMuM2MtLjMuNC0uOC41LTEuMi4zLTMuMi0yLTguMS0yLjUtMTEuOS0xLjQtLjUuMS0xLS4yLTEuMS0uNy0uMS0uNS4yLTEgLjctMS4xIDQuMy0xLjMgOS43LS43IDEzLjMgMS41LjQuMy41LjkuMiAxLjR6bS4xLTMuNGMtMy44LTIuMy0xMC4yLTIuNS0xMy44LTEuNC0uNi4yLTEuMi0uMi0xLjQtLjgtLjItLjYuMi0xLjIuOC0xLjQgNC4yLTEuMyAxMS4yLTEgMTUuNSAxLjYuNS4zLjcgMSAuNCAxLjUtLjMuNi0xIC44LTEuNS41eiIvPjwvc3ZnPg==",
  "discord": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNSIgZmlsbD0iIzU4NjVGMiIvPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik0xOS4zIDUuM0ExNS43IDE1LjcgMCAwIDAgMTUuNCA0YS4xLjEgMCAwIDAtLjEgMCAxMC45IDEwLjkgMCAwIDAtLjUgMSAxNC41IDE0LjUgMCAwIDAtNC40IDAgMTAgMTAgMCAwIDAtLjUtMSAuMS4xIDAgMCAwLS4xIDAgMTUuNyAxNS43IDAgMCAwLTMuOSAxLjMuMS4xIDAgMCAwIDAgLjFDMy40IDkgMi43IDEyLjUgMyAxNmEuMS4xIDAgMCAwIDAgLjEgMTUuOCAxNS44IDAgMCAwIDQuOCAyLjQuMS4xIDAgMCAwIC4xIDBjLjQtLjUuNy0xLjEgMS0xLjdhLjEuMSAwIDAgMC0uMS0uMSAxMC40IDEwLjQgMCAwIDEtMS41LS43LjEuMSAwIDAgMSAwLS4yYy4xLS4xLjItLjIuMy0uMiAzIDEuNCA2LjIgMS40IDkuMiAwIC4xIDAgLjIuMS4zLjJhLjEuMSAwIDAgMSAwIC4yIDEwLjggMTAuOCAwIDAgMS0xLjUuNy4xLjEgMCAwIDAtLjEuMWMuMy42LjYgMS4yIDEgMS43YS4xLjEgMCAwIDAgLjEgMCAxNS43IDE1LjcgMCAwIDAgNC44LTIuNC4xLjEgMCAwIDAgMC0uMWMuNC00LS43LTcuNC0yLjgtMTAuNmEuMS4xIDAgMCAwLS4xLS4xek04LjUgMTMuN2MtMSAwLTEuOC0uOS0xLjgtMnMuOC0yIDEuOC0yYzEgMCAxLjguOSAxLjggMnMtLjggMi0xLjggMnptNyAwYy0xIDAtMS44LS45LTEuOC0ycy44LTIgMS44LTJjMSAwIDEuOC45IDEuOCAycy0uOCAyLTEuOCAyeiIvPjwvc3ZnPg==",
  "reddit": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNGRjQ1MDAiLz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMTIgNi41YTEgMSAwIDAgMC0uOS42TDkuNiAxMGE4LjIgOC4yIDAgMCAwLTQuNiAxLjQgMS41IDEuNSAwIDAgMC0yIC40IDEuNSAxLjUgMCAwIDAgLjMgMi4xYy0uMi40LS4zLjktLjMgMS4zIDAgMi41IDMuMSA0LjUgNyA0LjVzNy0yIDctNC41YzAtLjQtLjEtLjktLjMtMS4zYTEuNSAxLjUgMCAwIDAgLjMtMi4xIDEuNSAxLjUgMCAwIDAtMi0uNCA4LjIgOC4yIDAgMCAwLTQuNi0xLjRsMS4yLTIuNSAyLjcuNmExLjUgMS41IDAgMSAwIC4zLTFsLTMuMy0uN2EuNS41IDAgMCAwLS41LjR6TTkgMTMuNWExLjIgMS4yIDAgMSAxIDAgMi40IDEuMiAxLjIgMCAwIDEgMC0yLjR6bTYgMGExLjIgMS4yIDAgMSAxIDAgMi40IDEuMiAxLjIgMCAwIDEgMC0yLjR6bS01IDMuOGE0IDQgMCAwIDAgNCAwIC40LjQgMCAwIDEgLjUuNiA0LjggNC44IDAgMCAxLTUgMCAuNC40IDAgMCAxIC41LS42eiIvPjwvc3ZnPg==",
  "notion": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI2ZmZmZmZiIvPjxwYXRoIGZpbGw9IiMwMDAwMDAiIGQ9Ik00LjUgNC44bDExLjQtMS42Yy45LS4xIDEuNC4zIDEuOCAxLjFsMi41IDMuOGMuNC42LjMgMS4xLS4zIDEuMmwtLjcuMXY5LjhjMCAxLS41IDEuNi0xLjcgMS43TDYgMjIuMmMtLjguMS0xLjMtLjItMS43LTFsLTEuNi0yLjVjLS4zLS41LS4yLTEgLjMtMS4xbC44LS4xVjUuOWMwLS43LjQtMS4xLjctMS4xem0xMS4yIDEuNEw2LjkgNy40djExLjdsOC44LTEuMVY2LjJ6bS02LjUgMi41bDIuNC0uMyAzLjYgNS44VjguMWwyLS4zdjguNWwtMi40LjMtMy42LTUuOHY2LjFsLTIgLjJWOC43eiIvPjwvc3ZnPg==",
  "figma": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzBBQ0Y4MyIgZD0iTTggMjRhNCA0IDAgMCAxLTQtNCA0IDQgMCAwIDEgNC00aDR2NGE0IDQgMCAwIDEtNCA0eiIvPjxwYXRoIGZpbGw9IiNBMjU5RkYiIGQ9Ik00IDEyYTQgNCAwIDAgMSA0LTRoNHY4SDhhNCA0IDAgMCAxLTQtNHoiLz48cGF0aCBmaWxsPSIjRjI0RTFFIiBkPSJNNCA0YTQgNCAwIDAgMSA0LTRoNHY4SDhhNCA0IDAgMCAxLTQtNHoiLz48cGF0aCBmaWxsPSIjRkY3MjYyIiBkPSJNMTIgMGg0YTQgNCAwIDAgMSAwIDhoLTR6Ii8+PHBhdGggZmlsbD0iIzFBQkNGRSIgZD0iTTE2IDhhNCA0IDAgMSAxIDAgOCA0IDQgMCAwIDEgMC04eiIvPjwvc3ZnPg==",
  "whatsapp": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMyNUQzNjYiLz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMTcuNSAxNC4zYy0uMy0uMS0xLjctLjgtMS45LS45LS4zLS4xLS41LS4xLS43LjEtLjIuMy0uOC45LTEgMS4xLS4yLjItLjQuMi0uNy4xLS4zLS4xLTEuMy0uNS0yLjUtMS41LS45LS44LTEuNS0xLjgtMS43LTIuMS0uMi0uMyAwLS41LjEtLjcuMS0uMS4zLS40LjUtLjUuMS0uMi4yLS4zLjMtLjUgMC0uMiAwLS4zLS4xLS41cy0uNy0xLjctLjktMi4zYy0uMi0uNi0uNS0uNS0uNy0uNWgtLjZjLS4yIDAtLjYuMS0uOS40LS4zLjQtMS4yIDEuMi0xLjIgMi45czEuMiAzLjMgMS40IDMuNmMuMi4yIDIuNCAzLjcgNS45IDUuMi44LjQgMS41LjYgMiAuNy44LjMgMS42LjIgMi4yLjEuNy0uMSAyLjEtLjkgMi40LTEuNy4zLS44LjMtMS41LjItMS43LS4xLS4xLS4zLS4yLS42LS4zeiIvPjwvc3ZnPg==",
  "netflix": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwMDAwMCIvPjxwYXRoIGZpbGw9IiNFNTA5MTQiIGQ9Ik01LjUgM2gzLjJsNS42IDEzLjhWM2gzLjJ2MThoLTMuMkw4LjcgNy4yVjIxSDUuNXoiLz48L3N2Zz4=",
  "linkedin": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwNzdCNSIvPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik02LjUgOC41aC0zdjExaDN6bS0xLjUtNWExLjcgMS43IDAgMSAwIDAgMy40IDEuNyAxLjcgMCAwIDAgMC0zLjR6bTE0IDkuNWMwLTIuOC0xLjUtNC4xLTMuNS00LjEtMS42IDAtMi4zLjktMi43IDEuNXYtMS4zaC0zYzAgLjggMCAxMSAwIDExaDN2LTYuMWMwLS4zIDAtLjcuMS0uOS4zLS43IDEtMS40IDItMS40IDEuNCAwIDIgMS4xIDIgMi43VjE5aDN6Ii8+PC9zdmc+",
  "wikipedia": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNmOGY5ZmEiLz48dGV4dCB4PSIxMiIgeT0iMTciIGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlc8L3RleHQ+PC9zdmc+",
  "x": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwMDAwMCIvPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik0xOC4yNDQgMi4yNWgzLjMwOGwtNy4yMjcgOC4yNiA4LjUwMiAxMS4yNEgxNi4xN2wtNS4yMTQtNi44MTdMNC45OSAyMS43NUgxLjY4bDcuNzMtOC44MzVMMS4yNTQgMi4yNUg4LjA4bDQuNzEzIDYuMjMxem0tMS4xNjEgMTcuNTJoMS44MzNMNy4wODQgNC4xMjZINS4xMTd6Ii8+PC9zdmc+",
};

export function getBundledIcon(urlOrDomain: string): string | null {
  if (!urlOrDomain) return null;

  let host = urlOrDomain.toLowerCase().trim();
  try {
    if (host.startsWith('http://') || host.startsWith('https://')) {
      host = new URL(host).hostname;
    }
  } catch (e) {
    host = host.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
  }

  host = host.replace(/^www\./, '');

  if (host === 'aura://newtab' || host === 'about:blank' || host.startsWith('chrome://')) {
    return BUNDLED_ICONS.google || null;
  }

  // 1. Check specific subdomains FIRST before generic domain matching!
  if (host.includes('mail.google.com') || host === 'gmail') return BUNDLED_ICONS.gmail || null;
  if (host.includes('drive.google.com') || host === 'drive') return BUNDLED_ICONS.drive || null;
  if (host.includes('docs.google.com') || host === 'docs') return BUNDLED_ICONS.docs || null;
  if (host.includes('calendar.google.com') || host === 'calendar') return BUNDLED_ICONS.calendar || null;
  if (host.includes('meet.google.com') || host === 'meet') return BUNDLED_ICONS.meet || null;
  if (host.includes('maps.google.com') || host === 'maps') return BUNDLED_ICONS.maps || null;
  if (host.includes('translate.google.com') || host === 'translate') return BUNDLED_ICONS.translate || null;
  if (host.includes('myaccount.google.com')) return BUNDLED_ICONS.google || null;
  if (host.includes('chromewebstore.google.com')) return BUNDLED_ICONS.google || null;

  // 2. Google search & root domain
  if (host === 'google.com' || host.endsWith('.google.com') || host.includes('google.co.') || host === 'google') {
    return BUNDLED_ICONS.google || null;
  }

  // 3. YouTube
  if (host.includes('youtube.com') || host.includes('youtu.be') || host === 'youtube') {
    return BUNDLED_ICONS.youtube || null;
  }

  // 4. Bitwarden
  if (host.includes('bitwarden.com') || host === 'bitwarden') {
    return BUNDLED_ICONS.bitwarden || null;
  }

  // 5. Speedtest
  if (host.includes('speedtest.net') || host === 'speedtest') {
    return BUNDLED_ICONS.speedtest || null;
  }

  // 6. GitHub
  if (host.includes('github.com') || host === 'github') {
    return BUNDLED_ICONS.github || null;
  }

  // 7. ChatGPT & OpenAI
  if (host.includes('chatgpt.com') || host.includes('openai.com') || host === 'chatgpt') {
    return BUNDLED_ICONS.chatgpt || null;
  }

  // 8. Spotify
  if (host.includes('spotify.com') || host === 'spotify') {
    return BUNDLED_ICONS.spotify || null;
  }

  // 9. Discord
  if (host.includes('discord.com') || host.includes('discord.gg') || host === 'discord') {
    return BUNDLED_ICONS.discord || null;
  }

  // 10. Reddit
  if (host.includes('reddit.com') || host === 'reddit') {
    return BUNDLED_ICONS.reddit || null;
  }

  // 11. Notion
  if (host.includes('notion.so') || host.includes('notion.site') || host === 'notion') {
    return BUNDLED_ICONS.notion || null;
  }

  // 12. Figma
  if (host.includes('figma.com') || host === 'figma') {
    return BUNDLED_ICONS.figma || null;
  }

  // 13. WhatsApp
  if (host.includes('whatsapp.com') || host === 'whatsapp') {
    return BUNDLED_ICONS.whatsapp || null;
  }

  // 14. Netflix
  if (host.includes('netflix.com') || host === 'netflix') {
    return BUNDLED_ICONS.netflix || null;
  }

  // 15. LinkedIn
  if (host.includes('linkedin.com') || host === 'linkedin') {
    return BUNDLED_ICONS.linkedin || null;
  }

  // 16. Wikipedia
  if (host.includes('wikipedia.org') || host === 'wikipedia') {
    return BUNDLED_ICONS.wikipedia || null;
  }

  // 17. X / Twitter
  if (host.includes('x.com') || host.includes('twitter.com') || host === 'x' || host === 'twitter') {
    return BUNDLED_ICONS.x || null;
  }

  return null;
}
