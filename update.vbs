' LLM MultiChat - Update Script
' Prueft auf Updates von GitHub und laedt neue Dateien

Option Explicit

Dim WshShell, FSO, AppPath, LocalVersion, RemoteVersion, Http
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' === KONFIGURATION ===
' GitHub Raw URL (main branch)
Const GITHUB_RAW = "https://raw.githubusercontent.com/3Dcut/multiLLM/main"
' Fallback: Netzlaufwerk (fuer Offline/Firmen-Umgebung)
Const FALLBACK_SOURCE = "\\acv27.acadon.acadon.de\Ablage\jmi\llm-multichat"
' ======================

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' --- HTTP Hilfsfunktionen ---

Function DownloadString(url)
    On Error Resume Next
    Set Http = CreateObject("MSXML2.XMLHTTP")
    Http.Open "GET", url, False
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

' --- Versions-Hilfsfunktionen ---

Function ReadLocalVersion()
    On Error Resume Next
    Dim versionPath, file
    versionPath = AppPath & "\version.txt"
    If FSO.FileExists(versionPath) Then
        Set file = FSO.OpenTextFile(versionPath, 1)
        ReadLocalVersion = Trim(file.ReadLine())
        file.Close
    Else
        ReadLocalVersion = "0"
    End If
    On Error GoTo 0
End Function

Function CompareVersions(v1, v2)
    ' Vergleicht Datums-Versionen (YYYY.MM.DD.N) oder numerisch
    ' Gibt 1 zurueck wenn v1 > v2, -1 wenn v1 < v2, 0 wenn gleich
    Dim clean1, clean2
    clean1 = Replace(v1, ".", "")
    clean2 = Replace(v2, ".", "")
    
    ' Auf gleiche Laenge bringen
    Do While Len(clean1) < Len(clean2)
        clean1 = clean1 & "0"
    Loop
    Do While Len(clean2) < Len(clean1)
        clean2 = clean2 & "0"
    Loop
    
    If clean1 > clean2 Then
        CompareVersions = 1
    ElseIf clean1 < clean2 Then
        CompareVersions = -1
    Else
        CompareVersions = 0
    End If
End Function

' --- Status-Kommunikation ---

Sub WriteStatus(msg)
    Dim file, StatusFile
    StatusFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-status.txt"
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "VERSION:" & LocalVersion
    file.WriteLine "STATUS:" & msg
    file.Close
End Sub

' --- Update-Funktionen ---

Function CheckGitHubConnection()
    Dim testContent
    testContent = DownloadString(GITHUB_RAW & "/version.txt")
    CheckGitHubConnection = (Len(testContent) > 0)
End Function

Function CheckFallbackConnection()
    CheckFallbackConnection = FSO.FolderExists(FALLBACK_SOURCE)
End Function

Sub DownloadAllFiles(useGitHub)
    Dim filesToDownload, file, sourceUrl, destPath
    
    filesToDownload = Array( _
        "main.js", _
        "renderer.js", _
        "preload.js", _
        "index.html", _
        "styles.css", _
        "package.json", _
        "README.md", _
        "version.txt", _
        "status.hta", _
        "update.vbs", _
        "Start.vbs", _
        "config.json.template", _
        "user-settings.json.template" _
    )
    
    For Each file In filesToDownload
        destPath = AppPath & "\" & file
        
        If useGitHub Then
            sourceUrl = GITHUB_RAW & "/" & file
            DownloadFile sourceUrl, destPath
        Else
            ' Fallback: Netzlaufwerk
            On Error Resume Next
            If FSO.FileExists(FALLBACK_SOURCE & "\" & file) Then
                FSO.CopyFile FALLBACK_SOURCE & "\" & file, destPath, True
            End If
            On Error GoTo 0
        End If
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
    Dim isFirstInstall, response, useGitHub, canConnect
    
    LocalVersion = ReadLocalVersion()
    
    ' Verbindung pruefen (GitHub bevorzugt)
    WriteStatus "Pruefe Verbindung..."
    useGitHub = CheckGitHubConnection()
    
    If Not useGitHub Then
        ' Fallback auf Netzlaufwerk
        If Not CheckFallbackConnection() Then
            ' Keine Verbindung - nur bei Erstinstallation Fehler
            If Not FSO.FileExists(AppPath & "\main.js") Then
                MsgBox "Keine Verbindung zu Update-Server!" & vbCrLf & vbCrLf & _
                       "GitHub: " & GITHUB_RAW & vbCrLf & _
                       "Fallback: " & FALLBACK_SOURCE & vbCrLf & vbCrLf & _
                       "Bitte Internetverbindung pruefen.", vbCritical, "LLM MultiChat"
                WScript.Quit 1
            End If
            Exit Sub
        End If
    End If
    
    ' Remote-Version holen
    If useGitHub Then
        RemoteVersion = Trim(DownloadString(GITHUB_RAW & "/version.txt"))
    Else
        On Error Resume Next
        Dim file
        Set file = FSO.OpenTextFile(FALLBACK_SOURCE & "\version.txt", 1)
        RemoteVersion = Trim(file.ReadLine())
        file.Close
        On Error GoTo 0
    End If
    
    ' Erstinstallation?
    isFirstInstall = Not FSO.FileExists(AppPath & "\main.js")
    
    If isFirstInstall Then
        WriteStatus "Erstinstallation von " & IIf(useGitHub, "GitHub", "Netzwerk") & "..."
        DownloadAllFiles useGitHub
        InitializeConfigs
        LocalVersion = RemoteVersion
        Exit Sub
    End If
    
    ' Update verfuegbar?
    If CompareVersions(RemoteVersion, LocalVersion) > 0 Then
        response = MsgBox("Update verfuegbar!" & vbCrLf & vbCrLf & _
                          "Neu: " & RemoteVersion & vbCrLf & _
                          "Aktuell: " & LocalVersion & vbCrLf & vbCrLf & _
                          "Quelle: " & IIf(useGitHub, "GitHub", "Netzwerk") & vbCrLf & vbCrLf & _
                          "Jetzt aktualisieren?", _
                          vbYesNo + vbQuestion, "LLM MultiChat Update")
        
        If response = vbYes Then
            WriteStatus "Update " & RemoteVersion & " wird installiert..."
            DownloadAllFiles useGitHub
            
            MsgBox "Update auf Version " & RemoteVersion & " abgeschlossen!" & vbCrLf & vbCrLf & _
                   "Deine Einstellungen wurden beibehalten.", _
                   vbInformation, "LLM MultiChat"
            
            ' node_modules aktualisieren?
            If FSO.FolderExists(AppPath & "\node_modules") Then
                response = MsgBox("Sollen die Node-Module aktualisiert werden?" & vbCrLf & _
                                  "(Empfohlen nach groesseren Updates)", _
                                  vbYesNo + vbQuestion, "LLM MultiChat Update")
                If response = vbYes Then
                    On Error Resume Next
                    FSO.DeleteFolder AppPath & "\node_modules", True
                    On Error GoTo 0
                End If
            End If
        End If
    End If
    
    ' Configs initialisieren
    InitializeConfigs
End Sub

' IIf Ersatz fuer VBScript
Function IIf(condition, trueVal, falseVal)
    If condition Then
        IIf = trueVal
    Else
        IIf = falseVal
    End If
End Function

Main
