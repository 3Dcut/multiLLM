' LLM MultiChat - Update Script
' Prueft auf Updates und kopiert neue Dateien
' Bei Erstinstallation werden alle Dateien vom Server geholt

Option Explicit

Dim WshShell, FSO, AppPath, LocalVersion, RemoteVersion
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' === KONFIGURATION ===
Const UPDATE_SOURCE = "\\acv27.acadon.acadon.de\Ablage\jmi\llm-multichat"
' ======================

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' --- Hilfsfunktionen ---

Function ReadVersionFile(filePath)
    On Error Resume Next
    If FSO.FileExists(filePath) Then
        Dim file
        Set file = FSO.OpenTextFile(filePath, 1)
        ReadVersionFile = Trim(file.ReadLine())
        file.Close
    Else
        ReadVersionFile = "0.0.0"
    End If
    On Error GoTo 0
End Function

Function CompareVersions(v1, v2)
    Dim parts1, parts2, i, p1, p2
    parts1 = Split(v1, ".")
    parts2 = Split(v2, ".")
    
    For i = 0 To 2
        If i <= UBound(parts1) Then p1 = CInt(parts1(i)) Else p1 = 0
        If i <= UBound(parts2) Then p2 = CInt(parts2(i)) Else p2 = 0
        
        If p1 > p2 Then
            CompareVersions = 1
            Exit Function
        ElseIf p1 < p2 Then
            CompareVersions = -1
            Exit Function
        End If
    Next
    
    CompareVersions = 0
End Function

Sub CopyFile(source, dest)
    On Error Resume Next
    If FSO.FileExists(source) Then
        FSO.CopyFile source, dest, True
    End If
    On Error GoTo 0
End Sub

Sub WriteStatus(msg)
    Dim file, StatusFile
    StatusFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\llm-multichat-status.txt"
    Set file = FSO.CreateTextFile(StatusFile, True)
    file.WriteLine "VERSION:" & RemoteVersion
    file.WriteLine "STATUS:" & msg
    file.Close
End Sub

Sub CopyAllFiles()
    Dim filesToCopy, file
    
    filesToCopy = Array( _
        "main.js", _
        "renderer.js", _
        "preload.js", _
        "index.html", _
        "styles.css", _
        "package.json", _
        "README.md", _
        "version.txt", _
        "status.hta", _
        "config.json.template", _
        "user-settings.json.template" _
    )
    
    For Each file In filesToCopy
        CopyFile UPDATE_SOURCE & "\" & file, AppPath & "\" & file
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
    Dim isFirstInstall, response
    
    ' Pruefen ob Update-Quelle erreichbar
    If Not FSO.FolderExists(UPDATE_SOURCE) Then
        ' Server nicht erreichbar - nur bei Erstinstallation Fehler
        If Not FSO.FileExists(AppPath & "\main.js") Then
            MsgBox "Update-Server nicht erreichbar:" & vbCrLf & _
                   UPDATE_SOURCE & vbCrLf & vbCrLf & _
                   "Bitte Netzwerkverbindung pruefen.", vbCritical, "LLM MultiChat"
            WScript.Quit 1
        End If
        Exit Sub
    End If
    
    ' Versionen lesen
    LocalVersion = ReadVersionFile(AppPath & "\version.txt")
    RemoteVersion = ReadVersionFile(UPDATE_SOURCE & "\version.txt")
    
    ' Erstinstallation?
    isFirstInstall = Not FSO.FileExists(AppPath & "\main.js")
    
    If isFirstInstall Then
        WriteStatus "Erstinstallation..."
        CopyAllFiles
        InitializeConfigs
        Exit Sub
    End If
    
    ' Update verfuegbar?
    If CompareVersions(RemoteVersion, LocalVersion) > 0 Then
        response = MsgBox("Update verfuegbar: Version " & RemoteVersion & vbCrLf & _
                          "(Aktuell: " & LocalVersion & ")" & vbCrLf & vbCrLf & _
                          "Jetzt aktualisieren?", _
                          vbYesNo + vbQuestion, "LLM MultiChat Update")
        
        If response = vbYes Then
            WriteStatus "Update wird installiert..."
            CopyAllFiles
            
            MsgBox "Update auf Version " & RemoteVersion & " abgeschlossen!" & vbCrLf & vbCrLf & _
                   "Deine Einstellungen wurden beibehalten.", _
                   vbInformation, "LLM MultiChat Update"
            
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
    
    ' Configs initialisieren (falls Templates aktualisiert wurden)
    InitializeConfigs
End Sub

Main
