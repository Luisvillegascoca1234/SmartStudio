$ErrorActionPreference = "Stop"

try {
    $photoshop = New-Object -ComObject Photoshop.Application
    $information = [string]$photoshop.SystemInformation
    $gpuName = if ($information -match '(?m)^GPUName:\s+(.+)$') { $Matches[1].Trim() } else { $null }
    $enabled = (
        $information -match '(?m)^useGPU:\s+1\s*$' -and
        $information -match '(?m)^isGPUCapable:\s+1\s*$' -and
        $information -match '(?m)^isGPUAllowed:\s+1\s*$' -and
        $information -match '(?m)^UseGraphicsProcessorChecked:\s+1\s*$'
    )
    [pscustomobject]@{
        available = $true
        enabled = $enabled
        device = $gpuName
        error = $null
    } | ConvertTo-Json -Compress
}
catch {
    [pscustomobject]@{
        available = $false
        enabled = $false
        device = $null
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
}
