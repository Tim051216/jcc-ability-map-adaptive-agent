import express from "express";
import { spawn } from "node:child_process";

const app = express();
const PORT = 39333;
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3002",
  "http://127.0.0.1:3002",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ ok: false, error: "origin_not_allowed" });
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/capture-active-window", async (req, res) => {
  const x = Number(req.query.x ?? 0);
  const y = Number(req.query.y ?? 0);
  const width = Number(req.query.width ?? 0);
  const height = Number(req.query.height ?? 0);
  const screenX = Number(req.query.screenX ?? Number.NaN);
  const screenY = Number(req.query.screenY ?? Number.NaN);
  const useScreenCoords = Number.isFinite(screenX) && Number.isFinite(screenY);

  const script = `
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeCapture {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);
}
"@

$sourceX = 0
$sourceY = 0
$sourceWidth = 0
$sourceHeight = 0
$cropX = 0
$cropY = 0
$cropWidth = 0
$cropHeight = 0

if (${useScreenCoords ? "$true" : "$false"}) {
  $virtualLeft = [NativeCapture]::GetSystemMetrics(76)
  $virtualTop = [NativeCapture]::GetSystemMetrics(77)
  $virtualWidth = [Math]::Max(1, [NativeCapture]::GetSystemMetrics(78))
  $virtualHeight = [Math]::Max(1, [NativeCapture]::GetSystemMetrics(79))
  $sourceX = $virtualLeft
  $sourceY = $virtualTop
  $sourceWidth = $virtualWidth
  $sourceHeight = $virtualHeight
  $screenCropX = [Math]::Round(${Number.isFinite(screenX) ? screenX : 0})
  $screenCropY = [Math]::Round(${Number.isFinite(screenY) ? screenY : 0})
  $screenCropWidth = [Math]::Max(1, [Math]::Round(${Number.isFinite(width) ? width : 0}))
  $screenCropHeight = [Math]::Max(1, [Math]::Round(${Number.isFinite(height) ? height : 0}))
  $cropX = [Math]::Max(0, [Math]::Min($screenCropX - $virtualLeft, $virtualWidth - 1))
  $cropY = [Math]::Max(0, [Math]::Min($screenCropY - $virtualTop, $virtualHeight - 1))
  $cropWidth = [Math]::Max(1, [Math]::Min($screenCropWidth, $virtualWidth - $cropX))
  $cropHeight = [Math]::Max(1, [Math]::Min($screenCropHeight, $virtualHeight - $cropY))
} else {
  $window = [NativeCapture]::GetForegroundWindow()
  if ($window -eq [IntPtr]::Zero) {
    Write-Error "no_foreground_window"
    exit 1
  }

  $clientRect = New-Object NativeCapture+RECT
  if (-not [NativeCapture]::GetClientRect($window, [ref]$clientRect)) {
    Write-Error "get_client_rect_failed"
    exit 1
  }

  $origin = New-Object NativeCapture+POINT
  $origin.X = 0
  $origin.Y = 0
  if (-not [NativeCapture]::ClientToScreen($window, [ref]$origin)) {
    Write-Error "client_to_screen_failed"
    exit 1
  }

  $sourceX = $origin.X
  $sourceY = $origin.Y
  $sourceWidth = [Math]::Max(1, $clientRect.Right - $clientRect.Left)
  $sourceHeight = [Math]::Max(1, $clientRect.Bottom - $clientRect.Top)
  $cropX = [Math]::Max(0, [Math]::Min(${Number.isFinite(x) ? Math.round(x) : 0}, $sourceWidth - 1))
  $cropY = [Math]::Max(0, [Math]::Min(${Number.isFinite(y) ? Math.round(y) : 0}, $sourceHeight - 1))
  $cropWidth = [Math]::Max(1, [Math]::Min(${Number.isFinite(width) ? Math.round(width) : 0}, $sourceWidth - $cropX))
  $cropHeight = [Math]::Max(1, [Math]::Min(${Number.isFinite(height) ? Math.round(height) : 0}, $sourceHeight - $cropY))
}

$bitmap = New-Object System.Drawing.Bitmap($sourceWidth, $sourceHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($sourceX, $sourceY, 0, 0, $bitmap.Size)

$target = New-Object System.Drawing.Bitmap($cropWidth, $cropHeight)
$targetGraphics = [System.Drawing.Graphics]::FromImage($target)
$targetGraphics.DrawImage(
  $bitmap,
  (New-Object System.Drawing.Rectangle(0, 0, $cropWidth, $cropHeight)),
  (New-Object System.Drawing.Rectangle($cropX, $cropY, $cropWidth, $cropHeight)),
  [System.Drawing.GraphicsUnit]::Pixel
)

$stream = New-Object System.IO.MemoryStream
$target.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)

$targetGraphics.Dispose()
$graphics.Dispose()
$target.Dispose()
$bitmap.Dispose()

[Convert]::ToBase64String($stream.ToArray())
`;

  const child = spawn(
    "powershell",
    ["-NoProfile", "-STA", "-Command", script],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("close", (code) => {
    const base64 = stdout.trim();
    if (code !== 0 || !base64) {
      res.status(500).json({
        ok: false,
        error: stderr.trim() || "capture_active_window_failed",
      });
      return;
    }
    res.json({
      ok: true,
      mimeType: "image/png",
      fileName: `active-window-capture-${Date.now()}.png`,
      base64,
    });
  });
});

app.get("/capture", async (_req, res) => {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Start-Process "ms-screenclip:"
$image = $null
for ($i = 0; $i -lt 80; $i++) {
  Start-Sleep -Milliseconds 500
  if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    break
  }
}
if ($null -eq $image) {
  Write-Output ""
  exit 1
}
$stream = New-Object System.IO.MemoryStream
$image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
[Convert]::ToBase64String($stream.ToArray())
`;

  const child = spawn(
    "powershell",
    ["-NoProfile", "-STA", "-Command", script],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("close", (code) => {
    const base64 = stdout.trim();
    if (code !== 0 || !base64) {
      res.status(500).json({
        ok: false,
        error: stderr.trim() || "capture_failed",
      });
      return;
    }
    res.json({
      ok: true,
      mimeType: "image/png",
      fileName: `system-capture-${Date.now()}.png`,
      base64,
    });
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`local screenshot helper listening on http://127.0.0.1:${PORT}`);
});
