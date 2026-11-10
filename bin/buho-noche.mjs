#!/usr/bin/env node
/**
 * buho-noche · CLI de Búho Noche para agentes de IA y personas. Habla con la API local de la app
 * (Documentos\BuhoNoche\api.json trae URL y token). Si la app está cerrada, la abre.
 *
 *   buho-noche estado                       modo, brillo y pantallas (cuáles dejan bajar su luz real)
 *   buho-noche rojo | ambar | normal        cambia el color (rojo usa los valores de noche guardados)
 *   buho-noche mitad                        brillo de imagen y luz de fondo a la mitad
 *   buho-noche brillo <5-100>               brillo de la imagen (todas las pantallas)
 *   buho-noche luz <0-100> [--pantalla id]  luz de fondo real (solo pantallas con DDC/CI)
 *   buho-noche apagar [--espera ms]         apaga las pantallas hasta que se mueva el ratón o una tecla
 *   buho-noche despertar                    las enciende
 *   buho-noche abrir | skill
 *
 * Opciones: --json (salida JSON), --no-launch (no abrir la app si está cerrada).
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const portableDir = existsSync(join(here, '..', 'portable.txt')) ? join(here, '..', 'datos') : null
const docs = join(process.env.USERPROFILE || homedir(), 'Documents')
const dataDir = process.env.BUHO_DATA_DIR || portableDir || join(docs, 'BuhoNoche')

const die = (m, c = 1) => { process.stderr.write(m + '\n'); process.exit(c) }
const pos = [], opt = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const k = a.slice(2)
  if (a.startsWith('--')) { const n = argv[i + 1]; if (['json', 'no-launch'].includes(k) || n === undefined || n.startsWith('--')) opt[k] = true; else opt[k] = argv[++i] }
  else pos.push(a)
}
const [cmd, arg] = pos

const leer = () => { try { return JSON.parse(readFileSync(join(dataDir, 'api.json'), 'utf8')) } catch { return null } }
async function vivo(i) { if (!i) return false; try { return (await fetch(i.url + '/v1/estado', { headers: { authorization: `Bearer ${i.token}` } })).ok } catch { return false } }
function appExe() {
  const l = process.env.LOCALAPPDATA || ''
  return [join(here, '..', 'BuhoNoche.exe'), join(l, 'Programs', 'BuhoNoche', 'BuhoNoche.exe')].find((p) => existsSync(p))
}
async function conectar() {
  let i = leer()
  if (await vivo(i)) return i
  const exe = opt['no-launch'] ? undefined : appExe()
  if (!exe) die('Búho Noche no está abierto. Ábrelo y vuelve a intentarlo.', 2)
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  spawn(exe, ['--oculto'], { detached: true, stdio: 'ignore', env }).unref()
  process.stderr.write('Abriendo Búho Noche…\n')
  for (let k = 0; k < 60; k++) { await new Promise((r) => setTimeout(r, 250)); i = leer(); if (await vivo(i)) return i }
  die('He abierto Búho Noche pero no responde.', 2)
}
let c = null
async function call(path, body) {
  c ??= await conectar()
  const res = await fetch(c.url + path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const d = await res.json()
  if (!res.ok) die(`Error: ${d.error ?? res.status}`)
  return d
}

function ver(s) {
  if (opt.json) return process.stdout.write(JSON.stringify(s, null, 2) + '\n')
  if (s.monitores === undefined) return process.stdout.write(JSON.stringify(s) + '\n')
  const l = [`Modo: ${s.modo} · brillo de imagen ${Math.round(s.brillo)} %${s.apagado ? ' · PANTALLAS APAGADAS' : ''}`, '']
  for (const m of s.monitores) {
    l.push(`  ${m.nombre} (${m.resolucion}) · id ${m.id}`)
    l.push(m.luzReal ? `    luz de fondo ${m.luz} % (de día ${m.luzDia ?? '?'} %, de noche ${m.luzNoche} %)` : '    sin control de luz por cable: solo rojo y brillo de imagen')
  }
  process.stdout.write(l.join('\n') + '\n')
}

const num = (v, a, b, q) => { const n = Number(v); if (!Number.isFinite(n) || n < a || n > b) die(`${q}: un número de ${a} a ${b}`); return n }

switch (cmd) {
  case undefined: case 'estado': ver(await call('/v1/estado')); break
  case 'rojo': ver(await call('/v1/preset/rojo', {})); break
  case 'normal': ver(await call('/v1/preset/normal', {})); break
  case 'mitad': ver(await call('/v1/preset/mitad', {})); break
  case 'ambar': case 'ámbar': ver(await call('/v1/aplicar', { modo: 'ambar' })); break
  case 'brillo': ver(await call('/v1/aplicar', { brillo: num(arg, 5, 100, 'brillo') })); break
  case 'luz': {
    const v = num(arg, 0, 100, 'luz')
    ver(await call('/v1/aplicar', { luz: opt.pantalla ? { [opt.pantalla]: v } : v })); break
  }
  case 'apagar': ver(await call('/v1/apagar', { espera: opt.espera ? Number(opt.espera) : 700 })); break
  case 'despertar': ver(await call('/v1/despertar', {})); break
  case 'abrir': ver(await call('/v1/mostrar', {})); break
  case 'skill': {
    const p = [join(here, 'SKILL.md'), join(here, '..', 'SKILL.md'), join(here, '..', 'skills', 'buho-noche', 'SKILL.md')].find((x) => existsSync(x))
    process.stdout.write(p ? readFileSync(p, 'utf8') : 'No encuentro SKILL.md\n'); break
  }
  default: die(`Orden desconocida: ${cmd}. Usa: estado, rojo, ambar, normal, mitad, brillo, luz, apagar, despertar, abrir, skill`)
}
