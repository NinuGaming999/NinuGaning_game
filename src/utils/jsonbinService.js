import axios from 'axios';

// NOTE: JSONBin's real API host is api.jsonbin.io (not jsonbin.io).
const BIN_ID = import.meta.env.VITE_JSONBIN_ID;
const API_KEY = import.meta.env.VITE_JSONBIN_KEY;
const BASE_URL = 'https://api.jsonbin.io/v3/b';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': API_KEY,
    'X-Bin-Meta': 'false',
  };
}

export async function fetchBinData() {
  const res = await axios.get(`${BASE_URL}/${BIN_ID}/latest`, {
    headers: getHeaders(),
  });
  return res.data;
}

export async function saveBinData(data) {
  const res = await axios.put(`${BASE_URL}/${BIN_ID}`, data, {
    headers: getHeaders(),
  });
  return res.data;
}
