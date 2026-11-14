param([int]$Port = 8731)

# Minimal static file server for local preview (no Node/Python needed).
# Extra: GET /assets/list.json returns the files currently under assets/ (so the game
# only requests art that actually exists).
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"

# 重写 assets/manifest.js：游戏只加载清单里的图片（发布前也要跑一次，或手动编辑）
$adir0 = Join-Path $root 'assets'
if (Test-Path -LiteralPath $adir0) {
  $imgs = @(Get-ChildItem -LiteralPath $adir0 -Recurse -File | Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp)$' -and $_.FullName -notmatch '[\\/]_sheets[\\/]' } | ForEach-Object {
    "'" + $_.FullName.Substring($adir0.Length + 1).Replace('\', '/').Replace("'", '') + "'"
  })
  $ver = (Get-ChildItem -LiteralPath $adir0 -Recurse -File | Measure-Object -Property LastWriteTime -Maximum).Maximum.ToString('yyyyMMddHHmmss')
  $js = "/* 自动生成（serve.ps1）：已放进 assets/ 的图片清单，游戏只加载这里列出的文件 */`nwindow.ASSET_LIST = [" + ($imgs -join ', ') + "];`nwindow.ASSET_VER = '" + $ver + "';`n"
  [System.IO.File]::WriteAllText((Join-Path $adir0 'manifest.js'), $js, (New-Object System.Text.UTF8Encoding $false))
  Write-Host ("assets/manifest.js: " + $imgs.Count + " images")
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.mp3'  = 'audio/mpeg'
  '.ogg'  = 'audio/ogg'
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      if ($rel -eq 'assets/list.json') {
        $adir = Join-Path $root 'assets'
        $names = @()
        if (Test-Path -LiteralPath $adir) {
          $names = @(Get-ChildItem -LiteralPath $adir -Recurse -File | ForEach-Object {
            '"' + $_.FullName.Substring($adir.Length + 1).Replace('\', '/').Replace('"', '') + '"'
          })
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('[' + ($names -join ',') + ']')
        $ctx.Response.ContentType = $mime['.json']
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } elseif ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] } else { $ctx.Response.ContentType = 'application/octet-stream' }
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
      }
    } catch {
      $ctx.Response.StatusCode = 500
    } finally {
      $ctx.Response.Close()
    }
  }
} finally {
  $listener.Stop()
}
