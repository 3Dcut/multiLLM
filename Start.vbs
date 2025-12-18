' LLM MultiChat - Minimal Starter
' Eine Datei fuer alles: Update, Setup, Start

Option Explicit

Dim WshShell, FSO, AppPath, Http, LocalTimestamp, RemoteTimestamp, RemoteCommit
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' === KONFIGURATION ===
Const GITHUB_API = "https://api.github.com/repos/3Dcut/multiLLM/commits/main"
Const GITHUB_RAW = "https://raw.githubusercontent.com/3Dcut/multiLLM/main"
' ======================

' --- HTTP Funktionen ---

Function DownloadString(url)
    On Error Resume Next
    Set Http = CreateObject("MSXML2.XMLHTTP")
    Http.Open "GET", url, False
    Http.setRequestHeader "User-Agent", "LLM-MultiChat-Updater"
    Http.Send
    If Http.Status = 200 Then
        DownloadString = Http.ResponseText
    Else
        DownloadString = ""
    End If
    Set Http = Nothing
    On Error GoTo 0
End Function

Function DownloadFile(url, destPath)
    On Error Resume Next
    Dim Stream
    Set Http = CreateObject("MSXML2.XMLHTTP")
    Http.Open "GET", url, False
    Http.setRequestHeader "User-Agent", "LLM-MultiChat-Updater"
    Http.Send
    
    If Http.Status = 200 Then
        Set Stream = CreateObject("ADODB.Stream")
        Stream.Open
        Stream.Type = 1
        Stream.Write Http.ResponseBody
        Stream.SaveToFile destPath, 2
        Stream.Close
        Set Stream = Nothing
        DownloadFile = True
    Else
        DownloadFile = False
    End If
    Set Http = Nothing
    On Error GoTo 0
End Function

' --- Version/Update Funktionen ---

Function ReadLocalTimestamp()
    On Error Resume Next
    Dim infoPath, file, line
    infoPath = AppPath & "\update-info.txt"
    ReadLocalTimestamp = ""
    
    If FSO.FileExists(infoPath) Then
        Set file = FSO.OpenTextFile(infoPath, 1)
        Do While Not file.AtEndOfStream
            line = file.ReadLine()
            If Left(line, 10) = "TIMESTAMP:" Then
                ReadLocalTimestamp = Trim(Mid(line, 11))
            End If
        Loop
        file.Close
    End If
    On Error GoTo 0
End Function

Sub SaveUpdateInfo(timestamp, commitSha)
    Dim file
    Set file = FSO.CreateTextFile(AppPath & "\update-info.txt", True)
    file.WriteLine "TIMESTAMP:" & timestamp
    file.WriteLine "COMMIT:" & commitSha
    file.Close
End Sub

Function GetGitHubCommitInfo()
    Dim json, dateMatch, matches
    json = DownloadString(GITHUB_API)
    
    If Len(json) > 0 Then
        ' SHA extrahieren
        Dim regex
        Set regex = New RegExp
        regex.Pattern = """sha""\s*:\s*""([^""]+)"""
        regex.IgnoreCase = True
        Set matches = regex.Execute(json)
        If matches.Count > 0 Then
            RemoteCommit = matches(0).SubMatches(0)
        End If
        
        ' Datum extrahieren
        Set dateMatch = New RegExp
        dateMatch.Pattern = """date""\s*:\s*""(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?)"""
        dateMatch.Global = True
        Set matches = dateMatch.Execute(json)
        If matches.Count > 1 Then
            RemoteTimestamp = matches(1).SubMatches(0)
        ElseIf matches.Count > 0 Then
            RemoteTimestamp = matches(0).SubMatches(0)
        End If
        GetGitHubCommitInfo = True
    Else
        GetGitHubCommitInfo = False
    End If
End Function

Function FormatTimestamp(isoDate)
    If Len(isoDate) >= 16 Then
        FormatTimestamp = Mid(isoDate, 9, 2) & "." & Mid(isoDate, 6, 2) & "." & Left(isoDate, 4) & " " & Mid(isoDate, 12, 5)
    Else
        FormatTimestamp = isoDate
    End If
End Function

' --- Download Funktionen ---

Sub DownloadAllFiles()
    Dim files, file
    files = Array( _
        "main.js", "renderer.js", "preload.js", "index.html", "styles.css", _
        "package.json", "README.md", "status.hta", "disclaimer.hta", "Uninstall.hta", _
        "config.json.template", "user-settings.json.template", "security-report.pdf" _
    )
    
    For Each file In files
        DownloadFile GITHUB_RAW & "/" & file, AppPath & "\" & file
    Next
End Sub

Sub DownloadEssentialFiles()
    ' Nur fuer Disclaimer noetige Dateien
    DownloadFile GITHUB_RAW & "/disclaimer.hta", AppPath & "\disclaimer.hta"
    DownloadFile GITHUB_RAW & "/security-report.pdf", AppPath & "\security-report.pdf"
End Sub

Sub InitializeConfigs()
    If Not FSO.FileExists(AppPath & "\config.json") Then
        If FSO.FileExists(AppPath & "\config.json.template") Then
            FSO.CopyFile AppPath & "\config.json.template", AppPath & "\config.json"
        End If
    End If
    
    If Not FSO.FileExists(AppPath & "\user-settings.json") Then
        If FSO.FileExists(AppPath & "\user-settings.json.template") Then
            FSO.CopyFile AppPath & "\user-settings.json.template", AppPath & "\user-settings.json"
        End If
    End If
End Sub

' --- Disclaimer ---

Function HasAcceptedDisclaimer()
    HasAcceptedDisclaimer = FSO.FileExists(AppPath & "\disclaimer-accepted.txt")
End Function

Function ShowDisclaimer()
    Dim htaPath, resultFile, file, result
    htaPath = AppPath & "\disclaimer.hta"
    resultFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-disclaimer.txt"
    
    On Error Resume Next
    FSO.DeleteFile resultFile
    On Error GoTo 0
    
    If Not FSO.FileExists(htaPath) Then
        result = MsgBox("WARNUNG: Diese Software wurde zu 100% von KI generiert!" & vbCrLf & vbCrLf & _
                        "Der Code ist ungeprueft. Nutzung auf eigene Gefahr." & vbCrLf & vbCrLf & _
                        "Fortfahren?", vbYesNo + vbExclamation, "LLM MultiChat")
        ShowDisclaimer = (result = vbYes)
        Exit Function
    End If
    
    WshShell.Run "mshta """ & htaPath & """", 1, True
    
    If FSO.FileExists(resultFile) Then
        Set file = FSO.OpenTextFile(resultFile, 1)
        result = Trim(file.ReadLine())
        file.Close
        FSO.DeleteFile resultFile
        
        If result = "ACCEPTED" Then
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

' --- Setup ---

Function CommandExists(cmd)
    On Error Resume Next
    Dim result
    result = WshShell.Run("cmd /c where " & cmd & " >nul 2>&1", 0, True)
    CommandExists = (result = 0)
    On Error GoTo 0
End Function

Sub InstallNodeJS()
    Dim TempPath, InstallerPath, DownloadUrl, result
    
    TempPath = WshShell.ExpandEnvironmentStrings("%TEMP%")
    InstallerPath = TempPath & "\node_setup.msi"
    DownloadUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    
    MsgBox "Node.js wird heruntergeladen..." & vbCrLf & "Dies kann einige Minuten dauern.", vbInformation, "LLM MultiChat"
    
    result = WshShell.Run("powershell -WindowStyle Hidden -Command ""[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " & _
                          "Invoke-WebRequest -Uri '" & DownloadUrl & "' -OutFile '" & InstallerPath & "' -UseBasicParsing""", 0, True)
    
    If result <> 0 Or Not FSO.FileExists(InstallerPath) Then
        MsgBox "Download fehlgeschlagen!" & vbCrLf & vbCrLf & "Bitte Node.js manuell installieren: https://nodejs.org/", vbCritical, "Fehler"
        WScript.Quit 1
    End If
    
    MsgBox "Node.js wird installiert...", vbInformation, "LLM MultiChat"
    result = WshShell.Run("msiexec /i """ & InstallerPath & """ /passive", 1, True)
    
    On Error Resume Next
    FSO.DeleteFile InstallerPath
    On Error GoTo 0
    
    If result <> 0 Then
        MsgBox "Installation fehlgeschlagen!", vbCritical, "Fehler"
        WScript.Quit 1
    End If
    
    Dim NodeDir
    NodeDir = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs"
    WshShell.Environment("PROCESS")("PATH") = NodeDir & ";" & WshShell.Environment("PROCESS")("PATH")
End Sub

Sub InstallDependencies()
    MsgBox "Module werden installiert..." & vbCrLf & "Dies kann 1-2 Minuten dauern.", vbInformation, "LLM MultiChat"
    WshShell.Run "cmd /c cd /d """ & AppPath & """ && npm install >nul 2>&1", 0, True
End Sub

' --- Hauptprogramm ---

Sub Main()
    Dim isFirstInstall, needsUpdate, response
    
    ' Verbindung pruefen
    If Not GetGitHubCommitInfo() Then
        If Not FSO.FileExists(AppPath & "\main.js") Then
            MsgBox "Keine Internetverbindung!" & vbCrLf & "Erstinstallation nicht moeglich.", vbCritical, "Fehler"
            WScript.Quit 1
        End If
        ' Offline-Start ohne Update
        WshShell.CurrentDirectory = AppPath
        WshShell.Run "cmd /c npm start", 0, False
        Exit Sub
    End If
    
    LocalTimestamp = ReadLocalTimestamp()
    isFirstInstall = Not FSO.FileExists(AppPath & "\main.js")
    needsUpdate = (RemoteTimestamp > LocalTimestamp)
    
    ' Bei Erstinstallation oder Update: Disclaimer-Dateien zuerst laden
    If isFirstInstall Or (needsUpdate And Not HasAcceptedDisclaimer()) Then
        DownloadEssentialFiles
    End If
    
    ' Disclaimer pruefen
    If Not HasAcceptedDisclaimer() Then
        If Not ShowDisclaimer() Then
            MsgBox "Installation abgebrochen.", vbInformation, "LLM MultiChat"
            WScript.Quit 0
        End If
    End If
    
    ' Erstinstallation
    If isFirstInstall Then
        MsgBox "Erstinstallation wird durchgefuehrt...", vbInformation, "LLM MultiChat"
        DownloadAllFiles
        InitializeConfigs
        SaveUpdateInfo RemoteTimestamp, RemoteCommit
    ' Update
    ElseIf needsUpdate Then
        response = MsgBox("Update verfuegbar!" & vbCrLf & vbCrLf & _
                          "Neu: " & FormatTimestamp(RemoteTimestamp) & vbCrLf & _
                          "Aktuell: " & FormatTimestamp(LocalTimestamp) & vbCrLf & vbCrLf & _
                          "Jetzt aktualisieren?", vbYesNo + vbQuestion, "LLM MultiChat")
        
        If response = vbYes Then
            DownloadAllFiles
            SaveUpdateInfo RemoteTimestamp, RemoteCommit
            MsgBox "Update abgeschlossen!", vbInformation, "LLM MultiChat"
            
            If FSO.FolderExists(AppPath & "\node_modules") Then
                response = MsgBox("Node-Module aktualisieren?", vbYesNo + vbQuestion, "LLM MultiChat")
                If response = vbYes Then
                    On Error Resume Next
                    FSO.DeleteFolder AppPath & "\node_modules", True
                    On Error GoTo 0
                End If
            End If
        End If
    End If
    
    InitializeConfigs
    
    ' Node.js pruefen
    If Not CommandExists("node") Then
        response = MsgBox("Node.js ist nicht installiert." & vbCrLf & vbCrLf & _
                          "Jetzt installieren?", vbYesNo + vbQuestion, "LLM MultiChat")
        If response = vbNo Then
            MsgBox "Bitte Node.js manuell installieren: https://nodejs.org/", vbInformation, "LLM MultiChat"
            WScript.Quit 0
        End If
        InstallNodeJS
        
        If Not CommandExists("node") Then
            MsgBox "Bitte PC neu starten und erneut versuchen.", vbInformation, "LLM MultiChat"
            WScript.Quit 0
        End If
    End If
    
    ' Dependencies pruefen
    If Not FSO.FileExists(AppPath & "\node_modules\.bin\electron.cmd") Then
        InstallDependencies
    End If
    
    ' App starten
    WshShell.CurrentDirectory = AppPath
    WshShell.Run "cmd /c npm start", 0, False
End Sub

Main
