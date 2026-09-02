# Frentes Térmicos PTFE

Demo interactiva en HTML/CSS/JS (con Three.js vía CDN para las figuras 3D) que resuelve **en vivo, en el navegador**, cuatro escenas del modelo físico de ablación láser de PTFE:

- **Escena 1** — Fourier (parabólica, ∂T/∂t = α∂²T/∂x²) vs. Cattaneo–Vernotte (hiperbólica, con tiempo de relajación τ₀): sistema (T, q) en variables características (invariantes de Riemann), diferencias contra el viento, separación de Strang para la relajación.
- **Escena 2** — Problema de Stefan (frontera de fusión/ablación móvil), resuelto con el método de capacidad calorífica aparente (Voller & Swaminathan, 1991) — deliberadamente distinto del método numérico usado en la tesis (front-fixing ξ/η de dos capas), para mantener esta demo pública sin exponer el método de investigación aún no publicado.
- **Escena 3** — Ciencia de materiales: conformación helicoidal del PTFE (Clark, 1999) y su efecto en el módulo de Young E(T) (Rae & Brown, 2005), como sustento estructural de por qué τ₀ no es una constante universal del material. La cadena helicoidal y el empaquetamiento hexagonal se muestran en **3D real** (Three.js), explorables con el mouse.
- **Escena 4** — Acoplamiento superficie–plasma: transporte diferencial de especies y flujo de retorno de átomos (Jakubczak, Jardin & Kurzyna, 2024; Keidar, Boyd & Beilis, 2001), también en 3D.

Construida como pieza complementaria del póster de tesis de pregrado en Ingeniería Física — *Modelo físico-matemático de la ablación láser de PTFE en propulsores de plasma pulsado* — Universidad del Cauca, presentado en ASCEND 2026 (Pisa).

## Archivos

```
index.html        estructura de la página (las 4 escenas)
style.css         estilos (tema oscuro, colores institucionales Unicauca)
common.js         utilidades compartidas (mapa térmico, ejes, callouts)
script.js         física de las Escenas 1 y 2 (verificada) + estado de las Escenas 3 y 4
three-scenes.js   figuras 3D (Three.js + OrbitControls) de las Escenas 3 y 4
```

Los cinco archivos deben subirse juntos, en la misma carpeta del repositorio — `index.html` los referencia por nombre relativo.

## ⚠️ Importante: esta versión necesita un servidor (no sirve abrir el archivo con doble clic)

A diferencia de la versión anterior (un solo archivo HTML), esta versión carga `three-scenes.js` como **módulo de JavaScript** (`<script type="module">`), y Three.js se descarga desde una CDN (jsDelivr). Los navegadores bloquean los módulos de JS cuando el archivo se abre directamente como `file:///...` (doble clic) — verás la página, pero las Escenas 3 y 4 se quedarán en "cargando 3D…".

Dos formas de verla correctamente:

**Opción A — GitHub Pages (recomendada, es la versión final para el póster):** ver abajo.

**Opción B — previsualizar en tu computador antes de subir:** abre una terminal en la carpeta de estos archivos y corre:
```bash
python3 -m http.server 8000
```
y abre `http://localhost:8000/index.html` en el navegador. (Si no tienes Python, cualquier "servidor estático local" equivalente funciona igual — por ejemplo la extensión "Live Server" de VS Code.)

## Publicar con GitHub Pages

1. Sube **los cinco archivos** (`index.html`, `style.css`, `common.js`, `script.js`, `three-scenes.js`) a la raíz del repositorio — reemplazando los que ya existan ahí. En la web de GitHub: **Add file → Upload files**, arrastra los cinco archivos a la vez, y confirma el commit.
2. En **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, elige la rama `main` y la carpeta `/ (root)`. Guarda (si ya estaba configurado de una vez anterior, no hay que repetir este paso).
3. En un minuto o dos, la página queda publicada en `https://<tu-usuario>.github.io/<tu-repo>/`, con las cuatro escenas y las tres figuras 3D funcionando (GitHub Pages sí tiene acceso normal a internet, así que la CDN de Three.js carga sin problema, aunque el entorno donde se construyó esta demo no pudiera alcanzarla directamente).

## Notas de física y de alcance

- Todos los parámetros de la Escena 1 (τ₀, longitudes, tiempos) son **unidades arbitrarias normalizadas para visualización** — no representan las escalas reales del PTFE (τ₀ ~ 10⁻¹¹–10⁻¹³ s, longitudes ~ nm).
- La Escena 2 (Stefan/ablación) es una ilustración **conceptual y genérica**, no el método numérico de la tesis.
- Las figuras 3D de las Escenas 3 y 4 son **esquemáticas**: la geometría, el giro de la hélice y las trayectorias son ilustrativas y a escala cualitativa, no cuantitativa — cada escena lo aclara en su nota correspondiente.
- Referencias completas dentro de la propia página (pie de página).

---
Generado con asistencia de Claude (Anthropic) como parte del trabajo de tesis.
