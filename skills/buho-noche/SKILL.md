---
name: buho-noche
description: Poner las pantallas del PC en rojo o ámbar para dormir, bajar el brillo (a la mitad o a lo que se pida) o apagarlas hasta que se mueva el ratón, con el PC encendido, mediante Búho Noche y su CLI `buho-noche`. Úsala SIEMPRE que el usuario diga que le molesta la luz de las pantallas, que se va a dormir, que quiere modo noche, luz roja, bajar el brillo de los monitores o apagar las pantallas sin apagar el PC, aunque no nombre la app. Vale para cualquier agente con terminal.
---

# Búho Noche · `buho-noche`

App de bandeja (junto al reloj) de Búho AI. Hace tres cosas sin apagar el PC:

1. **Color**: `rojo` (toda la imagen en rojo puro, sin azul ni verde), `ambar` o `normal`. Afecta a todas las pantallas.
2. **Brillo de la imagen** (5–100 %): oscurece la imagen por software en todas las pantallas.
3. **Luz de fondo real** (0–100 %) y **apagado real**: solo en pantallas que aceptan DDC/CI. En las que no (muchas teles), solo funcionan el color y el brillo de imagen.

Si la app está cerrada, el CLI la abre en segundo plano. Al cerrar la app todo vuelve a normal: no deja nada fijo en el sistema.

## Órdenes

```bash
buho-noche estado                      # modo, brillo y qué pantallas dejan bajar su luz real (con su id)
buho-noche rojo                        # rojo con los valores de noche guardados (por defecto imagen 60 %, luz 0 %)
buho-noche ambar | normal              # normal también devuelve la luz de fondo de día
buho-noche mitad                       # imagen al 50 % y luz de fondo a la mitad de la de día
buho-noche brillo 40                   # brillo de la imagen, 5-100
buho-noche luz 0 [--pantalla <id>]     # luz de fondo real, 0-100 (todas las que tengan DDC/CI o una)
buho-noche apagar [--espera 700]       # apaga las pantallas hasta que se mueva el ratón o se pulse una tecla
buho-noche despertar
buho-noche abrir                       # enseña la ventana
```

`--json` da la salida en JSON.

## Atajos de teclado (con la app abierta)

`Ctrl+Alt+R` rojo/normal · `Ctrl+Alt+M` mitad · `Ctrl+Alt+A` apagar · `Ctrl+Alt+↑/↓` brillo · `Ctrl+Alt+N` todo normal.

## Notas

- En rojo o ámbar, lo que el usuario ajusta en la ventana queda como valor de noche para el próximo «Rojo».
- `apagar` desde un agente: cualquier movimiento del ratón o tecla las enciende. No lo lances sin que el usuario lo pida.
- Datos: `Documentos\BuhoNoche` (`ajustes.json`, `api.json`). API local en `127.0.0.1:47364` con token.
