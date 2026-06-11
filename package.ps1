# 读取版本号（与原脚本一致）
$version = Select-String -Path "mod.hjson" -Pattern "^version:" | ForEach-Object { $_.Line -replace "version:", "" -replace "\s", "" }
$scriptDir = $PSScriptRoot   # 脚本所在的绝对路径
if (-not $scriptDir) { $scriptDir = Get-Location }  # 兼容 ISE

$zipFileName = Join-Path $scriptDir "super-cheat-v$version.zip"

# 要打包的内容（文件或目录名，相对于当前目录）
$itemsToZip = @("README.md", "preview.png", "icon.png", "LICENSE", "mod.hjson", "bundles", "content", "scripts", "sounds", "sprites")

# 删除已存在的 zip 文件（避免冲突）
if (Test-Path $zipFileName) { Remove-Item $zipFileName -Force }

# 加载必要程序集
Add-Type -AssemblyName System.IO.Compression.FileSystem

# 创建 zip 文件流
$zipStream = [System.IO.File]::OpenWrite($zipFileName)
$zipArchive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    foreach ($item in $itemsToZip) {
        $resolvedItem = Resolve-Path $item -ErrorAction SilentlyContinue
        if (-not $resolvedItem) {
            Write-Warning "未找到: $item"
            continue
        }
        $fullPath = $resolvedItem.Path
        $isDir = Test-Path $fullPath -PathType Container

        if ($isDir) {
            # 递归添加目录下所有文件
            Get-ChildItem -Path $fullPath -Recurse -File | ForEach-Object {
                $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
                # 关键：将 Windows 反斜杠替换为正斜杠
                $entryName = $relativePath -replace '\\', '/'
                # 创建条目并复制文件
                $entry = $zipArchive.CreateEntry($entryName)
                # 设置 Unix 权限（可选，帮助 Java 程序）
                # 注意：ZipArchiveEntry 没有直接设置权限的方法，但可扩展。此处仅确保路径正确。
                $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $_.FullName, $entryName)
            }
        } else {
            # 处理单个文件
            $relativePath = $fullPath.Substring((Get-Location).Path.Length + 1)
            $entryName = $relativePath -replace '\\', '/'
            $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $fullPath, $entryName)
        }
    }
} finally {
    $zipArchive.Dispose()
    $zipStream.Dispose()
}

Write-Host "已生成: $zipFileName"
