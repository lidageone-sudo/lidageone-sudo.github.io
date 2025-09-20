/* Retro Reader - local txt / epub reader (client-only) */
const els = {
  shelfView: document.getElementById('shelfView'),
  readerView: document.getElementById('readerView'),
  shelfGrid: document.getElementById('shelfGrid'),
  fileInput: document.getElementById('fileInput'),
  toggleShelf: document.getElementById('toggleShelf'),
  toggleReader: document.getElementById('toggleReader'),
  themeSwitch: document.getElementById('themeSwitch'),
  page: document.getElementById('pageContainer'),
  chapterSelect: document.getElementById('chapterSelect'),
  prevChapter: document.getElementById('prevChapter'),
  nextChapter: document.getElementById('nextChapter'),
  fontInc: document.getElementById('fontInc'),
  fontDec: document.getElementById('fontDec'),
  fontSizeInd: document.getElementById('fontSizeInd'),
  resetPos: document.getElementById('resetPos'),
  progressFill: document.getElementById('progressFill'),
  homeBtn: document.getElementById('homeBtn'),
  sbTime: document.getElementById('sbTime')
};

let currentBook = null; // { id, name, type, chapters:[{title,text}], cfi } for txt OR epub Book object
let currentIndex = 0;
let fontSize = Number(localStorage.getItem('retroReaderFontSize')) || 16;
const theme = localStorage.getItem('retroReaderTheme') || 'light';
if(theme) document.documentElement.setAttribute('data-theme', theme);

function tickTime(){
  const d = new Date();
  els.sbTime.textContent = d.toTimeString().slice(0,5);
}
setInterval(tickTime, 30000); tickTime();

function humanSize(bytes){ if(bytes<1024) return bytes+'B'; if(bytes<1048576) return (bytes/1024).toFixed(1)+'K'; return (bytes/1048576).toFixed(1)+'M'; }

function switchView(view){
  const shelf = view==='shelf';
  els.shelfView.classList.toggle('active', shelf);
  els.readerView.hidden = shelf;
  els.toggleShelf.setAttribute('aria-pressed', shelf);
  els.toggleReader.setAttribute('aria-pressed', !shelf);
}

function saveProgress(){
  if(!currentBook) return;
  const key = 'retroReaderProgress:'+currentBook.id;
  if(currentBook.type==='txt'){
    const scrollTop = els.page.scrollTop;
    localStorage.setItem(key, JSON.stringify({ index: currentIndex, scroll: scrollTop }));
  } else if(currentBook.type==='epub' && currentBook.rendition){
    localStorage.setItem(key, JSON.stringify({ cfi: currentBook.lastCfi||null }));
  }
}

function restoreProgress(){
  if(!currentBook) return;
  const key = 'retroReaderProgress:'+currentBook.id;
  try{
    const data = JSON.parse(localStorage.getItem(key)||'null');
    if(!data) return;
    if(currentBook.type==='txt'){
      if(typeof data.index==='number'){ currentIndex = data.index; }
      renderTxtChapter();
      requestAnimationFrame(()=>{ els.page.scrollTop = data.scroll||0; updateProgress(); });
    } else if(currentBook.type==='epub' && data.cfi){
      currentBook.rendition.display(data.cfi);
    }
  }catch(e){console.warn('restore fail', e)}
}

function addShelfItem(meta){
  const div = document.createElement('div');
  div.className = 'book-slot fade-in';
  div.innerHTML = `<div class="ico">📖</div><div class="title">${meta.name}</div><div class="fmt">${meta.type.toUpperCase()}</div>`;
  div.title = meta.name + ' ('+meta.type+')';
  div.addEventListener('click',()=>{openBook(meta.id);});
  els.shelfGrid.appendChild(div);
}

const shelf = new Map(); // id -> {id,name,type,file, size}

function openBook(id){
  const meta = shelf.get(id);
  if(!meta) return;
  if(meta.type==='txt') loadTxt(meta); else loadEpub(meta);
}

function parseTxt(raw){
  const lines = raw.split(/\r?\n/);
  const chapters = [];
  let current = { title: '开始', text: []};
  const chapterRegex = /(第[\d一二三四五六七八九十百千]+[章节回])|^(Chapter\s+\d+)/i;
  for(const line of lines){
    if(line.trim().length<1){ current.text.push(''); continue; }
    if(chapterRegex.test(line.trim()) && current.text.length>20){
      chapters.push(current);
      current = { title: line.trim(), text: []};
    } else {
      current.text.push(line);
    }
  }
  if(current.text.length) chapters.push(current);
  return chapters.map((c,i)=>({ title: c.title || ('章节 '+(i+1)), text: c.text.join('\n') }));
}

function renderChapterOptions(chapters){
  els.chapterSelect.innerHTML='';
  chapters.forEach((c,i)=>{
    const opt=document.createElement('option');
    opt.value=i; opt.textContent = (i+1)+'. '+c.title.slice(0,40);
    els.chapterSelect.appendChild(opt);
  });
}

function renderTxtChapter(){
  if(!currentBook) return;
  const ch = currentBook.chapters[currentIndex];
  els.chapterSelect.value = String(currentIndex);
  els.page.innerHTML = '<h2>'+ch.title+'</h2>' + ch.text.split(/\n+/).map(p=> p.trim()?'<p>'+p.replace(/[<>]/g,s=>({'<':'&lt;','>':'&gt;'}[s]))+'</p>':'<p>&nbsp;</p>').join('');
  els.page.style.fontSize = fontSize+'px';
  els.fontSizeInd.textContent = fontSize;
  updateProgress();
}

function updateProgress(){
  if(!currentBook) return;
  if(currentBook.type==='txt'){
    const total = els.page.scrollHeight - els.page.clientHeight;
    const ratio = total>0? (els.page.scrollTop/total):0;
    els.progressFill.style.width = (ratio*100).toFixed(1)+'%';
  } else if(currentBook.type==='epub'){
    // ratio based on locations if available
    if(currentBook.book && currentBook.book.locations && currentBook.book.locations.length()>0){
      const percent = currentBook.book.locations.percentageFromCfi(currentBook.lastCfi||'')*100;
      if(!isNaN(percent)) els.progressFill.style.width = percent.toFixed(1)+'%';
    }
  }
}

function loadTxt(meta){
  const reader = new FileReader();
  reader.onload = () => {
    const raw = reader.result;
    const chapters = parseTxt(raw);
    currentBook = { id: meta.id, name: meta.name, type: 'txt', chapters };
    renderChapterOptions(chapters);
    currentIndex = 0;
    switchView('reader');
    renderTxtChapter();
    restoreProgress();
  };
  reader.readAsText(meta.file, 'utf-8');
}

function loadEpub(meta){
  const book = ePub(meta.file);
  currentBook = { id: meta.id, name: meta.name, type: 'epub', book };
  switchView('reader');
  els.page.innerHTML = '<p style="opacity:.6">加载 EPUB 目录...</p>';
  const rendition = book.renderTo('pageContainer', { flow: 'paginated', width: '100%', height: '100%' });
  currentBook.rendition = rendition;
  rendition.display();
  book.loaded.navigation.then(nav => {
    const chapters = nav.toc.map((i,idx)=>({ title: i.label, href: i.href, index: idx }));
    currentBook.chapters = chapters;
    els.chapterSelect.innerHTML='';
    chapters.forEach((c,i)=>{ const opt=document.createElement('option'); opt.value=i; opt.textContent=(i+1)+'. '+c.title.slice(0,40); els.chapterSelect.appendChild(opt); });
  });
  rendition.on('relocated', (loc)=>{ currentBook.lastCfi = loc.start.cfi; updateProgress(); saveProgress(); });
  book.ready.then(()=>{
    if(!book.locations.length()) book.locations.generate(600).then(()=>updateProgress());
    restoreProgress();
  });
}

function changeChapter(delta){
  if(!currentBook) return;
  if(currentBook.type==='txt'){
    const next = currentIndex + delta;
    if(next<0 || next>=currentBook.chapters.length) return; currentIndex = next; renderTxtChapter(); saveProgress(); els.page.scrollTop=0; }
  else if(currentBook.type==='epub'){
    const idx = Number(els.chapterSelect.value) + delta;
    if(idx<0 || idx>=currentBook.chapters.length) return; gotoEpubChapter(idx); }
}

function gotoEpubChapter(i){
  const chap = currentBook.chapters[i];
  if(!chap) return;
  currentBook.rendition.display(chap.href);
  els.chapterSelect.value = String(i);
}

function bindEvents(){
  els.fileInput.addEventListener('change', e=>{
    const files = [...e.target.files];
    files.forEach(f=>{
      const ext = f.name.split('.').pop().toLowerCase();
      if(!['txt','epub'].includes(ext)) return;
      const id = f.name + '_' + f.size;
      if(!shelf.has(id)){
        const meta = { id, name: f.name.replace(/\.(txt|epub)$/i,''), type: ext, file: f, size: f.size };
        shelf.set(id, meta); addShelfItem(meta);
      }
    });
    e.target.value='';
  });
  els.toggleShelf.addEventListener('click',()=>switchView('shelf'));
  els.toggleReader.addEventListener('click',()=>switchView('reader'));
  els.homeBtn.addEventListener('click',()=>switchView('shelf'));
  els.prevChapter.addEventListener('click',()=>changeChapter(-1));
  els.nextChapter.addEventListener('click',()=>changeChapter(1));
  els.chapterSelect.addEventListener('change', e=>{
    if(!currentBook) return; if(currentBook.type==='txt'){ currentIndex = Number(e.target.value); renderTxtChapter(); saveProgress(); els.page.scrollTop=0; } else { gotoEpubChapter(Number(e.target.value)); }});
  els.fontInc.addEventListener('click',()=>{fontSize=Math.min(36,fontSize+1);applyFont();});
  els.fontDec.addEventListener('click',()=>{fontSize=Math.max(12,fontSize-1);applyFont();});
  els.resetPos.addEventListener('click',()=>{ if(currentBook){ if(currentBook.type==='txt'){ els.page.scrollTop=0; updateProgress(); saveProgress(); } else if(currentBook.type==='epub'){ currentBook.rendition.display(); } } });
  els.page.addEventListener('scroll',()=>{ updateProgress(); if(Date.now()%5===0) saveProgress(); });
  document.addEventListener('keydown', e=>{
    if(e.altKey||e.ctrlKey||e.metaKey) return;
    if(e.key==='ArrowLeft') changeChapter(-1);
    if(e.key==='ArrowRight') changeChapter(1);
    if(e.key==='Escape') switchView('shelf');
  });
  els.themeSwitch.addEventListener('click', toggleTheme);
}

function applyFont(){
  els.page.style.fontSize = fontSize+'px';
  els.fontSizeInd.textContent = fontSize;
  localStorage.setItem('retroReaderFontSize', fontSize);
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme')||'light';
  const seq = ['light','sepia','dark'];
  const next = seq[(seq.indexOf(current)+1)%seq.length];
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('retroReaderTheme', next);
}

bindEvents();
applyFont();
window.addEventListener('beforeunload', saveProgress);
