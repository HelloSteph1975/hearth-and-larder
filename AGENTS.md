# Instructions for coding assistants

Hearth & Larder is a kitchen keeper that runs on the user's own computer. You are probably here because a non-technical person asked you to install, update, uninstall or fix it. Follow this file exactly. It matches the code in this repository.

## Golden rules

1. Never delete, move, overwrite or reset the data folder. By default it is `Documents\Hearth & Larder Data` in the user's home folder, or the `dataDir` folder named in `config.json`. It holds the database (`hearth.db`), photos (`photos\`) and backups (`backups\`).
2. Never run `npm run demo -- --reset` unless the user asks for it. It is meant for the separate demo folder only.
3. Don't change code unless the user asks you to.
4. Explain each step in plain language, in short messages. Ask before anything that changes the system: scheduled tasks, Desktop shortcuts, antivirus exceptions.
5. Don't edit or delete `config.json` without telling the user. Setup creates it, and Git ignores it.
6. Never disable antivirus or Windows security features.

## Install on Windows

1. Check Node: run `node --version`. It must be 24 or newer. If Node is missing or older, tell the user to install the Node.js 24 LTS from https://nodejs.org, then open a new terminal and ask you again. Stop there.
2. Run `npm run setup`. This installs dependencies, builds the app, writes `config.json` if it is missing, and creates the data folder. It may take a few minutes.
3. Ask the user: "Next I'll add two scheduled tasks (start at 5:30 AM, back up and stop at 9:30 PM) and a Desktop shortcut. OK?" Only after a yes, run `npm run install-windows`. It creates:
   - the task `Hearth & Larder - Start Morning` (daily 5:30 AM, runs on battery),
   - the task `Hearth & Larder - Stop 9-30 PM` (daily 9:30 PM, runs on battery; the name uses a hyphen because task names can't contain a colon),
   - the Desktop shortcut `Hearth & Larder Dashboard`.
4. Start the app now. Either run the scheduled task (`Start-ScheduledTask -TaskName 'Hearth & Larder - Start Morning'` in PowerShell) or run `npm start` in a separate terminal and leave it running.
5. Verify: `GET http://127.0.0.1:4193/api/health` should return JSON with `"ok": true`. Use the port from `config.json` if the user changed it. Also check that `Hearth & Larder Dashboard.lnk` exists on the Desktop.
6. Open the app: ask the user to double-click the Desktop shortcut, or open http://localhost:4193. It opens in a Chrome app window, or in the default browser if Chrome isn't installed.
7. Tell the user where their data lives and that the app is reachable only from their own computer.

## Install on macOS or Linux

Run `npm run setup`, then `npm start`, and open http://localhost:4193. There are no scheduled tasks or shortcuts on these systems. The app still backs up when it starts if the last backup is a day old, and the user can press Back up now in Settings.

## Update

1. Run `npm run stop`. It asks the running app to back up and stop, and says so if it wasn't running.
2. Get the new files. With Git, run `git pull`. With a ZIP, copy the new files over the folder. Either way keep `config.json` and leave the data folder alone.
3. Run `npm run setup`.
4. Start the app again (the scheduled task, `npm start`, or the Desktop shortcut). The database upgrades itself on start. If the Windows tasks and shortcut already exist, they keep working. Run `npm run install-windows` again only if the app folder has moved.

## Uninstall

1. Confirm with the user first, and say that their data will be kept.
2. Run `npm run uninstall-windows`. It stops the app and removes both scheduled tasks and the Desktop shortcut. It does not touch the data folder.
3. The app folder can now be removed if the user wants. Leave the data folder in place unless the user explicitly asks to delete it. If they do, remind them that it holds all their items, recipes, photos and backups, and confirm once more.

## Troubleshooting

- **Port 4193 is busy.** The server prints `Port 4193 is busy; Hearth & Larder is probably already running.` and exits. Most often another copy is already running, which is fine. To restart it, run `npm run stop`, wait a moment, then start it again. If a different program uses the port, set another `port` in `config.json` (for example 4201), then restart. The launcher and stop script read the port from `config.json`. The environment variable `HEARTH_PORT` overrides the file.
- **`config.json` errors.** The app names the file and stops. The usual cause is a Windows path with single backslashes. In JSON they must be doubled: `"dataDir": "D:\\Kitchen Data"`. Fix only that line. Never point `dataDir` at a new empty folder to "fix" things, because the app would look empty. The old data is still in the old folder.
- **A message says Hearth & Larder couldn't start.** The Desktop launcher waits about 15 seconds for the server. Open `server.log` in the app folder and read the last lines. Likely causes are an unreachable data folder, a bad `config.json`, or Node missing from the PATH.
- **Antivirus warns about the `.vbs` files.** `windows\start-server.vbs`, `windows\stop-server.vbs` and `windows\Launch Hearth & Larder.vbs` start Node with no visible window, which some antivirus programs flag. The stop script uses Node, not PowerShell. Read the files with the user so they can see what they do. Add a narrow exception for the app folder only if the user agrees. Never turn antivirus off.
- **Backups and restore.** Backups are in the `backups\` folder inside the data folder. They are made at 9:30 PM by the stop task, or at start if the last one is a day old. Settings has Back up now and Restore. Restoring makes a safety copy of the current data first. Use Restore in Settings, not manual file copying.
- **Chrome isn't installed.** The shortcut opens the app in the default browser instead. It works the same.
- **The app doesn't respond but the tasks exist.** Check `Get-ScheduledTaskInfo -TaskName 'Hearth & Larder - Start Morning'`, then try `npm start` in a terminal to see the error directly.

## Commands

```
npm run setup              # npm install, build, write config.json, create data folder
npm run install-windows    # scheduled tasks and Desktop shortcut (Windows only)
npm run uninstall-windows  # remove them; keeps data
npm start                  # run the app (port 4193)
npm run stop               # back up and stop the running app
npm run demo               # demo on port 4195 with its own sample data folder
npm run dev                # API with auto-restart plus the Vite dev server
npm run build              # build the client
npm test                   # unit and API tests (Vitest)
npm run test:e2e           # browser test (Playwright), throwaway data folder, port 4199
```

## For contributors

- Work on a branch, not `main`. Run `npm test` before committing, and `npm run test:e2e` for UI changes.
- Tests use throwaway folders. Never point them at the real data folder, and don't use port 4193 for experiments.
- Keep text plain and warm, with no em dashes.
