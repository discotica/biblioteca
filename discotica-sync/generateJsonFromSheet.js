import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import fs from 'fs';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vScoTP0-0jq3HAGMIzxS9NOSHsgXx4bxjlFKSPtuFq26OLJ5QCTtulXm328Bdl5lMHzpiOO5ffkpvE4/pub?output=csv';

async function generateJSON() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const csv = await res.text();

    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true
    });

    const data = records.map(row => ({
      number: Number(row.number),
        artist: row.artist,
      title: row.title,
      type: row.type,
      country: row.country.split(',').map(x => x.trim()),
      genre: row.genre.split(',').map(x => x.trim()),
      label: row.label,
      release_date: row.release_date,
      buy_link: row.buy_link,
      review: row.review,
      radar: {
        experimental: Number(row.experimental),
        denso: Number(row.denso),
        sintetico: Number(row.sintetico),
        bailable: Number(row.bailable),
        rapido: Number(row.rapido)
      },
      cover: row.cover
    }));

    fs.writeFileSync('./lanzamientos.json', JSON.stringify(data, null, 2));
    console.log('✅ Archivo lanzamientos.json generado con éxito.');
  } catch (error) {
    console.error('❌ Error al generar JSON:', error.message);
  }
}

generateJSON();