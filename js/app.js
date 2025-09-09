/* Minimal store en localStorage con columnas extendidas (profesor, curso, proyecto) */
const LS_KEY = "inv_items_v2";

const defaultState = {
  items: [],
  auto: false
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let state = loadState();

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if(!s) return {...defaultState};
    return {...defaultState, ...s, items: Array.isArray(s.items) ? s.items : []};
  }catch(e){ return {...defaultState}; }
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

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
const fileInput = $("#fileInput");
const catFilter = $("#catFilter");
const estadoFilter = $("#estadoFilter");
const ubicFilter = $("#ubicFilter");
const searchInput = $("#searchInput");
const yearSpans = $$(".year");

/* Modal */
const itemModal = $("#itemModal");
const itemForm = $("#itemForm");
const catList = $("#catList");
const ubicList = $("#ubicList");

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
      </div></td>
    </tr>`;
  }).join("");

  tbody.innerHTML = rows || `<tr><td colspan="15" style="text-align:center;color:#8aa1cf;padding:20px">Sin datos aún</td></tr>`;
  recomputeKPIs();
  fillFilters();
}

function openModal(item=null){
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

function closeModal(){ itemModal.close(); }

function upsertFromForm(ev){
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(itemForm).entries());
  // normalizar tipos
  data.cantidad = Number(data.cantidad||0);
  data.valorUnitario = Number(data.valorUnitario||0);

  if(editIndex===null){
    state.items.push(data);
  }else{
    state.items[editIndex] = {...state.items[editIndex], ...data};
  }
  saveState();
  renderTable();
  closeModal();
}

function onRowAction(ev){
  const btn = ev.target.closest("button[data-action]");
  if(!btn) return;
  const tr = ev.target.closest("tr");
  const idx = Number(tr?.dataset?.i);
  if(Number.isNaN(idx)) return;

  const action = btn.dataset.action;
  if(action==="edit"){
    openModal(state.items[idx]);
  }else if(action==="delete"){
    if(confirm("¿Eliminar este ítem?")){
      state.items.splice(idx,1);
      saveState();
      renderTable();
    }
  }
}

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
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "inventario_invernadero.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importCSVFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const text = e.target.result;
    const rows = text.split(/\r?\n/).filter(Boolean).map(r=>{
      // CSV simple (comillas opcionales)
      // Aquí implementamos un parser elemental para no depender de librerías
      const out = [];
      let cur = "", inQ = false;
      for(let i=0;i<r.length;i++){
        const ch = r[i];
        if(ch === '"' ){
          if(inQ && r[i+1]==='"'){ cur+='"'; i++; }
          else inQ = !inQ;
        }else if(ch === ',' && !inQ){
          out.push(cur); cur="";
        }else{
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    });
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

    // Merge simple: concatenar
    state.items = [...state.items, ...newItems];
    saveState();
    renderTable();
    alert(`Importados ${newItems.length} ítems.`);
  };
  reader.readAsText(file, "utf-8");
}

/* Auto refresh dummy (simula buscar nuevos datos locales) */
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
    autoTimer = setInterval(()=>{
      // si existieran fuentes externas, aquí se refrescan.
      renderTable();
    }, 60_000);
  }
}

/* Events */
addBtn.addEventListener("click", ()=> openModal());
itemForm.addEventListener("submit", upsertFromForm);
$("#cancelBtn").addEventListener("click", (e)=>{ e.preventDefault(); closeModal(); });
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
yearSpans.forEach(s=> s.textContent = new Date().getFullYear());

/* Init */
renderTable();
applyAutoUI();
