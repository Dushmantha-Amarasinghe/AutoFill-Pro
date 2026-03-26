/**
 * AutoFill Pro — Dashboard Script v2
 * by Refora Technologies
 */

let appData = null;
let activeProfileId = null;
let selectedColor = '#E8530A';

const COLORS = ['#E8530A','#F5A219','#2BA82B','#197A8A','#6B4ECC','#C44B8A','#1E7AAA','#8A7030','#3A6E60','#7A3A3A'];

function toast(msg, type='success') {
  const s=document.getElementById('toast-s');
  const icons={success:'',error:'',info:''};
  const t=document.createElement('div');
  t.className=`toast t${type.charAt(0)}`;
  t.innerHTML=`<span style="font-size:15px">${type==='success'?'✓':type==='error'?'✕':'•'}</span><span>${msg}</span>`;
  s.appendChild(t);
  requestAnimationFrame(()=>setTimeout(()=>t.classList.add('show'),10));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},3000);
}

// ── Navigation ─────────────────────────────────
document.querySelectorAll('.nitem[data-tab]').forEach(link=>{
  link.addEventListener('click',e=>{
    e.preventDefault();
    const tab=link.dataset.tab;
    document.querySelectorAll('.nitem').forEach(l=>l.classList.remove('active'));
    document.querySelectorAll('.tpanel').forEach(p=>p.classList.remove('active'));
    link.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if(tab==='my-fields') loadFieldsEditor();
    if(tab==='custom-fields') renderCF();
    if(tab==='history') renderHistory();
    if(tab==='url-rules') renderRules();
  });
});

// ── Init ────────────────────────────────────────
async function init() {
  appData = await StorageAPI.getData();
  activeProfileId = appData.activeProfileId;
  updateSidebarCtx();
  renderProfiles();
  applySettings();
  updateBadges();
  initColors();
}

function updateBadges() {
  document.getElementById('badge-p').textContent = appData.profiles.length;
  const ap = getAP();
  document.getElementById('badge-cf').textContent = (ap?.customFields||[]).length;
  document.getElementById('badge-h').textContent  = (appData.history||[]).length;
  document.getElementById('badge-r').textContent  = (appData.urlRules||[]).length;
}

function getAP() {
  return appData.profiles.find(p=>p.id===activeProfileId)||appData.profiles[0];
}

// Update the sidebar context strip and editing banners
function updateSidebarCtx() {
  const ap = getAP();
  if(!ap) return;
  document.getElementById('ctx-name').textContent = ap.name;
  document.getElementById('ctx-dot').style.background = ap.color||'#E8530A';
  document.getElementById('ctx-dot').style.boxShadow = `0 0 6px ${ap.color||'#E8530A'}`;
  document.getElementById('editing-name').textContent = ap.name;
  document.getElementById('cf-editing-name').textContent = ap.name;
  // Update editing banner color accent
  const accent = ap.color||'#E8530A';
  document.querySelectorAll('#editing-banner,#cf-editing-banner').forEach(b=>{
    b.style.borderColor = `${accent}44`;
    b.style.background = `${accent}18`;
    b.style.color = accent;
  });
}

// ── Profiles Tab ────────────────────────────────
function renderProfiles() {
  const grid = document.getElementById('profiles-grid');
  grid.innerHTML = '';

  appData.profiles.forEach(p=>{
    const isActive = p.id===activeProfileId;
    const fc = Object.values(p.fields||{}).filter(v=>v&&v.trim()).length;
    const cc = (p.customFields||[]).length;
    const card = document.createElement('div');
    card.className = `pcard${isActive?' is-active':''}`;
    card.style.setProperty('--cc', p.color||'#E8530A');
    card.innerHTML = `
      ${isActive?'<div class="active-badge">Active</div>':''}
      <div class="pcard-top">
        <div class="pavatar" style="background:${p.color||'#E8530A'}">${p.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="pname">${esc(p.name)}</div>
          <div class="pstat">${fc} built-in · ${cc} custom field${cc!==1?'s':''}</div>
        </div>
      </div>
      <div class="pcard-acts">
        ${!isActive?`<button class="btn btn-success btn-sm" data-act="activate" data-id="${p.id}">Set Active</button>`:''}
        <button class="btn btn-sm" data-act="edit" data-id="${p.id}">Edit</button>
        ${appData.profiles.length>1?`<button class="btn btn-danger btn-sm btn-ico" data-act="delete" data-id="${p.id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>`:''}
      </div>`;
    grid.appendChild(card);
  });

  // Clarifying info card below
  const info = document.createElement('div');
  info.style.cssText='grid-column:1/-1;padding:12px 16px;border:1px solid rgba(240,160,60,.12);border-radius:9px;background:rgba(240,160,60,.05);font-size:12px;color:#9A8A78;display:flex;align-items:flex-start;gap:10px;';
  info.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px;opacity:.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>The <strong style="color:#D09060">active profile</strong> is used when filling forms. Built-in Fields and Custom Fields in the sidebar always belong to the active profile. Switch profile here to edit different profiles.</span>`;
  grid.appendChild(info);

  // Add new profile card
  const addCard = document.createElement('div');
  addCard.className='add-pcard';
  addCard.innerHTML=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add New Profile</span>`;
  addCard.addEventListener('click',()=>openModal());
  grid.appendChild(addCard);

  grid.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const {act,id}=btn.dataset;
      if(act==='activate') activateProfile(id);
      if(act==='delete')   deleteProfile(id);
      if(act==='edit')     openModal(id);
    });
  });
}

async function activateProfile(id) {
  activeProfileId=id;
  appData.activeProfileId=id;
  await StorageAPI.setActiveProfile(id);
  appData=await StorageAPI.getData();
  updateSidebarCtx();
  renderProfiles();
  updateBadges();
  toast('Profile activated — fields tabs now show this profile');
}

async function deleteProfile(id) {
  if(!confirm('Delete this profile? This cannot be undone.')) return;
  await StorageAPI.deleteProfile(id);
  appData=await StorageAPI.getData();
  activeProfileId=appData.activeProfileId;
  updateSidebarCtx();
  renderProfiles();
  updateBadges();
  toast('Profile deleted','info');
}

// ── Color Picker ────────────────────────────────
function initColors() {
  const c=document.getElementById('color-opts');
  COLORS.forEach(col=>{
    const o=document.createElement('div');
    o.className='copt'+(col===selectedColor?' selected':'');
    o.style.background=col;
    o.addEventListener('click',()=>{
      document.querySelectorAll('.copt').forEach(x=>x.classList.remove('selected'));
      o.classList.add('selected');
      selectedColor=col;
    });
    c.appendChild(o);
  });
}

// ── Profile Modal ───────────────────────────────
let editingId=null;
function openModal(profileId=null) {
  editingId=profileId;
  const m=document.getElementById('prof-modal');
  const ti=document.getElementById('modal-title');
  const ni=document.getElementById('modal-pname');
  const cb=document.getElementById('modal-confirm');
  if(profileId){
    const p=appData.profiles.find(x=>x.id===profileId);
    ti.textContent='Edit Profile';
    ni.value=p?.name||'';
    selectedColor=p?.color||'#E8530A';
    cb.textContent='Save Changes';
  } else {
    ti.textContent='Create New Profile';
    ni.value='';
    selectedColor='#E8530A';
    cb.textContent='Create Profile';
  }
  document.querySelectorAll('.copt').forEach((o,i)=>{
    o.classList.toggle('selected',COLORS[i]===selectedColor);
  });
  m.classList.add('show');
  setTimeout(()=>ni.focus(),80);
}
document.getElementById('modal-cancel').addEventListener('click',()=>document.getElementById('prof-modal').classList.remove('show'));
document.getElementById('prof-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('show');});
document.getElementById('modal-confirm').addEventListener('click',async()=>{
  const name=document.getElementById('modal-pname').value.trim();
  if(!name){toast('Enter a profile name','error');return;}
  if(editingId){
    const p=appData.profiles.find(x=>x.id===editingId);
    if(p){p.name=name;p.color=selectedColor;await StorageAPI.saveProfile(p);toast('Profile updated');}
  } else {
    await StorageAPI.createProfile(name,selectedColor);
    toast('Profile created');
  }
  appData=await StorageAPI.getData();
  activeProfileId=appData.activeProfileId;
  updateSidebarCtx();
  renderProfiles();
  updateBadges();
  document.getElementById('prof-modal').classList.remove('show');
});

// ── Built-in Fields ─────────────────────────────
const FKEYS=['firstName','lastName','email','mobile','nic','whatsapp','landphone','organization','jobTitle','city','country'];
function loadFieldsEditor() {
  const ap=getAP();
  FKEYS.forEach(k=>{
    const el=document.getElementById(`f-${k}`);
    if(el) el.value=ap?.fields?.[k]||'';
  });
}
document.getElementById('btn-save-fields').addEventListener('click',async()=>{
  const ap=getAP();
  if(!ap) return;
  FKEYS.forEach(k=>{const el=document.getElementById(`f-${k}`);if(el)ap.fields[k]=el.value.trim();});
  await StorageAPI.saveProfile(ap);
  appData=await StorageAPI.getData();
  const st=document.getElementById('save-status');
  st.style.color='var(--green)';
  st.textContent='Saved';
  setTimeout(()=>st.textContent='',2200);
  toast('Profile data saved');
  renderProfiles();
  updateBadges();
});

// ── Custom Fields ───────────────────────────────
let cfType='text';
document.querySelectorAll('.tbtn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.tbtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    cfType=b.dataset.type;
  });
});
document.getElementById('btn-add-cf').addEventListener('click',async()=>{
  const label=document.getElementById('cf-label').value.trim();
  const value=document.getElementById('cf-value').value.trim();
  if(!label||!value){toast('Label and Value are required','error');return;}
  const aliases=document.getElementById('cf-aliases').value.split(',').map(a=>a.trim()).filter(Boolean);
  const ap=getAP();
  if(!ap.customFields) ap.customFields=[];
  ap.customFields.push({id:Date.now().toString(36),label,value,type:cfType,aliases});
  await StorageAPI.saveProfile(ap);
  appData=await StorageAPI.getData();
  activeProfileId=appData.activeProfileId;
  document.getElementById('cf-label').value='';
  document.getElementById('cf-value').value='';
  document.getElementById('cf-aliases').value='';
  renderCF();
  updateBadges();
  toast('Custom field added');
});
function renderCF() {
  const container=document.getElementById('cf-list');
  const ap=getAP();
  const fields=ap?.customFields||[];
  if(!fields.length){
    container.innerHTML=`<div class="empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg><p>No custom fields yet.<br>Add your first one above.</p></div>`;
    return;
  }
  container.innerHTML=fields.map((cf,i)=>`
    <div class="cfi">
      <span class="drag-h"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>
      <span class="cft-badge ${cf.type==='dropdown'?'dropdown':''}">${cf.type}</span>
      <span class="cf-label-text">${esc(cf.label)}</span>
      <span class="cf-arr">→</span>
      <span class="cf-val">${esc(cf.value)}</span>
      ${cf.aliases?.length?`<span style="font-size:10px;color:var(--tm)">+${cf.aliases.length} alias</span>`:''}
      <button class="btn btn-danger btn-sm btn-ico" data-del="${i}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
    </div>`).join('');
  container.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const ap=getAP();ap.customFields.splice(parseInt(btn.dataset.del),1);
      await StorageAPI.saveProfile(ap);appData=await StorageAPI.getData();activeProfileId=appData.activeProfileId;
      renderCF();updateBadges();toast('Field removed','info');
    });
  });
}

// ── URL Rules ────────────────────────────────────
function populateRuleSel() {
  const s=document.getElementById('rule-profile');
  s.innerHTML='<option value="">Select profile…</option>';
  appData.profiles.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;s.appendChild(o);});
}
async function renderRules() {
  populateRuleSel();
  const rules=appData.urlRules||[];
  const c=document.getElementById('rules-list');
  if(!rules.length){c.innerHTML=`<div class="empty"><p>No rules defined yet.</p></div>`;return;}
  c.innerHTML=rules.map((r,i)=>{
    const p=appData.profiles.find(x=>x.id===r.profileId);
    return `<div class="ritem"><span class="rurl">${esc(r.urlPattern)}</span><span style="color:var(--tm)">→</span><span class="rprof">${p?esc(p.name):'Unknown'}</span><button class="btn btn-danger btn-sm btn-ico" data-dr="${i}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
  }).join('');
  c.querySelectorAll('[data-dr]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      appData.urlRules.splice(parseInt(btn.dataset.dr),1);
      await StorageAPI.saveUrlRules(appData.urlRules);
      updateBadges();renderRules();toast('Rule removed','info');
    });
  });
}
document.getElementById('btn-add-rule').addEventListener('click',async()=>{
  const url=document.getElementById('rule-url').value.trim();
  const pid=document.getElementById('rule-profile').value;
  if(!url||!pid){toast('Fill both fields','error');return;}
  if(!appData.urlRules) appData.urlRules=[];
  appData.urlRules.push({urlPattern:url,profileId:pid});
  await StorageAPI.saveUrlRules(appData.urlRules);
  document.getElementById('rule-url').value='';
  updateBadges();renderRules();toast('Rule added');
});

// ── History ──────────────────────────────────────
function renderHistory() {
  const c=document.getElementById('hist-list');
  const h=appData.history||[];
  if(!h.length){c.innerHTML=`<div class="empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>No fill history yet.</p></div>`;return;}
  c.innerHTML=h.map(e=>{
    const d=new Date(e.timestamp);
    const ts=d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<div class="hitem"><div class="hico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8530A" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><div class="hmeta"><div class="hsite">${esc(e.title||e.url||'Unknown')}</div><div class="hsub">${esc(e.url||'')} · ${ts} · ${esc(e.profileName||'—')}</div></div><div class="hbadge">${e.fieldsFilled} field${e.fieldsFilled!==1?'s':''}</div></div>`;
  }).join('');
}
document.getElementById('btn-clear-hist').addEventListener('click',async()=>{
  if(!confirm('Clear all history?')) return;
  await StorageAPI.clearHistory();appData.history=[];
  updateBadges();renderHistory();toast('History cleared','info');
});

// ── Settings ─────────────────────────────────────
function applySettings() {
  const s=appData.settings;
  document.getElementById('s-load').checked  =!!s.autofillOnLoad;
  document.getElementById('s-submit').checked=!!s.autosubmit;
  document.getElementById('s-hl').checked    =s.highlightBeforeFill!==false;
  document.getElementById('s-skip').checked  =s.skipFilled!==false;
}
async function saveSettingsFromUI() {
  appData.settings.autofillOnLoad     =document.getElementById('s-load').checked;
  appData.settings.autosubmit         =document.getElementById('s-submit').checked;
  appData.settings.highlightBeforeFill=document.getElementById('s-hl').checked;
  appData.settings.skipFilled         =document.getElementById('s-skip').checked;
  await StorageAPI.saveSettings(appData.settings);
}
['s-load','s-submit','s-hl','s-skip'].forEach(id=>document.getElementById(id).addEventListener('change',saveSettingsFromUI));

// ── Export / Import ──────────────────────────────
async function doExport() {
  try{
    const enc=await StorageAPI.exportData();
    const blob=new Blob([JSON.stringify({afp_export:enc,version:2})],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download=`autofill-pro-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();URL.revokeObjectURL(url);
    toast('Exported successfully');
  }catch(e){toast('Export failed: '+e.message,'error');}
}
async function doImport(file) {
  try{
    const txt=await file.text();
    const parsed=JSON.parse(txt);
    if(!parsed.afp_export) throw new Error('Invalid backup file');
    await StorageAPI.importData(parsed.afp_export);
    appData=await StorageAPI.getData();
    activeProfileId=appData.activeProfileId;
    updateSidebarCtx();renderProfiles();updateBadges();
    toast('Data imported successfully');
  }catch(e){toast('Import failed: '+e.message,'error');}
}
document.getElementById('btn-export').addEventListener('click',doExport);
document.getElementById('s-export').addEventListener('click',doExport);
['inp-import','s-import'].forEach(id=>{document.getElementById(id).addEventListener('change',e=>{if(e.target.files[0])doImport(e.target.files[0]);});});
document.getElementById('btn-save-all').addEventListener('click',async()=>{
  const activeTab=document.querySelector('.tpanel.active')?.id;
  if(activeTab==='tab-my-fields') document.getElementById('btn-save-fields').click();
  else {await saveSettingsFromUI();toast('Settings saved');}
});
document.getElementById('s-reset').addEventListener('click',async()=>{
  if(!confirm('Delete ALL profiles, fields, and settings? This cannot be undone.')) return;
  const a=prompt('Type RESET to confirm:');
  if(a!=='RESET') return;
  await StorageAPI.resetAll();toast('Reset — reloading…','info');
  setTimeout(()=>location.reload(),1500);
});

function esc(s){if(!s) return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

init();
