// Immersive Reader - TXT/EPUB with encoding detection & chunk loading

let currentBook = null; // { id,name,type,chapters,book?,rendition?,encoding }
let currentIndex = 0;
let fontSize = parseInt(localStorage.getItem('retroReaderFont')||'16',10);
let theme = localStorage.getItem('retroReaderTheme')||'light';
let shelves = [];
let scrollSaveTimer = null;
let activeLoaderToken = 0; // cancellation token

// DOM
const pageContainer = document.getElementById('pageContainer');
const shelfView = document.getElementById('shelfView');
const readerView = document.getElementById('readerView');
const chapterSelect = document.getElementById('chapterSelect');
const fontSizeInd = document.getElementById('fontSizeInd');
const fileInput = document.getElementById('fileInput');
const toggleShelfBtn = document.getElementById('toggleShelf');
const toggleReaderBtn = document.getElementById('toggleReader');
const themeSwitchBtn = document.getElementById('themeSwitch');
const prevChapterBtn = document.getElementById('prevChapter');
const nextChapterBtn = document.getElementById('nextChapter');
const resetPosBtn = document.getElementById('resetPos');
const encodingSelect = document.getElementById('encodingSelect');
const loadFill = document.getElementById('loadFill');
const loadText = document.getElementById('loadText');
const loadBar = document.getElementById('loadBar');
const progressFill = document.getElementById('progressFill');
const shelfGrid = document.getElementById('shelfGrid');

document.documentElement.dataset.theme = theme;
pageContainer.style.fontSize = fontSize + 'px';
fontSizeInd.textContent = fontSize;

function saveProgress(){
  if(!currentBook) return;
  try{
    const key = 'retroReaderProgress_'+currentBook.id;
    const payload = { idx: currentIndex, scroll: pageContainer.scrollTop, font: fontSize, theme };
    localStorage.setItem(key, JSON.stringify(payload));
  }catch(e){}
}

function restoreProgress(book){
  try{
    const raw = localStorage.getItem('retroReaderProgress_'+book.id);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(typeof data.font==='number'){ fontSize=data.font; pageContainer.style.fontSize=fontSize+'px'; fontSizeInd.textContent=fontSize; }
    if(data.theme){ theme=data.theme; document.documentElement.dataset.theme=theme; }
    if(typeof data.idx==='number'){ currentIndex=data.idx; }
    setTimeout(()=>{ pageContainer.scrollTop = data.scroll||0; updateProgress(); },60);
  }catch(e){}
}

function parseTxt(raw){
  const lines = raw.split(/\r?\n/);
  const chapters=[]; let current={title:'开始',content:[]};
  const pat=/^(第[\d一二三四五六七八九十百千万〇零两]+[章节回卷])|(Chapter\s+\d+)|(Part\s+\d+)/i;
  for(const line of lines){
    const t=line.trim();
    if(!t){ current.content.push(''); continue; }
    if(pat.test(t)){
      if(current.content.some(p=>p.trim())) chapters.push(current);
      current={title:t.replace(/\s+/g,' '),content:[]};
    }else current.content.push(line);
  }
  if(current.content.some(p=>p.trim())) chapters.push(current);
  if(chapters.length<=1) return [{title:currentBook?.name||'全文',content:raw.split(/\r?\n/)}];
  return chapters;
}

function renderTxtChapter(){
  if(!currentBook) return; const ch=currentBook.chapters[currentIndex]; if(!ch) return;
  pageContainer.innerHTML='<h2>'+escapeHtml(ch.title)+'</h2>'+ch.content.map(p=>'<p>'+escapeHtml(p)+'</p>').join('');
  pageContainer.scrollTop=0; updateProgress(); chapterSelect.value=String(currentIndex); saveProgress();
}

function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

function updateProgress(){
  if(!currentBook) return;
  const chapterPortion=currentBook.chapters.length? currentIndex/currentBook.chapters.length:0;
  const inside= pageContainer.scrollHeight>pageContainer.clientHeight ? (pageContainer.scrollTop/(pageContainer.scrollHeight-pageContainer.clientHeight))/(currentBook.chapters.length||1):0;
  progressFill.style.width=((chapterPortion+inside)*100).toFixed(2)+'%';
}

function buildChapterSelect(){
  chapterSelect.innerHTML=currentBook.chapters.map((c,i)=>`<option value="${i}">${i+1}. ${escapeHtml(c.title.slice(0,40))}</option>`).join('');
}

function addShelfEntry(meta){ if(!shelves.find(b=>b.id===meta.id)) shelves.push(meta); buildShelf(); }
function buildShelf(){ shelfGrid.innerHTML = shelves.map(b=>`<div class="book-slot" data-id="${b.id}"><div class="title" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</div><div class="fmt">${b.type.toUpperCase()}</div></div>`).join(''); }

function showShelf(){ shelfView.classList.add('active'); readerView.hidden=true; toggleShelfBtn.setAttribute('aria-pressed','true'); toggleReaderBtn.setAttribute('aria-pressed','false'); }
function showReader(){ shelfView.classList.remove('active'); readerView.hidden=false; toggleShelfBtn.setAttribute('aria-pressed','false'); toggleReaderBtn.setAttribute('aria-pressed','true'); }
function openFromShelf(id){ if(currentBook && currentBook.id===id){ showReader(); return;} showReader(); }

function detectEncoding(buffer){
  try{ const dec=new TextDecoder('utf-8',{fatal:false}); const text=dec.decode(buffer.slice(0,Math.min(buffer.byteLength,200000))); const rep=(text.match(/\uFFFD/g)||[]).length/Math.max(1,text.length); if(rep>0.02) return 'gb18030'; if(/Ã|¢|Â|ð|Õ/.test(text)) return 'gb18030'; return 'utf-8'; }catch(e){ return 'utf-8'; }
}

async function loadTxt(file){
  activeLoaderToken++; const token=activeLoaderToken; const CHUNK=512*1024; let offset=0; let parts=[]; let detectBuf=null; loadBar.hidden=false; loadFill.style.width='0%'; loadText.textContent='读取 0%';
  while(offset<file.size){ if(token!==activeLoaderToken) return; const slice=file.slice(offset,offset+CHUNK); const buf=await slice.arrayBuffer(); if(!detectBuf) detectBuf=buf; parts.push(new Uint8Array(buf)); offset+=CHUNK; const pct=Math.min(100,offset/file.size*100).toFixed(1); loadFill.style.width=pct+'%'; loadText.textContent='读取 '+pct+'%'; await new Promise(r=>setTimeout(r,0)); }
  if(token!==activeLoaderToken) return; let enc=encodingSelect.value; if(enc==='auto') enc=detectEncoding(detectBuf); let decoder; try{ decoder=new TextDecoder(enc);}catch(e){ decoder=new TextDecoder('utf-8'); }
  const totalLen=parts.reduce((a,p)=>a+p.length,0); const all=new Uint8Array(totalLen); let pos=0; for(const p of parts){ all.set(p,pos); pos+=p.length; }
  loadText.textContent='解析章节...'; await new Promise(r=>setTimeout(r,0));
  const text=decoder.decode(all);
  currentBook={id:file.name+'_'+file.size,name:file.name,type:'txt',encoding:enc,chapters:[]}; addShelfEntry({id:currentBook.id,name:currentBook.name,type:'txt'});
  await new Promise(r=>setTimeout(()=>{ currentBook.chapters=parseTxt(text); r(); },0));
  buildChapterSelect(); restoreProgress(currentBook); renderTxtChapter(); loadFill.style.width='100%'; loadText.textContent='完成'; setTimeout(()=>{ if(loadText.textContent==='完成'){ loadBar.hidden=true; loadText.textContent=''; loadFill.style.width='0'; } },1600);
}

function loadEpub(file){
  loadBar.hidden=false; loadFill.style.width='30%'; loadText.textContent='加载目录';
  const url=URL.createObjectURL(file); const book=ePub(url); currentBook={id:file.name+'_'+file.size,name:file.name,type:'epub',book,chapters:[]}; addShelfEntry({id:currentBook.id,name:currentBook.name,type:'epub'});
  book.loaded.navigation.then(nav=>{ currentBook.chapters=nav.toc.map(i=>({href:i.href,title:i.label})); buildChapterSelect(); restoreProgress(currentBook); gotoEpubChapter(currentIndex); loadFill.style.width='100%'; loadText.textContent='完成'; setTimeout(()=>{ loadBar.hidden=true; loadText.textContent=''; loadFill.style.width='0'; },1200); });
}

function gotoEpubChapter(idx){ if(!currentBook) return; if(idx<0||idx>=currentBook.chapters.length) return; currentIndex=idx; chapterSelect.value=String(currentIndex); currentBook.book.rendition?.destroy?.(); if(!currentBook.rendition){ currentBook.rendition=currentBook.book.renderTo('pageContainer',{width:'100%',height:'100%',flow:'scrolled-doc'}); currentBook.rendition.themes.register('light',{body:{background:'var(--paper)',color:'var(--ink)','font-size':fontSize+'px'}}); currentBook.rendition.themes.register('dark',{body:{background:'var(--paper)',color:'var(--ink)','font-size':fontSize+'px'}}); currentBook.rendition.themes.register('sepia',{body:{background:'var(--paper)',color:'var(--ink)','font-size':fontSize+'px'}}); }
  currentBook.rendition.display(currentBook.chapters[currentIndex].href); applyRenditionTheme(); updateProgress(); saveProgress(); }

function applyRenditionTheme(){ if(currentBook?.rendition) currentBook.rendition.themes.select(theme); }
function changeChapter(delta){ if(!currentBook) return; const next=currentIndex+delta; if(next<0||next>=currentBook.chapters.length) return; currentIndex=next; saveProgress(); if(currentBook.type==='txt') renderTxtChapter(); else gotoEpubChapter(currentIndex); }

function bindEvents(){
  fileInput.addEventListener('change', e=>{ const files=Array.from(e.target.files||[]); if(!files.length) return; const f=files[0]; if(f.name.toLowerCase().endsWith('.txt')) loadTxt(f); else if(f.name.toLowerCase().endsWith('.epub')) loadEpub(f); showReader(); });
  toggleShelfBtn.addEventListener('click', showShelf);
  toggleReaderBtn.addEventListener('click', showReader);
  themeSwitchBtn.addEventListener('click', ()=>{ theme= theme==='light'?'dark':(theme==='dark'?'sepia':'light'); document.documentElement.dataset.theme=theme; localStorage.setItem('retroReaderTheme', theme); applyRenditionTheme(); saveProgress(); });
  prevChapterBtn.addEventListener('click', ()=>changeChapter(-1));
  nextChapterBtn.addEventListener('click', ()=>changeChapter(1));
  chapterSelect.addEventListener('change', e=>{ currentIndex=parseInt(e.target.value,10)||0; saveProgress(); if(currentBook?.type==='txt') renderTxtChapter(); else gotoEpubChapter(currentIndex); });
  pageContainer.addEventListener('scroll', ()=>{ updateProgress(); clearTimeout(scrollSaveTimer); scrollSaveTimer=setTimeout(()=>saveProgress(),400); });
  document.getElementById('fontDec').addEventListener('click',()=>{ fontSize=Math.max(12,fontSize-1); pageContainer.style.fontSize=fontSize+'px'; fontSizeInd.textContent=fontSize; localStorage.setItem('retroReaderFont',fontSize); applyRenditionTheme(); saveProgress(); });
  document.getElementById('fontInc').addEventListener('click',()=>{ fontSize=Math.min(46,fontSize+1); pageContainer.style.fontSize=fontSize+'px'; fontSizeInd.textContent=fontSize; localStorage.setItem('retroReaderFont',fontSize); applyRenditionTheme(); saveProgress(); });
  resetPosBtn.addEventListener('click',()=>{ pageContainer.scrollTop=0; saveProgress(); });
  shelfGrid.addEventListener('click', e=>{ const slot=e.target.closest('.book-slot'); if(slot) openFromShelf(slot.dataset.id); });
  encodingSelect.addEventListener('change',()=>{ if(currentBook?.type==='txt'){ loadText.textContent='更改编码需重新导入文件'; loadBar.hidden=false; setTimeout(()=>{ if(loadText.textContent.startsWith('更改编码')){ loadText.textContent=''; loadBar.hidden=true;} },2000); }});
}

bindEvents();
showShelf();
window.addEventListener('beforeunload', saveProgress);
