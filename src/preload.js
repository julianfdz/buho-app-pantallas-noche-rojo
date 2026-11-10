const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('noche', {
  foto: () => ipcRenderer.invoke('foto'),
  estado: (c) => ipcRenderer.invoke('estado', c),
  preset: (n) => ipcRenderer.invoke('preset', n),
  apagar: () => ipcRenderer.invoke('apagar'),
  luzNoche: (id, v) => ipcRenderer.invoke('luzNoche', id, v),
  rojoBrillo: (v) => ipcRenderer.invoke('rojoBrillo', v),
  refrescar: () => ipcRenderer.invoke('refrescar'),
  alCambiar: (f) => ipcRenderer.on('estado', (_e, s) => f(s))
})
