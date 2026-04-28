param(
    [Parameter(Mandatory=$true)]
    [string]$Class
)

# Parse grade and room
$parts = $Class -split '-'
$grade = $parts[0]
$room  = $parts[1]
$label = "${grade}학년 ${room}반 교실 알림"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 API
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Show {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

# Chrome path
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$script:chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $script:chromePath) {
    [System.Windows.Forms.MessageBox]::Show("Chrome을 찾을 수 없습니다.", $label, "OK", "Error")
    exit 1
}

# HTML path
$htmlFile = Join-Path $PSScriptRoot "..\classroom\$Class.html"
$htmlFile = (Resolve-Path $htmlFile).Path
$fileUrl  = "file:///$($htmlFile -replace '\\','/')"

$script:chromeArgs = "--app=`"$fileUrl`" --disable-background-timer-throttling --disable-renderer-backgrounding --autoplay-policy=no-user-gesture-required"

# Launch Chrome hidden
function Start-ChromeHidden {
    $script:proc = Start-Process -FilePath $script:chromePath -ArgumentList $script:chromeArgs -PassThru -WindowStyle Minimized
    Start-Sleep -Seconds 3
    $script:proc.Refresh()
    if ($script:proc.MainWindowHandle -ne [IntPtr]::Zero) {
        [Win32Show]::ShowWindow($script:proc.MainWindowHandle, 0) | Out-Null
    }
}

Start-ChromeHidden

# Tray icon
$trayIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon.Icon = [System.Drawing.SystemIcons]::Information
$trayIcon.Text = $label
$trayIcon.Visible = $true

# Context menu
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$showItem = $menu.Items.Add("창 보기")
$hideItem = $menu.Items.Add("창 숨기기")
[void]$menu.Items.Add("-")
$exitItem = $menu.Items.Add("종료")
$trayIcon.ContextMenuStrip = $menu

$showItem.Add_Click({
    if ($script:proc -and -not $script:proc.HasExited) {
        $script:proc.Refresh()
        [Win32Show]::ShowWindow($script:proc.MainWindowHandle, 9) | Out-Null
        [Win32Show]::SetForegroundWindow($script:proc.MainWindowHandle) | Out-Null
    }
})

$hideItem.Add_Click({
    if ($script:proc -and -not $script:proc.HasExited) {
        $script:proc.Refresh()
        [Win32Show]::ShowWindow($script:proc.MainWindowHandle, 0) | Out-Null
    }
})

$exitItem.Add_Click({
    try { if ($script:proc -and -not $script:proc.HasExited) { $script:proc.Kill() } } catch {}
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$trayIcon.Add_DoubleClick({
    if ($script:proc -and -not $script:proc.HasExited) {
        $script:proc.Refresh()
        [Win32Show]::ShowWindow($script:proc.MainWindowHandle, 9) | Out-Null
        [Win32Show]::SetForegroundWindow($script:proc.MainWindowHandle) | Out-Null
    }
})

# Monitor Chrome - restart if closed
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({
    if ($script:proc.HasExited) {
        Start-ChromeHidden
    }
})
$timer.Start()

# Message loop
[System.Windows.Forms.Application]::Run()
