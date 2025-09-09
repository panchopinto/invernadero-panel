/* Homologado: mismas tabs con iconos multicolor del "portafolio unificado" */
const LS_ITEMS = "inv_items_v2";
const LS_MOVS  = "inv_moves_v1";

const defaultState = { items: [], auto: false };
const defaultMovs  = { moves: [] };

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let state = loadState();
let movs  = loadMovs();

function loadState(){ try{ const s=JSON.parse(localStorage.getItem(LS_ITEMS)); return s?{...defaultState,...s,items:Array.isArray(s.items)?s.items:[]}:{...defaultState}; }catch(e){ return {...defaultState}; } }
function saveState(){ localStorage.setItem(LS_ITEMS, JSON.stringify(state)); }
function loadMovs(){ try{ const m=JSON.parse(localStorage.getItem(LS_MOVS)); return m?{...defaultMovs,...m,moves:Array.isArray(m.moves)?m.moves:[]}:{...defaultMovs}; }catch(e){ return {...defaultMovs}; } }
function saveMovs(){ localStorage.setItem(LS_MOVS, JSON.stringify(movs)); }

/* UI */
const tbody=$("#tbody"), k_totalItems=$("#k_totalItems"), k_unidades=$("#k_unidades"), k_categorias=$("#k_categorias"), k_valor=$("#k_valor");
const autoBtn=$("#autoBtn"), autoChk=$("#autoChk");
const importBtn=$("#importBtn"), exportBtn=$("#exportBtn"), addBtn=$("#addBtn"), movBtn=$("#movBtn");
const fileInput=$("#fileInput"), catFilter=$("#catFilter"), estadoFilter=$("#estadoFilter"), ubicFilter=$("#ubicFilter"), searchInput=$("#searchInput");
const yearSpans=$$(".year");

/* Modals */
const itemModal=$("#itemModal"), itemForm=$("#itemForm"), catList=$("#catList"), ubicList=$("#ubicList");
const movModal=$("#movModal"), movForm=$("#movForm"), codList=$("#codList");
const movListModal=$("#movListModal"), movSearch=$("#movSearch"), movTbody=$("#movTbody"), movExport=$("#movExport"), movClose=$("#movClose"), movListBtn=$("#movListBtn");

let editIndex=null;

function money(n){ if(!n||isNaN(+n)) return "$0"; return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(+n); }
function recomputeKPIs(){
  k_totalItems.textContent = state.items.length;
  const totalUnidades = state.items.reduce((a,i)=>a+(+i.cantidad||0),0); k_unidades.textContent=totalUnidades;
  const cats = new Set(state.items.map(i=>(i.categoria||"").trim()).filter(Boolean)); k_categorias.textContent=cats.size;
  const totalValor = state.items.reduce((a,i)=>a+((+i.valorUnitario||0)*(+i.cantidad||0)),0); k_valor.textContent=money(totalValor);
}
function fillFilters(){
  const cats=[...new Set(state.items.map(i=>i.categoria).filter(Boolean))].sort();
  const ubis=[...new Set(state.items.map(i=>i.ubicacion).filter(Boolean))].sort();
  catFilter.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c=>`<option>${c}</option>`).join("");
  ubicFilter.innerHTML = `<option value="">Todas las ubicaciones</option>` + ubis.map(u=>`<option>${u}</option>`).join("");
  catList.innerHTML = cats.map(c=>`<option value="${c}"></option>`).join("");
  ubicList.innerHTML = ubis.map(u=>`<option value="${u}"></option>`).join("");
  const cods = state.items.map(i=>i.codigo).filter(Boolean).sort(); codList.innerHTML = cods.map(c=>`<option value="${c}"></option>`).join("");
}
function renderTable(){
  const txt=(searchInput.value||"").toLowerCase(), cat=catFilter.value||"", est=estadoFilter.value||"", ubi=ubicFilter.value||"";
  const rows = state.items.filter(it=>{
    const matchesTxt = !txt || [it.codigo,it.nombre,it.categoria,it.profesor,it.curso,it.proyecto,it.ubicacion,it.proveedor].some(v=>(v||"").toString().toLowerCase().includes(txt));
    const matchesCat = !cat || (it.categoria||"")===cat;
    const matchesEst = !est || (it.estado||"")===est;
    const matchesUbi = !ubi || (it.ubicacion||"")===ubi;
    return matchesTxt && matchesCat && matchesEst && matchesUbi;
  }).map((it,idx)=>{
    const vUnit=+it.valorUnitario||0, cant=+it.cantidad||0, vTot=vUnit*cant;
    return `<tr data-i="${idx}">
      <td>${it.codigo||""}</td><td>${it.nombre||""}</td><td>${it.categoria||""}</td>
      <td>${it.profesor||""}</td><td>${it.curso||""}</td><td>${it.proyecto||""}</td>
      <td>${it.unidad||""}</td><td>${cant}</td><td>${it.ubicacion||""}</td><td>${it.proveedor||""}</td>
      <td>${money(vUnit)}</td><td>${money(vTot)}</td><td>${it.estado||""}</td><td>${it.fecha||""}</td>
      <td><div class="row-actions">
        <button class="mini" data-action="edit" title="Editar">✏️</button>
        <button class="mini" data-action="delete" title="Eliminar">🗑️</button>
        <button class="mini" data-action="asignar" title="Asignar / movimiento">🔗</button>
      </div></td>
    </tr>`;
  }).join("");
  tbody.innerHTML = rows || `<tr><td colspan="15" style="text-align:center;color:#8aa1cf;padding:20px">Sin datos aún</td></tr>`;
  recomputeKPIs(); fillFilters();
}
function openItemModal(item=null){
  $("#modalTitle").textContent = item ? "Editar Ítem" : "Nuevo Ítem";
  editIndex = item ? state.items.indexOf(item) : null;
  itemForm.reset();
  const f=["codigo","nombre","categoria","unidad","cantidad","ubicacion","proveedor","valorUnitario","estado","fecha","obs","profesor","curso","proyecto"];
  if(item){ f.forEach(k=> itemForm.elements[k].value = item[k] ?? ""); } else { itemForm.elements["fecha"].valueAsDate = new Date(); }
  itemModal.showModal();
}
function upsertFromForm(e){
  e.preventDefault();
  const data = Object.fromEntries(new FormData(itemForm).entries());
  data.cantidad = +(data.cantidad||0); data.valorUnitario = +(data.valorUnitario||0);
  if(editIndex===null) state.items.push(data); else state.items[editIndex] = {...state.items[editIndex], ...data};
  saveState(); renderTable(); itemModal.close();
}
function onRowAction(e){
  const btn=e.target.closest("button[data-action]"); if(!btn) return;
  const idx=+e.target.closest("tr").dataset.i; const action=btn.dataset.action;
  if(action==="edit") openItemModal(state.items[idx]);
  else if(action==="delete"){ if(confirm("¿Eliminar este ítem?")){ state.items.splice(idx,1); saveState(); renderTable(); } }
  else if(action==="asignar") openMovModalFromItem(state.items[idx]);
}

/* CSV Ítems */
function exportCSV(){
  const headers=["codigo","nombre","categoria","profesor","curso","proyecto","unidad","cantidad","ubicacion","proveedor","valorUnitario","estado","fecha","obs"];
  const lines=[headers.join(",")];
  state.items.forEach(it=>{
    const row=headers.map(h=>{ const v=(it[h]??"").toString().replaceAll('"','""'); return /[",\n]/.test(v)?`"${v}"`:v; }).join(",");
    lines.push(row);
  });
  downloadCSV(lines.join("\n"),"inventario_invernadero.csv");
}
function importCSVFile(file){
  const reader=new FileReader();
  reader.onload=(e)=>{
    const rows=parseCSV(e.target.result); if(!rows.length) return;
    const headers=rows.shift().map(h=>h.trim()); const idx=(n)=>headers.indexOf(n);
    const add=rows.map(c=>({ codigo:c[idx("codigo")]||"", nombre:c[idx("nombre")]||"", categoria:c[idx("categoria")]||"", profesor:c[idx("profesor")]||"", curso:c[idx("curso")]||"", proyecto:c[idx("proyecto")]||"", unidad:c[idx("unidad")]||"", cantidad:+(c[idx("cantidad")]||0), ubicacion:c[idx("ubicacion")]||"", proveedor:c[idx("proveedor")]||"", valorUnitario:+(c[idx("valorUnitario")]||0), estado:c[idx("estado")]||"", fecha:c[idx("fecha")]||"", obs:c[idx("obs")]||"" }));
    state.items=[...state.items, ...add]; saveState(); renderTable(); alert(`Importados ${add.length} ítems.`);
  };
  reader.readAsText(file,"utf-8");
}
function parseCSV(text){
  return text.split(/\r?\n/).filter(Boolean).map(r=>{const out=[];let cur="",q=false;for(let i=0;i<r.length;i++){const ch=r[i];if(ch=='"'){if(q&&r[i+1]=='"'){cur+='"';i++;}else q=!q;}else if(ch==","&&!q){out.push(cur);cur="";}else cur+=ch;} out.push(cur); return out;});
}
function downloadCSV(content, name){ const b=new Blob([content],{type:"text/csv;charset=utf-8"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); }

/* Auto switch */
function applyAutoUI(){ autoBtn.classList.toggle("switch",true); autoBtn.classList.toggle("on", state.auto); autoChk.checked = state.auto; if(state.auto){ if(!window._autoTimer){ window._autoTimer=setInterval(()=>renderTable(),60_000);} } else { clearInterval(window._autoTimer); window._autoTimer=null; } }
function toggleAuto(){ state.auto = !state.auto; saveState(); applyAutoUI(); }

/* Movimientos */
function openMovModalFromItem(item){
  movForm.reset();
  const now = new Date();
  movForm.elements["fecha"].value = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  movForm.elements["tipo"].value = "Consumo/Salida";
  movForm.elements["afecta"].checked = true;
  if(item){
    movForm.elements["codigo"].value=item.codigo||"";
    movForm.elements["nombre"].value=item.nombre||"";
    movForm.elements["profesor"].value=item.profesor||"";
    movForm.elements["curso"].value=item.curso||"";
    movForm.elements["proyecto"].value=item.proyecto||"";
  }
  movModal.showModal();
}
function openMovModal(){ openMovModalFromItem(null); }
function onMovCodigoChange(){ const cod=movForm.elements["codigo"].value; const item=state.items.find(i=>(i.codigo||"")==cod); movForm.elements["nombre"].value=item?item.nombre:""; }
function submitMov(e){
  e.preventDefault();
  const d=Object.fromEntries(new FormData(movForm).entries()); d.cantidad=+(d.cantidad||0); d.afecta=movForm.elements["afecta"].checked?"sí":"no"; if(!d.fecha) d.fecha=new Date().toISOString();
  movs.moves.push(d); saveMovs();
  if(movForm.elements["afecta"].checked){ const item=state.items.find(i=>(i.codigo||"")==d.codigo); if(item){ if(d.tipo==="Consumo/Salida"){ item.cantidad=(+item.cantidad||0)-d.cantidad; if(item.cantidad<0)item.cantidad=0; } else if(d.tipo==="Devolución/Entrada"){ item.cantidad=(+item.cantidad||0)+d.cantidad; } saveState(); renderTable(); } }
  movModal.close(); alert("Asignación registrada.");
}
function renderMovList(){
  const q=(movSearch.value||"").toLowerCase();
  const rows = (JSON.parse(localStorage.getItem(LS_MOVS))?.moves||movs.moves).filter(m=>{
    if(!q) return true;
    return [m.profesor,m.curso,m.proyecto,m.codigo,m.nombre,m.tipo].some(v=>(v||"").toLowerCase().includes(q));
  }).map(m=>`
    <tr><td>${m.fecha||""}</td><td>${m.tipo||""}</td><td>${m.codigo||""}</td><td>${m.nombre||""}</td>
    <td>${m.cantidad||0}</td><td>${m.profesor||""}</td><td>${m.curso||""}</td><td>${m.proyecto||""}</td><td>${(m.obs||"").replaceAll('<','&lt;')}</td></tr>
  `).join("");
  movTbody.innerHTML = rows || `<tr><td colspan="9" style="text-align:center;color:#8aa1cf;padding:16px">Sin asignaciones aún</td></tr>`;
}
function exportMovCSV(){
  const headers=["fecha","tipo","codigo","nombre","cantidad","profesor","curso","proyecto","obs","afecta"];
  const lines=[headers.join(",")];
  movs.moves.forEach(m=>{ const row=headers.map(h=>{ const v=(m[h]??"").toString().replaceAll('"','""'); return /[",\n]/.test(v)?`"${v}"`:v; }).join(","); lines.push(row); });
  downloadCSV(lines.join("\n"),"asignaciones.csv");
}

/* Events */
addBtn.addEventListener("click", ()=>openItemModal());
$("#cancelBtn").addEventListener("click", (e)=>{e.preventDefault(); itemModal.close();});
itemForm.addEventListener("submit", upsertFromForm);
tbody.addEventListener("click", onRowAction);
exportBtn.addEventListener("click", exportCSV);
importBtn.addEventListener("click", ()=>fileInput.click());
fileInput.addEventListener("change",(e)=>{const f=e.target.files?.[0]; if(f) importCSVFile(f); fileInput.value="";});
movBtn.addEventListener("click", openMovModal);
movForm.addEventListener("submit", submitMov);
movForm.elements["codigo"].addEventListener("change", onMovCodigoChange);
movForm.elements["codigo"].addEventListener("input", onMovCodigoChange);
$("#movListBtn").addEventListener("click", ()=>{ movModal.close(); renderMovList(); $("#movListModal").showModal(); });
$("#movClose").addEventListener("click", ()=> $("#movListModal").close());
$("#movExport").addEventListener("click", exportMovCSV);
$("#movSearch").addEventListener("input", renderMovList);

autoBtn.addEventListener("click", (e)=>{ if(e.target.id!=="autoChk"){ toggleAuto(); } });
autoChk.addEventListener("change", toggleAuto);
searchInput.addEventListener("input", renderTable);
catFilter.addEventListener("change", renderTable);
estadoFilter.addEventListener("change", renderTable);
ubicFilter.addEventListener("change", renderTable);
yearSpans.forEach(s=> s.textContent = new Date().getFullYear());

/* Init */
renderTable(); applyAutoUI();
