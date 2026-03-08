# sink-cli full workflow demo — macOS chrome, cyan background
# Render: cd /Users/chrisschofield/workspace/active/sink-cli && vhs video/demo-full.tape

Output video/out/sink-full.gif
Output video/out/sink-full.mp4

Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 18
Set Width 840
Set Height 680
Set TypingSpeed 80ms
Set Theme "Catppuccin Mocha"
Set Padding 20
Set Framerate 30
Set PlaybackSpeed 1
Set WindowBar Colorful
Set Margin 40
Set MarginFill "#06b6d4"
Set BorderRadius 12

Env PS1 "\033[36m$\033[0m "
Env FORCE_COLOR "1"
Env HOME "/tmp"

# Hidden setup
Hide
Type "cd /Users/chrisschofield/workspace/active/sink-cli && alias sink='node dist/cli.js' && cp video/contacts.csv contacts.csv && clear"
Enter
Sleep 1s
Show

# ── Scene 1: Interactive menu (logo + options) ────────────────────
Type "sink"
Sleep 300ms
Enter
Sleep 3s

# Exit the interactive menu
Ctrl+C
Sleep 500ms

# ── Scene 2: Show messy CSV ───────────────────────────────────────
Type "cat contacts.csv"
Sleep 300ms
Enter
Sleep 2.5s

# ── Scene 3: Scrub (output flows naturally) ───────────────────────
Type "sink scrub contacts.csv -o scrubbed.csv"
Sleep 300ms
Enter
Sleep 4s

# ── Scene 4: Rinse (follows scrub output) ─────────────────────────
Type "sink rinse scrubbed.csv -o clean.csv"
Sleep 300ms
Enter
Sleep 4s

# ── Scene 5: Inspect (follows rinse output) ───────────────────────
Type "sink inspect clean.csv"
Sleep 300ms
Enter
Sleep 4s

# ── Hold on final result ──────────────────────────────────────────
Sleep 3s
