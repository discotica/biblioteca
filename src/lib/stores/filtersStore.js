import { writable } from 'svelte/store';

export const filtrosBase = writable({
  pais: [],      // Soporta múltiples países
  genero: [],    // Soporta múltiples géneros
  texto: '',     // Búsqueda libre (artista, título, sello)
  año: '',
  mes: '',
  type: ''
});