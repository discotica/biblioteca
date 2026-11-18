<?php
/**
 * Vista previa de enlaces (2026-11-17).
 *
 * El sitio es una SPA sin SSR: WhatsApp, iMessage, Telegram, Slack y compañía
 * leen el HTML sin ejecutar JavaScript, así que solo ven index.html. Apache
 * (.htaccess) envía aquí /lanzamiento/{slug} y /coleccion/{slug}; este script
 * devuelve el mismo index.html con las etiquetas Open Graph de esa ficha en el
 * bloque <!-- vista-previa --> … <!-- /vista-previa --> (src/app.html).
 *
 * Se sirve a todos, no solo a los rastreadores: no depende de reconocer agentes
 * y el título correcto llega desde el primer byte. Para no sumar espera, cada
 * ficha se guarda 10 minutos; el rastreador que genera la vista previa calienta
 * esa caché para quien abre el enlace después.
 *
 * Nunca rompe la página: sin configuración, sin red o sin datos, devuelve
 * index.html con las etiquetas genéricas. Las colecciones privadas no se leen
 * (RLS con la clave publicable), así que no filtran nada.
 *
 * La configuración (URL y clave publicable de Supabase, las mismas del bundle)
 * la escribe scripts/vista-previa-config.mjs al compilar.
 */

const CACHE_TTL = 600;
/** Una ficha que no existe se vuelve a buscar antes: puede publicarse en un rato. */
const CACHE_TTL_MISS = 60;
const HTTP_TIMEOUT = 1.5;
const SITE_NAME = 'Biblioteca Discótica';

$shellPath = __DIR__ . '/index.html';
$shell = @file_get_contents($shellPath);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
if ($shell === false) {
  http_response_code(500);
  exit;
}

$config = @include __DIR__ . '/vista-previa.config.php';
$origin = is_array($config) && !empty($config['origin']) ? rtrim($config['origin'], '/') : 'https://biblioteca.discotica.com';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

$meta = null;
if (is_array($config) && !empty($config['supabase_url']) && !empty($config['supabase_key'])) {
  try {
    $meta = vp_cached($path, $_GET, function () use ($path, $config, $origin) {
      return vp_resolve($path, $_GET, $config, $origin);
    });
  } catch (Throwable $e) {
    $meta = null;
  }
}

echo $meta ? vp_inject($shell, $meta, $origin) : $shell;

// ─── Resolución por ruta ────────────────────────────────────────────────────

/** Etiquetas de la ficha, null si no existe o no es pública, false si la red falló. */
function vp_resolve(string $path, array $query, array $config, string $origin) {
  if (preg_match('#^/lanzamiento/([^/]+)/?$#', $path, $m)) {
    return vp_release(rawurldecode($m[1]), $config, $origin);
  }
  if (preg_match('#^/coleccion/([^/]+)/?$#', $path, $m)) {
    $user = isset($query['usuario']) && is_string($query['usuario']) ? $query['usuario'] : '';
    return vp_collection(rawurldecode($m[1]), $user, $config, $origin);
  }
  return null;
}

function vp_release(string $slug, array $config, string $origin) {
  if ($slug === '') return null;
  $select = 'select=slug,title,release_date,type,label,artists,primary_artists,genres,cover';
  $rows = vp_get($config, 'catalog_releases?' . $select . '&slug=eq.' . rawurlencode($slug) . '&limit=1');
  if ($rows === null) return false;
  if (!$rows) {
    // Alias y slugs viejos: el mismo resolvedor que usa la ficha.
    $match = vp_post($config, 'rpc/resolve_release_slug', ['p_slug' => $slug]);
    if (!is_array($match) || count($match) !== 1 || empty($match[0]['release_id'])) return null;
    $rows = vp_get($config, 'catalog_releases?' . $select . '&id=eq.' . rawurlencode($match[0]['release_id']) . '&limit=1');
  }
  if (!$rows) return null;
  $r = $rows[0];

  $artists = vp_names($r['primary_artists'] ?? null) ?: vp_names($r['artists'] ?? null);
  $title = trim((string)($r['title'] ?? ''));
  $artistLine = vp_join_names($artists);
  $year = preg_match('/^(\d{4})/', (string)($r['release_date'] ?? ''), $y) ? $y[1] : '';
  $facts = array_values(array_filter([trim((string)($r['type'] ?? '')), $year, trim((string)($r['label'] ?? ''))]));
  $genres = vp_names($r['genres'] ?? null);

  $description = implode(' · ', $facts);
  if ($genres) $description .= ($description ? '. ' : '') . implode(', ', array_slice($genres, 0, 4));

  return [
    'title' => $artistLine ? "$title — $artistLine" : $title,
    'description' => $description ?: 'Un lanzamiento en la ' . SITE_NAME . '.',
    'image' => vp_image($r['cover'] ?? ''),
    'url' => $origin . '/lanzamiento/' . rawurlencode((string)$r['slug']),
    'type' => 'music.album',
  ];
}

function vp_collection(string $slug, string $username, array $config, string $origin) {
  if ($slug === '' || $username === '') return null;
  $crates = vp_get($config, 'crates?select=id,name,description,slug,profiles!inner(username,display_name)'
    . '&slug=eq.' . rawurlencode($slug)
    . '&profiles.username=eq.' . rawurlencode($username)
    . '&is_public=eq.true&limit=1');
  if ($crates === null) return false;
  if (!$crates) return null;
  $crate = $crates[0];

  $count = null;
  $items = vp_get($config, 'crate_items?select=release_id&crate_id=eq.' . rawurlencode($crate['id']) . '&order=position.asc&limit=4', $count);
  if ($items === null) {
    // Sin orden manual en el entorno (D1): por fecha de alta, como la ficha.
    $items = vp_get($config, 'crate_items?select=release_id&crate_id=eq.' . rawurlencode($crate['id']) . '&order=added_at.asc&limit=4', $count);
  }
  $image = null;
  $ids = array_values(array_filter(array_map(fn($i) => $i['release_id'] ?? null, $items ?: [])));
  if ($ids) {
    $covers = vp_get($config, 'catalog_releases?select=id,cover&id=in.(' . implode(',', array_map('rawurlencode', $ids)) . ')') ?: [];
    $byId = [];
    foreach ($covers as $c) $byId[$c['id']] = $c['cover'] ?? '';
    foreach ($ids as $id) {
      $image = vp_image($byId[$id] ?? '');
      if ($image) break;
    }
  }

  $owner = trim((string)($crate['profiles']['display_name'] ?? ''));
  if ($owner === '') $owner = '@' . $username;
  $description = trim((string)($crate['description'] ?? ''));
  if ($description === '') {
    $description = $count === null ? 'Una colección en la ' . SITE_NAME . '.'
      : ($count === 1 ? '1 lanzamiento' : "$count lanzamientos") . ' en la ' . SITE_NAME . '.';
  }

  return [
    'title' => trim((string)$crate['name']) . " — colección de $owner",
    'description' => vp_clip($description, 200),
    'image' => $image,
    'url' => $origin . '/coleccion/' . rawurlencode((string)$crate['slug']) . '?usuario=' . rawurlencode($username),
    'type' => 'website',
  ];
}

// ─── Etiquetas ──────────────────────────────────────────────────────────────

function vp_inject(string $shell, array $m, string $origin): string {
  $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $title = $m['title'] . ' — ' . SITE_NAME;
  $tags = [
    '<title>' . $e($title) . '</title>',
    '<meta name="description" content="' . $e($m['description']) . '" />',
    '<link rel="canonical" href="' . $e($m['url']) . '" />',
    '<meta property="og:site_name" content="' . SITE_NAME . '" />',
    '<meta property="og:locale" content="es_LA" />',
    '<meta property="og:type" content="' . $e($m['type']) . '" />',
    '<meta property="og:title" content="' . $e($m['title']) . '" />',
    '<meta property="og:description" content="' . $e($m['description']) . '" />',
    '<meta property="og:url" content="' . $e($m['url']) . '" />',
  ];
  if (!empty($m['image'])) {
    // Portada cuadrada: tarjeta compacta.
    $tags[] = '<meta property="og:image" content="' . $e($m['image']) . '" />';
    $tags[] = '<meta property="og:image:alt" content="' . $e($m['title']) . '" />';
    $tags[] = '<meta name="twitter:card" content="summary" />';
  } else {
    $tags[] = '<meta property="og:image" content="' . $e($origin . '/img/vista-previa.png') . '" />';
    $tags[] = '<meta property="og:image:width" content="1200" />';
    $tags[] = '<meta property="og:image:height" content="630" />';
    $tags[] = '<meta name="twitter:card" content="summary_large_image" />';
  }
  $block = "<!-- vista-previa -->\n\t\t" . implode("\n\t\t", $tags) . "\n\t\t<!-- /vista-previa -->";
  $out = preg_replace('#<!-- vista-previa -->.*?<!-- /vista-previa -->#s', str_replace(['\\', '$'], ['\\\\', '\\$'], $block), $shell, 1, $n);
  return $n === 1 && is_string($out) ? $out : $shell;
}

/**
 * WhatsApp no muestra AVIF, que es lo que guarda el catálogo de Bandcamp
 * (a{id}_1x1_700.avif). Bandcamp sirve la misma imagen en JPG de 700 px
 * (a{id}_16.jpg, ~110 KB): cabe en el límite de las vistas previas.
 * Otra AVIF sin equivalente conocido cae en la imagen genérica.
 */
function vp_image($url): ?string {
  $url = trim((string)$url);
  if (!preg_match('#^https://#i', $url)) return null;
  if (preg_match('#^https://f\d+\.bcbits\.com/img/(a?\d+)_#i', $url, $m)) {
    return 'https://f4.bcbits.com/img/' . $m[1] . '_16.jpg';
  }
  if (preg_match('#\.avif(\?|$)#i', $url)) return null;
  return $url;
}

function vp_names($value): array {
  if (is_string($value)) $value = json_decode($value, true);
  if (!is_array($value)) return [];
  $names = [];
  foreach ($value as $item) {
    $name = is_array($item) ? ($item['name'] ?? '') : $item;
    $name = trim((string)$name);
    if ($name !== '') $names[] = $name;
  }
  return $names;
}

function vp_join_names(array $names): string {
  if (count($names) <= 1) return $names[0] ?? '';
  $last = array_pop($names);
  return implode(', ', $names) . ' y ' . $last;
}

function vp_clip(string $text, int $max): string {
  $text = preg_replace('/\s+/u', ' ', $text);
  if (mb_strlen($text) <= $max) return $text;
  return rtrim(mb_substr($text, 0, $max - 1)) . '…';
}

// ─── Caché ──────────────────────────────────────────────────────────────────

function vp_cached(string $path, array $query, callable $build): ?array {
  $dir = sys_get_temp_dir() . '/discotica-vista-previa';
  $key = sha1($path . '?' . ($query['usuario'] ?? ''));
  $file = "$dir/$key.json";
  $stale = null;
  if (is_file($file)) {
    $cached = json_decode((string)@file_get_contents($file), true);
    if (is_array($cached) && array_key_exists('meta', $cached)) {
      $ttl = $cached['meta'] === null ? CACHE_TTL_MISS : CACHE_TTL;
      if (time() - (int)@filemtime($file) < $ttl) return $cached['meta'];
      $stale = $cached['meta'];
    }
  }
  $meta = $build();
  if ($meta === false) return $stale; // fallo de red: lo último que se supo
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  @file_put_contents($file, json_encode(['meta' => $meta]), LOCK_EX);
  return $meta;
}

// ─── PostgREST ──────────────────────────────────────────────────────────────

/** Filas, [] si no hay, null si la petición falla. $count recibe el total si lo hay. */
function vp_get(array $config, string $resource, &$count = null): ?array {
  return vp_request($config, 'GET', $resource, null, $count);
}

function vp_post(array $config, string $resource, array $body): ?array {
  $count = null;
  return vp_request($config, 'POST', $resource, $body, $count);
}

function vp_request(array $config, string $method, string $resource, ?array $body, &$count): ?array {
  $url = rtrim($config['supabase_url'], '/') . '/rest/v1/' . $resource;
  $headers = [
    'apikey: ' . $config['supabase_key'],
    'Accept: application/json',
    'Prefer: count=exact',
  ];
  // Las claves sb_publishable_ no son JWT: solo van en apikey.
  if (strpos($config['supabase_key'], 'sb_') !== 0) $headers[] = 'Authorization: Bearer ' . $config['supabase_key'];
  if ($body !== null) $headers[] = 'Content-Type: application/json';

  $responseHeaders = [];
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_CUSTOMREQUEST => $method,
      CURLOPT_HTTPHEADER => $headers,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_CONNECTTIMEOUT_MS => (int)(HTTP_TIMEOUT * 1000),
      CURLOPT_TIMEOUT_MS => (int)(HTTP_TIMEOUT * 1000),
      CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$responseHeaders) {
        $responseHeaders[] = trim($line);
        return strlen($line);
      },
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
  } else {
    $context = stream_context_create(['http' => [
      'method' => $method,
      'header' => implode("\r\n", $headers),
      'content' => $body !== null ? json_encode($body) : null,
      'timeout' => HTTP_TIMEOUT,
      'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents($url, false, $context);
    $responseHeaders = $http_response_header ?? [];
    $status = preg_match('#^HTTP/\S+ (\d+)#', $responseHeaders[0] ?? '', $s) ? (int)$s[1] : 0;
  }

  if ($raw === false || $status < 200 || $status >= 300) return null;
  foreach ($responseHeaders as $line) {
    if (preg_match('#^content-range:\s*\S+/(\d+)#i', $line, $c)) $count = (int)$c[1];
  }
  $data = json_decode($raw, true);
  return is_array($data) ? $data : null;
}
