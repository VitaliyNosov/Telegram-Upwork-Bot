Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\user\Desktop\Telegram-Upwork-Bot\webapp\logo.png"
$bmp = New-Object System.Drawing.Bitmap($srcPath)
$newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)

for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $c = $bmp.GetPixel($x, $y)
        # If pixel is non-transparent and dark/black (the 'work' letters)
        if ($c.A -gt 30 -and $c.R -lt 100 -and $c.G -lt 100 -and $c.B -lt 100) {
            $newColor = [System.Drawing.Color]::FromArgb($c.A, 255, 255, 255)
            $newBmp.SetPixel($x, $y, $newColor)
        } else {
            $newBmp.SetPixel($x, $y, $c)
        }
    }
}

$newBmp.Save("c:\Users\user\Desktop\Telegram-Upwork-Bot\webapp\logo-dark.png", [System.Drawing.Imaging.ImageFormat]::Png)
$newBmp.Save("c:\Users\user\Desktop\Telegram-Upwork-Bot\docs\logo-dark.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$newBmp.Dispose()
Write-Host "Dark logos created successfully."
