' LLM MultiChat - Update Script
' Prueft auf Updates von GitHub

Option Explicit

Dim WshShell, FSO, AppPath, Http, LocalTimestamp, RemoteTimestamp, RemoteCommit, StatusFile
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)
StatusFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-status.txt"

Const GITHUB_API = "https://api.github.com/repos/3Dcut/multiLLM/commits/main"
Const GITHUB_RAW = "https://raw.githubusercontent.com/3Dcut/multiLLM/main"

' --- HTTP Funktionen ---

Function DownloadString(url)
    On Error Resume Next
    Set Http = CreateObject("MSXML2.XMLHTTP")
    Http.Open "GET", url, False
    Http.setRequestHeader "User-Agent", "LLM-MultiChat"
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
    Http.setRequestHeader "User-Agent", "LLM-MultiChat"
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

' --- Status ---

Sub WriteStatus(msg)
    Dim file
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "VERSION:LLM MultiChat"
    file.WriteLine "STATUS:" & msg
    file.Close
End Sub

Sub CloseStatus()
    Dim file
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "CLOSE"
    file.Close
    WScript.Sleep 500
    On Error Resume Next
    FSO.DeleteFile StatusFile
    On Error GoTo 0
End Sub

Sub StartStatusWindow()
    If FSO.FileExists(AppPath & "\status.hta") Then
        WshShell.Run "mshta """ & AppPath & "\status.hta""", 1, False
        WScript.Sleep 500
    End If
End Sub

' --- Version ---

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

Sub SaveUpdateInfo(timestamp, sha)
    Dim file
    Set file = FSO.CreateTextFile(AppPath & "\update-info.txt", True)
    file.WriteLine "TIMESTAMP:" & timestamp
    file.WriteLine "COMMIT:" & sha
    file.Close
End Sub

Function GetGitHubCommitInfo()
    Dim json, regex, matches
    json = DownloadString(GITHUB_API)
    If Len(json) = 0 Then
        GetGitHubCommitInfo = False
        Exit Function
    End If
    
    Set regex = New RegExp
    regex.Pattern = """sha""\s*:\s*""([^""]+)"""
    Set matches = regex.Execute(json)
    If matches.Count > 0 Then RemoteCommit = matches(0).SubMatches(0)
    
    regex.Pattern = """date""\s*:\s*""(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?)"""
    regex.Global = True
    Set matches = regex.Execute(json)
    If matches.Count > 1 Then
        RemoteTimestamp = matches(1).SubMatches(0)
    ElseIf matches.Count > 0 Then
        RemoteTimestamp = matches(0).SubMatches(0)
    End If
    GetGitHubCommitInfo = True
End Function

Function FormatTS(ts)
    If Len(ts) >= 16 Then
        FormatTS = Mid(ts,9,2) & "." & Mid(ts,6,2) & "." & Left(ts,4) & " " & Mid(ts,12,5)
    Else
        FormatTS = ts
    End If
End Function

' --- Download ---

Sub DownloadAllFiles()
    Dim files, f
    files = Array("main.js","renderer.js","preload.js","index.html","styles.css", _
                  "package.json","vote-patterns.js","README.md","status.hta","disclaimer.hta","Uninstall.hta", _
                  "config.json.template","user-settings.json.template","security-report.pdf")
    For Each f In files
        WriteStatus "Lade " & f & "..."
        DownloadFile GITHUB_RAW & "/" & f, AppPath & "\" & f
    Next
End Sub

Sub InitConfigs()
    If Not FSO.FileExists(AppPath & "\config.json") And FSO.FileExists(AppPath & "\config.json.template") Then
        FSO.CopyFile AppPath & "\config.json.template", AppPath & "\config.json"
    End If
    If Not FSO.FileExists(AppPath & "\user-settings.json") And FSO.FileExists(AppPath & "\user-settings.json.template") Then
        FSO.CopyFile AppPath & "\user-settings.json.template", AppPath & "\user-settings.json"
    End If
End Sub

' --- Disclaimer ---

Function HasAccepted()
    HasAccepted = FSO.FileExists(AppPath & "\disclaimer-accepted.txt")
End Function

Function ShowDisclaimer()
    Dim htaPath, resultFile, file, result
    htaPath = AppPath & "\disclaimer.hta"
    resultFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-disclaimer.txt"
    
    On Error Resume Next
    FSO.DeleteFile resultFile
    On Error GoTo 0
    
    If Not FSO.FileExists(htaPath) Then
        result = MsgBox("WARNUNG: 100% KI-generiert, ungeprueft." & vbCrLf & "Fortfahren?", vbYesNo + vbExclamation, "LLM MultiChat")
        If result = vbYes Then
            Set file = FSO.CreateTextFile(AppPath & "\disclaimer-accepted.txt", True)
            file.WriteLine Now()
            file.Close
            ShowDisclaimer = True
        Else
            ShowDisclaimer = False
        End If
        Exit Function
    End If
    
    WshShell.Run "mshta """ & htaPath & """", 1, True
    WScript.Sleep 200
    
    If FSO.FileExists(resultFile) Then
        Set file = FSO.OpenTextFile(resultFile, 1)
        result = Trim(file.ReadLine())
        file.Close
        FSO.DeleteFile resultFile
        If result = "ACCEPTED" Then
            Set file = FSO.CreateTextFile(AppPath & "\disclaimer-accepted.txt", True)
            file.WriteLine Now()
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

Function HasNode()
    On Error Resume Next
    HasNode = (WshShell.Run("cmd /c where node >nul 2>&1", 0, True) = 0)
    On Error GoTo 0
End Function

Sub InstallNode()
    Dim tmp, msi, r
    tmp = WshShell.ExpandEnvironmentStrings("%TEMP%")
    msi = tmp & "\node_setup.msi"
    
    WriteStatus "Node.js Download..."
    r = WshShell.Run("powershell -WindowStyle Hidden -Command ""Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '" & msi & "'""", 0, True)
    
    If r <> 0 Or Not FSO.FileExists(msi) Then
        CloseStatus
        MsgBox "Download fehlgeschlagen!", vbCritical, "Fehler"
        WScript.Quit 1
    End If
    
    WriteStatus "Node.js Installation..."
    WshShell.Run "msiexec /i """ & msi & """ /passive", 1, True
    FSO.DeleteFile msi
    
    WshShell.Environment("PROCESS")("PATH") = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs;" & WshShell.Environment("PROCESS")("PATH")
End Sub

Sub InstallModules()
    WriteStatus "Module installieren (1-2 Min)..."
    WshShell.Run "cmd /c cd /d """ & AppPath & """ && npm install >nul 2>&1", 0, True
End Sub

' --- Main ---

Sub Main()
    Dim isNew, needsUp, r
    
    If Not GetGitHubCommitInfo() Then
        If Not FSO.FileExists(AppPath & "\main.js") Then
            MsgBox "Keine Internetverbindung!", vbCritical, "Fehler"
            WScript.Quit 1
        End If
        Exit Sub
    End If
    
    LocalTimestamp = ReadLocalTimestamp()
    isNew = Not FSO.FileExists(AppPath & "\main.js")
    needsUp = (RemoteTimestamp > LocalTimestamp)
    
    ' Disclaimer laden falls noetig
    If isNew Or (needsUp And Not HasAccepted()) Then
        DownloadFile GITHUB_RAW & "/disclaimer.hta", AppPath & "\disclaimer.hta"
        DownloadFile GITHUB_RAW & "/security-report.pdf", AppPath & "\security-report.pdf"
    End If
    
    If Not HasAccepted() Then
        If Not ShowDisclaimer() Then
            MsgBox "Nutzungsbedingungen nicht akzeptiert.", vbInformation, "LLM MultiChat"
            WScript.Quit 0
        End If
    End If
    
    ' Status-Fenster
    If isNew Or needsUp Then
        DownloadFile GITHUB_RAW & "/status.hta", AppPath & "\status.hta"
        StartStatusWindow
    End If
    
    If isNew Then
        WriteStatus "Erstinstallation..."
        DownloadAllFiles
        InitConfigs
        SaveUpdateInfo RemoteTimestamp, RemoteCommit
    ElseIf needsUp Then
        CloseStatus
        r = MsgBox("Update: " & FormatTS(RemoteTimestamp) & vbCrLf & "Aktuell: " & FormatTS(LocalTimestamp) & vbCrLf & vbCrLf & "Aktualisieren?", vbYesNo, "Update")
        If r = vbYes Then
            StartStatusWindow
            DownloadAllFiles
            SaveUpdateInfo RemoteTimestamp, RemoteCommit
            If FSO.FolderExists(AppPath & "\node_modules") Then
                CloseStatus
                If MsgBox("Module aktualisieren?", vbYesNo, "Update") = vbYes Then
                    StartStatusWindow
                    WriteStatus "Module loeschen..."
                    FSO.DeleteFolder AppPath & "\node_modules", True
                End If
            End If
        End If
    End If
    
    InitConfigs
    
    If Not HasNode() Then
        CloseStatus
        If MsgBox("Node.js installieren?", vbYesNo, "Setup") = vbNo Then
            MsgBox "Bitte manuell: https://nodejs.org/", vbInformation, "Info"
            WScript.Quit 0
        End If
        If Not FSO.FileExists(AppPath & "\status.hta") Then
            DownloadFile GITHUB_RAW & "/status.hta", AppPath & "\status.hta"
        End If
        StartStatusWindow
        InstallNode
        If Not HasNode() Then
            CloseStatus
            MsgBox "Bitte PC neu starten.", vbInformation, "Info"
            WScript.Quit 0
        End If
    End If
    
    If Not FSO.FileExists(AppPath & "\node_modules\.bin\electron.cmd") Then
        If Not FSO.FileExists(AppPath & "\status.hta") Then
            DownloadFile GITHUB_RAW & "/status.hta", AppPath & "\status.hta"
        End If
        StartStatusWindow
        InstallModules
    End If
    
    CloseStatus
End Sub

Main
