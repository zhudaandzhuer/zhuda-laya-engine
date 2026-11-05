import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const inside=(root,file)=>file===root || (!path.relative(root,file).startsWith('..'+path.sep) && path.relative(root,file)!=='..' && !path.isAbsolute(path.relative(root,file)));
export function resolveBundleFile(root, address) {
  const url=new URL(address);
  if(url.protocol!=='app:' || url.hostname!=='bundle' || url.port || url.username || url.password)throw Error('APP_PATH_ESCAPE');
  const base=fs.realpathSync(root), pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\\') || pathname.includes('\0'))throw Error('APP_PATH_ESCAPE');
  let file=path.resolve(base,'.'+pathname);
  if(!inside(base,file))throw Error('APP_PATH_ESCAPE');
  if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  file=fs.realpathSync(file);
  if(!inside(base,file))throw Error('APP_PATH_ESCAPE');
  const stat=fs.statSync(file);
  if(!stat.isFile() || stat.size>256*1024*1024)throw Error('APP_FILE_LIMIT');
  return file;
}
/** Copy a validated consumer bundle into the app so an installed EXE needs no source checkout. */
export function stageBundle(source, destination) {
  const root=fs.realpathSync(source), dest=path.resolve(destination);
  if(inside(root,dest) || inside(dest,root))throw Error('Bundle staging roots must be separate');
  const parent=path.dirname(dest);fs.mkdirSync(parent,{recursive:true});
  const stage=fs.mkdtempSync(path.join(parent,'.zhuda-stage-')), files=[];
  let total=0;
  const copy=(directory,relative='')=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const name=path.join(relative,entry.name), input=path.join(directory,entry.name), output=path.join(stage,name);
      if(entry.isSymbolicLink())throw Error('Bundle staging refuses symlinks: '+name);
      if(entry.isDirectory()){fs.mkdirSync(output);copy(input,name);}
      else if(entry.isFile()){
        const stat=fs.statSync(input);total+=stat.size;
        if(stat.size>256*1024*1024 || total>1024*1024*1024)throw Error('Bundle staging byte budget exceeded');
        const bytes=fs.readFileSync(input);fs.writeFileSync(output,bytes);files.push({path:name.replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
      }else throw Error('Bundle staging requires ordinary files: '+name);
    }
  };
  const backup=stage+'-previous';let moved=false;
  try {
    copy(root);
    resolveBundleFile(stage,'app://bundle/index.html');
    const manifest={schemaVersion:1,files,totalBytes:total};fs.writeFileSync(path.join(stage,'desktop-bundle.json'),JSON.stringify(manifest,null,2));
    if(fs.existsSync(dest)){fs.renameSync(dest,backup);moved=true;}
    try{fs.renameSync(stage,dest);}catch(error){if(moved)fs.renameSync(backup,dest);throw error;}
    if(moved)fs.rmSync(backup,{recursive:true,force:true});return manifest;
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.env.ZHUDA_WEB_ROOT)throw Error('Set ZHUDA_WEB_ROOT to a built consumer dist/web before packaging');
  console.log(JSON.stringify(stageBundle(process.env.ZHUDA_WEB_ROOT,path.join(import.meta.dirname,'web')),null,2));
}
