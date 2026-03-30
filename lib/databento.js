// databento.js — Databento Historical Data API client

const DATABENTO_BASE = 'https://hist.databento.com/v0';

async function queryDatabento({ dataset, symbols, start, end, schema }) {
  var apiKey = process.env.DATABENTO_API_KEY;
  if (!apiKey) {
    throw new Error('DATABENTO_API_KEY not configured. Add it to your .env file.');
  }

  var url = new URL(DATABENTO_BASE + '/timeseries.get_range');

  var body = {
    dataset: dataset || 'GLBX.MDP3',
    symbols: symbols || 'ES.FUT',
    schema: schema || 'ohlcv-1d',
    start: start,
    end: end,
    encoding: 'json',
    stype_in: 'raw_symbol',
  };

  var response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    var errText = await response.text().catch(function () { return ''; });
    throw new Error('Databento API error (' + response.status + '): ' + errText.substring(0, 200));
  }

  var data = await response.json();
  return Array.isArray(data) ? data : [];
}

module.exports = { queryDatabento };
