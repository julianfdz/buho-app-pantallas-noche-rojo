# Búho Noche · pantallas en rojo para dormir

App de Windows de Búho AI para dormir con el PC encendido sin que molesten las pantallas.
Vive junto al reloj (bandeja del sistema) y pone las pantallas en **rojo**, les baja el **brillo** o las **apaga hasta
que muevas el ratón**, sin apagar el PC.

Pensada para quien deja el PC encendido por la noche en la habitación o duerme con un foco de luz roja: la pantalla se
queda en el mismo tono y mucho más tenue.

## Qué hace

| Función | Cómo lo hace | En qué pantallas |
|---|---|---|
| **Rojo / ámbar / normal** | Filtro de color de Windows (API de lupa, `MagSetFullscreenColorEffect`): toda la imagen pasa al canal rojo, también vídeos y juegos | Todas |
| **Brillo de la imagen** (5–100 %) | El mismo filtro oscurece la imagen | Todas |
| **Luz de fondo real** (0–100 %) | Órdenes al monitor por el cable (DDC/CI, VCP 0x10) | Solo las que aceptan DDC/CI (casi todos los monitores; muchas teles no) |
| **Brillo a la mitad** | Imagen al 50 % y luz de fondo a la mitad de la de día | Todas |
| **Apagar hasta mover el ratón** | Corte de señal de Windows (`SC_MONITORPOWER`); se encienden con el ratón o una tecla | Todas |

- Lo que ajustas en rojo se guarda como valores de noche para la próxima vez.
- **Nada queda fijo en Windows**: el filtro desaparece al cerrar la app y las pantallas vuelven a su brillo de día.
  No toca el registro ni la gamma del sistema.
- La app detecta sola qué pantallas dejan bajar su luz de verdad y lo dice en la ventana.

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+Alt+R` | Rojo / normal |
| `Ctrl+Alt+M` | Brillo a la mitad |
| `Ctrl+Alt+A` | Apagar pantallas hasta mover el ratón |
| `Ctrl+Alt+↑` / `↓` | Más / menos brillo |
| `Ctrl+Alt+N` | Todo normal |

## CLI para agentes de IA: `buho-noche`

La app es *agentic first*: cualquier agente con terminal (Claude, Codex, Copilot, scripts) la maneja con su CLI,
que el instalador añade al PATH. Si la app está cerrada, el CLI la abre en segundo plano.

```bash
buho-noche estado                      # modo, brillo y qué pantallas dejan bajar su luz real
buho-noche rojo | ambar | normal
buho-noche mitad
buho-noche brillo 40                   # brillo de la imagen, 5-100
buho-noche luz 0 [--pantalla <id>]     # luz de fondo real, 0-100
buho-noche apagar                      # hasta mover el ratón
buho-noche despertar
buho-noche skill                       # guía para agentes
```

`--json` da la salida en JSON. La guía para agentes está en [`skills/buho-noche/SKILL.md`](skills/buho-noche/SKILL.md).
Por debajo hay una API local en `127.0.0.1:47364` con token (en `Documentos\BuhoNoche\api.json`).

## Instalar y compilar

Requisitos: Windows 10/11 y Node 20+. El motor nativo se compila con el compilador de C# que ya trae Windows
(.NET Framework 4.x): no hace falta instalar Visual Studio.

```bash
npm install
npm start            # compila el motor y abre la app
npm run dist         # instalador en dist/Buho-Noche-<versión>-x64.exe
npm run dist:portable
```

## Cómo está hecho

```
motor/BuhoNoche.cs     motor nativo (C#): filtro de color, DDC/CI, apagado y vigilancia del ratón
                       → resources/bin/buho-noche-motor.exe; habla por stdin/stdout, una línea JSON por orden
src/main.js            Electron: bandeja, atajos, ajustes y API local
src/ui/                ventana (HTML + JS, sin frameworks)
bin/buho-noche.mjs     CLI
skills/buho-noche/     skill para agentes
ia_context/            decisiones y pruebas
```

Datos de usuario en `Documentos\BuhoNoche` (`ajustes.json`, `api.json`).

## Avisos

- **No usa el apagado por DDC/CI (VCP 0xD6)**: en un LG 24UD58 dejó el monitor en «sin señal» y hubo que cambiar de
  entrada HDMI y volver para recuperarlo. «Apagar» usa solo el corte de señal de Windows.
- En pantallas sin DDC/CI (muchas teles) la luz de fondo no se puede bajar desde el PC: el rojo y el brillo de la
  imagen funcionan, pero el panel sigue iluminado. Con «Apagar», algunas teles enseñan un aviso de «sin señal» antes
  de quedarse a oscuras.
- Versión 0.1.0, probada en un solo equipo (tele con placa CVTE + LG 24UD58, NVIDIA RTX 4060).

---

© 2026 Buho Corps Systems · Búho AI
