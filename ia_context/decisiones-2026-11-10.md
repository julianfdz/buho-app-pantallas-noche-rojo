# Decisiones y pruebas · 10/11/2026

Pantallas de Julián:
- `DISPLAY1` principal: tele con placa CVTE (`CVT0003`), 1920×1080 al 125 %. **Sin DDC/CI**: solo rojo y brillo por software.
  Con el apagado de Windows enseña «sin señal» y luego vuelve.
- `DISPLAY2`: LG 24UD58 (`GSM5B08`). DDC/CI: VCP 10 brillo (de día 100), 12 contraste (67), D6 encendido (01/04).

Decisiones:
- **No usar el apagado por DDC (VCP D6=4).** El LG se quedó colgado: con D6=1 decía estar encendido pero enseñaba la
  pantalla gris de «sin señal». Se arregló reaplicando la configuración de pantallas (`SetDisplayConfig` con
  `SDC_APPLY | SDC_USE_DATABASE_CURRENT`) o con Win+Ctrl+Mayús+B. Apagar = solo `SC_MONITORPOWER`.
- Rojo: la luminancia (0,45 R + 0,80 G + 0,25 B) va al canal rojo, por el brillo k. Ámbar: además el 30 % al verde.
- Al abrir, la app arranca en normal; recuerda los valores de noche (imagen 60 %, luz 0 %) para el próximo «Rojo».
- Nada fijo en el sistema: el filtro muere con el proceso, al salir vuelve la luz de día. «Abrir con Windows» solo si
  Julián lo marca en la bandeja.
- Datos en `Documentos\BuhoNoche` (no AppData: lo abierto desde Claude escribe AppData en LocalCache).

Pendiente: probar de nuevo «Apagar» con solo el corte de señal y ver que el LG vuelve solo.
