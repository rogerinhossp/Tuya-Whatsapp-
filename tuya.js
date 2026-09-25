import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const {
  TUYA_ACCESS_ID,
  TUYA_ACCESS_SECRET,
  TUYA_REGION = 'us',
  TUYA_DEVICE_ID
} = process.env;

const REGION_MAP = {
  us: 'https://openapi.tuyaus.com',
  'us-e': 'https://openapi-ueaz.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  'eu-w': 'https://openapi-weaz.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
  sg: 'https://openapi.tuyasg.com'
};

const baseUrl = REGION_MAP[TUYA_REGION] || REGION_MAP.us;

let accessToken = null;
let tokenExpire = 0;

function sign(method, path, body = '', t = Date.now()) {
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const stringToSign = [method, contentHash, '', path].join('\n');
  const signStr = TUYA_ACCESS_ID + accessToken + t + stringToSign;
  return crypto
    .createHmac('sha256', TUYA_ACCESS_SECRET)
    .update(signStr, 'utf8')
    .digest('hex')
    .toUpperCase();
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpire - 60000) return accessToken;

  const t = Date.now().toString();
  const path = '/v1.0/token?grant_type=1';
  const signStr =
    TUYA_ACCESS_ID +
    t +
    'GET\n' +
    crypto.createHash('sha256').update('').digest('hex') +
    '\n\n' +
    path;

  const signature = crypto
    .createHmac('sha256', TUYA_ACCESS_SECRET)
    .update(signStr, 'utf8')
    .digest('hex')
    .toUpperCase();

  const res = await axios.get(`${baseUrl}${path}`, {
    headers: {
      client_id: TUYA_ACCESS_ID,
      sign: signature,
      t,
      sign_method: 'HMAC-SHA256'
    }
  });

  if (res.data.success) {
    accessToken = res.data.result.access_token;
    tokenExpire = Date.now() + res.data.result.expire_time * 1000;
    return accessToken;
  }
  throw new Error('Falha ao obter token Tuya: ' + JSON.stringify(res.data));
}

async function tuyaRequest(method, path, body = null) {
  await getToken();
  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = sign(method, path, bodyStr, t);

  const config = {
    method,
    url: `${baseUrl}${path}`,
    headers: {
      client_id: TUYA_ACCESS_ID,
      access_token: accessToken,
      sign: signature,
      t,
      sign_method: 'HMAC-SHA256',
      'Content-Type': 'application/json'
    }
  };
  if (body) config.data = body;

  const res = await axios(config);
  return res.data;
}

// === Funções públicas ===

export async function listDevices() {
  // Tenta listar dispositivos via API
  // Nota: a rota exata pode variar conforme o tipo de projeto Tuya
  try {
    const res = await tuyaRequest('GET', '/v1.0/iot-03/devices');
    return res.result || [];
  } catch (e) {
    // Fallback: se tiver device ID, tenta via user
    if (TUYA_DEVICE_ID) {
      const res = await tuyaRequest(
        'GET',
        `/v1.0/devices/${TUYA_DEVICE_ID}`
      );
      return res.result ? [res.result] : [];
    }
    throw e;
  }
}

export async function getDeviceStatus(deviceId) {
  const res = await tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`);
  return res.result || [];
}

export async function sendCommand(deviceId, commands) {
  // commands = [{ code: 'switch_1', value: true }]
  const res = await tuyaRequest('POST', `/v1.0/devices/${deviceId}/commands`, {
    commands
  });
  return res;
}

export async function turnOn(deviceId, code = 'switch_1') {
  return sendCommand(deviceId, [{ code, value: true }]);
}

export async function turnOff(deviceId, code = 'switch_1') {
  return sendCommand(deviceId, [{ code, value: false }]);
}

export async function toggle(deviceId, code = 'switch_1') {
  const status = await getDeviceStatus(deviceId);
  const current = status.find((s) => s.code === code);
  const newValue = !(current?.value);
  return sendCommand(deviceId, [{ code, value: newValue }]);
}
