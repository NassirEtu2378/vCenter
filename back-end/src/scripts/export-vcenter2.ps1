$vCenter = "10.230.230.80"
$username = "adm-hra"
$password = "lmzXVF0195#123"

Connect-VIServer -Server $vCenter -User $username -Password $password -Force

$vms = Get-VM | Select-Object `
    Name,
    @{Name="OS"; Expression={$_.Guest.OSFullName}},
    @{Name="CreationDate"; Expression={
        if ($_.ExtensionData.Config.CreateDate) {
            $_.ExtensionData.Config.CreateDate
        }
        else {
            "UNKNOWN"
        }
    }} |
Export-Csv `
    "D:\newproject\back-end\src\scripts\VM_List_secondary.csv" `
    -NoTypeInformation `
    -Delimiter ';'

Disconnect-VIServer * -Confirm:$false