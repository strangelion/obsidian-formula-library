param([string]$PayloadPath, [switch]$UseCurrentClipboard)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

# Only newly created, unsaved documents in this owned Word instance are touched.
# Payload tests replace the clipboard with test data. Never inspect a user's document.
function ConvertTo-CfHtml([string]$Html) {
    $template = "Version:0.9`r`nStartHTML:{0:D10}`r`nEndHTML:{1:D10}`r`nStartFragment:{2:D10}`r`nEndFragment:{3:D10}`r`n"
    $empty = $template -f 0,0,0,0
    $start = [Text.Encoding]::UTF8.GetByteCount($empty)
    $startMarker = '<!--StartFragment-->'
    $endMarker = '<!--EndFragment-->'
    $begin = $Html.IndexOf($startMarker) + $startMarker.Length
    $end = $Html.IndexOf($endMarker)
    if ($begin -lt $startMarker.Length -or $end -lt $begin) { throw 'Missing fragment markers' }
    $header = $template -f $start,($start + [Text.Encoding]::UTF8.GetByteCount($Html)),
        ($start + [Text.Encoding]::UTF8.GetByteCount($Html.Substring(0,$begin))),
        ($start + [Text.Encoding]::UTF8.GetByteCount($Html.Substring(0,$end)))
    return $header + $Html
}

$word = $null
$document = $null
$ownsWord = $false
try {
    $word = New-Object -ComObject Word.Application
    if ($word.Visible -or $word.Documents.Count -ne 0) { throw 'Refuse to modify an existing Word session' }
    $ownsWord = $true
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    $cases = if ($UseCurrentClipboard) { @(@{ id = 'native-plugin-copy' }) }
        else { @(Get-Content -Raw -LiteralPath $PayloadPath | ConvertFrom-Json) }
    $results = @()
    foreach ($case in $cases) {
        if (!$UseCurrentClipboard) {
            $data = New-Object System.Windows.Forms.DataObject
            $data.SetData([Windows.Forms.DataFormats]::Html, (ConvertTo-CfHtml $case.html))
            $data.SetData([Windows.Forms.DataFormats]::UnicodeText, [string]$case.text)
            [Windows.Forms.Clipboard]::SetDataObject($data, $true)
        }
        $document = $word.Documents.Add()
        $range = $document.Range(0,0)
        $range.Paste()
        $count = $document.OMaths.Count
        $xml = $document.Content.WordOpenXML
        $results += [pscustomobject]@{
            id = $case.id; wordVersion = $word.Version; equationCount = $count
            hasFraction = $xml -match '<m:f[ >]'; hasSuperscript = $xml -match '<m:sSup[ >]'
            hasMatrix = $xml -match '<m:m[ >]'; textLength = $document.Content.Text.Length
        }
        $document.Close(0)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
        $document = $null
    }
    $results | ConvertTo-Json -Depth 5
    if (@($results | Where-Object { $_.equationCount -lt 1 }).Count) { throw 'Paste did not create an editable native Word equation' }
} finally {
    if ($document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
    if ($word) {
        if ($ownsWord) { $saveOption = 0; $word.Quit([ref]$saveOption) }
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
}
