// file: linkedin.js
// usage:
// node linkedin --search="php, node js, 2 tahun, jakarta"

require('dotenv').config();
const axios = require('axios');

// ==============================
// CONFIG
// ==============================

// ambil dari browser cookies linkedin
// contoh:
// LI_AT=AQED...
// JSESSIONID=ajax:123456789
const LI_AT = process.env.LI_AT;
const JSESSIONID = process.env.JSESSIONID;

if (!LI_AT || !JSESSIONID) {
  console.log(`
ERROR:
set env dulu

Mac/Linux:
export LI_AT="..."
export JSESSIONID="ajax:..."

Windows CMD:
set LI_AT=...
set JSESSIONID=...

Windows PowerShell:
$env:LI_AT="..."
$env:JSESSIONID="ajax:..."
  `);

  process.exit(1);
}

// ==============================
// ARGUMENT PARSER
// ==============================

function getArg(name) {
  const arg = process.argv.find((x) =>
    x.startsWith(`--${name}=`)
  );

  if (!arg) return null;

  return arg.split('=')[1];
}

const searchInput = getArg('search');

if (!searchInput) {
  console.log(`
usage:
node linkedin --search="php, node js, 2 tahun, jakarta"
  `);

  process.exit(1);
}

// ==============================
// LINKEDIN CLIENT
// ==============================

const client = axios.create({
  headers: {
    Cookie: `li_at=${LI_AT}; JSESSIONID=${JSESSIONID}`,
    'csrf-token': JSESSIONID.replace(/"/g, ''),
    'x-restli-protocol-version': '2.0.0',
    'x-li-lang': 'en_US',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    accept: 'application/json, text/plain, */*',
    'referer': 'https://www.linkedin.com/feed/',
  }
});

// ==============================
// SEARCH FUNCTION
// ==============================

async function searchPeople(query) {
  const url =
    'https://www.linkedin.com/voyager/api/search/hits';

  const params = {
    keywords: query,
    origin: 'GLOBAL_SEARCH_HEADER',
    q: 'blended',
    start: 0,
    count: 10
  };

  const res = await client.get(url, {
    params
  });

  return res.data;
}

// ==============================
// PARSE CANDIDATES
// ==============================

function extractText(obj) {
  if (!obj) return '';

  if (typeof obj === 'string') return obj;

  if (Array.isArray(obj)) {
    return obj.map(extractText).join(' ');
  }

  if (typeof obj === 'object') {
    return Object.values(obj)
      .map(extractText)
      .join(' ');
  }

  return '';
}

function parseCandidates(data) {
  const rawText = extractText(data);

  // fallback parsing sederhana
  // voyager sering berubah struktur

  const regex =
    /"title":{"text":"(.*?)"}.*?"primarySubtitle":{"text":"(.*?)"}.*?"secondarySubtitle":{"text":"(.*?)"}/gs;

  const candidates = [];

  let match;

  while ((match = regex.exec(rawText)) !== null) {
    candidates.push({
      name: match[1],
      headline: match[2],
      location: match[3]
    });
  }

  return candidates;
}

// ==============================
// SCORING
// ==============================

function scoreCandidate(candidate, search) {
  let score = 0;

  const text = (
    candidate.name +
    ' ' +
    candidate.headline +
    ' ' +
    candidate.location
  ).toLowerCase();

  const keywords = search
    .toLowerCase()
    .split(',');

  for (const keyword of keywords) {
    const k = keyword.trim();

    if (text.includes(k)) {
      score += 25;
    }
  }

  if (text.includes('senior')) {
    score += 20;
  }

  if (text.includes('lead')) {
    score += 15;
  }

  if (text.includes('engineer')) {
    score += 10;
  }

  return score;
}

// ==============================
// MAIN
// ==============================

async function main() {
  try {
    console.log(`
Searching:
${searchInput}
`);

    const data =
      await searchPeople(searchInput);

    const candidates =
      parseCandidates(data);

    const ranked = candidates
      .map((c) => ({
        ...c,
        score: scoreCandidate(
          c,
          searchInput
        )
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`
==============================
TOP 5 CANDIDATES
==============================
`);

    if (!ranked.length) {
      console.log('No candidates found');
      return;
    }

    ranked.forEach((c, i) => {
      console.log(`
#${i + 1}
Name      : ${c.name}
Headline  : ${c.headline}
Location  : ${c.location}
Score     : ${c.score}
------------------------------
`);
    });
  } catch (err) {
    console.error(`
ERROR:
`);

    if (err.response) {
      console.error(
        err.response.status
      );

      console.error(
        JSON.stringify(
          err.response.data,
          null,
          2
        )
      );
    } else {
      console.error(err.message);
    }
  }
}

main();