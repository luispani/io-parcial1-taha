/* Study plan data (§6). Global: IO.plan */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };

  IO.plan = {
    examDate: '2026-09-14',
    days: [
      {
        id: 'd1', date: '2026-09-05', label: 'Sáb 5 sep',
        topic: 'Cap 1 + 2.1–2.2',
        tasks: [
          'Leer 1.1–1.7',
          'Reddy Mikks a mano',
          'Dieta a mano',
          'Widget gráfico con 3 ejemplos',
          'Quiz cap 1'
        ]
      },
      {
        id: 'd2', date: '2026-09-06', label: 'Dom 6 sep',
        topic: 'Cap 2.4 formulación',
        tasks: [
          'Formular 5 aplicaciones sin mirar',
          'Entrenador de formulación',
          '4 ejercicios',
          'Quiz cap 2'
        ]
      },
      {
        id: 'd3', date: '2026-09-07', label: 'Lun 7 sep',
        topic: 'Cap 3.1–3.3 simplex',
        tasks: [
          'Forma de ecuación',
          'Soluciones básicas',
          'Reddy Mikks por simplex a mano (3 tablas) y verificar con widget'
        ]
      },
      {
        id: 'd4', date: '2026-09-08', label: 'Mar 8 sep',
        topic: 'Cap 3.4–3.5',
        tasks: [
          'Método M y dos fases a mano',
          'Identificar los 4 casos especiales en tableau'
        ]
      },
      {
        id: 'd5', date: '2026-09-09', label: 'Mié 9 sep',
        topic: 'Cap 3.6 sensibilidad',
        tasks: [
          'TOYCO: duales, rangos de factibilidad y optimalidad',
          'Sensibilidad gráfica',
          'Quiz cap 3'
        ]
      },
      {
        id: 'd6', date: '2026-09-10', label: 'Jue 10 sep',
        topic: 'Cap 4.1–4.3 dualidad',
        tasks: [
          'Escribir el dual de 5 problemas',
          'y = c_B B⁻¹',
          'Interpretación económica',
          'Dualidad débil/fuerte'
        ]
      },
      {
        id: 'd7', date: '2026-09-11', label: 'Vie 11 sep',
        topic: 'Cap 4.4–4.5',
        tasks: [
          'Simplex dual a mano',
          'Postóptimo TOYCO (cambiar b, cambiar c, nueva variable)',
          'Quiz cap 4'
        ]
      },
      {
        id: 'd8', date: '2026-09-12', label: 'Sáb 12 sep',
        topic: 'Cap 5 transporte y asignación',
        tasks: [
          'SunRay: NW, costo mínimo, Vogel, MODI hasta óptimo a mano',
          'Húngaro 3×3 y 4×4',
          'Quiz cap 5'
        ]
      },
      {
        id: 'd9', date: '2026-09-13', label: 'Dom 13 sep',
        topic: 'Simulacro y repaso',
        tasks: [
          'Simulacro 90 min sin apuntes',
          'Corregir',
          'Releer Resumen',
          'Rehacer los ejercicios fallados'
        ]
      },
      {
        id: 'd10', date: '2026-09-14', label: 'Lun 14 sep',
        topic: 'Parcial',
        tasks: [
          'Repaso de 30 min del Resumen',
          'Dormir bien',
          'Llevar calculadora'
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
