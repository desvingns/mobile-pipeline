/* Reproducible voice generation; only the approved narration is sent to TTS. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(root,'../../graph/story/scenario.js'),'utf8'),ctx);
fs.mkdirSync(path.join(root,'assets/voice'),{recursive:true});
for(const s of ctx.window.MP_STORY.stages){fs.writeFileSync(path.join(root,'assets/voice',s.id+'.txt'),s.narration,'utf8');}
fs.writeFileSync(path.join(root,'voice-request.json'),JSON.stringify({provider:'edge-tts',voice:'ru-RU-DmitryNeural',rate:'+12%',lines:ctx.window.MP_STORY.stages.map(s=>({id:s.id,text:s.narration})),bgm:{mode:'none'}},null,2)+'\n');
console.log('Prepared '+ctx.window.MP_STORY.stages.length+' narration files.');
