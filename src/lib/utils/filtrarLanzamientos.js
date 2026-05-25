export function filtrarLanzamientos(data, filtros, radar) {
  return data.filter(item => {
    const matchTexto =
      filtros.texto === '' ||
      item.titulo.toLowerCase().includes(filtros.texto.toLowerCase()) ||
      item.artista?.toLowerCase().includes(filtros.texto.toLowerCase()) ||
      item.sello?.toLowerCase().includes(filtros.texto.toLowerCase());

    const matchPais =
      filtros.pais.length === 0 ||
      filtros.pais.some(p => item.pais?.includes(p));

    const matchGenero =
      filtros.genero.length === 0 ||
      filtros.genero.some(g => item.genero?.includes(g));

    const matchAño = filtros.año === '' || item.fecha.startsWith(filtros.año);
    const matchMes = filtros.mes === '' || item.fecha.split('-')[1] === filtros.mes;

    return matchTexto && matchPais && matchGenero && matchAño && matchMes;
  });
}