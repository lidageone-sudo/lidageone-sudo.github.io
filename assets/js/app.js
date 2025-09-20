/* AI 导航站 前端逻辑 */
// 数据结构约定：data/models.json 返回数组，每项：
// { id, name, description, category, license, stars, updated, tags:[], links:{ homepage, repo, doc, demo }, score?, vendor?, size?, params?, type? }

const state = {
  all: [],
  filtered: [],
  categories: [],
  licenses: [],
  activeTags: new Set(),
  favorites: new Set(JSON.parse(localStorage.getItem('aiNavFav')||'[]')),
  query: '',
  sort: 'score',
  category: 'ALL',
  license: 'ALL',
  layout: localStorage.getItem('aiNavLayout')||'normal',
  theme: localStorage.getItem('aiNavTheme')||'light'
};

document.documentElement.dataset.theme = state.theme;
if(state.layout==='compact') document.body.classList.add('compact');

const els = {
  resultArea: document.getElementById('resultArea'),
  searchInput: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  categorySelect: document.getElementById('categorySelect'),
  licenseSelect: document.getElementById('licenseSelect'),
  sortSelect: document.getElementById('sortSelect'),
  tagBar: document.getElementById('tagBar'),
  toggleLayout: document.getElementById('toggleLayout'),
  toggleTheme: document.getElementById('toggleTheme'),
  sidePanel: document.getElementById('sidePanel'),
  panelBody: document.getElementById('panelBody'),
  overlay: document.getElementById('overlay'),
  closePanel: document.getElementById('closePanel'),
  dbCount: document.getElementById('dbCount'),
  cardTpl: document.getElementById('cardTpl'),
};

/* ---------- 数据加载 ---------- */
async function loadData(){
  const res = await fetch('data/models.json?_=' + Date.now());
  const data = await res.json();
  state.all = data.map(enrich);
  buildFacetOptions();
  syncFilter();
  render();
}

function enrich(item){
  // 计算初步推荐得分 (可继续调权重)
  const stars = item.stars || 0;
  const updated = item.updated ? (Date.now() - new Date(item.updated).getTime())/86400000 : 999;
  const freshness = Math.max(0, 1 - Math.min(updated/180,1));
  item.score = (stars?Math.log10(stars+10):0) * 0.6 + freshness * 0.4 + (item.tags?.length||0)*0.05;
  return item;
}

/* ---------- 过滤与搜索 ---------- */
function syncFilter(){
  const q = state.query.trim().toLowerCase();
  const usePinyin = /[a-z]/.test(q) && /[\u4e00-\u9fa5]/.test(JSON.stringify(state.all));
  state.filtered = state.all.filter(it=>{
    if(state.category!=='ALL' && it.category!==state.category) return false;
    if(state.license!=='ALL' && it.license!==state.license) return false;
    if(state.activeTags.size){
      if(!it.tags || ![...state.activeTags].every(t=>it.tags.includes(t))) return false;
    }
    if(q){
      const hay = (it.name+' '+(it.description||'')+' '+(it.tags||[]).join(' ')).toLowerCase();
      if(!hay.includes(q)){
        if(usePinyin){
          // 简单拼音首字母匹配（预处理缓存）
          if(!it._pinyin){ it._pinyin = toInitials(it.name + ' ' + (it.tags||[]).join(' ')); }
          if(!it._pinyin.includes(q)) return false;
        } else return false;
      }
    }
    return true;
  });
  applySort();
}

function applySort(){
  const s = state.sort;
  state.filtered.sort((a,b)=>{
    if(s==='name') return a.name.localeCompare(b.name,'zh');
    if(s==='recent') return new Date(b.updated||0)-new Date(a.updated||0);
    if(s==='stars') return (b.stars||0)-(a.stars||0);
    return (b.score||0)-(a.score||0);
  });
}

/* ---------- 构建筛选项 ---------- */
function buildFacetOptions(){
  state.categories = Array.from(new Set(state.all.map(i=>i.category).filter(Boolean))).sort();
  state.licenses = Array.from(new Set(state.all.map(i=>i.license).filter(Boolean))).sort();
  els.categorySelect.innerHTML = '<option value="ALL">全部分类</option>'+ state.categories.map(c=>`<option value="${c}">${c}</option>`).join('');
  els.licenseSelect.innerHTML = '<option value="ALL">全部许可证</option>'+ state.licenses.map(c=>`<option value="${c}">${c}</option>`).join('');
  const tagFreq = new Map();
  state.all.forEach(i=> (i.tags||[]).forEach(t=> tagFreq.set(t,(tagFreq.get(t)||0)+1)) );
  const top = [...tagFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([t,n])=>({t,n}));
  els.tagBar.innerHTML = top.map(o=>`<div class="tag" data-tag="${o.t}" title="${o.n} 项">${o.t}</div>`).join('');
  els.dbCount.textContent = '· '+state.all.length+' 项';
}

/* ---------- 渲染结果 ---------- */
function render(){
  const wrap = els.resultArea;
  wrap.innerHTML='';
  if(!state.filtered.length){
    wrap.innerHTML = '<div class="empty">暂无结果，尝试修改搜索或筛选。</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for(const item of state.filtered){
    const node = buildCard(item);
    frag.appendChild(node);
  }
  wrap.appendChild(frag);
}

function buildCard(item){
  const tpl = els.cardTpl.content.firstElementChild.cloneNode(true);
  tpl.dataset.id = item.id;
  tpl.querySelector('.title').textContent = item.name;
  const desc = tpl.querySelector('.desc');
  desc.textContent = item.description || '';
  tpl.querySelector('.badge-cat').textContent = item.category || '其它';
  tpl.querySelector('.badge-license').textContent = item.license || '-';
  const meta = [];
  if(item.stars) meta.push('★ '+shortNumber(item.stars));
  if(item.updated) meta.push('更新 '+item.updated.split('T')[0]);
  if(item.params) meta.push('参数 '+item.params);
  tpl.querySelector('.meta-line').textContent = meta.join(' · ');
  const tagsBox = tpl.querySelector('.tags');
  (item.tags||[]).forEach(t=>{
    const span = document.createElement('span');
    span.className='t'; span.textContent=t; span.dataset.tag=t;
    tagsBox.appendChild(span);
  });
  const favBtn = tpl.querySelector('.btn-fav');
  if(state.favorites.has(item.id)) favBtn.classList.add('faved');
  favBtn.addEventListener('click', e=>{
    e.stopPropagation();
    if(state.favorites.has(item.id)) state.favorites.delete(item.id); else state.favorites.add(item.id);
    favBtn.classList.toggle('faved');
    localStorage.setItem('aiNavFav', JSON.stringify([...state.favorites]));
  });
  tpl.addEventListener('click', ()=> openPanel(item));
  return tpl;
}

/* ---------- 详情面板 ---------- */
function openPanel(item){
  els.sidePanel.classList.add('active');
  els.overlay.hidden=false;
  els.sidePanel.setAttribute('aria-hidden','false');
  const links = [];
  if(item.links){
    for(const k of Object.keys(item.links)){
      if(item.links[k]) links.push(`<a href="${item.links[k]}" target="_blank" rel="noopener">${k}</a>`);
    }
  }
  els.panelBody.innerHTML = `
    <h2>${escapeHtml(item.name)}</h2>
    <p>${escapeHtml(item.description||'')}</p>
    <div class="sec">基本信息</div>
    <div class="line">分类：<code>${escapeHtml(item.category||'-')}</code> 许可证：<code>${escapeHtml(item.license||'-')}</code></div>
    <div class="line">Tags：${(item.tags||[]).map(t=>`<code>${escapeHtml(t)}</code>`).join(' ')||'-'}</div>
    <div class="line">Stars：<code>${item.stars?shortNumber(item.stars):'-'}</code> 更新时间：<code>${item.updated?item.updated.split('T')[0]:'-'}</code></div>
    ${(item.vendor||item.size||item.params)?`<div class="line">供应商：<code>${escapeHtml(item.vendor||'-')}</code> 参数规模：<code>${escapeHtml(item.params||'-')}</code> 大小：<code>${escapeHtml(item.size||'-')}</code></div>`:''}
    <div class="sec">链接</div>
    <div class="links">${links.join('')||'<span style="opacity:.6">无</span>'}</div>
  `;
}
function closePanel(){
  els.sidePanel.classList.remove('active');
  els.overlay.hidden=true;
  els.sidePanel.setAttribute('aria-hidden','true');
}

/* ---------- 工具函数 ---------- */
function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function shortNumber(n){ if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'k'; return n; }
function toInitials(str){ return str.split(/\s+/).map(w=> w[0] ? w[0].toLowerCase() : '').join(''); }

/* ---------- 事件绑定 ---------- */
els.searchInput.addEventListener('input', ()=>{ state.query=els.searchInput.value; syncFilter(); render(); });
els.clearSearch.addEventListener('click', ()=>{ els.searchInput.value=''; state.query=''; syncFilter(); render(); els.searchInput.focus(); });
els.categorySelect.addEventListener('change', ()=>{ state.category=els.categorySelect.value; syncFilter(); render(); });
els.licenseSelect.addEventListener('change', ()=>{ state.license=els.licenseSelect.value; syncFilter(); render(); });
els.sortSelect.addEventListener('change', ()=>{ state.sort=els.sortSelect.value; applySort(); render(); });
els.toggleLayout.addEventListener('click', ()=>{ state.layout = state.layout==='normal'?'compact':'normal'; document.body.classList.toggle('compact', state.layout==='compact'); localStorage.setItem('aiNavLayout', state.layout); });
els.toggleTheme.addEventListener('click', ()=>{ state.theme = state.theme==='light'?'dark':'light'; document.documentElement.dataset.theme=state.theme; localStorage.setItem('aiNavTheme', state.theme); });
els.tagBar.addEventListener('click', e=>{ const tag = e.target.closest('.tag'); if(!tag) return; const t=tag.dataset.tag; if(state.activeTags.has(t)) state.activeTags.delete(t); else state.activeTags.add(t); tag.classList.toggle('active'); syncFilter(); render(); });
els.closePanel.addEventListener('click', closePanel); els.overlay.addEventListener('click', closePanel);
window.addEventListener('keydown', e=>{ if(e.key==='Escape') closePanel(); });

/* ---------- 初始化 ---------- */
loadData();
