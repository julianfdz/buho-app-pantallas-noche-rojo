# Búho Noche

App de bandeja de Búho AI (Buho Corps Systems) para dormir con el PC encendido sin que molesten las pantallas:

- **Rojo / ámbar / normal** en todas las pantallas (API de lupa de Windows, `MagSetFullscreenColorEffect`; desaparece al cerrar la app).
- **Brillo de la imagen** 5–100 % por software (todas las pantallas).
- **Luz de fondo real** 0–100 % por DDC/CI en las pantallas que lo aceptan.
- **Apagar hasta mover el ratón** (corte de señal de Windows, `SC_MONITORPOWER`).
- Atajos globales, CLI `buho-noche` (API local 127.0.0.1:47364 con token) y skill en `skills/buho-noche`.

```bash
npm install
npm start          # compila el motor (csc de Windows) y abre la app
npm run dist       # instalador en dist/
```

Motor nativo: `motor/BuhoNoche.cs` → `resources/bin/buho-noche-motor.exe`. Datos: `Documentos\BuhoNoche`.
Notas y decisiones en `ia_context/`.
