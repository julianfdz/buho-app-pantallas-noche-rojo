// Búho Noche · proceso principal. Vive junto al reloj (bandeja), habla con el motor nativo
// (resources/bin/buho-noche-motor.exe) y expone una API local para el CLI buho-noche.
// Nada queda fijo en el sistema: al cerrar la app el filtro desaparece y las pantallas vuelven a su brillo de día.
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, screen } = require('electron')
const { spawn } = require('node:child_process')
const { createInterface } = require('node:readline')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { randomBytes } = require('node:crypto')
const http = require('node:http')
const { join } = require('node:path')

const PUERTO = 47364
const portable = existsSync(join(process.execPath, '..', 'portable.txt'))
// Datos en Documentos (no en AppData: lo que se abre desde Claude escribe AppData en otra carpeta).
const DATOS = process.env.BUHO_DATA_DIR || (portable ? join(process.execPath, '..', 'datos') : join(app.getPath('documents'), 'BuhoNoche'))
mkdirSync(DATOS, { recursive: true })
const F_AJUSTES = join(DATOS, 'ajustes.json')
const F_API = join(DATOS, 'api.json')

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }

// ---------- Ajustes ----------
const AJUSTES_BASE = {
  modo: 'normal', // normal | rojo | ambar
  brillo: 100, // atenuación por software, 5-100 (todas las pantallas)
  rojoBrillo: 60, // brillo que se aplica al activar el rojo
  luzNoche: {}, // por monitor (id): luz de fondo real por DDC/CI al activar el rojo o la mitad
  luzDia: {}, // por monitor (id): luz de fondo de día, para volver a ella
  luzActual: {},
  atajos: true
}
let ajustes = { ...AJUSTES_BASE }
try { ajustes = { ...AJUSTES_BASE, ...JSON.parse(readFileSync(F_AJUSTES, 'utf8')) } } catch {}
const guardar = () => { try { writeFileSync(F_AJUSTES, JSON.stringify(ajustes, null, 2)) } catch {} }

// ---------- Motor nativo ----------
const motorExe = app.isPackaged ? join(process.resourcesPath, 'bin', 'buho-noche-motor.exe') : join(__dirname, '..', 'resources', 'bin', 'buho-noche-motor.exe')
let motor = null
let monitores = []
let apagado = false
const pendientes = []

function arrancarMotor() {
  motor = spawn(motorExe, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
  createInterface({ input: motor.stdout }).on('line', (l) => {
    let m
    try { m = JSON.parse(l) } catch { return }
    if (m.event === 'listo') { monitores = m.monitores; alArrancar(); return }
    if (m.event === 'apagado') { apagado = true; avisar(); return }
    if (m.event === 'despierto') { apagado = false; avisar(); return }
    const p = pendientes.shift()
    if (p) p(m)
  })
  motor.on('exit', () => {
    motor = null
    pendientes.splice(0).forEach((p) => p({ ok: false, error: 'motor cerrado' }))
    if (!saliendo) setTimeout(arrancarMotor, 1000)
  })
}
function orden(linea) {
  return new Promise((res) => {
    if (!motor) return res({ ok: false, error: 'motor no disponible' })
    pendientes.push(res)
    motor.stdin.write(linea + '\n')
  })
}

const idMon = (m) => (m.id || m.dev || String(m.n)).replace(/#\{.*$/, '')
const conDdc = () => monitores.filter((m) => m.ddc)

// ---------- Acciones ----------
async function aplicarColor() {
  const brillo = Math.max(5, Math.min(100, Math.round(ajustes.brillo)))
  await orden(`color ${ajustes.modo} ${brillo}`)
}

async function ponerLuz(id, valor) {
  const m = monitores.find((x) => idMon(x) === id)
  if (!m || !m.ddc) return false
  const v = Math.max(0, Math.min(m.brilloMax || 100, Math.round(valor)))
  const r = await orden(`ddc ${m.n} 10 ${v}`)
  if (r.ok) { m.brillo = v; ajustes.luzActual[id] = v }
  return r.ok
}

// Guarda la luz de día de cada pantalla la primera vez que se sale del modo normal.
function recordarDia() {
  for (const m of conDdc()) {
    const id = idMon(m)
    const enNoche = ajustes.modo !== 'normal' || ajustes.brillo < 100
    if (!enNoche && m.brillo >= 0) ajustes.luzDia[id] = m.brillo
    if (ajustes.luzDia[id] == null && m.brillo >= 0) ajustes.luzDia[id] = m.brillo
  }
}

async function estado(cambios = {}) {
  recordarDia()
  if (cambios.modo) ajustes.modo = cambios.modo
  if (cambios.brillo != null) ajustes.brillo = Number(cambios.brillo)
  await aplicarColor()
  if (cambios.luz) for (const [id, v] of Object.entries(cambios.luz)) await ponerLuz(id, v)
  guardar()
  avisar()
  return foto()
}

const PRESETS = {
  async rojo() {
    recordarDia()
    const luz = {}
    for (const m of conDdc()) luz[idMon(m)] = ajustes.luzNoche[idMon(m)] ?? 0
    return estado({ modo: 'rojo', brillo: ajustes.rojoBrillo, luz })
  },
  async mitad() {
    recordarDia()
    const luz = {}
    for (const m of conDdc()) luz[idMon(m)] = Math.round((ajustes.luzDia[idMon(m)] ?? 100) / 2)
    return estado({ brillo: 50, luz })
  },
  async normal() {
    const luz = {}
    for (const m of conDdc()) luz[idMon(m)] = ajustes.luzDia[idMon(m)] ?? 100
    return estado({ modo: 'normal', brillo: 100, luz })
  },
  async alternar() {
    return ajustes.modo === 'normal' ? PRESETS.rojo() : PRESETS.normal()
  }
}

async function apagar(espera = 700) {
  const r = await orden(`apagar ${Math.max(0, Math.round(espera))}`)
  return { ok: r.ok }
}
async function despertar() { const r = await orden('despertar'); return { ok: r.ok } }

function foto() {
  return {
    modo: ajustes.modo,
    brillo: ajustes.brillo,
    rojoBrillo: ajustes.rojoBrillo,
    apagado,
    monitores: monitores.map((m) => ({
      id: idMon(m),
      nombre: nombreBonito(m),
      principal: m.principal,
      resolucion: `${m.ancho}×${m.alto}`,
      luzReal: m.ddc,
      apagable: m.apagable,
      luz: m.ddc ? m.brillo : null,
      luzDia: ajustes.luzDia[idMon(m)] ?? null,
      luzNoche: ajustes.luzNoche[idMon(m)] ?? 0
    }))
  }
}

// El nombre de Windows es «Generic PnP Monitor»: se saca el fabricante del id (GSM = LG, CVT = tele con placa CVTE…).
const FABRICANTES = { GSM: 'LG', SAM: 'Samsung', DEL: 'Dell', ACI: 'ASUS', AUS: 'ASUS', BNQ: 'BenQ', PHL: 'Philips', AOC: 'AOC', HWP: 'HP', LEN: 'Lenovo', MSI: 'MSI', GBT: 'Gigabyte', SNY: 'Sony', CVT: 'Tele (CVTE)', HIS: 'Hisense', TCL: 'TCL', XMI: 'Xiaomi', ACR: 'Acer', VSC: 'ViewSonic', IVM: 'iiyama' }
function nombreBonito(m) {
  const cod = /DISPLAY#([A-Z]{3})([0-9A-F]{4})/i.exec(m.id || '')
  const fab = cod ? FABRICANTES[cod[1].toUpperCase()] || cod[1].toUpperCase() : 'Pantalla'
  const nombre = m.nombre && !/generic/i.test(m.nombre) ? m.nombre : fab
  return `${nombre}${m.principal ? ' · principal' : ''}`
}

// ---------- Ventana y bandeja ----------
let win = null
let tray = null
let saliendo = false
const iconoApp = nativeImage.createFromPath(join(__dirname, '..', 'build', 'icon.png'))

function crearVentana() {
  win = new BrowserWindow({
    width: 400, height: 640, show: false, resizable: false, maximizable: false, fullscreenable: false,
    title: 'Búho Noche', icon: iconoApp, backgroundColor: '#07080c', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  })
  win.setMenu(null)
  win.loadFile(join(__dirname, 'ui', 'index.html'))
  win.on('close', (e) => { if (!saliendo) { e.preventDefault(); win.hide() } })
}
function mostrar() {
  if (!win) crearVentana()
  // Junto al reloj de la pantalla principal.
  const area = screen.getPrimaryDisplay().workArea
  const [w, h] = win.getSize()
  win.setPosition(area.x + area.width - w - 12, area.y + area.height - h - 12)
  win.show(); win.focus()
}

function menuBandeja() {
  return Menu.buildFromTemplate([
    { label: 'Rojo noche', type: 'radio', checked: ajustes.modo === 'rojo', click: () => PRESETS.rojo() },
    { label: 'Ámbar', type: 'radio', checked: ajustes.modo === 'ambar', click: () => estado({ modo: 'ambar' }) },
    { label: 'Normal', type: 'radio', checked: ajustes.modo === 'normal', click: () => PRESETS.normal() },
    { type: 'separator' },
    { label: 'Brillo a la mitad', click: () => PRESETS.mitad() },
    { label: 'Apagar pantallas hasta mover el ratón', click: () => apagar(900) },
    { type: 'separator' },
    { label: 'Abrir Búho Noche', click: mostrar },
    { label: 'Abrir con Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { label: 'Salir (vuelve todo a normal)', click: salir }
  ])
}

function avisar() {
  if (tray) {
    tray.setContextMenu(menuBandeja())
    tray.setToolTip(`Búho Noche · ${ajustes.modo === 'normal' ? 'normal' : ajustes.modo} · ${Math.round(ajustes.brillo)} %${apagado ? ' · pantallas apagadas' : ''}`)
  }
  if (win && !win.isDestroyed()) win.webContents.send('estado', foto())
}

function registrarAtajos() {
  globalShortcut.unregisterAll()
  if (!ajustes.atajos) return
  const atajo = (k, f) => { try { globalShortcut.register(k, f) } catch {} }
  atajo('Control+Alt+R', () => PRESETS.alternar())
  atajo('Control+Alt+M', () => PRESETS.mitad())
  atajo('Control+Alt+N', () => PRESETS.normal())
  atajo('Control+Alt+A', () => apagar(900))
  atajo('Control+Alt+Up', () => estado({ brillo: Math.min(100, ajustes.brillo + 10) }))
  atajo('Control+Alt+Down', () => estado({ brillo: Math.max(5, ajustes.brillo - 10) }))
}

// ---------- IPC (ventana) ----------
ipcMain.handle('foto', () => foto())
ipcMain.handle('estado', (_e, c) => estado(c))
ipcMain.handle('preset', (_e, n) => (PRESETS[n] ? PRESETS[n]() : foto()))
ipcMain.handle('apagar', () => apagar(900))
ipcMain.handle('luzNoche', (_e, id, v) => { ajustes.luzNoche[id] = Number(v); guardar(); return foto() })
ipcMain.handle('rojoBrillo', (_e, v) => { ajustes.rojoBrillo = Number(v); guardar(); return foto() })
ipcMain.handle('refrescar', async () => { const r = await orden('monitores'); if (r.ok) monitores = r.monitores; return foto() })

// ---------- API local (CLI buho-noche) ----------
const TOKEN = randomBytes(18).toString('hex')
function api() {
  const srv = http.createServer(async (req, res) => {
    const enviar = (code, o) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)) }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return enviar(401, { error: 'token' })
    let cuerpo = ''
    req.on('data', (c) => (cuerpo += c))
    req.on('end', async () => {
      let b = {}
      try { b = cuerpo ? JSON.parse(cuerpo) : {} } catch { return enviar(400, { error: 'JSON no válido' }) }
      try {
        const u = new URL(req.url, 'http://x').pathname
        if (u === '/v1/estado') return enviar(200, foto())
        if (u === '/v1/aplicar') {
          if (b.modo && !['normal', 'rojo', 'ambar'].includes(b.modo)) return enviar(400, { error: 'modo: normal, rojo o ambar' })
          let luz
          if (b.luz != null) {
            luz = {}
            const lista = typeof b.luz === 'object' ? b.luz : Object.fromEntries(conDdc().map((m) => [idMon(m), b.luz]))
            for (const [k, v] of Object.entries(lista)) {
              const m = monitores.find((x) => idMon(x) === k || String(x.n) === k)
              if (m) luz[idMon(m)] = v
            }
          }
          return enviar(200, await estado({ modo: b.modo, brillo: b.brillo, luz }))
        }
        if (u.startsWith('/v1/preset/')) {
          const n = u.slice(11)
          if (!PRESETS[n]) return enviar(404, { error: 'preset: rojo, mitad, normal o alternar' })
          return enviar(200, await PRESETS[n]())
        }
        if (u === '/v1/apagar') return enviar(200, await apagar(b.espera ?? 700))
        if (u === '/v1/despertar') return enviar(200, await despertar())
        if (u === '/v1/mostrar') { mostrar(); return enviar(200, { ok: true }) }
        enviar(404, { error: 'ruta desconocida' })
      } catch (e) { enviar(500, { error: String(e.message || e) }) }
    })
  })
  srv.listen(PUERTO, '127.0.0.1', () => writeFileSync(F_API, JSON.stringify({ url: `http://127.0.0.1:${PUERTO}`, token: TOKEN, pid: process.pid })))
  srv.on('error', () => {})
}

// ---------- Ciclo de vida ----------
let arrancado = false
async function alArrancar() {
  if (arrancado) { await aplicarColor(); return } // el motor se reinició: reponer el filtro
  arrancado = true
  recordarDia()
  // Al abrir la app se empieza en normal, recordando los valores de la noche para el próximo «Rojo».
  ajustes.modo = 'normal'; ajustes.brillo = 100
  guardar()
  avisar()
}

async function salir() {
  saliendo = true
  try {
    for (const m of conDdc()) { const dia = ajustes.luzDia[idMon(m)]; if (dia != null) await ponerLuz(idMon(m), dia) }
    ajustes.modo = 'normal'; ajustes.brillo = 100; guardar()
    await Promise.race([orden('salir'), new Promise((r) => setTimeout(r, 1500))])
  } catch {}
  app.quit()
}

app.on('second-instance', mostrar)
app.on('window-all-closed', (e) => e.preventDefault())
app.on('will-quit', () => globalShortcut.unregisterAll())

app.whenReady().then(() => {
  app.setAppUserModelId('es.buhoai.noche')
  arrancarMotor()
  tray = new Tray(iconoApp.resize({ width: 16, height: 16 }))
  tray.on('click', mostrar)
  avisar()
  registrarAtajos()
  api()
  crearVentana()
  if (!process.argv.includes('--oculto')) win.once('ready-to-show', mostrar)
})
