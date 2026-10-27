/* Catálogo de servicios y cotización inicial.
   Para cambiar la evidencia de un servicio, edita sus rutas en `videos` e `images`
   o usa el botón "Reemplazar" dentro del dashboard. */
(function () {
  'use strict';

  const media = (svc, n, ext) => `assets/media/${svc}/${svc}-${n}.${ext}`;

  const catalog = {
    metaads: {
      id: 'metaads',
      name: 'Meta Ads',
      title: 'Creación y manejo de Meta Ads',
      tagline: 'Inversión con criterio: cada sol rinde y se mide.',
      duration: '3 meses',
      deliverables: [
        '12 creativos para anuncios durante los 3 meses del servicio, entre imágenes y video',
        'Gestión de anuncios publicitarios en Meta Ads',
        'Presupuesto de inversión de S/ 2,500 incluido en la cotización',
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
    },

    audiovisual: {
      id: 'audiovisual',
      name: 'Audiovisual',
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

    branding: {
      id: 'branding',
      name: 'Branding',
      title: 'Identidad de marca',
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

    diseno: {
      id: 'diseno',
      name: 'Diseño gráfico',
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

    redes: {
      id: 'redes',
      name: 'Redes sociales',
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
    }
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function blockFromService(serviceId) {
    const service = catalog[serviceId];
    if (!service) return null;
    return {
      uid: 'b' + Math.random().toString(36).slice(2, 8),
      serviceId: service.id,
      title: service.title,
      tagline: service.tagline,
      duration: service.duration,
      deliverables: clone(service.deliverables),
      considerations: clone(service.considerations),
      process: clone(service.process || []),
      items: clone(service.items),
      videos: clone(service.videos),
      images: clone(service.images)
    };
  }

  function defaultQuote() {
    return {
      version: 1,
      meta: {
        quoteNo: 'OCT26-23',
        date: '2026-10-23',
        client: 'H&S Inmobiliaria',
        lede: 'Inversión con criterio: cada sol rinde y se mide.',
        duration: '3 meses',
        validity: '30 días',
        taxEnabled: true,
        taxRate: 18,
        payments: [
          { label: 'Al dar inicio al servicio', pct: 60 },
          { label: 'Al mes siguiente', pct: 40 }
        ],
        closing: 'Estamos listos para empezar cuando tú lo estés. Cualquier ajuste al alcance se conversa antes de la firma.',
        conditions: [
          'La proforma tiene una vigencia de 30 días desde la fecha de emisión.',
          'Los precios están expresados en soles peruanos y no incluyen I.G.V. salvo indicación contraria.',
          'La inversión publicitaria se factura por adelantado y se ejecuta según el plan aprobado.',
          'Cualquier cambio de alcance se cotiza por separado antes de su ejecución.'
        ]
      },
      bank: {
        holder: 'Pandora Marketing S.A.C.',
        account: '5702449750023',
        cci: '002-57000244975002301',
        detractions: '00 771 021492',
        bankName: 'BCP · Cuenta corriente'
      },
      blocks: [blockFromService('metaads')]
    };
  }

  window.P = window.P || {};
  window.P.catalog = catalog;
  window.P.blockFromService = blockFromService;
  window.P.defaultQuote = defaultQuote;
  window.P.clone = clone;
})();
