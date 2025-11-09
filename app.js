const API_BASE = "https://api.breathanalyzer.in"; // change to your API URL if needed

// Helpers
function $(id){return document.getElementById(id)}
const waveCanvas = $('wave');
const ctx = waveCanvas.getContext('2d');
let audioStream=null, audioCtx=null, analyser=null, dataArray=null, rafId=null;
let recording=false, mediaRecorder=null, recordedChunks=[];

function drawWave(){
  if(!analyser) return;
  analyser.getByteTimeDomainData(dataArray);
  ctx.clearRect(0,0,waveCanvas.width,waveCanvas.height);
  ctx.lineWidth=2; ctx.strokeStyle='rgba(0,255,153,0.9)'; ctx.beginPath();
  const sliceWidth = waveCanvas.width / dataArray.length;
  let x=0;
  for(let i=0;i<dataArray.length;i++){
    const v = dataArray[i]/128.0; const y = v * waveCanvas.height/2;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    x+=sliceWidth;
  }
  ctx.stroke();
  rafId = requestAnimationFrame(drawWave);
}

// Microphone connection
$('connectMic').addEventListener('click', async ()=>{
  try{
    audioStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(audioStream);
    analyser = audioCtx.createAnalyser(); analyser.fftSize=2048;
    dataArray = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    drawWave();
    $('startRec').disabled=false;
    $('status').innerText='Mic connected';
    checkApiStatus();
  }catch(e){ console.error(e); alert('Microphone access denied or unavailable'); }
});

// Recording & sending (5s)
$('startRec').addEventListener('click', ()=>{
  if(!audioStream){ alert('Connect microphone first'); return; }
  recordedChunks=[];
  mediaRecorder = new MediaRecorder(audioStream);
  mediaRecorder.ondataavailable = e => { if(e.data.size>0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = async ()=>{
    const blob = new Blob(recordedChunks, {type:'audio/webm'});
    $('status').innerText='Uploading...';
    const form = new FormData();
    form.append('user','web_user');
    form.append('fs','48000');
    form.append('file', blob, 'breath.webm');
    try{
      const res = await fetch(API_BASE + '/api/session', { method:'POST', body: form });
      const txt = await res.text();
      $('status').innerText = 'Server response: ' + txt;
    }catch(err){
      $('status').innerText = 'Upload error: ' + err;
    }
  };
  mediaRecorder.start();
  $('status').innerText='Recording...';
  setTimeout(()=>{ mediaRecorder.stop(); }, 5000);
});

async function checkApiStatus(){
  try{
    const res = await fetch(API_BASE + '/');
    if(res.ok){ $('apiStatus').innerText='API: online'; $('apiStatus').style.color='var(--neon)'; }
    else { $('apiStatus').innerText='API: offline'; $('apiStatus').style.color='salmon'; }
  }catch(e){ $('apiStatus').innerText='API: unreachable'; $('apiStatus').style.color='salmon'; }
}

/// --- Phase Selection ---
const defaultPhases = [
  { name: 'Pūraka (Inhale)', t: 4 },
  { name: 'Antar Kumbhaka (Hold)', t: 4 },
  { name: 'Rechaka (Exhale)', t: 4 },
  { name: 'Bāhya Kumbhaka (Hold)', t: 4 },
  { name: 'Re-Pūraka (Re-Inhale)', t: 4 },
  { name: 'Re-Antar Kumbhaka (Re-Hold)', t: 4 },
  { name: 'Re-Rechaka (Re-Exhale)', t: 4 },
  { name: 'Re-Bāhya Kumbhaka (Re-Hold)', t: 4 }
];

let PHASES = [...defaultPhases]; // Current active set

document.getElementById('savePhases').addEventListener('click', () => {
  const selected = Array.from(document.querySelectorAll('#phaseSelector input[type=checkbox]:checked'))
    .map(cb => cb.value);

  PHASES = defaultPhases.filter(p => selected.includes(p.name));
  alert(`Saved ${PHASES.length} active phases!`);
});

$('startCycle').addEventListener('click', ()=>{
  if(cycleOn) return;
  cycleOn=true; $('stopCycle').disabled=false; $('startCycle').disabled=true;
  phaseIdx=0; remaining=PHASES[0].t; updatePhaseUI();
  phaseTimer = setInterval(()=>{
    remaining--; updatePhaseUI();
    if(remaining<=0){
      phaseIdx=(phaseIdx+1)%PHASES.length; remaining=PHASES[phaseIdx].t; updatePhaseUI();
      // play bell or sound cue if needed (requires hosting bell.mp3)
      // new Audio('assets/bell.mp3').play();
    }
  },1000);
});
$('stopCycle').addEventListener('click', ()=>{
  clearInterval(phaseTimer); cycleOn=false; $('stopCycle').disabled=true; $('startCycle').disabled=false;
  $('phaseName').innerText='—'; $('phaseTimer').innerText='00:00';
});

// Exports
$('downloadCSV').addEventListener('click', ()=>{
  window.open(API_BASE + '/export/cohort_csv', '_blank');
});
$('openReports').addEventListener('click', ()=>{
  alert('This button links to the server reports folder endpoint when hosted on your VPS.');
});

// resize canvas to DPR
function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  waveCanvas.width = waveCanvas.clientWidth * dpr;
  waveCanvas.height = waveCanvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();
checkApiStatus();
