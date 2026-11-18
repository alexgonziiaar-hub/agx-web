# Herramientas del rediseño 3D de agxcommunity.com

Esta rama NO se publica ni se mezcla con `main`: solo guarda las herramientas de trabajo.

- `agx-e2e.cjs`: prueba de funcionamiento (1.054 comprobaciones) en modo ejemplo y con servidor simulado.
- `agx-shots.cjs` + `agx-contact.py`: capturas de todas las pantallas y hojas de contacto.
- `agx-verificar.sh`: ejecuta lo anterior sobre la copia local.
- `mapa.md`: mapa del diseño actual (componentes, ganchos del JS, riesgos).
- `diseno-3d.md`: dirección de diseño del rediseño 3D.

Para ejecutarlas hacen falta Playwright y, junto a los scripts, `vendor/xlsx.full.min.js` (del paquete npm `xlsx@0.18.5`)
y las fuentes `@fontsource-variable/archivo` y `@fontsource/bebas-neue` (ver la cabecera de cada script).
