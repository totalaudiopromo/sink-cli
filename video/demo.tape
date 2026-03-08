# sink-cli promo — 15s, macOS chrome, cyan background, 1080p 60fps
# Render: cd /Users/chrisschofield/workspace/active/sink-cli && vhs video/demo.tape

Output video/out/sink-demo.gif
Output video/out/sink-demo.mp4

Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1920
Set Height 1080
Set TypingSpeed 40ms
Set Theme "Catppuccin Mocha"
Set Padding 30
Set Framerate 60
Set PlaybackSpeed 1
Set WindowBar Colorful
Set Margin 30
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

# ── Messy CSV ───────────────────────────────────────────────────────

Type "cat contacts.csv"
Enter
Sleep 3s

# ── Scrub ───────────────────────────────────────────────────────────

Type "sink scrub contacts.csv"
Enter
Sleep 4s

# ── Clear + Rinse ───────────────────────────────────────────────────

Hide
Type "clear"
Enter
Sleep 200ms
Show
Type "sink rinse contacts.csv"
Enter
Sleep 4s

# ── Hold on result ──────────────────────────────────────────────────

Sleep 2s
