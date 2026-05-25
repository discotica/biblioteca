import fs from 'fs';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

// ID del documento
const SHEET_ID = '2PACX-1vScoTP0-0jq3HAGMIzxS9NOSHsgXx4bxjlFKSPtuFq26OLJ5QCTtulXm328Bdl5lMHzpiOO5ffkpvE4';
// GID de la pestaña (sheet)
const GID = '0';

// URL para exportar como CSV
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

async function convertirGoogleSheetAJSON() {
  const res = await fetch(url);
  const csv = await res.text();

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const data = rows.map(row => ({
    artist: row.artist.split(',').map(x => x.trim()).filter(Boolean),
    title: row.title,
    type: row.type.split(',').map(x => x.trim()).filter(Boolean),
    country: row.country.split(',').map(x => x.trim()).filter(Boolean),
    genre: row.genre.split(',').map(x => x.trim()).filter(Boolean),
    label: row.label.split(',').map(x => x.trim()).filter(Boolean),
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

  fs.writeFileSync('./lanzamientos.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ ${data.length} entradas guardadas en lanzamientos.json`);
}

convertirGoogleSheetAJSON().catch(console.error);