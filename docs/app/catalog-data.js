/* Catálogo compartido de servicios. Lo usan la matriz heredada, el panel
   privado y las pruebas. Las rutas de medios son relativas a la raíz del sitio. */
(function (root, factory) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('./core.js') : (root.P || {});
  const api = factory(core || {});
  if (isNode) {
    module.exports = api;
  } else {
    root.P = root.P || {};
    root.P.catalog = api.catalog;
    root.P.blockFromService = api.blockFromService;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  const uid = core.uid || ((prefix) => (prefix || 'b') + Math.random().toString(36).slice(2, 8));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const media = (svc, n, ext) => `assets/media/${svc}/${svc}-${n}.${ext}`;

  const catalog = {
    consultoria: {
      id: 'consultoria',
      name: 'Consultoría de Negocios y Marketing',
      title: 'Consultoría de negocios y marketing',
      tagline: '¿Buscas nuevas oportunidades o asesoría para tu empresa?',
      duration: 'Según alcance',
      deliverables: [
        'Diagnóstico de negocio, mercado y marketing',
        'Definición de objetivos y oportunidades de crecimiento',
        'Plan de acción priorizado con responsables y plazos',
        'Sesiones de acompañamiento y seguimiento'
      ],
      considerations: [
        'El alcance y la duración se definen después del diagnóstico inicial.',
        'No incluye ejecución de campañas, producción de piezas ni inversión publicitaria.',
        'La información del negocio la proporciona el cliente.'
      ],
      process: [
        { title: 'Diagnóstico', detail: 'Revisamos el negocio, el mercado y el punto de partida.' },
        { title: 'Estrategia', detail: 'Definimos objetivos y oportunidades priorizadas.' },
        { title: 'Plan de acción', detail: 'Traducimos la estrategia en acciones concretas.' },
        { title: 'Acompañamiento', detail: 'Seguimos la implementación y ajustamos el plan.' }
      ],
      items: [],
      videos: [],
      images: []
    },

    branding: {
      id: 'branding',
      name: 'Branding e Identidad Corporativa',
      title: 'Branding e identidad corporativa',
      tagline: 'Una marca se reconoce antes de leerse.',
      duration: '5 semanas',
      deliverables: [
        'Investigación y sesión de descubrimiento con el equipo del cliente',
        'Territorio creativo, moodboard y concepto de marca',
        'Logotipo, símbolo y versiones horizontal, vertical e isotipo',
        'Paleta cromática, tipografías y sistema gráfico',
        'Manual de marca básico en PDF interactivo',
        'Aplicaciones: papelería, redes y piezas base'
      ],
      considerations: [
        'Incluye 02 rutas creativas y 02 rondas de ajuste sobre la elegida.',
        'Entrega final en AI, PDF y PNG con fondo transparente.',
        'No incluye registro de marca ante Indecopi.',
        'Plazo de entrega: 25 días hábiles.'
      ],
      process: [
        { title: 'Descubrimiento', detail: 'Entendemos el negocio, la audiencia y el punto de partida.' },
        { title: 'Ruta creativa', detail: 'Presentamos dos territorios y elegimos uno juntos.' },
        { title: 'Diseño', detail: 'Construimos símbolo, tipografía, color y sistema gráfico.' },
        { title: 'Manual y entrega', detail: 'Documentamos la marca y entregamos los archivos finales.' }
      ],
      items: [
        { label: 'Investigación y estrategia de marca', amount: 1800 },
        { label: 'Diseño de identidad visual', amount: 3200 },
        { label: 'Manual de marca', amount: 1200 },
        { label: 'Aplicaciones base', amount: 800 }
      ],
      videos: [
        { title: 'Identidad — sistema de marca', src: media('branding', 1, 'mp4'), poster: media('branding', 1, 'jpg') },
        { title: 'Propósito — manual aplicado', src: media('branding', 2, 'mp4'), poster: media('branding', 2, 'jpg') }
      ],
      images: [
        { title: 'Construcción del símbolo', src: media('branding', 1, 'png') },
        { title: 'Paleta y tipografía', src: media('branding', 2, 'png') },
        { title: 'Aplicaciones', src: media('branding', 3, 'png') }
      ]
    },

    redes: {
      id: 'redes',
      name: 'Manejo de Redes Sociales',
      title: 'Manejo de redes sociales',
      tagline: 'Contenido con criterio, comunidad con conversación.',
      duration: '3 meses',
      deliverables: [
        'Estrategia de contenido y parrilla mensual',
        '12 publicaciones al mes, entre estáticas y carruseles',
        '04 reels al mes con edición y subtítulos',
        'Redacción de copys y hashtags',
        'Gestión de comunidad: comentarios y mensajes',
        'Reporte mensual de métricas y aprendizajes'
      ],
      considerations: [
        'El servicio se contrata por periodos mínimos de 3 meses.',
        'Incluye 01 sesión de fotografía de producto al trimestre.',
        'No incluye inversión publicitaria ni colaboraciones pagadas.',
        'Requiere acceso a las cuentas y 48 h de anticipación por pieza.'
      ],
      process: [
        { title: 'Estrategia', detail: 'Definimos pilares, tono y objetivos medibles por mes.' },
        { title: 'Parrilla', detail: 'Planificamos el calendario y validamos los contenidos.' },
        { title: 'Producción', detail: 'Diseñamos, editamos y programamos cada publicación.' },
        { title: 'Medición', detail: 'Revisamos métricas y ajustamos el plan del mes siguiente.' }
      ],
      items: [
        { label: 'Estrategia y parrilla mensual', amount: 900 },
        { label: 'Producción de contenido', amount: 1400 },
        { label: 'Community management', amount: 700 },
        { label: 'Reporte y análisis', amount: 400 }
      ],
      videos: [
        { title: 'Parrilla — contenido mensual', src: media('redes', 1, 'mp4'), poster: media('redes', 1, 'jpg') },
        { title: 'Comunidad — reels y stories', src: media('redes', 2, 'mp4'), poster: media('redes', 2, 'jpg') }
      ],
      images: [
        { title: 'Contenido para feed', src: media('redes', 1, 'png') },
        { title: 'Parrilla mensual', src: media('redes', 2, 'png') },
        { title: 'Portada de reel', src: media('redes', 3, 'png') }
      ]
    },

    diseno: {
      id: 'diseno',
      name: 'Diseño Gráfico & Identidad Corporativa',
      title: 'Diseño gráfico y piezas de campaña',
      tagline: 'Del concepto a la pieza final, sin perder el detalle.',
      duration: '4 semanas',
      deliverables: [
        'Concepto creativo y dirección de arte de la campaña',
        'Key visual principal y sus adaptaciones',
        '06 piezas para redes en 4:5 y 9:16',
        '01 pieza para exterior o punto de venta',
        'Archivos finales para impresión y digital'
      ],
      considerations: [
        'Incluye 02 rondas de ajuste sobre la propuesta elegida.',
        'No incluye impresión, producción gráfica ni fotografía.',
        'Los archivos editables se entregan bajo solicitud.',
        'Plazo de entrega: 12 días hábiles.'
      ],
      process: [
        { title: 'Brief', detail: 'Aterrizamos objetivo, formato y restricciones de producción.' },
        { title: 'Concepto', detail: 'Exploramos dirección de arte y validamos la ruta elegida.' },
        { title: 'Producción', detail: 'Diseñamos el key visual y sus adaptaciones por formato.' },
        { title: 'Ajustes y entrega', detail: 'Aplicamos las rondas de ajuste y preparamos los archivos.' }
      ],
      items: [
        { label: 'Concepto y dirección de arte', amount: 1500 },
        { label: 'Key visual y adaptaciones', amount: 1200 },
        { label: 'Piezas para redes (6)', amount: 1400 },
        { label: 'Pieza para exterior', amount: 900 }
      ],
      videos: [
        { title: 'Sur — afiche de campaña', src: media('diseno', 1, 'mp4'), poster: media('diseno', 1, 'jpg') },
        { title: 'Temporada — packaging', src: media('diseno', 2, 'mp4'), poster: media('diseno', 2, 'jpg') }
      ],
      images: [
        { title: 'Afiche de campaña', src: media('diseno', 1, 'png') },
        { title: 'Sistema de packaging', src: media('diseno', 2, 'png') },
        { title: 'Diseño editorial', src: media('diseno', 3, 'png') }
      ]
    },

    web: {
      id: 'web',
      name: 'Páginas Web',
      title: 'Diseño y desarrollo de páginas web',
      tagline: 'Obtén un diseño y desarrollo superior para tu empresa o proyecto.',
      duration: 'Según alcance',
      deliverables: [
        'Diseño UX/UI adaptado a la marca',
        'Desarrollo responsive para computadora y móvil',
        'Configuración de dominio, hosting y analítica',
        'Capacitación de uso y entrega de accesos'
      ],
      considerations: [
        'No incluye costos de dominio, hosting ni licencias de terceros.',
        'El contenido final lo proporciona el cliente.',
        'Los cambios fuera del alcance aprobado se cotizan aparte.'
      ],
      process: [
        { title: 'Brief', detail: 'Definimos objetivos, audiencia y alcance del sitio.' },
        { title: 'Diseño', detail: 'Creamos la estructura y la interfaz alineadas a la marca.' },
        { title: 'Desarrollo', detail: 'Construimos el sitio y validamos su funcionamiento.' },
        { title: 'Lanzamiento', detail: 'Publicamos, capacitamos y entregamos accesos.' }
      ],
      items: [],
      videos: [],
      images: []
    },

    edicion: {
      id: 'edicion',
      name: 'Edición Fotográfica y Audiovisual',
      title: 'Edición fotográfica y audiovisual',
      tagline: 'Lanza fotografías y videos de alto impacto.',
      duration: 'Según alcance',
      deliverables: [
        'Selección y retoque fotográfico',
        'Edición de video, colorización y diseño sonoro',
        'Versiones para redes y formatos de pauta',
        'Entrega de archivos finales en alta calidad'
      ],
      considerations: [
        'No incluye producción ni rodaje.',
        'Los archivos originales los proporciona el cliente.',
        'El volumen de piezas y los tiempos se definen según el alcance.'
      ],
      process: [
        { title: 'Recepción', detail: 'Revisamos el material y los objetivos de la edición.' },
        { title: 'Selección', detail: 'Elegimos las tomas y piezas con mayor potencial.' },
        { title: 'Edición', detail: 'Retocamos, montamos y ajustamos color y sonido.' },
        { title: 'Entrega', detail: 'Exportamos las versiones acordadas para cada formato.' }
      ],
      items: [],
      videos: [],
      images: []
    },

    fotografia: {
      id: 'fotografia',
      name: 'Fotografía',
      title: 'Producción fotográfica',
      tagline: 'Todo entra mejor por los ojos.',
      duration: 'Según alcance',
      deliverables: [
        'Dirección de arte y moodboard',
        'Jornada de fotografía con equipo de producción',
        'Selección y retoque de las imágenes',
        'Entrega en alta resolución y formatos para redes'
      ],
      considerations: [
        'No incluye locaciones, permisos, talento ni vestuario.',
        'Jornadas adicionales se cotizan aparte.',
        'El número de imágenes finales se define según el alcance.'
      ],
      process: [
        { title: 'Brief', detail: 'Definimos el concepto, la estética y los usos.' },
        { title: 'Preproducción', detail: 'Coordinamos locación, equipo, arte y horarios.' },
        { title: 'Rodaje', detail: 'Realizamos la jornada con dirección y supervisión.' },
        { title: 'Entrega', detail: 'Seleccionamos, retocamos y entregamos los archivos.' }
      ],
      items: [],
      videos: [],
      images: []
    },

    audiovisual: {
      id: 'audiovisual',
      name: 'Producción Audiovisual',
      title: 'Producción audiovisual',
      tagline: 'Piezas que se ven, se sienten y se recuerdan.',
      duration: '3 semanas',
      deliverables: [
        'Dirección creativa, guion y plan de rodaje',
        '01 jornada de rodaje de 8 horas con equipo de producción',
        '02 piezas principales de 30 s para pauta y orgánico',
        '03 cortes verticales de 9:16 para reels y stories',
        'Edición, colorización y diseño sonoro',
        '02 rondas de ajustes por pieza'
      ],
      considerations: [
        'Incluye una jornada de rodaje; jornadas adicionales se cotizan aparte.',
        'No incluye locaciones, permisos, talento ni vestuario.',
        'Entrega de masters en 4K y versiones optimizadas para redes.',
        'Plazo de entrega: 15 días hábiles desde la aprobación del guion.'
      ],
      process: [
        { title: 'Brief y guion', detail: 'Definimos el mensaje, las referencias y el plan de rodaje.' },
        { title: 'Preproducción', detail: 'Coordinamos locación, equipo, arte y horarios.' },
        { title: 'Rodaje', detail: 'Jornada de grabación con dirección y supervisión en set.' },
        { title: 'Postproducción', detail: 'Montaje, color, sonido y versiones para cada formato.' }
      ],
      items: [
        { label: 'Dirección creativa y guion', amount: 1200 },
        { label: 'Producción y rodaje (1 jornada)', amount: 2800 },
        { label: 'Edición, color y diseño sonoro', amount: 1600 },
        { label: 'Adaptaciones 9:16 y 1:1', amount: 600 }
      ],
      videos: [
        { title: 'Luz — reel de marca', src: media('audiovisual', 1, 'mp4'), poster: media('audiovisual', 1, 'jpg') },
        { title: 'Movimiento — spot 9:16', src: media('audiovisual', 2, 'mp4'), poster: media('audiovisual', 2, 'jpg') }
      ],
      images: [
        { title: 'Dirección de fotografía', src: media('audiovisual', 1, 'png') },
        { title: 'Color y montaje', src: media('audiovisual', 2, 'png') },
        { title: 'Guion visual', src: media('audiovisual', 3, 'png') }
      ]
    },

    btl: {
      id: 'btl',
      name: 'Campañas BTL & Activaciones',
      title: 'Campañas BTL y activaciones',
      tagline: 'Campañas de alto impacto para promover tu marca a otro nivel.',
      duration: 'Según alcance',
      deliverables: [
        'Concepto creativo y plan de activación',
        'Coordinación de producción y proveedores',
        'Materiales y dinámica de activación',
        'Reporte de resultados y aprendizajes'
      ],
      considerations: [
        'No incluye permisos municipales, alquiler de espacios ni talento.',
        'El presupuesto de producción se cotiza según la plaza y el alcance.',
        'Los tiempos dependen de la fecha y las condiciones de la activación.'
      ],
      process: [
        { title: 'Brief', detail: 'Definimos objetivos, público y contexto de la activación.' },
        { title: 'Concepto', detail: 'Creamos la idea y la dinámica de participación.' },
        { title: 'Producción', detail: 'Coordinamos materiales, proveedores y logística.' },
        { title: 'Activación', detail: 'Ejecutamos la campaña y medimos sus resultados.' }
      ],
      items: [],
      videos: [],
      images: []
    },

    metaads: {
      id: 'metaads',
      name: 'Meta Ads',
      title: 'Creación y manejo de Meta Ads',
      tagline: 'Inversión con criterio: cada sol rinde y se mide.',
      duration: '3 meses',
      deliverables: [
        '12 creativos para anuncios durante los 3 meses del servicio, entre imágenes y video',
        'Gestión de anuncios publicitarios en Meta Ads',
        'Presupuesto de inversión para anuncios incluido en la cotización',
        '01 sesión de fotografía y/o video de 2 h para contenido de anuncios',
        'Supervisión de contenido y monitoreo de campañas publicitarias',
        'Revisión de tendencias y novedades'
      ],
      considerations: [
        'No incluye respuesta de comentarios y mensajes.',
        'Duración del servicio de 3 meses, con el primer mes pagado por adelantado.',
        'El presupuesto de inversión para anuncios está considerado en esta cotización.',
        'Para iniciar el servicio se abona el 60% y el 40% restante al mes siguiente.'
      ],
      process: [
        { title: 'Brief y accesos', detail: 'Revisamos objetivos, público y permisos de las cuentas.' },
        { title: 'Creativos', detail: 'Producimos las piezas y las validamos contigo antes de publicar.' },
        { title: 'Lanzamiento', detail: 'Activamos campañas y monitoreamos el rendimiento a diario.' },
        { title: 'Optimización', detail: 'Ajustamos segmentación, presupuesto y creativos cada semana.' }
      ],
      items: [
        { label: 'Creación y manejo de Meta Ads (3 meses)', amount: 5000 },
        { label: 'Inversión publicitaria en Meta', amount: 2500 }
      ],
      videos: [
        { title: 'Alcance — campaña Meta Ads', src: media('metaads', 1, 'mp4'), poster: media('metaads', 1, 'jpg') },
        { title: 'Conversión — set de anuncios', src: media('metaads', 2, 'mp4'), poster: media('metaads', 2, 'jpg') }
      ],
      images: [
        { title: 'Estructura de campaña', src: media('metaads', 1, 'png') },
        { title: 'Anuncio en feed', src: media('metaads', 2, 'png') },
        { title: 'Embudo de conversión', src: media('metaads', 3, 'png') }
      ]
    }
  };

  function blockFromService(serviceId) {
    const service = catalog[serviceId];
    if (!service) return null;
    return {
      uid: uid('b'),
      serviceId: service.id,
      serviceName: service.name,
      title: service.title,
      tagline: service.tagline,
      duration: service.duration,
      deliverables: clone(service.deliverables || []),
      includesAlso: clone(service.includesAlso || []),
      considerations: clone(service.considerations || []),
      process: clone(service.process || []),
      items: clone(service.items || []),
      videos: clone(service.videos || []),
      images: clone(service.images || []),
      showEvidence: true
    };
  }

  return { catalog, blockFromService };
});
