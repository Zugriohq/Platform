const sharp=require('C:/Users/JOBA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs=require('fs');
const path=require('path');
(async()=>{
 const root=__dirname;
 fs.mkdirSync(path.join(root,'asset-host/public'),{recursive:true});
 await sharp(path.join(root,'brand-sources/official-wordmark.svg'),{density:192}).resize({width:640}).flatten({background:'#050508'}).png().toFile(path.join(root,'asset-host/public/zugrio-wordmark-silver-v1.png'));
 // Preserve the official paths; strengthen thin contour strokes for small email displays.
 const field=fs.readFileSync(path.join(root,'brand-sources/market-topography.svg'),'utf8')
  .replace(/stroke-opacity="([\d.]+)"/g,(_,n)=>`stroke-opacity="${Math.min(.9,Number(n)+.35)}"`)
  .replace(/stroke-width="([\d.]+)"/g,(_,n)=>`stroke-width="${Number(n)*2.4}"`);
 await sharp(Buffer.from(field),{density:144}).resize({width:1200}).flatten({background:'#050508'}).png().toFile(path.join(root,'asset-host/public/zugrio-market-topography-email-v2.png'));
 console.log('Official logo and market topography exported to email PNGs.');
})().catch(e=>{console.error(e.message);process.exit(1)});
