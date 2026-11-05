import {MeshoptEncoder} from 'meshoptimizer/encoder';
/** Compress an authored neutral fixture without replacing scene/art definitions. */
export async function compressFixture(document) {
 await MeshoptEncoder.ready;
 const d=structuredClone(document), original=Buffer.from(d.buffers[0].uri.split(',')[1],'base64'), chunks=[];
 let offset=0;
 for(let i=0;i<d.bufferViews.length;i++){
  const v=d.bufferViews[i], accessor=d.accessors.find(a=>a.bufferView===i);
  const stride=accessor.type==='SCALAR' && accessor.componentType===5123?2:4;
  const mode=stride===2?'TRIANGLES':'ATTRIBUTES', count=v.byteLength/stride;
  const bytes=MeshoptEncoder.encodeGltfBuffer(original.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),count,stride,mode,0);
  v.buffer=1; v.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:bytes.byteLength,byteStride:stride,count,mode}};
  chunks.push(bytes);offset+=bytes.byteLength;
 }
 const payload=Buffer.concat(chunks);
 d.buffers=[{byteLength:payload.length,uri:'data:application/octet-stream;base64,'+payload.toString('base64')},{byteLength:original.length,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 d.extensionsUsed=[...(d.extensionsUsed??[]),'EXT_meshopt_compression'];d.extensionsRequired=[...(d.extensionsRequired??[]),'EXT_meshopt_compression'];
 return d;
}
export function embeddedGlb(document){
 const d=structuredClone(document), bin=Buffer.from(d.buffers[0].uri.split(',')[1],'base64');delete d.buffers[0].uri;
 const json=Buffer.from(JSON.stringify(d)),jl=Math.ceil(json.length/4)*4,bl=Math.ceil(bin.length/4)*4;
 const out=Buffer.alloc(28+jl+bl);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jl,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+jl);json.copy(out,20);out.writeUInt32LE(bl,20+jl);out.writeUInt32LE(0x004e4942,24+jl);bin.copy(out,28+jl);return out;
}
