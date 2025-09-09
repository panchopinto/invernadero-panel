/* Store principal (ítems) y store de movimientos */
const LS_ITEMS = "inv_items_v2";
const LS_MOVS  = "inv_moves_v1";

const defaultState = { items: [], auto: false };
const defaultMovs  = { moves: [] };

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let state = loadState();
let movs  = loadMovs();

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_ITEMS));
    if(!s) return {...defaultState};
    return {...defaultState, ...s, items: Array.isArray(s.items) ? s.items : []};
  }catch(e){ return {...defaultState}; }
}
function saveState(){ localStorage.setItem(LS_ITEMS, JSON.stringify(state)); }

function loadMovs(){
  try{
    const m = JSON.parse(localStorage.getItem(LS_MOVS));
    if(!m) return {...defaultMovs};
    return {...defaultMovs, ...m, moves: Array.isArray(m.moves) ? m.moves : []};
  }catch(e){ return {...defaultMovs}; }
}
function saveMovs(){ localStorage.setItem(LS_MOVS, JSON.stringify(movs)); }

/* UI refs */
const tbody = $("#tbody");
const k_totalItems = $("#k_totalItems");
const k_unidades = $("#k_unidades");
const k_categorias = $("#k_categorias");
const k_valor = $("#k_valor");
const autoBtn = $("#autoBtn");
const autoState = $("#autoState");
const importBtn = $("#importBtn");
const exportBtn = $("#exportBtn");
const addBtn = $("#addBtn");
const movBtn = $("#movBtn");
const fileInput = $("#fileInput");
const catFilter = $("#catFilter");
const estadoFilter = $("#estadoFilter");
const ubicFilter = $("#ubicFilter");
const searchInput = $("#searchInput");
const yearSpans = $$(".year");

/* Modal Ítems */
const itemModal = $("#itemModal");
const itemForm = $("#itemForm");
const catList = $("#catList");
const ubicList = $("#ubicList");

/* Modal Movimientos */
const movModal = $("#movModal");
const movForm = $("#movForm");
const codList = $("#codList");
const movListModal = $("#movListModal");
const movSearch = $("#movSearch");
const movTbody = $("#movTbody");
const movExport = $("#movExport");
const movClose = $("#movClose");
const movListBtn = $("#movListBtn");

let editIndex = null;

function money(n){
  if(!n || isNaN(+n)) return "$0";
  return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(+n);
}

function recomputeKPIs(){
  k_totalItems.textContent = state.items.length;
  const totalUnidades = state.items.reduce((acc,it)=>acc + (Number(it.cantidad)||0),0);
  k_unidades.textContent = totalUnidades;
  const cats = new Set(state.items.map(it => (it.categoria||"").trim()).filter(Boolean));
  k_categorias.textContent = cats.size;
  const totalValor = state.items.reduce((acc,it)=>acc + ((Number(it.valorUnitario)||0)*(Number(it.cantidad)||0)),0);
  k_valor.textContent = money(totalValor);
}

function fillFilters(){
  const cats = Array.from(new Set(state.items.map(i=>i.categoria).filter(Boolean))).sort();
  const ubics = Array.from(new Set(state.items.map(i=>i.ubicacion).filter(Boolean))).sort();
  catFilter.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c=>`<option>${c}</option>`).join("");
  ubicFilter.innerHTML = `<option value="">Todas las ubicaciones</option>` + ubics.map(u=>`<option>${u}</option>`).join("");
  catList.innerHTML = cats.map(c=>`<option value="${c}"></option>`).join("");
  ubicList.innerHTML = ubics.map(u=>`<option value="${u}"></option>`).join("");

  // codList para movimientos
  const cods = state.items.map(i => i.codigo).filter(Boolean).sort();
  codList.innerHTML = cods.map(c=>`<option value="${c}"></option>`).join("");
}

function renderTable(){
  const txt = (searchInput.value||"").toLowerCase();
  const cat = catFilter.value||"";
  const est = estadoFilter.value||"";
  const ubi = ubicFilter.value||"";

  const rows = state.items.filter(it=>{
    const matchesTxt = !txt || [
      it.codigo, it.nombre, it.categoria, it.profesor, it.curso, it.proyecto, it.ubicacion, it.proveedor
    ].some(v => (v||"").toString().toLowerCase().includes(txt));

    const matchesCat = !cat || (it.categoria||"")===cat;
    const matchesEst = !est || (it.estado||"")===est;
    const matchesUbi = !ubi || (it.ubicacion||"")===ubi;
    return matchesTxt && matchesCat && matchesEst && matchesUbi;
  }).map((it, idx)=>{
    const vUnit = Number(it.valorUnitario)||0;
    const cant  = Number(it.cantidad)||0;
    const vTot  = vUnit * cant;
    return `<tr data-i="${idx}">
      <td>${it.codigo||""}</td>
      <td>${it.nombre||""}</td>
      <td>${it.categoria||""}</td>
      <td>${it.profesor||""}</td>
      <td>${it.curso||""}</td>
      <td>${it.proyecto||""}</td>
      <td>${it.unidad||""}</td>
      <td>${cant}</td>
      <td>${it.ubicacion||""}</td>
      <td>${it.proveedor||""}</td>
      <td>${money(vUnit)}</td>
      <td>${money(vTot)}</td>
      <td>${it.estado||""}</td>
      <td>${it.fecha||""}</td>
      <td><div class="row-actions">
        <button class="icon ghost" data-action="edit" title="Editar">✏️</button>
        <button class="icon ghost" data-action="delete" title="Eliminar">🗑️</button>
        <button class="icon ghost" data-action="asignar" title="Asignar / movimiento">🔗</button>
      </div></td>
    </tr>`;
  }).join("");

  tbody.innerHTML = rows || `<tr><td colspan="15" style="text-align:center;color:#8aa1cf;padding:20px">Sin datos aún</td></tr>`;
  recomputeKPIs();
  fillFilters();
}

function openItemModal(item=null){
  $("#modalTitle").textContent = item ? "Editar Ítem" : "Nuevo Ítem";
  editIndex = item ? state.items.indexOf(item) : null;
  itemForm.reset();
  const fields = ["codigo","nombre","categoria","unidad","cantidad","ubicacion","proveedor","valorUnitario","estado","fecha","obs","profesor","curso","proyecto"];
  if(item){
    fields.forEach(f=> itemForm.elements[f].value = item[f] ?? "");
  }else{
    itemForm.elements["fecha"].valueAsDate = new Date();
  }
  itemModal.showModal();
}

function closeItemModal(){ itemModal.close(); }

function upsertFromForm(ev){
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(itemForm).entries());
  data.cantidad = Number(data.cantidad||0);
  data.valorUnitario = Number(data.valorUnitario||0);

  if(editIndex===null){
    state.items.push(data);
  }else{
    state.items[editIndex] = {...state.items[editIndex], ...data};
  }
  saveState();
  renderTable();
  closeItemModal();
}

function onRowAction(ev){
  const btn = ev.target.closest("button[data-action]");
  if(!btn) return;
  const tr = ev.target.closest("tr");
  const idx = Number(tr?.dataset?.i);
  if(Number.isNaN(idx)) return;

  const action = btn.dataset.action;
  if(action==="edit"){
    openItemModal(state.items[idx]);
  }else if(action==="delete"){
    if(confirm("¿Eliminar este ítem?")){
      state.items.splice(idx,1);
      saveState();
      renderTable();
    }
  }else if(action==="asignar"){
    openMovModalFromItem(state.items[idx]);
  }
}

/* Export / Import CSV (ítems) */
function exportCSV(){
  const headers = ["codigo","nombre","categoria","profesor","curso","proyecto","unidad","cantidad","ubicacion","proveedor","valorUnitario","estado","fecha","obs"];
  const lines = [headers.join(",")];
  state.items.forEach(it=>{
    const row = headers.map(h=> {
      const val = (it[h]??"").toString().replaceAll('"','""');
      const needsQuotes = /[",\n]/.test(val);
      return needsQuotes ? `"${val}"` : val;
    }).join(",");
    lines.push(row);
  });
  downloadCSV(lines.join("\n"), "inventario_invernadero.csv");
}

function importCSVFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const text = e.target.result;
    const rows = parseCSV(text);
    if(!rows.length) return;
    const headers = rows.shift().map(h=>h.trim());
    const idx = (name)=> headers.indexOf(name);
    const newItems = rows.map(cols=> ({
      codigo: cols[idx("codigo")]||"",
      nombre: cols[idx("nombre")]||"",
      categoria: cols[idx("categoria")]||"",
      profesor: cols[idx("profesor")]||"",
      curso: cols[idx("curso")]||"",
      proyecto: cols[idx("proyecto")]||"",
      unidad: cols[idx("unidad")]||"",
      cantidad: Number(cols[idx("cantidad")]||0),
      ubicacion: cols[idx("ubicacion")]||"",
      proveedor: cols[idx("proveedor")]||"",
      valorUnitario: Number(cols[idx("valorUnitario")]||0),
      estado: cols[idx("estado")]||"",
      fecha: cols[idx("fecha")]||"",
      obs: cols[idx("obs")]||""
    }));

    state.items = [...state.items, ...newItems];
    saveState();
    renderTable();
    alert(`Importados ${newItems.length} ítems.`);
  };
  reader.readAsText(file, "utf-8");
}

function parseCSV(text){
  return text.split(/\r?\n/).filter(r=>r.length>0).map(r=>{
    const out = []; let cur = "", inQ=false;
    for(let i=0;i<r.length;i++){
      const ch = r[i];
      if(ch === '"'){
        if(inQ && r[i+1]==='"'){ cur+='"'; i++; }
        else inQ = !inQ;
      }else if(ch === ',' && !inQ){ out.push(cur); cur=""; }
      else { cur += ch; }
    }
    out.push(cur);
    return out;
  });
}
function downloadCSV(content, filename){
  const blob = new Blob([content], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Auto refresh dummy */
function toggleAuto(){
  state.auto = !state.auto;
  saveState();
  applyAutoUI();
}
let autoTimer = null;
function applyAutoUI(){
  autoState.textContent = state.auto ? "ON" : "OFF";
  autoBtn.classList.toggle("on", state.auto);
  if(autoTimer){ clearInterval(autoTimer); autoTimer = null; }
  if(state.auto){
    autoTimer = setInterval(()=>{ renderTable(); }, 60_000);
  }
}

/* --------- MÓDULO MOVIMIENTOS / ASIGNACIONES --------- */
function openMovModalFromItem(item){
  movForm.reset();
  // defaults
  const now = new Date();
  movForm.elements["fecha"].value = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  movForm.elements["tipo"].value = "Consumo/Salida";
  movForm.elements["afecta"].checked = true;

  if(item){
    movForm.elements["codigo"].value = item.codigo || "";
    movForm.elements["nombre"].value = item.nombre || "";
    movForm.elements["profesor"].value = item.profesor || "";
    movForm.elements["curso"].value = item.curso || "";
    movForm.elements["proyecto"].value = item.proyecto || "";
  }
  movModal.showModal();
}

function openMovModal(){
  openMovModalFromItem(null);
}

function onMovCodigoChange(){
  const cod = movForm.elements["codigo"].value;
  const item = state.items.find(i=> (i.codigo||"") === cod);
  movForm.elements["nombre"].value = item ? (item.nombre||"") : "";
}

function submitMov(ev){
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(movForm).entries());
  data.cantidad = Number(data.cantidad||0);
  data.afecta = movForm.elements["afecta"].checked ? "sí" : "no";
  if(!data.fecha) data.fecha = new Date().toISOString();

  // registrar movimiento
  movs.moves.push(data);
  saveMovs();

  // afectar stock si corresponde
  if(movForm.elements["afecta"].checked){
    const item = state.items.find(i=> (i.codigo||"") === data.codigo);
    if(item){
      if(data.tipo === "Consumo/Salida"){
        item.cantidad = Number(item.cantidad||0) - data.cantidad;
        if(item.cantidad < 0) item.cantidad = 0;
      }else if(data.tipo === "Devolución/Entrada"){
        item.cantidad = Number(item.cantidad||0) + data.cantidad;
      }
      saveState();
      renderTable();
    }
  }
  movModal.close();
  alert("Asignación registrada.");
}

function renderMovList(){
  const q = (movSearch.value||"").toLowerCase();
  const rows = movs.moves.filter(m=>{
    if(!q) return true;
    return [m.profesor, m.curso, m.proyecto, m.codigo, m.nombre, m.tipo].some(v => (v||"").toLowerCase().includes(q));
  }).map(m=>`
    <tr>
      <td>${m.fecha||""}</td>
      <td>${m.tipo||""}</td>
      <td>${m.codigo||""}</td>
      <td>${m.nombre||""}</td>
      <td>${m.cantidad||0}</td>
      <td>${m.profesor||""}</td>
      <td>${m.curso||""}</td>
      <td>${m.proyecto||""}</td>
      <td>${(m.obs||"").replaceAll('<','&lt;')}</td>
    </tr>
  `).join("");
  movTbody.innerHTML = rows || `<tr><td colspan="9" style="text-align:center;color:#8aa1cf;padding:16px">Sin asignaciones aún</td></tr>`;
}

function exportMovCSV(){
  const headers = ["fecha","tipo","codigo","nombre","cantidad","profesor","curso","proyecto","obs","afecta"];
  const lines = [headers.join(",")];
  movs.moves.forEach(m=>{
    const row = headers.map(h=>{
      const val = (m[h]??"").toString().replaceAll('"','""');
      const needsQuotes = /[",\n]/.test(val);
      return needsQuotes ? `"${val}"` : val;
    }).join(",");
    lines.push(row);
  });
  downloadCSV(lines.join("\n"), "asignaciones.csv");
}

/* Events */
addBtn.addEventListener("click", ()=> openItemModal());
$("#cancelBtn").addEventListener("click", (e)=>{ e.preventDefault(); itemModal.close(); });
itemForm.addEventListener("submit", upsertFromForm);
tbody.addEventListener("click", onRowAction);

exportBtn.addEventListener("click", exportCSV);
importBtn.addEventListener("click", ()=> fileInput.click());
fileInput.addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(f) importCSVFile(f);
  fileInput.value = "";
});

autoBtn.addEventListener("click", toggleAuto);
searchInput.addEventListener("input", renderTable);
catFilter.addEventListener("change", renderTable);
estadoFilter.addEventListener("change", renderTable);
ubicFilter.addEventListener("change", renderTable);

movBtn.addEventListener("click", openMovModal);
movForm.addEventListener("submit", submitMov);
movForm.elements["codigo"].addEventListener("change", onMovCodigoChange);
movForm.elements["codigo"].addEventListener("input", onMovCodigoChange);
movListBtn.addEventListener("click", ()=>{ movModal.close(); renderMovList(); movListModal.showModal(); });
movClose.addEventListener("click", ()=> movListModal.close());
movSearch.addEventListener("input", renderMovList);
movExport.addEventListener("click", exportMovCSV);

const yearSpans = $$(".year"); yearSpans.forEach(s=> s.textContent = new Date().getFullYear());

/* Init */
function init(){
  renderTable();
  applyAutoUI();
}
init();
