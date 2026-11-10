// Ventana de Búho Noche. Los deslizadores aplican al momento; en rojo o ámbar, lo que ajustes queda
// como valor de noche para la próxima vez que pulses «Rojo».
const $ = (id) => document.getElementById(id)
let s = null
let arrastrando = null

function limitar(f, ms) {
  let t = 0, ultimo = null, timer = null
  return (...a) => {
    ultimo = a
    const ahora = Date.now()
    if (ahora - t >= ms) { t = ahora; f(...a) }
    else { clearTimeout(timer); timer = setTimeout(() => { t = Date.now(); f(...ultimo) }, ms - (ahora - t)) }
  }
}

function pintar(n) {
  s = n
  document.querySelectorAll('.modo').forEach((b) => b.classList.toggle('on', b.dataset.m === s.modo))
  if (arrastrando !== 'brillo') $('brillo').value = s.brillo
  $('vBrillo').textContent = `${Math.round(s.brillo)} %`
  $('est').textContent = s.apagado ? 'pantallas apagadas' : s.modo === 'normal' && s.brillo >= 100 ? 'de día' : 'modo noche'

  const cont = $('luces')
  const ids = s.monitores.map((m) => m.id).join('|')
  if (cont.dataset.ids !== ids) {
    cont.dataset.ids = ids
    cont.innerHTML = ''
    for (const m of s.monitores) {
      const sec = document.createElement('section')
      if (m.luzReal) {
        sec.innerHTML = `<div class="fila"><b>Luz de fondo · ${m.nombre}</b><span class="v"></span></div>
          <input type="range" min="0" max="100" step="1">
          <div class="nota">Baja la luz de verdad de esta pantalla.</div>`
        const r = sec.querySelector('input')
        const enviar = limitar((v) => window.noche.estado({ luz: { [m.id]: v } }), 120)
        r.addEventListener('input', () => {
          arrastrando = m.id
          sec.querySelector('.v').textContent = `${r.value} %`
          enviar(Number(r.value))
          if (s.modo !== 'normal') window.noche.luzNoche(m.id, Number(r.value))
        })
        r.addEventListener('change', () => { arrastrando = null })
      } else {
        sec.innerHTML = `<div class="fila"><b>${m.nombre}</b><span>solo imagen</span></div>
          <div class="nota">Esta pantalla no deja bajar su luz desde el PC: aquí funcionan el rojo y el brillo de la imagen.</div>`
      }
      sec.dataset.id = m.id
      cont.appendChild(sec)
    }
  }
  for (const m of s.monitores) {
    const sec = cont.querySelector(`section[data-id="${CSS.escape(m.id)}"]`)
    const r = sec && sec.querySelector('input')
    if (r && arrastrando !== m.id && m.luz != null) { r.value = m.luz; sec.querySelector('.v').textContent = `${m.luz} %` }
  }
}

document.querySelectorAll('.modo').forEach((b) => b.addEventListener('click', async () => {
  const m = b.dataset.m
  pintar(await (m === 'rojo' ? window.noche.preset('rojo') : m === 'normal' ? window.noche.preset('normal') : window.noche.estado({ modo: m })))
}))

const enviarBrillo = limitar((v) => window.noche.estado({ brillo: v }), 60)
$('brillo').addEventListener('input', (e) => {
  arrastrando = 'brillo'
  const v = Number(e.target.value)
  $('vBrillo').textContent = `${v} %`
  enviarBrillo(v)
  if (s && s.modo !== 'normal') window.noche.rojoBrillo(v)
})
$('brillo').addEventListener('change', () => { arrastrando = null })
$('mitad').addEventListener('click', async () => pintar(await window.noche.preset('mitad')))
$('apagar').addEventListener('click', () => window.noche.apagar())

window.noche.alCambiar(pintar)
window.noche.foto().then(pintar)
