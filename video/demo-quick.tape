# sink-cli quick demo — 8s, macOS chrome, cyan background
# Render: cd /Users/chrisschofield/workspace/active/sink-cli && vhs video/demo-quick.tape

Output video/out/sink-quick.gif
Output video/out/sink-quick.mp4

Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 18
Set Width 840
Set Height 520
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

# ── Show messy CSV ─────────────────────────────────────────────────
Type "cat contacts.csv"
Sleep 300ms
Enter
Sleep 2s

# ── Scrub ──────────────────────────────────────────────────────────
Type "sink scrub contacts.csv"
Sleep 300ms
Enter
Sleep 4s

# ── Hold on result ─────────────────────────────────────────────────
Sleep 2s
