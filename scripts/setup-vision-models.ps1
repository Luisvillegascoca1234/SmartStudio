$ErrorActionPreference = "Stop"

function Get-ModelSha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "")
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

$projectDirectory = Split-Path -Parent $PSScriptRoot
$requirements = Join-Path $projectDirectory "requirements-vision.txt"
& python -m pip install --requirement $requirements
if ($LASTEXITCODE -ne 0) {
  throw "No se pudieron instalar las dependencias locales de visión."
}
$dataDirectory = if ($env:SMARTSTUDIO_DATA_DIR) {
  $env:SMARTSTUDIO_DATA_DIR
} else {
  Join-Path $projectDirectory ".smartstudio-data"
}
$modelDirectory = Join-Path $dataDirectory "models"
New-Item -ItemType Directory -Force -Path $modelDirectory | Out-Null

$models = @(
  @{
    Name = "face_landmarker.task"
    Uri = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    MinimumBytes = 3000000
    Sha256 = "64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF"
  },
  @{
    Name = "selfie_multiclass_256x256.tflite"
    Uri = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite"
    MinimumBytes = 15000000
    Sha256 = "C6748B1253A99067EF71F7E26CA71096CD449BAEFA8F101900EA23016507E0E0"
  },
  @{
    Name = "birefnet-general-lite.onnx"
    Uri = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx"
    MinimumBytes = 224005088
    Sha256 = "5600024376F572A557870A5EB0AFB1E5961636BEF4E1E22132025467D0F03333"
  }
)

foreach ($model in $models) {
  $destination = Join-Path $modelDirectory $model.Name
  $validExistingModel = (Test-Path -LiteralPath $destination) `
    -and (Get-Item -LiteralPath $destination).Length -ge $model.MinimumBytes `
    -and (Get-ModelSha256 $destination) -eq $model.Sha256
  if ($validExistingModel) {
    Write-Host "$($model.Name) ya está disponible."
    continue
  }
  $temporary = "$destination.download"
  Invoke-WebRequest -Uri $model.Uri -OutFile $temporary
  if ((Get-Item -LiteralPath $temporary).Length -lt $model.MinimumBytes) {
    Remove-Item -LiteralPath $temporary -Force
    throw "La descarga de $($model.Name) quedó incompleta."
  }
  if ((Get-ModelSha256 $temporary) -ne $model.Sha256) {
    Remove-Item -LiteralPath $temporary -Force
    throw "La descarga de $($model.Name) no coincide con la versión esperada."
  }
  Move-Item -LiteralPath $temporary -Destination $destination -Force
  Write-Host "$($model.Name) descargado correctamente."
}
