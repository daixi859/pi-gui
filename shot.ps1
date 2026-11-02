# 重新截 docs/screenshots 里的真实引擎截图。用法：powershell -File shot.ps1
$env:PATH = "C:\Users\DELL\AppData\Local\nvm\v24.21.0;$env:PATH"
$root = "D:\workspace\PiGui"
$shots = @(
  @{ file = '01-start.png'; wait = 14; js = '' },
  @{
    file = '02-chat.png'; wait = 16
    js = '(async function(){const w=(ms)=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<40;i++){const el=[...document.querySelectorAll("button,div")].find(e=>e.textContent.trim().startsWith("读取 src/shared/blocks.ts"));if(el){el.click();await w(13000);const b=[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-expanded")!==null&&e.textContent.trim().startsWith("已"));return "ok"}await w(1000)}return "no-row"})()'
  },
  @{
    file = '03-model-menu.png'; wait = 12
    js = '(async function(){const w=(ms)=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<30;i++){const el=[...document.querySelectorAll("button")].find(e=>e.textContent.includes("DeepSeek"));if(el){el.click();await w(1200);return "ok"}await w(800)}return "no-btn"})()'
  },
  @{
    file = '04-collapsed.png'; wait = 12
    js = '(async function(){const w=(ms)=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<30;i++){const el=document.querySelector("[aria-label=\"收起侧栏\"]");if(el){el.click();await w(1200);return "ok"}await w(800)}return "no-btn"})()'
  },
  @{
    file = '10-permission-gate.png'; wait = 14
    js = '(async function(){const w=(ms)=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<30;i++){const ta=document.querySelector("textarea");if(ta){const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;set.call(ta,"用 powershell 执行 echo hello");ta.dispatchEvent(new Event("input",{bubbles:true}));ta.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));await w(9000);return "ok"}await w(800)}return "no-box"})()'
  }
)

foreach ($s in $shots) {
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 500
  Remove-Item "$root\dev.log" -ErrorAction SilentlyContinue
  $env:PI_SHOT = "$root\docs\screenshots\$($s.file)"
  $env:PI_SHOT_AT = '9000'
  $env:PI_SHOT_DELAY = "$($s.wait * 1000)"
  if ($s.js) { $env:PI_SHOT_JS = $s.js } else { Remove-Item Env:\PI_SHOT_JS -ErrorAction SilentlyContinue }
  Start-Process -FilePath "$root\dev.cmd" -WindowStyle Hidden
  Start-Sleep -Seconds ($s.wait + 20)
  "shot $($s.file) -> $(Test-Path "$root\docs\screenshots\$($s.file)")"
}
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item "$root\dev.log" -ErrorAction SilentlyContinue
