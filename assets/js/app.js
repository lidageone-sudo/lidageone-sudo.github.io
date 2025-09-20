/* Main App Logic */
const state = {
  books: [],
  filtered: [],
  favorites: new Set(),
  activeTags: new Set(),
  onlyFavorites: false,
  sort: 'title',
  search: ''
};

const els = {
  list: document.getElementById('bookList'),
  template: document.getElementById('bookCardTemplate'),
  tagBar: document.getElementById('tagBar'),
  search: document.getElementById('searchInput'),
  sort: document.getElementById('sortSelect'),
  favToggle: document.getElementById('toggleFavorites'),
  themeToggle: document.getElementById('themeToggle'),
  detailPanel: document.getElementById('detailPanel'),
  detailContent: document.getElementById('detailContent'),
  closeDetail: document.getElementById('closeDetail'),
  exportFavorites: document.getElementById('exportFavorites'),
  emptyHint: document.querySelector('.empty-hint')
};

function loadFavorites() {
  try {
    const raw = localStorage.getItem('myLibraryFavorites');
    if (raw) JSON.parse(raw).forEach(id => state.favorites.add(id));
  } catch (e) { console.warn('fav load fail', e); }
}
function saveFavorites() {
  localStorage.setItem('myLibraryFavorites', JSON.stringify([...state.favorites]));
}

async function loadBooks() {
  const res = await fetch('data/books.json?_=' + Date.now());
  if (!res.ok) throw new Error('加载 books.json 失败');
  const data = await res.json();
  state.books = data;
}

function buildTagCloud() {
  const freq = new Map();
  state.books.forEach(b => (b.tags||[]).forEach(t => freq.set(t, (freq.get(t)||0)+1)));
  const tags = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40).map(v=>v[0]);
  els.tagBar.innerHTML = '';
  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag';
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener('click',()=>{toggleTag(tag);});
    els.tagBar.appendChild(btn);
  });
}

function toggleTag(tag){
  if(state.activeTags.has(tag)) state.activeTags.delete(tag); else state.activeTags.add(tag);
  updateTagUI();
  applyFilters();
}

function updateTagUI(){
  [...els.tagBar.querySelectorAll('.tag')].forEach(e => {
    e.classList.toggle('active', state.activeTags.has(e.dataset.tag));
  });
}

function applyFilters(){
  const search = state.search.trim().toLowerCase();
  const tags = state.activeTags;
  const onlyFav = state.onlyFavorites;
  let arr = state.books.filter(b => {
    if (onlyFav && !state.favorites.has(b.id)) return false;
    if (tags.size && !(b.tags||[]).every(t => tags.has(t)) ) {
      // tags 采用 AND? 这里使用包含全部选中标签
      for (const t of tags){ if(!(b.tags||[]).includes(t)) return false; }
    }
    if (search){
      const hay = [b.title,b.authors?.join(' '),(b.tags||[]).join(' ')].join(' ').toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });
  // sort
  arr.sort((a,b)=>{
    if(state.sort==='title') return a.title.localeCompare(b.title,'zh');
    if(state.sort==='author') return (a.authors?.[0]||'').localeCompare(b.authors?.[0]||'','zh');
    if(state.sort==='year') return (b.year||0)-(a.year||0);
    return 0;
  });
  state.filtered = arr;
  renderList();
}

function renderList(){
  els.list.querySelectorAll('.book-card').forEach(n=>n.remove());
  if(!state.filtered.length){
    els.emptyHint.hidden = false;
    return;
  }
  els.emptyHint.hidden = true;
  const frag = document.createDocumentFragment();
  state.filtered.forEach(b => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = b.id;
    const img = node.querySelector('img');
    if(b.cover){ img.src = b.cover; } else { img.alt = '无封面'; }
    node.querySelector('.title').textContent = b.title;
    node.querySelector('.authors').textContent = (b.authors||[]).join(', ');
    node.querySelector('.meta').textContent = [b.year, b.language].filter(Boolean).join(' · ');
    const tagsWrap = node.querySelector('.tags');
    (b.tags||[]).forEach(t=>{const span=document.createElement('span');span.className='t';span.textContent=t;tagsWrap.appendChild(span);});
    const favBtn = node.querySelector('.fav-btn');
    if(state.favorites.has(b.id)) favBtn.classList.add('active'), favBtn.textContent = '★'; else favBtn.textContent='☆';
    favBtn.addEventListener('click',e=>{e.stopPropagation();toggleFavorite(b.id,favBtn);});
    node.addEventListener('click',()=>openDetail(b.id));
    frag.appendChild(node);
  });
  els.list.appendChild(frag);
}

function toggleFavorite(id, btn){
  if(state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  saveFavorites();
  if(btn){btn.classList.toggle('active');btn.textContent = state.favorites.has(id)?'★':'☆';}
}

function openDetail(id){
  const book = state.books.find(b=>b.id===id);
  if(!book) return;
  els.detailPanel.hidden = false;
  const html = `
    <h2>${book.title}</h2>
    <div class="actions">
      <button id="detailFav" class="btn ${state.favorites.has(book.id)?'active':''}">${state.favorites.has(book.id)?'已收藏':'收藏'}</button>
      ${book.link?`<a class="btn" rel="noopener" target="_blank" href="${book.link}">访问链接</a>`:''}
      <button id="copyLink" class="btn">复制链接</button>
    </div>
    <p class="meta-line"><strong>作者:</strong> ${(book.authors||[]).join(', ')||'—'} ${book.year?` | <strong>年份:</strong> ${book.year}`:''} ${book.isbn?` | <strong>ISBN:</strong> ${book.isbn}`:''}</p>
    <div class="badges">${(book.tags||[]).map(t=>`<span class="badge">${t}</span>`).join('')}</div>
    <div class="desc">${(book.description||'').replace(/</g,'&lt;')}</div>
  `;
  els.detailContent.innerHTML = html;
  history.replaceState(null,'',`#book/${encodeURIComponent(id)}`);
  document.getElementById('detailFav').addEventListener('click',()=>{
    toggleFavorite(book.id, document.getElementById('detailFav'));
    document.getElementById('detailFav').textContent = state.favorites.has(book.id)?'已收藏':'收藏';
    document.getElementById('detailFav').classList.toggle('active', state.favorites.has(book.id));
    // sync list star if open
    const cardBtn = els.list.querySelector(`.book-card[data-id="${CSS.escape(book.id)}"] .fav-btn`);
    if(cardBtn){cardBtn.classList.toggle('active', state.favorites.has(book.id));cardBtn.textContent=state.favorites.has(book.id)?'★':'☆';}
  });
  document.getElementById('copyLink').addEventListener('click',()=>{
    navigator.clipboard.writeText(location.href).then(()=>{
      document.getElementById('copyLink').textContent='已复制';
      setTimeout(()=>{const btn=document.getElementById('copyLink');if(btn) btn.textContent='复制链接';},1600);
    });
  });
  setTimeout(()=>{els.detailContent.focus();},50);
}

function closeDetail(){
  els.detailPanel.hidden = true;
  if(location.hash.startsWith('#book/')) history.replaceState(null,'','#');
}

function handleHash(){
  if(location.hash.startsWith('#book/')){
    const id = decodeURIComponent(location.hash.split('/')[1]||'');
    openDetail(id);
  } else {
    closeDetail();
  }
}

function exportFavorites(){
  const favBooks = state.books.filter(b=>state.favorites.has(b.id));
  const blob = new Blob([JSON.stringify(favBooks,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'favorites.json'; a.click();
  URL.revokeObjectURL(url);
}

function toggleTheme(){
  const html = document.documentElement;
  const current = html.getAttribute('data-theme')==='dark'?'dark':'light';
  const next = current==='dark'?'light':'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('myLibraryTheme', next);
}
function loadTheme(){
  const t = localStorage.getItem('myLibraryTheme');
  if(t) document.documentElement.setAttribute('data-theme', t);
}

function initEvents(){
  let searchTimer; els.search.addEventListener('input', e=>{clearTimeout(searchTimer); searchTimer=setTimeout(()=>{state.search=e.target.value;applyFilters();},260);});
  els.sort.addEventListener('change', e=>{state.sort=e.target.value;applyFilters();});
  els.favToggle.addEventListener('click',()=>{state.onlyFavorites=!state.onlyFavorites;els.favToggle.setAttribute('aria-pressed', state.onlyFavorites);els.favToggle.classList.toggle('active', state.onlyFavorites);applyFilters();});
  els.themeToggle.addEventListener('click', toggleTheme);
  els.closeDetail.addEventListener('click', closeDetail);
  window.addEventListener('hashchange', handleHash);
  els.exportFavorites.addEventListener('click', e=>{e.preventDefault();exportFavorites();});
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !els.detailPanel.hidden) closeDetail(); });
}

async function bootstrap(){
  loadTheme();
  loadFavorites();
  await loadBooks();
  buildTagCloud();
  applyFilters();
  handleHash();
  initEvents();
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
}

bootstrap();
