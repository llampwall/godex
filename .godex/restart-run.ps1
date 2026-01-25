$log = "P:\software\godex\.godex\restart.log"
$runCmd = "P:\software\godex\.godex\restart-run.cmd"
$repoRoot = "P:\software\godex"
Add-Content -Path $log -Value ("[" + (Get-Date -Format o) + "] ps1 start")
Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "start", "", "/min", $runCmd) -WorkingDirectory $repoRoot -WindowStyle Hidden
Add-Content -Path $log -Value ("[" + (Get-Date -Format o) + "] ps1 launched")
