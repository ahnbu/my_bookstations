# prepare-ai-files.ps1

Write-Host '🚀 Preparing files for AI Studio (Flatten mode)...' -ForegroundColor Cyan

# 1. 업로드용 폴더 설정 및 초기화
$uploadDir = 'uploads_for_ai_studio'
if (Test-Path -Path $uploadDir) {
  Remove-Item -Recurse -Force $uploadDir
}
New-Item -ItemType Directory -Name $uploadDir | Out-Null

# 2. 처리할 대상 폴더 및 파일 목록 설정
$targetFolders = @('library-checker/src', 'services', 'stores', 'utils')
$fileCount = 0

# 3. 각 폴더를 순회하며 .ts 파일 처리
foreach ($folder in $targetFolders) {
  if (Test-Path $folder) {
    Get-ChildItem -Path $folder -Filter '*.ts' -Recurse | ForEach-Object {
      $relativePath = $_.FullName.Substring($PWD.Path.Length).TrimStart('\')
      $flatName = $relativePath -replace '[\\/]', '_'
      $destFile = Join-Path $uploadDir ([System.IO.Path]::ChangeExtension($flatName, '.tsx'))
      Copy-Item -Path $_.FullName -Destination $destFile
      $fileCount++
    }
  }
}

# 4. 최상위 types.ts 파일 처리
if (Test-Path 'types.ts') {
  Copy-Item -Path 'types.ts' -Destination (Join-Path $uploadDir 'types.tsx')
  $fileCount++
}

# 5. 최종 결과 출력
Write-Host "✅ Task Complete! Total files copied: $fileCount to '$uploadDir' folder." -ForegroundColor Green