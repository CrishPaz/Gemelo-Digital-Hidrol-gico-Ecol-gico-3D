/**
 * pngDecode.ts - Decodificador PNG mínimo (sin dependencias externas).
 *
 * Solo cubre lo que necesitan los tiles de elevación "Terrarium": 8 bits por canal,
 * RGB/RGBA, no entrelazado. Es suficiente para reconstruir el DEM y evita añadir
 * una dependencia nativa (sharp) o de terceros al proyecto.
 */

import zlib from 'node:zlib';

export interface DecodedPNG {
  width: number;
  height: number;
  channels: number;
  data: Buffer; // RGB(A) sin filtrar, fila por fila
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePNG(buffer: Buffer): DecodedPNG {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Firma PNG inválida');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      const bitDepth = chunk.readUInt8(8);
      const colorType = chunk.readUInt8(9);
      const interlace = chunk.readUInt8(12);
      if (bitDepth !== 8) throw new Error(`Profundidad de bits no soportada: ${bitDepth}`);
      if (interlace !== 0) throw new Error('PNG entrelazado no soportado');
      if (colorType === 2) channels = 3;
      else if (colorType === 6) channels = 4;
      else throw new Error(`Tipo de color no soportado: ${colorType}`);
    } else if (type === 'IDAT') {
      idatChunks.push(chunk);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // longitud + tipo + datos + CRC
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;

    for (let i = 0; i < stride; i++) {
      const rawByte = raw[pos + i];
      const left = i >= channels ? out[rowStart + i - channels] : 0;
      const up = y > 0 ? out[prevStart + i] : 0;
      const upLeft = y > 0 && i >= channels ? out[prevStart + i - channels] : 0;

      let value: number;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + left; break;
        case 2: value = rawByte + up; break;
        case 3: value = rawByte + ((left + up) >> 1); break;
        case 4: value = rawByte + paethPredictor(left, up, upLeft); break;
        default: throw new Error(`Filtro PNG desconocido: ${filter}`);
      }
      out[rowStart + i] = value & 0xff;
    }
    pos += stride;
  }

  return { width, height, channels, data: out };
}
