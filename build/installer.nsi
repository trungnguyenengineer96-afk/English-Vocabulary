; Vocab Quest Windows installer (NSIS 3, Modern UI 2).
; Built by scripts/build-win.mjs from release/win-unpacked; no Wine required.
; Expects: -DVERSION=x.y.z -DSRC_DIR=<win-unpacked> -DOUT_FILE=<setup.exe> -DICON=<icon.ico>

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!define APP_NAME "Vocab Quest"
!define APP_EXE "Vocab Quest.exe"
!define APP_ID "com.vocabquest.app"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
BrandingText "${APP_NAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1033 "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "CompanyName" "${APP_NAME}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "${APP_NAME}"

!include "MUI2.nsh"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Vietnamese"
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

Section "Install"
  SetShellVarContext current
  ; Replace the program files from any previous version (user progress lives in AppData and is kept).
  RMDir /r "$INSTDIR\resources"
  SetOutPath "$INSTDIR"
  File /r "${SRC_DIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall ${APP_NAME}.exe"

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall ${APP_NAME}.exe"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall ${APP_NAME}.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP_ID}"
  ; Learning progress in %APPDATA%\Vocab Quest is intentionally kept.
SectionEnd
