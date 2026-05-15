param(
    [string]$CLS = "1-1",
    [string]$URL = ""
)

# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $URL) {
    $URL = "https://dyuits.github.io/school-app/classroom/$CLS.html"
}

# Windows Forms / Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ── Chrome 경로 찾기 ──
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromePath = $null
foreach ($p in $chromePaths) {
    if (Test-Path $p) { $chromePath = $p; break }
}
if (-not $chromePath) {
    [System.Windows.Forms.MessageBox]::Show("Chrome을 찾을 수 없습니다.", "교실알림 오류", "OK", "Error")
    exit 1
}

# ── Chrome 사용자 데이터 폴더 ──
$userDataDir = "$env:LOCALAPPDATA\교실알림\$CLS"
if (-not (Test-Path $userDataDir)) { New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null }

# ── 중복 실행 방지 ──
$mutexName = "교실알림_$CLS"
$mutex = New-Object System.Threading.Mutex($false, $mutexName)
if (-not $mutex.WaitOne(0)) {
    exit 0
}

# ── 트레이 아이콘 생성 ──
$grade = $CLS.Split("-")[0]
$classNum = $CLS.Split("-")[1]
$displayName = "${grade}학년 ${classNum}반 교실알림"

# 아이콘 생성 (종 모양)
$bitmap = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = "AntiAlias"
$g.Clear([System.Drawing.Color]::Transparent)
# 종 모양 그리기
$g.FillEllipse([System.Drawing.Brushes]::Gold, 6, 2, 20, 20)
$g.FillRectangle([System.Drawing.Brushes]::Gold, 10, 18, 12, 8)
$g.FillEllipse([System.Drawing.Brushes]::OrangeRed, 13, 24, 6, 6)
$g.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $icon
$notifyIcon.Text = $displayName
$notifyIcon.Visible = $true

# ── 컨텍스트 메뉴 ──
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$titleItem = New-Object System.Windows.Forms.ToolStripMenuItem
$titleItem.Text = "📢 $displayName"
$titleItem.Enabled = $false
$titleItem.Font = New-Object System.Drawing.Font("맑은 고딕", 9, [System.Drawing.FontStyle]::Bold)
$contextMenu.Items.Add($titleItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$showItem = New-Object System.Windows.Forms.ToolStripMenuItem
$showItem.Text = "🖥️ 창 보기"
$contextMenu.Items.Add($showItem) | Out-Null

$hideItem = New-Object System.Windows.Forms.ToolStripMenuItem
$hideItem.Text = "👁️‍🗨️ 창 숨기기"
$contextMenu.Items.Add($hideItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusItem.Text = "✅ 실행 중"
$statusItem.Enabled = $false
$contextMenu.Items.Add($statusItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "❌ 종료"
$exitItem.Font = New-Object System.Drawing.Font("맑은 고딕", 9, [System.Drawing.FontStyle]::Bold)
$contextMenu.Items.Add($exitItem) | Out-Null

$notifyIcon.ContextMenuStrip = $contextMenu

# ── Win32 API for 창 제어 ──
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    public const int SW_HIDE = 0;
    public const int SW_SHOW = 5;
    public const int SW_RESTORE = 9;
    public const int SW_SHOWMAXIMIZED = 3;
}
"@

# ── Chrome 프로세스 관리 ──
$script:chromeProcess = $null

function Start-Chrome {
    $args = @(
        "--app=$URL",
        "--user-data-dir=`"$userDataDir`"",
        "--disable-popup-blocking",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--no-first-run",
        "--window-size=800,600"
    )
    $script:chromeProcess = Start-Process -FilePath $chromePath -ArgumentList $args -PassThru
    Start-Sleep -Seconds 3
    $statusItem.Text = "✅ 실행 중"
    $notifyIcon.Text = "$displayName - 실행 중"
}

function Get-ChromeWindow {
    if ($script:chromeProcess -and -not $script:chromeProcess.HasExited) {
        return $script:chromeProcess.MainWindowHandle
    }
    # lockfile로 Chrome 실행 여부 확인
    $lockfile = Join-Path $userDataDir "lockfile"
    if (Test-Path $lockfile) {
        $procs = Get-Process -Name "chrome" -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle -match $CLS -or $_.MainWindowTitle -match "교실" }
        if ($procs) { return $procs[0].MainWindowHandle }
    }
    return [IntPtr]::Zero
}

function Show-ChromeWindow {
    $hwnd = Get-ChromeWindow
    if ($hwnd -ne [IntPtr]::Zero) {
        [Win32]::ShowWindow($hwnd, [Win32]::SW_RESTORE) | Out-Null
        [Win32]::ShowWindow($hwnd, [Win32]::SW_SHOWMAXIMIZED) | Out-Null
        [Win32]::SetForegroundWindow($hwnd) | Out-Null
    }
}

function Hide-ChromeWindow {
    $hwnd = Get-ChromeWindow
    if ($hwnd -ne [IntPtr]::Zero) {
        [Win32]::ShowWindow($hwnd, [Win32]::SW_HIDE) | Out-Null
    }
}

# ── 이벤트 핸들러 ──
$notifyIcon.Add_DoubleClick({
    Show-ChromeWindow
})

$showItem.Add_Click({
    Show-ChromeWindow
})

$hideItem.Add_Click({
    Hide-ChromeWindow
})

$exitItem.Add_Click({
    # Chrome 종료
    if ($script:chromeProcess -and -not $script:chromeProcess.HasExited) {
        $script:chromeProcess.Kill()
    }
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

# ── Chrome 시작 ──
Start-Chrome

# ── 감시 타이머 (10초마다 Chrome 살아있는지 확인) ──
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({
    $lockfile = Join-Path $userDataDir "lockfile"
    $alive = $false
    
    if ($script:chromeProcess -and -not $script:chromeProcess.HasExited) {
        $alive = $true
    } elseif (Test-Path $lockfile) {
        $alive = $true
    }
    
    if (-not $alive) {
        $statusItem.Text = "🔄 재시작 중..."
        $notifyIcon.Text = "$displayName - 재시작 중..."
        Start-Sleep -Seconds 3
        # 한번 더 확인
        if (-not (Test-Path $lockfile)) {
            Start-Chrome
        }
    }
})
$timer.Start()

# ── 볼륨 최대 ──
$wshell = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt 50; $i++) { $wshell.SendKeys([char]175) }

# ── 메시지 루프 시작 ──
[System.Windows.Forms.Application]::Run()
