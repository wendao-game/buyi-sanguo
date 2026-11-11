param([int]$Port = 8731)

# Minimal static file server for local preview (no Node/Python needed).
# Extra: GET /assets/list.json returns the files currently under assets/ (so the game
# only requests art that actually exists).
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"

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
