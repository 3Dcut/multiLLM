' LLM MultiChat - All-in-One Starter
' 1. Disclaimer anzeigen (bei Erststart)
' 2. Update pruefen
' 3. Setup pruefen (Node.js, node_modules)
' 4. App starten

Option Explicit

Dim WshShell, FSO, AppPath, Result, StatusFile, DisclaimerResult
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)
StatusFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-status.txt"
DisclaimerResult = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-disclaimer.txt"

' --- Disclaimer-Funktionen ---

Function HasAcceptedDisclaimer()
    ' Prueft ob Disclaimer bereits akzeptiert wurde
    HasAcceptedDisclaimer = FSO.FileExists(AppPath & "\disclaimer-accepted.txt")
End Function

Function ShowDisclaimer()
    Dim htaPath, file, result
    htaPath = AppPath & "\disclaimer.hta"
    
    ' Alte Ergebnis-Datei loeschen
    On Error Resume Next
    FSO.DeleteFile DisclaimerResult
    On Error GoTo 0
    
    If Not FSO.FileExists(htaPath) Then
        ' Fallback wenn HTA fehlt
        result = MsgBox("WARNUNG: Diese Software wurde zu 100% von KI generiert!" & vbCrLf & vbCrLf & _
                        "Der Code ist ungeprüft. Nutzung auf eigene Gefahr." & vbCrLf & vbCrLf & _
                        "Fortfahren?", vbYesNo + vbExclamation, "LLM MultiChat - Disclaimer")
        ShowDisclaimer = (result = vbYes)
        Exit Function
    End If
    
    ' HTA anzeigen und warten
    WshShell.Run "mshta """ & htaPath & """", 1, True
    
    ' Ergebnis lesen
    If FSO.FileExists(DisclaimerResult) Then
        Set file = FSO.OpenTextFile(DisclaimerResult, 1)
        result = Trim(file.ReadLine())
        file.Close
        FSO.DeleteFile DisclaimerResult
        
        If result = "ACCEPTED" Then
            ' Akzeptanz speichern
            Set file = FSO.CreateTextFile(AppPath & "\disclaimer-accepted.txt", True)
            file.WriteLine "Akzeptiert am: " & Now()
            file.Close
            ShowDisclaimer = True
        Else
            ShowDisclaimer = False
        End If
    Else
        ShowDisclaimer = False
    End If
End Function

' --- Status-Funktionen ---

Sub WriteStatus(msg)
    Dim file, version
    version = ReadVersion()
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "VERSION:" & version
    file.WriteLine "STATUS:" & msg
    file.Close
End Sub

Sub CloseStatusWindow()
    Dim file
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "CLOSE"
    file.Close
    WScript.Sleep 500
    On Error Resume Next
    FSO.DeleteFile StatusFile
    On Error GoTo 0
End Sub

Function ReadVersion()
    On Error Resume Next
    Dim infoPath, file, line
    infoPath = AppPath & "\update-info.txt"
    ReadVersion = "Neu"
    
    If FSO.FileExists(infoPath) Then
        Set file = FSO.OpenTextFile(infoPath, 1)
        Do While Not file.AtEndOfStream
            line = file.ReadLine()
            If Left(line, 10) = "TIMESTAMP:" Then
                ReadVersion = Mid(line, 11, 10) ' Nur Datum
            End If
        Loop
        file.Close
    End If
    On Error GoTo 0
End Function

Sub StartStatusWindow()
    Dim htaPath
    htaPath = AppPath & "\status.hta"
    If FSO.FileExists(htaPath) Then
        WshShell.Run "mshta """ & htaPath & """", 1, False
        WScript.Sleep 500
    End If
End Sub

' --- Hilfsfunktionen ---

Function CommandExists(cmd)
    On Error Resume Next
    Result = WshShell.Run("cmd /c where " & cmd & " >nul 2>&1", 0, True)
    CommandExists = (Result = 0)
    On Error GoTo 0
End Function

Function CheckNodeJS()
    CheckNodeJS = CommandExists("node")
End Function

Function CheckNodeModules()
    CheckNodeModules = FSO.FolderExists(AppPath & "\node_modules")
End Function

Function CheckElectron()
    CheckElectron = FSO.FileExists(AppPath & "\node_modules\.bin\electron.cmd")
End Function

' --- Installation ---

Sub InstallNodeJS()
    Dim TempPath, InstallerPath, DownloadUrl
    
    TempPath = WshShell.ExpandEnvironmentStrings("%TEMP%")
    InstallerPath = TempPath & "\node_setup.msi"
    DownloadUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    
    WriteStatus "Node.js wird heruntergeladen..."
    
    Result = WshShell.Run("powershell -WindowStyle Hidden -Command ""[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " & _
                          "Invoke-WebRequest -Uri '" & DownloadUrl & "' -OutFile '" & InstallerPath & "' -UseBasicParsing""", 0, True)
    
    If Result <> 0 Or Not FSO.FileExists(InstallerPath) Then
        CloseStatusWindow
        MsgBox "Download fehlgeschlagen!" & vbCrLf & vbCrLf & _
               "Bitte Node.js manuell installieren:" & vbCrLf & _
               "https://nodejs.org/", vbCritical, "LLM MultiChat - Fehler"
        WScript.Quit 1
    End If
    
    WriteStatus "Node.js wird installiert..."
    
    Result = WshShell.Run("msiexec /i """ & InstallerPath & """ /passive", 1, True)
    
    On Error Resume Next
    FSO.DeleteFile InstallerPath
    On Error GoTo 0
    
    If Result <> 0 Then
        CloseStatusWindow
        MsgBox "Node.js Installation fehlgeschlagen!" & vbCrLf & vbCrLf & _
               "Bitte manuell installieren: https://nodejs.org/", vbCritical, "LLM MultiChat - Fehler"
        WScript.Quit 1
    End If
    
    Dim NodeDir
    NodeDir = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs"
    WshShell.Environment("PROCESS")("PATH") = NodeDir & ";" & WshShell.Environment("PROCESS")("PATH")
End Sub

Sub InstallDependencies()
    WriteStatus "Module werden installiert..."
    
    Result = WshShell.Run("cmd /c cd /d """ & AppPath & """ && npm install >nul 2>&1", 0, True)
    
    If Result <> 0 Then
        CloseStatusWindow
        MsgBox "Installation fehlgeschlagen!" & vbCrLf & vbCrLf & _
               "Bitte manuell versuchen: npm install", vbCritical, "LLM MultiChat - Fehler"
        WScript.Quit 1
    End If
End Sub

' --- Update-Skript ausfuehren ---

Sub RunUpdateCheck()
    Dim updateScript
    updateScript = AppPath & "\update.vbs"
    
    If FSO.FileExists(updateScript) Then
        WriteStatus "Suche nach Updates..."
        WshShell.Run "wscript """ & updateScript & """", 1, True
    End If
End Sub

' --- Hauptprogramm ---

Sub Main()
    Dim NeedNodeJS, NeedModules
    
    ' 0. Disclaimer pruefen (nur beim ersten Start)
    If Not HasAcceptedDisclaimer() Then
        If Not ShowDisclaimer() Then
            MsgBox "Setup abgebrochen." & vbCrLf & vbCrLf & _
                   "Sie haben die Nutzungsbedingungen nicht akzeptiert.", _
                   vbInformation, "LLM MultiChat"
            WScript.Quit 0
        End If
    End If
    
    ' 1. Status-Fenster starten
    StartStatusWindow
    WriteStatus "Initialisiere..."
    
    ' 2. Update-Check ausfuehren
    RunUpdateCheck
    
    ' 3. Setup pruefen
    WriteStatus "Pruefe Installation..."
    NeedNodeJS = Not CheckNodeJS()
    NeedModules = Not CheckNodeModules() Or Not CheckElectron()
    
    ' Node.js installieren falls noetig
    If NeedNodeJS Then
        CloseStatusWindow
        Dim Response
        Response = MsgBox("Node.js ist nicht installiert." & vbCrLf & vbCrLf & _
                          "Soll Node.js jetzt automatisch installiert werden?" & vbCrLf & vbCrLf & _
                          "(Erfordert Internetverbindung, ca. 30 MB Download)", _
                          vbYesNo + vbQuestion, "LLM MultiChat Setup")
        
        If Response = vbNo Then
            MsgBox "Bitte Node.js manuell installieren:" & vbCrLf & _
                   "https://nodejs.org/", vbInformation, "LLM MultiChat"
            WScript.Quit
        End If
        
        StartStatusWindow
        InstallNodeJS
        
        WScript.Sleep 2000
        If Not CheckNodeJS() Then
            CloseStatusWindow
            MsgBox "Node.js wurde installiert, aber der PATH muss aktualisiert werden." & vbCrLf & vbCrLf & _
                   "Bitte PC neu starten und dann erneut starten.", vbInformation, "LLM MultiChat"
            WScript.Quit
        End If
        
        NeedModules = True
    End If
    
    ' Node-Module installieren falls noetig
    If NeedModules Then
        InstallDependencies
        
        If Not CheckElectron() Then
            CloseStatusWindow
            MsgBox "Installation fehlgeschlagen." & vbCrLf & _
                   "Bitte Support kontaktieren.", vbCritical, "LLM MultiChat - Fehler"
            WScript.Quit 1
        End If
    End If
    
    ' 4. App starten
    WriteStatus "Starte LLM MultiChat..."
    WScript.Sleep 500
    CloseStatusWindow
    
    WshShell.CurrentDirectory = AppPath
    WshShell.Run "cmd /c npm start", 0, False
End Sub

Main
