/** Compila motor/BuhoNoche.cs con el csc.exe de .NET Framework 4.x que trae Windows (no hace falta instalar nada).
 *  Salida: resources/bin/buho-noche-motor.exe */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'motor', 'BuhoNoche.cs')
const out = join(root, 'resources', 'bin', 'buho-noche-motor.exe')
const csc = join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

if (existsSync(out) && statSync(out).mtimeMs > statSync(src).mtimeMs && !process.argv.includes('--force')) {
  console.log('buho-noche-motor.exe al día')
} else {
  if (!existsSync(csc)) throw new Error(`No encuentro el compilador de C# de Windows en ${csc}`)
  mkdirSync(dirname(out), { recursive: true })
  execFileSync(csc, ['-nologo', '-optimize+', '-platform:x64', '-target:winexe', `-out:${out}`, src], { stdio: 'inherit' })
  console.log(`Compilado ${out}`)
}
