import type { ProjectTranslation } from "../types";

export const es: ProjectTranslation = {
  tagline:
    "Aplicación de escritorio para visualizar cursos descargados de forma local.",
  summary:
    "CursoVisor es una aplicación de escritorio construida con Electron y React que organiza y reproduce cursos guardados en el disco. Nació de un problema propio: carpetas con cientos de videos sueltos, sin progreso, sin orden y sin manera de retomar donde se quedó.",
  role: "Desarrollo y diseño de la aplicación",
  highlights: [
    "Lectura y organización automática de carpetas de curso",
    "Progreso de reproducción guardado de forma local",
    "Empaquetado y distribución mediante GitHub Releases",
    "Funciona sin conexión: todo el contenido vive en el equipo",
  ],
  body: [
    {
      type: "heading",
      text: "El problema",
    },
    {
      type: "paragraph",
      text: "Un curso descargado suele ser un árbol de carpetas con nombres inconsistentes. El reproductor del sistema no sabe qué módulo sigue, no recuerda el minuto en que quedaste y no distingue un video visto de uno pendiente.",
    },
    {
      type: "heading",
      text: "Cómo está construido",
    },
    {
      type: "paragraph",
      text: "La aplicación combina un proceso principal de Electron con acceso al sistema de archivos, un servidor Express local que sirve el contenido, y una interfaz en React. Separar el servidor del proceso de la ventana permitió reutilizar la misma lógica de catálogo si algún día se ejecuta en el navegador.",
    },
    {
      type: "list",
      items: [
        "Electron para el acceso nativo al disco y el empaquetado.",
        "Express para servir los archivos con soporte de rangos, necesario para adelantar y retroceder el video.",
        "React con TypeScript para la interfaz y el estado del reproductor.",
        "Persistencia local del progreso, sin cuentas ni servidor remoto.",
      ],
    },
    {
      type: "heading",
      text: "Qué aprendí",
    },
    {
      type: "paragraph",
      text: "Servir video local no es solo devolver un archivo: sin peticiones por rango, la barra de progreso no funciona. Fue el detalle que más tiempo tomó y el que más cambió la experiencia final.",
    },
  ],
};
