Add-Type -AssemblyName System.Drawing

function Analyze-Image($path) {
  $bmp = New-Object System.Drawing.Bitmap($path)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $bytes = New-Object byte[] ($data.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $bmp.Dispose()

  $step = 6
  $n = 0; $dark = 0; $mid = 0; $light = 0
  $t = @{ canvas = 0; white = 0; accent = 0; truth = 0; conflict = 0; ink = 0 }
  $buckets = @{}
  # 8x4 complexity grid
  $cells = @()
  for ($cy = 0; $cy -lt 4; $cy++) {
    for ($cx = 0; $cx -lt 8; $cx++) {
      $cells += @{ sum = 0.0; sumsq = 0.0; cnt = 0 }
    }
  }

  for ($y = 0; $y -lt $h; $y += $step) {
    $row = $y * $data.Stride
    $cy = [math]::Min(3, [int](($y * 4) / $h))
    for ($x = 0; $x -lt $w; $x += $step) {
      $i = $row + $x * 3
      $b = $bytes[$i]; $g = $bytes[$i + 1]; $r = $bytes[$i + 2]
      $lum = 0.2126 * $r + 0.7152 * $g + 0.0722 * $b
      if ($lum -lt 60) { $dark++ } elseif ($lum -gt 200) { $light++ } else { $mid++ }
      $n++

      if ([math]::Abs($r - 244) -le 6 -and [math]::Abs($g - 244) -le 6 -and [math]::Abs($b - 244) -le 6) { $t.canvas++ }
      elseif ([math]::Abs($r - 255) -le 4 -and [math]::Abs($g - 255) -le 4 -and [math]::Abs($b - 255) -le 4) { $t.white++ }
      elseif ([math]::Abs($r - 61) -le 9 -and [math]::Abs($g - 90) -le 9 -and [math]::Abs($b - 254) -le 9) { $t.accent++ }
      elseif ([math]::Abs($r - 0) -le 9 -and [math]::Abs($g - 48) -le 9 -and [math]::Abs($b - 207) -le 9) { $t.truth++ }
      elseif ([math]::Abs($r - 196) -le 9 -and [math]::Abs($g - 30) -le 9 -and [math]::Abs($b - 30) -le 9) { $t.conflict++ }
      elseif ($lum -lt 30) { $t.ink++ }

      $bk = [string]([int]($r / 32) * 256 + [int]($g / 32) * 16 + [int]($b / 32))
      if ($buckets.ContainsKey($bk)) { $buckets[$bk]++ } else { $buckets[$bk] = 1 }

      $cx = [math]::Min(7, [int](($x * 8) / $w))
      $cell = $cells[$cy * 8 + $cx]
      $cell.sum += $lum; $cell.sumsq += $lum * $lum; $cell.cnt++
    }
  }

  $top = $buckets.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 6 | ForEach-Object {
    $k = [int]$_.Key
    $r2 = [int]([math]::Floor($k / 256)) * 32 + 16
    $g2 = [int]([math]::Floor(($k % 256) / 16)) * 32 + 16
    $b2 = ($k % 16) * 32 + 16
    ("#{0:X2}{1:X2}{2:X2}:{3:P1}" -f $r2, $g2, $b2, ($_.Value / $n))
  }

  $pc = @{}
  foreach ($k in $t.Keys) { $pc[$k] = "{0:P1}" -f ($t[$k] / $n) }

  Write-Output ("FILE {0}  {1}x{2}  saved {3}" -f (Split-Path $path -Leaf), $w, $h, (Get-Item $path).LastWriteTime.ToString('HH:mm:ss'))
  Write-Output ("  light={0:P0} mid={1:P0} dark={2:P0}" -f ($light / $n), ($mid / $n), ($dark / $n))
  Write-Output ("  tokens: canvas={0} white={1} signalBlue={2} truth={3} conflict={4} nearBlack={5}" -f $pc.canvas, $pc.white, $pc.accent, $pc.truth, $pc.conflict, $pc.ink)
  Write-Output ("  dominant: {0}" -f ($top -join '  '))
  Write-Output "  complexity (8x4, stddev of luminance: low=smooth, high=busy):"
  $rows = @()
  for ($cy = 0; $cy -lt 4; $cy++) {
    $line = ''
    for ($cx = 0; $cx -lt 8; $cx++) {
      $c = $cells[$cy * 8 + $cx]
      $mean = $c.sum / $c.cnt
      $sd = [math]::Sqrt([math]::Max(0, ($c.sumsq / $c.cnt) - $mean * $mean))
      $line += ('{0,5:F0} ' -f $sd)
    }
    $rows += $line
  }
  $rows | ForEach-Object { Write-Output ("    " + $_) }
  Write-Output ''
}

foreach ($f in $args) { if (Test-Path $f) { Analyze-Image $f } }
