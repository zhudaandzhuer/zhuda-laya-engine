import zlib from 'node:zlib';
export function png(color) {
  const crc = bytes => { let c = -1; for (const b of bytes) { c ^= b; for (let i=0;i<8;i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ -1) >>> 0; };
  const chunk = (name, bytes) => {
    const type = Buffer.from(name), header = Buffer.alloc(4), checksum = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(Buffer.concat([type, bytes])));
    return Buffer.concat([header, type, bytes, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(16); header.writeUInt32BE(16,4); header[8]=8; header[9]=6;
  const rows = Buffer.concat(Array.from({length:16},()=>Buffer.concat([Buffer.from([0]),Buffer.from(Array(16).fill(color).flat())])));
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",zlib.deflateSync(rows)),chunk("IEND",Buffer.alloc(0))]);
}
