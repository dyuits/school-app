using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

class ClassroomAlert : Form
{
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int count);

    static NotifyIcon trayIcon;
    static Process chromeProc;
    static string chromePath;
    static string chromeArgs;
    static string htmlUrl;
    static string label;
    static System.Windows.Forms.Timer watchTimer;
    static System.Windows.Forms.Timer titleTimer;
    static bool isHidden = true;

    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length < 3)
        {
            MessageBox.Show("사용법: 교실알림.exe <Chrome경로> <HTML_URL> <반이름>",
                "교실 알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        chromePath = args[0];
        htmlUrl = args[1];
        label = args[2];
        chromeArgs = "--app=\"" + htmlUrl + "\" --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --no-first-run";

        Application.EnableVisualStyles();

        // 트레이 아이콘
        trayIcon = new NotifyIcon();
        trayIcon.Icon = SystemIcons.Information;
        trayIcon.Text = label;
        trayIcon.Visible = true;

        // 컨텍스트 메뉴
        var menu = new ContextMenuStrip();
        menu.Items.Add("창 보기", null, (s, e) => ShowChrome());
        menu.Items.Add("창 숨기기", null, (s, e) => HideChrome());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("종료", null, (s, e) => ExitApp());
        trayIcon.ContextMenuStrip = menu;
        trayIcon.DoubleClick += (s, e) => ShowChrome();

        // Chrome 실행
        LaunchChrome();

        // Chrome 재시작 감시 타이머 (10초)
        watchTimer = new System.Windows.Forms.Timer();
        watchTimer.Interval = 10000;
        watchTimer.Tick += (s, e) =>
        {
            if (chromeProc == null || chromeProc.HasExited) LaunchChrome();
        };
        watchTimer.Start();

        // 호출 감지 타이머 (2초) - 창 제목으로 호출 감지
        titleTimer = new System.Windows.Forms.Timer();
        titleTimer.Interval = 2000;
        titleTimer.Tick += (s, e) => CheckCallTitle();
        titleTimer.Start();

        Application.Run();
    }

    static void LaunchChrome()
    {
        try
        {
            var psi = new ProcessStartInfo(chromePath, chromeArgs);
            psi.WindowStyle = ProcessWindowStyle.Minimized;
            chromeProc = Process.Start(psi);
            Thread.Sleep(3000);
            HideChrome();
        }
        catch (Exception ex)
        {
            trayIcon.ShowBalloonTip(3000, "오류", "Chrome 실행 실패: " + ex.Message, ToolTipIcon.Error);
        }
    }

    static string GetChromeTitle()
    {
        if (chromeProc == null || chromeProc.HasExited) return "";
        try
        {
            chromeProc.Refresh();
            IntPtr hwnd = chromeProc.MainWindowHandle;
            if (hwnd == IntPtr.Zero) return "";
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hwnd, sb, sb.Capacity);
            return sb.ToString();
        }
        catch { return ""; }
    }

    static void CheckCallTitle()
    {
        string title = GetChromeTitle();
        if (string.IsNullOrEmpty(title)) return;

        if (title.Contains("[CALL]"))
        {
            if (isHidden) ShowChrome();
        }
        else
        {
            if (!isHidden) HideChrome();
        }
    }

    static void ShowChrome()
    {
        if (chromeProc != null && !chromeProc.HasExited)
        {
            chromeProc.Refresh();
            if (chromeProc.MainWindowHandle != IntPtr.Zero)
            {
                ShowWindow(chromeProc.MainWindowHandle, 9); // SW_RESTORE
                SetForegroundWindow(chromeProc.MainWindowHandle);
            }
        }
        isHidden = false;
    }

    static void HideChrome()
    {
        if (chromeProc != null && !chromeProc.HasExited)
        {
            chromeProc.Refresh();
            if (chromeProc.MainWindowHandle != IntPtr.Zero)
            {
                ShowWindow(chromeProc.MainWindowHandle, 0); // SW_HIDE
            }
        }
        isHidden = true;
    }

    static void ExitApp()
    {
        watchTimer.Stop();
        titleTimer.Stop();
        try { if (chromeProc != null && !chromeProc.HasExited) chromeProc.Kill(); } catch { }
        trayIcon.Visible = false;
        trayIcon.Dispose();
        Application.Exit();
    }
}
