' LLM MultiChat - Update Script
' Prueft auf Updates von GitHub via Commit-Timestamp

Option Explicit

Dim WshShell, FSO, AppPath, LocalTimestamp, RemoteTimestamp, RemoteCommit, Http
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' === KONFIGURATION ===
' GitHub API fuer letzten Commit
Const GITHUB_API = "https://api.github.com/repos/3Dcut/multiLLM/commits/main"
' GitHub Raw URL fuer Dateien
Const GITHUB_RAW = "https://raw.githubusercontent.com/3Dcut/multiLLM/main"
' ======================

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' --- HTTP Hilfsfunktionen ---

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
        Stream.Type = 1 ' Binary
        Stream.Write Http.ResponseBody
        Stream.SaveToFile destPath, 2 ' Overwrite
        Stream.Close
        Set Stream = Nothing
        DownloadFile = True
    Else
        DownloadFile = False
    End If
    Set Http = Nothing
    On Error GoTo 0
End Function

' --- JSON Parsing (einfach, fuer Commit-Info) ---

Function ExtractJsonValue(json, key)
    Dim regex, matches
    Set regex = New RegExp
    regex.Pattern = """" & key & """\s*:\s*""([^""]+)"""
    regex.IgnoreCase = True
    regex.Global = False
    
    Set matches = regex.Execute(json)
    If matches.Count > 0 Then
        ExtractJsonValue = matches(0).SubMatches(0)
    Else
        ExtractJsonValue = ""
    End If
End Function

' --- Versions-Hilfsfunktionen ---

Function ReadLocalInfo()
    On Error Resume Next
    Dim infoPath, file, line
    infoPath = AppPath & "\update-info.txt"
    
    LocalTimestamp = ""
    
    If FSO.FileExists(infoPath) Then
        Set file = FSO.OpenTextFile(infoPath, 1)
        Do While Not file.AtEndOfStream
            line = file.ReadLine()
            If Left(line, 10) = "TIMESTAMP:" Then
                LocalTimestamp = Trim(Mid(line, 11))
            End If
        Loop
        file.Close
    End If
    On Error GoTo 0
End Function

Sub SaveLocalInfo(timestamp, commitSha)
    Dim file, infoPath
    infoPath = AppPath & "\update-info.txt"
    Set file = FSO.CreateTextFile(infoPath, True)
    file.WriteLine "TIMESTAMP:" & timestamp
    file.WriteLine "COMMIT:" & commitSha
    file.Close
End Sub

Function FormatTimestamp(isoDate)
    On Error Resume Next
    If Len(isoDate) >= 16 Then
        FormatTimestamp = Mid(isoDate, 9, 2) & "." & Mid(isoDate, 6, 2) & "." & _
                          Left(isoDate, 4) & " " & Mid(isoDate, 12, 5)
    Else
        FormatTimestamp = isoDate
    End If
    On Error GoTo 0
End Function

' --- Status-Kommunikation ---

Sub WriteStatus(msg)
    Dim file, StatusFile
    StatusFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-status.txt"
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "VERSION:" & FormatTimestamp(LocalTimestamp)
    file.WriteLine "STATUS:" & msg
    file.Close
End Sub

' --- Update-Funktionen ---

Function GetGitHubCommitInfo()
    Dim json
    json = DownloadString(GITHUB_API)
    
    If Len(json) > 0 Then
        RemoteCommit = ExtractJsonValue(json, "sha")
        Dim dateMatch
        Set dateMatch = New RegExp
        dateMatch.Pattern = """date""\s*:\s*""(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?)"""
        dateMatch.Global = True
        Dim matches
        Set matches = dateMatch.Execute(json)
        If matches.Count > 0 Then
            If matches.Count > 1 Then
                RemoteTimestamp = matches(1).SubMatches(0)
            Else
                RemoteTimestamp = matches(0).SubMatches(0)
            End If
        End If
        GetGitHubCommitInfo = True
    Else
        GetGitHubCommitInfo = False
    End If
End Function

Sub DownloadAllFiles()
    Dim filesToDownload, file, sourceUrl, destPath
    
    filesToDownload = Array( _
        "main.js", _
        "renderer.js", _
        "preload.js", _
        "index.html", _
        "styles.css", _
        "package.json", _
        "README.md", _
        "status.hta", _
        "disclaimer.hta", _
        "Uninstall.hta", _
        "update.vbs", _
        "Start.vbs", _
        "config.json.template", _
        "user-settings.json.template" _
    )
    
    For Each file In filesToDownload
        destPath = AppPath & "\" & file
        sourceUrl = GITHUB_RAW & "/" & file
        DownloadFile sourceUrl, destPath
    Next
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

' --- Hauptprogramm ---

Sub Main()
    Dim isFirstInstall, response, canConnect
    
    ' Lokale Info lesen
    ReadLocalInfo
    
    ' GitHub API pruefen
    WriteStatus "Pruefe GitHub..."
    canConnect = GetGitHubCommitInfo()
    
    If Not canConnect Then
        ' Keine Verbindung - nur bei Erstinstallation Fehler
        If Not FSO.FileExists(AppPath & "\main.js") Then
            MsgBox "Keine Verbindung zu GitHub!" & vbCrLf & vbCrLf & _
                   "Bitte Internetverbindung pruefen.", vbCritical, "LLM MultiChat"
            WScript.Quit 1
        End If
        Exit Sub
    End If
    
    ' Erstinstallation?
    isFirstInstall = Not FSO.FileExists(AppPath & "\main.js")
    
    If isFirstInstall Then
        WriteStatus "Erstinstallation von GitHub..."
        DownloadAllFiles
        InitializeConfigs
        SaveLocalInfo RemoteTimestamp, RemoteCommit
        Exit Sub
    End If
    
    ' Update verfuegbar? (Timestamp vergleichen)
    If RemoteTimestamp > LocalTimestamp Then
        response = MsgBox("Update verfuegbar!" & vbCrLf & vbCrLf & _
                          "Neu: " & FormatTimestamp(RemoteTimestamp) & vbCrLf & _
                          "Aktuell: " & FormatTimestamp(LocalTimestamp) & vbCrLf & vbCrLf & _
                          "Jetzt aktualisieren?", _
                          vbYesNo + vbQuestion, "LLM MultiChat Update")
        
        If response = vbYes Then
            WriteStatus "Update wird installiert..."
            DownloadAllFiles
            SaveLocalInfo RemoteTimestamp, RemoteCommit
            
            MsgBox "Update abgeschlossen!" & vbCrLf & vbCrLf & _
                   "Stand: " & FormatTimestamp(RemoteTimestamp) & vbCrLf & vbCrLf & _
                   "Deine Einstellungen wurden beibehalten.", _
                   vbInformation, "LLM MultiChat"
            
            If FSO.FolderExists(AppPath & "\node_modules") Then
                response = MsgBox("Node-Module aktualisieren?" & vbCrLf & _
                                  "(Empfohlen nach groesseren Updates)", _
                                  vbYesNo + vbQuestion, "LLM MultiChat")
                If response = vbYes Then
                    On Error Resume Next
                    FSO.DeleteFolder AppPath & "\node_modules", True
                    On Error GoTo 0
                End If
            End If
        End If
    End If
    
    InitializeConfigs
End Sub

Main
