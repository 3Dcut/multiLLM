' LLM MultiChat - Starter
' Ruft Update-Script auf und startet die App

Option Explicit

Dim WshShell, FSO, AppPath
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

AppPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Update-Script ausfuehren (falls vorhanden)
If FSO.FileExists(AppPath & "\update.vbs") Then
    WshShell.Run "wscript """ & AppPath & "\update.vbs""", 1, True
End If

' Pruefen ob Installation erfolgreich
If Not FSO.FileExists(AppPath & "\main.js") Then
    WScript.Quit 0
End If

' App starten
WshShell.CurrentDirectory = AppPath
WshShell.Run "cmd /c npm start", 0, False
