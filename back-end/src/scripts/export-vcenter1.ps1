$vCenter = "10.220.220.80"
$username = "adm-hra"
$password = "lmzXVF0195#123"

# Connexion au vCenter
Connect-VIServer `
    -Server $vCenter `
    -User $username `
    -Password $password `
    -Force

# Export des VMs
Get-VM | Select-Object `
    Name,
    @{
        Name = "OS"
        Expression = {
            if ($_.Guest.OSFullName) {
                $_.Guest.OSFullName
            }
            elseif ($_.ExtensionData.Config.GuestFullName) {
                $_.ExtensionData.Config.GuestFullName
            }
            else {
                "UNKNOWN"
            }
        }
    },
    @{
        Name = "CreationDate"
        Expression = {
            if ($_.ExtensionData.Config.CreateDate) {
                $_.ExtensionData.Config.CreateDate
            }
            else {
                "UNKNOWN"
            }
        }
    } |
Export-Csv `
    "D:\newproject\back-end\src\scripts\VM_List_default.csv" `
    -NoTypeInformation `
    -Delimiter ';'

# Déconnexion
Disconnect-VIServer * -Confirm:$false