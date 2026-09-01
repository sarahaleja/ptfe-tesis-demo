# Frentes Térmicos PTFE

Demo interactiva en HTML/CSS/JS puro (sin librerías externas) que resuelve **en vivo, en el navegador**, dos modelos de conducción de calor lado a lado:

- **Fourier** (parabólica, ∂T/∂t = α∂²T/∂x²) — diferencias finitas explícitas.
- **Cattaneo–Vernotte** (hiperbólica, con tiempo de relajación τ₀) — sistema (T, q) en variables características (invariantes de Riemann), diferencias contra el viento, separación de Strang para la relajación.

Además incluye una segunda escena esquemática de un problema de Stefan (frontera de fusión/ablación), resuelta con el método de capacidad calorífica aparente (Voller & Swaminathan, 1991) — deliberadamente distinto del método numérico usado en la tesis (front-fixing ξ/η de dos capas), para mantener esta demo pública sin exponer el método de investigación aún no publicado.

Construida como pieza complementaria del póster de tesis de pregrado en Ingeniería Física — *Modelo físico-matemático de la ablación láser de PTFE en propulsores de plasma pulsado* — Universidad del Cauca, presentado en ASCEND 2026 (Pisa).

## Ver la demo

Abre `index.html` directamente en el navegador, o publícala con GitHub Pages (ver abajo).

## Publicar con GitHub Pages

1. Sube este repositorio a GitHub (público, para que Pages sea gratuito):
   ```bash
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git branch -M main
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, elige la rama `main` y la carpeta `/ (root)`. Guarda.
3. En un minuto o dos, la página queda publicada en `https://<tu-usuario>.github.io/<tu-repo>/`.

## Notas de física y de alcance

- Todos los parámetros (τ₀, longitudes, tiempos) son **unidades arbitrarias normalizadas para visualización** — no representan las escalas reales del PTFE (τ₀ ~ 10⁻¹¹–10⁻¹³ s, longitudes ~ nm).
- La Escena 2 (Stefan/ablación) es una ilustración **conceptual y genérica**, no el método numérico de la tesis.
- Referencias completas dentro de la propia página (pie de página).

---
Generado con asistencia de Claude (Anthropic) como parte del trabajo de tesis.
