// LifeBreath Dashboard v2 - app.js (complete)
const API_BASE = "https://api.breathanalyzer.in"; // change if needed
function $(id){return document.getElementById(id)}
const waveCanvas = $('wave'); const ctx = waveCanvas.getContext('2d');
let audioStream=null, audioCtx=null, analyser=null, dataArray=null, rafId=null;
let mediaRecorder=null, recordedChunks=[];
let envHistory = [], envHistoryMax = 800;
function envelopeFromData(buf){ let sum=0; for(let i=0;i<buf.length;i++){ let v=Math.abs(buf[i]-128); sum+=v } return sum/buf.length }
function drawWave(){ if(!analyser) return; analyser.getByteTimeDomainData(dataArray); ctx.clearRect(0,0,waveCanvas.width,waveCanvas.height); ctx.lineWidth=2; ctx.strokeStyle='rgba(0,255,153,0.95)'; ctx.beginPath(); const slice = waveCanvas.width / dataArray.length; let x=0; for(let i=0;i<dataArray.length;i++){ const v=(dataArray[i]-128)/128; const y=(v * waveCanvas.height/2) + waveCanvas.height/2; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); x+=slice } ctx.stroke(); const env=envelopeFromData(dataArray); envHistory.push(env); if(envHistory.length>envHistoryMax) envHistory.shift(); estimateBPMandStress(); rafId = requestAnimationFrame(drawWave); }
// BPM & stress estimation
let lastPeakTime=0, peakTimes=[];
function estimateBPMandStress(){ if(envHistory.length<30){ updateMetrics(0,0); return } const arr=envHistory.slice(-240); const mean=arr.reduce((a,b)=>a+b,0)/arr.length; const sd=Math.sqrt(arr.reduce((s,v)=>s+(v-mean)*(v-mean),0)/arr.length); const thresh = mean + Math.max(0.5, 0.5*sd); const last = arr[arr.length-1]; const prev = arr[arr.length-2]||0; const isPeak = last>thresh && last>prev; const now = Date.now(); if(isPeak && (now-lastPeakTime>400)){ lastPeakTime=now; peakTimes.push(now); peakTimes = peakTimes.filter(t=> now - t < 60000) } const bpm = Math.round( peakTimes.length * (60 / Math.max(1, (Math.min(60000, now - (peakTimes[0]||now)) / 1000))) ); const recent = envHistory.slice(-480); const meanR = recent.reduce((a,b)=>a+b,0)/recent.length; const sdR = Math.sqrt(recent.reduce((s,v)=>s+(v-meanR)*(v-meanR),0)/recent.length); const maxSD = 100; const minSD = 0.1; const norm = Math.max(0, Math.min(1, (sdR - minSD) / (maxSD - minSD))); const stress = Math.round((1 - norm) * 100); updateMetrics(bpm, stress); addStressPoint(stress); }
// update UI
function updateMetrics(bpm, stress){ $('bpm').innerText = bpm>0?bpm:'—'; $('stress').innerText = stress>0?stress:'—'; drawStressBar(stress); }
// draw stress bar
function drawStressBar(value){ const c=$('stressBar'); const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height); const w=c.width, h=c.height; g.fillStyle='rgba(255,255,255,0.04)'; g.fillRect(0,0,w,h); const fill = Math.max(0,Math.min(100,value)); const px = (fill/100)*w; const grd = g.createLinearGradient(0,0,w,0); grd.addColorStop(0,'#00ff99'); grd.addColorStop(1,'#ff4d4d'); g.fillStyle=grd; g.fillRect(0,0,px,h); g.fillStyle='#cde'; g.font='12px sans-serif'; g.fillText(`${value} / 100`, 8, 16); }
// Chart.js line for stress trend
const stressCtx = document.getElementById('stressChart') && document.getElementById('stressChart').getContext('2d');
let stressChart=null, stressData=[];
function initStressChart(){ if(!stressCtx) return; const cfg = { type:'line', data:{ labels:[], datasets:[{ label:'Stress', data:[], fill:false, borderColor:'#00ff99', tension:0.2 }] }, options:{ responsive:true, scales:{ x:{ display:false }, y:{ min:0, max:100 } } } }; stressChart = new Chart(stressCtx, cfg); }
function addStressPoint(v){ if(!stressChart) return; const ts = new Date().toLocaleTimeString(); stressChart.data.labels.push(ts); stressChart.data.datasets[0].data.push(v); if(stressChart.data.labels.length>60){ stressChart.data.labels.shift(); stressChart.data.datasets[0].data.shift(); } stressChart.update(); }
// mic connect
$('connectMic').addEventListener('click', async ()=>{ try{ audioStream = await navigator.mediaDevices.getUserMedia({ audio:true }); audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const source = audioCtx.createMediaStreamSource(audioStream); analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; dataArray = new Uint8Array(analyser.fftSize); source.connect(analyser); drawWave(); $('startRec').disabled=false; $('status').innerText='Mic connected'; checkApiStatus(); }catch(e){ alert('Mic access denied'); console.error(e)} });
// record & send
$('startRec').addEventListener('click', ()=>{ if(!audioStream) return alert('Connect microphone first'); recordedChunks=[]; mediaRecorder = new MediaRecorder(audioStream); mediaRecorder.ondataavailable = e=>{ if(e.data.size>0) recordedChunks.push(e.data) }; mediaRecorder.onstop = async ()=>{ const blob = new Blob(recordedChunks,{type:'audio/webm'}); $('status').innerText='Uploading...'; const profile = loadProfile(); const form = new FormData(); form.append('user', profile.name||'web_user'); form.append('fs', '' + (audioCtx ? Math.round(audioCtx.sampleRate) : 48000)); form.append('profile', JSON.stringify(profile)); form.append('file', blob, 'breath.webm'); try{ const res = await fetch(API_BASE + '/api/session', { method:'POST', body: form }); const data = await res.json(); $('status').innerText = 'Saved: ' + (data.saved||'ok'); }catch(err){ $('status').innerText='Upload error'; console.error(err) } }; mediaRecorder.start(); $('status').innerText='Recording...'; setTimeout(()=> mediaRecorder.stop(), 5000); });
// auto-send on checkbox
document.getElementById('liveSend').addEventListener('change', (e)=>{ if(e.target.checked){ // start short recordings loop
    startAutoSend();
  } else {
    stopAutoSend();
  } });
let autoSendInterval=null;
function startAutoSend(){ if(autoSendInterval) return; autoSendInterval = setInterval(()=>{ if(mediaRecorder && mediaRecorder.state==='recording') return; // don't interfere
  // briefly record using MediaRecorder with 3s window
  recordedChunks=[]; const mr = new MediaRecorder(audioStream); mr.ondataavailable = e=>{ if(e.data.size>0) recordedChunks.push(e.data) }; mr.onstop = async ()=>{ const blob = new Blob(recordedChunks,{type:'audio/webm'}); const profile = loadProfile(); const form = new FormData(); form.append('user', profile.name||'web_user'); form.append('fs', ''+(audioCtx?Math.round(audioCtx.sampleRate):48000)); form.append('profile', JSON.stringify(profile)); form.append('file', blob, 'breath.webm'); try{ await fetch(API_BASE + '/api/session',{method:'POST', body: form}); }catch(e){} }; mr.start(); setTimeout(()=>mr.stop(),3000); }, 8000); }
function stopAutoSend(){ if(!autoSendInterval) return; clearInterval(autoSendInterval); autoSendInterval=null; }
// API status
async function checkApiStatus(){ try{ const res = await fetch(API_BASE + '/'); $('apiStatus').innerText = res.ok? 'API: online' : 'API: offline'; }catch(e){ $('apiStatus').innerText = 'API: unreachable' } }
// pranayama timer & selector
const defaultPhases = [{ name:'Pūraka (Inhale)', t:4},{ name:'Antar Kumbhaka (Hold)', t:4},{ name:'Rechaka (Exhale)', t:4},{ name:'Bāhya Kumbhaka (Hold)', t:4},{ name:'Re-Pūraka (Re-Inhale)', t:4},{ name:'Re-Antar Kumbhaka (Re-Hold)', t:4},{ name:'Re-Rechaka (Re-Exhale)', t:4},{ name:'Re-Bāhya Kumbhaka (Re-Hold)', t:4}];
let PHASES=[...defaultPhases], phaseIdx=0, remaining=0, phaseTimer=null, cycleOn=false;
function updatePhaseUI(){ $('phaseName').innerText = PHASES[phaseIdx]?.name || '—'; $('phaseTimer').innerText = new Date(remaining*1000).toISOString().substr(14,5) }
$('startCycle').addEventListener('click', ()=>{ if(cycleOn || PHASES.length===0) return; cycleOn=true; $('stopCycle').disabled=false; $('startCycle').disabled=true; phaseIdx=0; remaining=PHASES[0].t; updatePhaseUI(); phaseTimer = setInterval(()=>{ remaining--; updatePhaseUI(); if(remaining<=0){ phaseIdx=(phaseIdx+1)%PHASES.length; remaining = PHASES[phaseIdx].t; updatePhaseUI(); } },1000); });
$('stopCycle').addEventListener('click', ()=>{ clearInterval(phaseTimer); cycleOn=false; $('stopCycle').disabled=true; $('startCycle').disabled=false; $('phaseName').innerText='—'; $('phaseTimer').innerText='00:00'; });
$('savePhases').addEventListener('click', ()=>{ const selected = Array.from(document.querySelectorAll('#phaseSelector input[type=checkbox]:checked')).map(cb=>cb.value); PHASES = defaultPhases.filter(p=>selected.includes(p.name)); alert(`Saved ${PHASES.length} phases.`); });
// profile save/load
function saveProfile(){ const profile = { name:$('profileName').value||'', age:$('profileAge').value||'', gender:$('profileGender').value||'', notes:$('profileNotes').value||'' }; localStorage.setItem('lb_profile', JSON.stringify(profile)); alert('Profile saved'); }
function loadProfile(){ const raw = localStorage.getItem('lb_profile'); if(!raw) return {name:'',age:'',gender:'',notes:''}; const p = JSON.parse(raw); $('profileName').value=p.name||''; $('profileAge').value=p.age||''; $('profileGender').value=p.gender||''; $('profileNotes').value=p.notes||''; return p; }
$('saveProfile').addEventListener('click', saveProfile); loadProfile();
// download CSV (session-level)
$('downloadCSV').addEventListener('click', async ()=>{ try{ const res = await fetch(API_BASE + '/export/cohort_csv'); if(!res.ok) throw new Error('Download failed'); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cohort_export.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(err){ alert('CSV download error: '+err.message) } });
$('openReports').addEventListener('click', ()=>{ window.open(API_BASE + '/reports/','_blank') });
// stress chart init
initStressChart();
// canvas sizing
function fitCanvas(){ const dpr = window.devicePixelRatio||1; waveCanvas.width = waveCanvas.clientWidth * dpr; waveCanvas.height = waveCanvas.clientHeight * dpr; ctx.scale(dpr,dpr); }
window.addEventListener('resize', fitCanvas); fitCanvas(); checkApiStatus();
