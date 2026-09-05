$ErrorActionPreference = 'Stop'
foreach ($taskName in @('PlayCoffee Local Server', 'PlayCoffee Local Backup')) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Tarea eliminada: $taskName" -ForegroundColor Green
    } else {
        Write-Host "No existe la tarea: $taskName"
    }
}
