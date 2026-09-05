# Converts a .docx to .pdf using the installed Microsoft Word (COM automation).
# Usage: powershell -File scripts/convert-docx-pdf.ps1 <input.docx> <output.pdf>
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)
$In = (Resolve-Path $In).Path
$Out = [System.IO.Path]::GetFullPath($Out)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open($In, $false, $true)  # ReadOnly
  $wdFormatPDF = 17
  $doc.SaveAs([ref]$Out, [ref]$wdFormatPDF)
  $doc.Close($false)
  Write-Output "PDF written: $Out"
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
