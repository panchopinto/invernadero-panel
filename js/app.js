
// Minimal state

const ICONS = {
  edit:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4" stroke="#60a5fa" stroke-width="2"/></svg>`,
  del:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" stroke="#ef4444" stroke-width="2"/></svg>`,
  down:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M6 12h12M8 12v6h8v-6M12 6v6" stroke="#f59e0b" stroke-width="2"/></svg>`,
  copy:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M9 9h10v10H9zM5 5h10v10H5z" stroke="#a78bfa" stroke-width="2"/></svg>`
};


const CFG = (window.INVENTARIO_CONFIG)||{categorias:[],umbrales:{_default:5}};

let data = [];
let auto = false;
let lastLoaded = null;

const tabla = document.querySelector("#tabla tbody");
const q = document.querySelector("#q");
const fcat = document.querySelector("#f_categoria");
const fest = document.querySelector("#f_estado");
const fubi = document.querySelector("#f_ubicacion");
const autoSwitch = document.querySelector("#autoSwitch");
const autoLabel = document.querySelector("#autoLabel");
const fileInput = document.querySelector("#fileInput");

function CLP(n){ return n.toLocaleString('es-CL',{style:'currency',currency:'CLP'}); }

function statusBadge(row){
  const s = row.estado?.toUpperCase() || 'OK';
  const map = { 'OK':'s-ok','BAJO':'s-low','AGOTADO':'s-out' };
  return `<span class="status ${map[s]||'s-ok'}">${s}</span>`;
}

function refreshFilters(){
  const catsFromData = [...new Set(data.map(x=>x.categoria).filter(Boolean))];
  const cats = Array.from(new Set([...(CFG.categorias||[]), ...catsFromData])).sort();
  fcat.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c=>`<option>${c}</option>`).join('');

  const ubis = [...new Set(data.map(x=>x.ubicacion).filter(Boolean))].sort();
  fubi.innerHTML = `<option value="">Todas las ubicaciones</option>` + ubis.map(c=>`<option>${c}</option>`).join('');
}

function computeKPIs(rows){
  const rowsActivos = rows.filter(r=>(r.estado||'').toUpperCase()!=='BAJA');
  const totalItems = rowsActivos.length;
  const totalUnits = rowsActivos.reduce((a,b)=>a + (parseFloat(b.cantidad)||0),0);
  const totalValue = rowsActivos.reduce((a,b)=>a + ( (parseFloat(b.cantidad)||0) * (parseFloat(b.valor_unitario)||0) ),0);
  const cats = new Set(rowsActivos.map(r=>r.categoria).filter(Boolean)).size;
  document.querySelector('#k_total').textContent = totalItems;
  document.querySelector('#k_units').textContent = totalUnits.toLocaleString('es-CL');
  document.querySelector('#k_cats').textContent = cats;
  document.querySelector('#k_value').textContent = CLP(totalValue);
}

function render(){
  const term = (q.value||'').toLowerCase();
  let rows = data.filter(r=>{
    const hit = [r.codigo,r.nombre,r.proveedor].map(x=>String(x||'').toLowerCase()).some(t=>t.includes(term));
    const catOk = !fcat.value || r.categoria===fcat.value;
    const estOk = !fest.value || (r.estado||'').toUpperCase()===fest.value;
    const ubiOk = !fubi.value || r.ubicacion===fubi.value;
    return hit && catOk && estOk && ubiOk;
  });

  // Recalcular estado según umbrales si no viene definido o está vacío
  rows = rows.map(r=>{
    const qty = parseFloat(r.cantidad)||0;
    const cat = r.categoria||"";
    const minimo = r.minimo ? parseFloat(r.minimo) : (CFG.umbrales[cat] ?? CFG.umbrales._default ?? 5);
    let estado = (r.estado||"").toUpperCase().trim();
    if (!estado) {
      if (qty <= 0) estado = "AGOTADO";
      else if (qty < minimo) estado = "BAJO";
      else estado = "OK";
    }
    r._minimo = minimo;
    r.estado = estado;
    return r;
  });

  computeKPIs(rows);
  buildCharts(rows);
  updateCharts(rows);
  tabla.innerHTML = rows.map((r,ii)=>{ r._idx = data.indexOf(r);
    const vu = parseFloat(r.valor_unitario)||0;
    const qty = parseFloat(r.cantidad)||0;
    return `<tr>
      <td>${r.codigo||''}</td>
      <td>${r.nombre||''}</td>
      <td>${r.categoria||''}</td>
      <td>${r.unidad||''}</td>
      <td>${qty}</td>
      <td>${r.ubicacion||''}</td>
      <td>${r.proveedor||''}</td>
      <td>${vu?CLP(vu):''}</td>
      <td>${vu?CLP(vu*qty):''}</td>
      <td>${r._minimo??''}</td>
      <td>${statusBadge(r)}</td>
      <td>${r.fecha_ingreso||''}</td>
      <td class='actions-row'>
        <button class='btn btn-blue' data-act='edit' data-id='${i}'>${ICONS.edit}</button>
        <button class='btn btn-purple' data-act='copy' data-id='${r._idx||0}'>${ICONS.copy}</button>
        <button class='btn btn-orange' data-act='down' data-id='${r._idx||0}'>${ICONS.down}</button>
        <button class='btn btn-red' data-act='del' data-id='${r._idx||0}'>${ICONS.del}</button>
      </td>
      <td class='actions-row'>
        <button class='btn btn-ok btn-edit' data-id='${r.codigo}'>✏️</button>
        <button class='btn btn-danger btn-del' data-id='${r.codigo}'>🗑️</button>
        <button class='btn btn-warn btn-baja' data-id='${r.codigo}'>⬇️</button>
      </td>
    </tr>`;
  }).join('');
}

function parseCSV(text){
  const [headLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headLine.split(',').map(h=>h.trim());
  return lines.map(line=>{
    const cells = line.split(',').map(c=>c.trim());
    const row = {};
    headers.forEach((h,i)=> row[h]=cells[i]||'' );
    return row;
  });
}

async function loadCSV(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('No se pudo cargar el CSV');
  const txt = await res.text();
  return parseCSV(txt);
}

function toCSV(rows){
  const headers = ["codigo","nombre","categoria","unidad","cantidad","ubicacion","proveedor","fecha_ingreso","valor_unitario","estado","minimo","observaciones"];
  const lines = [headers.join(",")].concat(rows.map(r=>headers.map(h=>(r[h]??"")).join(",")));
  return lines.join("\n");
}

async function init(){
  try{
    data = await loadCSV("data/inventario.csv");
  }catch(e){
    data = [];
  }
  refreshFilters();
  render();
  attachRowEvents();
  lastLoaded = Date.now();
}

init();

// Controls
q.addEventListener('input', render);
fcat.addEventListener('change', render);
fest.addEventListener('change', render);
fubi.addEventListener('change', render);

document.querySelector('#btnExport').addEventListener('click',()=>{
  const csv = toCSV(data);
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "inventario_export.csv";
  a.click();
});

document.querySelector('#btnImport').addEventListener('click',()=> fileInput.click());
fileInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  data = parseCSV(text);
  refreshFilters();
  render();
});

document.querySelector('#btnAdd').addEventListener('click',()=>{
  const nombre = prompt("Nombre del ítem:");
  if(!nombre) return;
  const nuevo = {
    codigo: prompt("Código (opcional):")||"",
    nombre,
    categoria: prompt("Categoría (ej. herramientas, riego, semillas):")||"",
    unidad: prompt("Unidad (UN, kg, lt):")||"UN",
    cantidad: prompt("Cantidad:")||"0",
    ubicacion: prompt("Ubicación (Bodega, Invernadero 1, etc.):")||"",
    proveedor: prompt("Proveedor:")||"",
    fecha_ingreso: new Date().toISOString().slice(0,10),
    valor_unitario: prompt("Valor unitario CLP (número):")||"0",
    estado: prompt("Estado (OK/BAJO/AGOTADO):")||"OK",
    observaciones: ""
  };
  data.unshift(nuevo);
  refreshFilters();
  render();
});

// Auto refresh mock (reload local CSV when toggled)
autoSwitch.addEventListener('click',()=>{
  auto = !auto;
  autoSwitch.classList.toggle('on', auto);
  autoLabel.textContent = auto ? "Auto: ON" : "Auto: OFF";
});

document.querySelector('.year').textContent = new Date().getFullYear();

document.querySelector('#btnBulk').addEventListener('click',()=>{
  const help = `Pega líneas con formato:
nombre;categoria;cantidad;unidad;ubicacion;proveedor;valor_unitario;minimo

Ejemplo:
Manguera 1/2";Riego;4;UN;Bodega Principal;Distribuidora X;12000;2`;
  const txt = prompt(help, "");
  if(!txt) return;
  const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(const line of lines){
    const [nombre,categoria,cantidad,unidad,ubicacion,proveedor,valor_unitario,minimo] = line.split(';');
    data.unshift({
      codigo:"",
      nombre: nombre||"",
      categoria: categoria||"",
      unidad: unidad||"UN",
      cantidad: cantidad||"0",
      ubicacion: ubicacion||"",
      proveedor: proveedor||"",
      fecha_ingreso: new Date().toISOString().slice(0,10),
      valor_unitario: valor_unitario||"0",
      estado:"",
      minimo: minimo||"" ,
      observaciones:""
    });
  }
  refreshFilters();
  render();
});

function attachRowEvents(){
  document.querySelectorAll('.btn-edit').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      const item=data.find(r=>r.codigo===id);
      if(!item){alert("No encontrado");return;}
      const nuevoNombre=prompt("Editar nombre:",item.nombre)||item.nombre;
      item.nombre=nuevoNombre;
      render();
    };
  });
  document.querySelectorAll('.btn-del').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      if(confirm("¿Eliminar este producto?")){
        data=data.filter(r=>r.codigo!==id);
        render();
      }
    };
  });
  document.querySelectorAll('.btn-baja').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      const item=data.find(r=>r.codigo===id);
      if(item){ item.estado="BAJA"; render(); }
    };
  });
}

let chartCategorias=null, chartStock=null;

function updateCharts(rows){
  const ctx1=document.getElementById('chartCategorias').getContext('2d');
  const ctx2=document.getElementById('chartStock').getContext('2d');

  const byCat={};
  rows.forEach(r=>{
    const cat=r.categoria||"Otros";
    byCat[cat]=(byCat[cat]||0)+1;
  });
  const labels=Object.keys(byCat);
  const values=Object.values(byCat);

  if(chartCategorias) chartCategorias.destroy();
  chartCategorias=new Chart(ctx1,{type:'pie',data:{labels:labels,datasets:[{data:values}]} });

  // stock vs mínimo
  const byCat2={};
  rows.forEach(r=>{
    const cat=r.categoria||"Otros";
    const qty=parseFloat(r.cantidad)||0;
    const min=r._minimo||0;
    if(!byCat2[cat]) byCat2[cat]={qty:0,min:0};
    byCat2[cat].qty+=qty;
    byCat2[cat].min+=min;
  });
  const labels2=Object.keys(byCat2);
  const qtys=labels2.map(k=>byCat2[k].qty);
  const mins=labels2.map(k=>byCat2[k].min);
  if(chartStock) chartStock.destroy();
  chartStock=new Chart(ctx2,{type:'bar',
    data:{labels:labels2,datasets:[{label:'Stock',data:qtys,backgroundColor:'#22c55e'},
                                   {label:'Mínimo',data:mins,backgroundColor:'#ef4444'}]},
    options:{responsive:true,scales:{y:{beginAtZero:true}}}
  });
}

// Delegación de eventos para acciones
document.querySelector("#tabla").addEventListener("click",(e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const act = btn.getAttribute("data-act");
  const id = parseInt(btn.getAttribute("data-id"),10);
  const row = data[id];
  if(!row) return;
  if(act==="del"){ addMov({accion:'ELIMINAR', codigo:row.codigo, nombre:row.nombre, categoria:row.categoria, cantidad:row.cantidad});
    if(confirm("¿Eliminar este producto?")){ data.splice(id,1); refreshFilters(); render(); }
  }else if(act==="down"){ addMov({accion:'BAJA', codigo:row.codigo, nombre:row.nombre, categoria:row.categoria, cantidad:row.cantidad});
    if(confirm("¿Dar de baja este producto?")){ row.estado="BAJA"; render(); }
  }else if(act==="edit"){ /* log edit on save */
    openModal(row,id);
  }else if(act==="copy"){ addMov({accion:'DUPLICAR', codigo:row.codigo, nombre:row.nombre, categoria:row.categoria, cantidad:row.cantidad});
    const clone = {...row};
    clone.codigo = (row.codigo||"") + "-copy";
    data.unshift(clone);
    refreshFilters(); render();
  }
});

// ----- Modal Add/Edit -----
const modal = document.querySelector("#modalForm");
const modalTitle = document.querySelector("#modalTitle");
const m = {
  codigo: document.querySelector("#m_codigo"),
  nombre: document.querySelector("#m_nombre"),
  categoria: document.querySelector("#m_categoria"),
  unidad: document.querySelector("#m_unidad"),
  cantidad: document.querySelector("#m_cantidad"),
  minimo: document.querySelector("#m_minimo"),
  ubicacion: document.querySelector("#m_ubicacion"),
  proveedor: document.querySelector("#m_proveedor"),
  valor: document.querySelector("#m_valor"),
  estado: document.querySelector("#m_estado"),
  fecha: document.querySelector("#m_fecha"),
  obs: document.querySelector("#m_obs")
};
let editIndex = null;

function openModal(row=null, idx=null){
  editIndex = idx;
  modal.classList.remove("hidden");
  modalTitle.textContent = row? "Editar ítem" : "Nuevo ítem";
  const cats = Array.from(new Set([...(CFG.categorias||[]), ...data.map(x=>x.categoria).filter(Boolean)])).sort();
  const dl = document.querySelector("#catList");
  dl.innerHTML = cats.map(c=>`<option value="${c}">`).join("");

  const today = new Date().toISOString().slice(0,10);
  m.codigo.value = row?.codigo||"";
  m.nombre.value = row?.nombre||"";
  m.categoria.value = row?.categoria||"";
  m.unidad.value = row?.unidad||"UN";
  m.cantidad.value = row?.cantidad||"0";
  m.minimo.value = row?.minimo||"";
  m.ubicacion.value = row?.ubicacion||"";
  m.proveedor.value = row?.proveedor||"";
  m.valor.value = row?.valor_unitario||row?.valor||"0";
  m.estado.value = (row?.estado||"");
  m.fecha.value = row?.fecha_ingreso||today;
  m.obs.value = row?.observaciones||"";
  setModalDisabled(false);
}
function closeModal(){ modal.classList.add("hidden"); }
document.querySelector("#modalClose").addEventListener("click", closeModal);
document.querySelector("#modalCancel").addEventListener("click", closeModal);

document.querySelector("#btnAdd").addEventListener("click",()=> openModal());

document.querySelector("#modalSave").addEventListener("click",()=>{
  if(!m.nombre.value.trim()){ alert("El nombre es obligatorio"); return; }
  const nuevo = {
    codigo: m.codigo.value.trim(),
    nombre: m.nombre.value.trim(),
    categoria: m.categoria.value.trim(),
    unidad: m.unidad.value.trim()||"UN",
    cantidad: m.cantidad.value.trim()||"0",
    ubicacion: m.ubicacion.value.trim(),
    proveedor: m.proveedor.value.trim(),
    fecha_ingreso: m.fecha.value||new Date().toISOString().slice(0,10),
    valor_unitario: m.valor.value.trim()||"0",
    estado: m.estado.value.trim(),
    minimo: m.minimo.value.trim(),
    observaciones: m.obs.value.trim()
  };
  if(editIndex==null){ data.unshift(nuevo); addMov({accion:'AGREGAR', codigo:nuevo.codigo, nombre:nuevo.nombre, categoria:nuevo.categoria, cantidad:nuevo.cantidad}); }
  else { addMov({accion:'EDITAR', codigo:nuevo.codigo, nombre:nuevo.nombre, categoria:nuevo.categoria, cantidad:nuevo.cantidad}); data[editIndex] = nuevo; }
  closeModal();
  refreshFilters(); render();
});

let chartCategorias=null, chartStock=null;
function buildCharts(rows){
  const rowsActivos = rows.filter(r=>(r.estado||'').toUpperCase()!=='BAJA');
  const byCat = {};
  for(const r of rowsActivos){
    const cat = r.categoria||"(Sin categoría)";
    const qty = parseFloat(r.cantidad)||0;
    const min = (r._minimo!=null)? Number(r._minimo):0;
    if(!byCat[cat]) byCat[cat] = {items:0, qty:0, min:0};
    byCat[cat].items += 1;
    byCat[cat].qty += qty;
    byCat[cat].min += min;
  }
  const labels = Object.keys(byCat);
  const items = labels.map(k=>byCat[k].items);
  const qtys = labels.map(k=>byCat[k].qty);
  const mins = labels.map(k=>byCat[k].min);

  const ctx1 = document.getElementById('chartCategorias');
  if(ctx1){
    if(chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctx1, {
      type:'doughnut',
      data:{ labels, datasets:[{ data: items }] },
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });
  }
  const ctx2 = document.getElementById('chartStock');
  if(ctx2){
    if(chartStock) chartStock.destroy();
    chartStock = new Chart(ctx2, {
      type:'bar',
      data:{ labels, datasets:[
        { label:'Stock', data: qtys },
        { label:'Mínimo', data: mins }
      ]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true } } }
    });
  }
}

// ----- SELECCION ENTREGA -----
const seleccion = new Set();

function renderCheckbox(id){
  return `<input type="checkbox" class="sel" data-id="${id}">`;
}

// Hook after table render to attach checkbox events
function attachRowEvents(){
  document.querySelectorAll('input.sel').forEach(ch=>{
    ch.checked = seleccion.has(parseInt(ch.dataset.id,10));
    ch.addEventListener('change', (e)=>{
      const idx = parseInt(e.target.dataset.id,10);
      if(e.target.checked) seleccion.add(idx); else seleccion.delete(idx);
    });
  });
}

// Override render to include checkbox column & call attach
const _renderOrig = render;
render = function(){
  const term = (q.value||'').toLowerCase();
  let rows = data.filter(r=>{
    const hit = [r.codigo,r.nombre,r.proveedor].map(x=>String(x||'').toLowerCase()).some(t=>t.includes(term));
    const catOk = !fcat.value || r.categoria===fcat.value;
    const estOk = !fest.value || (r.estado||'').toUpperCase()===fest.value;
    const ubiOk = !fubi.value || r.ubicacion===fubi.value;
    return hit && catOk && estOk && ubiOk;
  });
  // Recalcular estado según umbral
  rows = rows.map(r=>{
    const qty = parseFloat(r.cantidad)||0;
    const cat = r.categoria||"";
    const minimo = r.minimo ? parseFloat(r.minimo) : (CFG.umbrales[cat] ?? CFG.umbrales._default ?? 5);
    let estado = (r.estado||"").toUpperCase().trim();
    if (!estado) {
      if (qty <= 0) estado = "AGOTADO";
      else if (qty < minimo) estado = "BAJO";
      else estado = "OK";
    }
    r._minimo = minimo;
    r.estado = estado;
    return r;
  });

  computeKPIs(rows);
  buildCharts(rows);

  tabla.innerHTML = rows.map((r,ii)=>{
    r._idx = data.indexOf(r);
    const vu = parseFloat(r.valor_unitario)||0;
    const qty = parseFloat(r.cantidad)||0;
    return `<tr>
      <td>${renderCheckbox(r._idx)}</td>
      <td>${r.codigo||''}</td>
      <td>${r.nombre||''}</td>
      <td>${r.categoria||''}</td>
      <td>${r.unidad||''}</td>
      <td>${qty}</td>
      <td>${r.ubicacion||''}</td>
      <td>${r.proveedor||''}</td>
      <td>${vu?CLP(vu):''}</td>
      <td>${vu?CLP(vu*qty):''}</td>
      <td>${r._minimo??''}</td>
      <td>${statusBadge(r)}</td>
      <td>${r.fecha_ingreso||''}</td>
      <td class='actions-row'>
        <button class='btn btn-blue' data-act='edit' data-id='${r._idx}'>${ICONS.edit}</button>
        <button class='btn btn-purple' data-act='copy' data-id='${r._idx}'>${ICONS.copy}</button>
        <button class='btn btn-orange' data-act='down' data-id='${r._idx}'>${ICONS.down}</button>
        <button class='btn btn-red' data-act='del' data-id='${r._idx}'>${ICONS.del}</button>
      </td>
    </tr>`;
  }).join('');

  attachRowEvents();
}

// ----- MODAL ENTREGA -----
const modalE = document.querySelector("#modalEntrega");
const eDocente = document.querySelector("#e_docente");
const eProyecto = document.querySelector("#e_proyecto");
const eFecha = document.querySelector("#e_fecha");
const eObs = document.querySelector("#e_obs");
const entTable = document.querySelector("#entTable tbody");

function openEntrega(){
  if(seleccion.size===0){ alert("Selecciona al menos un ítem con el checkbox."); return; }
  modalE.classList.remove("hidden");
  const today = new Date().toISOString().slice(0,10);
  eFecha.value = today;
  // Build rows for selected items
  entTable.innerHTML = "";
  [...seleccion].forEach(idx=>{
    const r = data[idx];
    const stock = parseFloat(r.cantidad)||0;
    entTable.insertAdjacentHTML('beforeend', `
      <tr data-id="${idx}">
        <td>${r.nombre}</td>
        <td>${stock}</td>
        <td><input type="number" min="0" max="${stock}" step="any" value="0" class="entQty" style="width:100px"/></td>
        <td><input type="text" class="entObs" placeholder="(opcional)"/></td>
      </tr>
    `);
  });
}
function closeEntrega(){ modalE.classList.add("hidden"); }
document.querySelector("#entClose").addEventListener("click", closeEntrega);
document.querySelector("#entCancel").addEventListener("click", closeEntrega);
document.querySelector("#btnEntrega").addEventListener("click", openEntrega);

// Confirmar: descuenta stock y prepara imprimible
document.querySelector("#entConfirm").addEventListener("click", ()=>{
  const rows = [...entTable.querySelectorAll('tr')].map(tr=>{
    const id = parseInt(tr.dataset.id,10);
    const qty = parseFloat(tr.querySelector('.entQty').value)||0;
    const obs = tr.querySelector('.entObs').value||"";
    return {id, qty, obs};
  }).filter(x=>x.qty>0);
  if(rows.length===0){ alert("Indica cantidades a entregar (>0)."); return; }
  // Descontar stock y loguear
  rows.forEach(({id,qty,obs})=>{
    const r = data[id];
    const cur = parseFloat(r.cantidad)||0;
    r.cantidad = Math.max(0, cur - qty);
    addMov({accion:'ENTREGA', codigo:r.codigo, nombre:r.nombre, categoria:r.categoria, cantidad:qty, docente:eDocente.value, proyecto:eProyecto.value, obs:obs});
  });
  // Build printable
  buildPrintable(rows);
  // Reset selección y cerrar modal
  seleccion.clear();
  closeEntrega();
  refreshFilters(); render();
});


function buildPrintable(rows){
  const meta = document.querySelector("#printMeta");
  const pid = 'ENT-' + new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14) + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  document.querySelector("#printId").innerHTML = `<b>ID de Acta:</b> ${pid}`;
  meta.innerHTML = `
    <div><b>Docente/Responsable:</b> ${eDocente.value||"-"}</div>
    <div><b>Curso/Proyecto:</b> ${eProyecto.value||"-"}</div>
    <div><b>Fecha:</b> ${eFecha.value||"-"}</div>
  `;
  const tbody = document.querySelector("#printTable tbody");
  tbody.innerHTML = "";
  rows.forEach(({id,qty,obs})=>{
    const r = data[id];
    tbody.insertAdjacentHTML('beforeend',`
      <tr>
        <td>${r.codigo||""}</td>
        <td>${r.nombre||""}</td>
        <td>${r.categoria||""}</td>
        <td>${r.unidad||""}</td>
        <td>${qty}</td>
        <td>${obs||""}</td>
      </tr>
    `);
  });
  document.querySelector("#printObs").textContent = eObs.value||"";
  // QR
  const qrDiv = document.querySelector("#qrCode");
  qrDiv.innerHTML = "";
  if(window.QRCode){
    const payload = JSON.stringify({
      id: pid,
      docente: eDocente.value||"",
      proyecto: eProyecto.value||"",
      fecha: eFecha.value||"",
      items: rows.map(({id,qty})=>({codigo:data[id].codigo, nombre:data[id].nombre, qty}))
    });
    new QRCode(qrDiv, { text: payload, width: 96, height: 96 });
  }
  // Mostrar área de impresión y disparar print
  document.querySelector("#printable").classList.remove("hidden");
  window.print();
  // Ocultar nuevamente
  document.querySelector("#printable").classList.add("hidden");
}


// Atajo: botón "Generar PDF" solo arma el imprimible sin descontar stock
document.querySelector("#entImprimir").addEventListener("click", ()=>{
  const rows = [...entTable.querySelectorAll('tr')].map(tr=>{
    const id = parseInt(tr.dataset.id,10);
    const qty = parseFloat(tr.querySelector('.entQty').value)||0;
    const obs = tr.querySelector('.entObs').value||"";
    return {id, qty, obs};
  }).filter(x=>x.qty>0);
  if(rows.length===0){ alert("Indica cantidades a entregar (>0)."); return; }
  buildPrintable(rows);
});

// ===== HISTORIAL DE MOVIMIENTOS =====
let MOVS = JSON.parse(localStorage.getItem('movs')||'[]');

function addMov({accion,codigo,nombre,categoria,cantidad,docente,proyecto,obs}){
  const ts = new Date().toISOString();
  MOVS.push({fecha_hora:ts,accion,codigo,nombre,categoria,cantidad,docente,proyecto,obs});
  localStorage.setItem('movs', JSON.stringify(MOVS));
}

function buildHistTable(){
  const tbody = document.querySelector("#histTable tbody");
  if(!tbody) return;
  tbody.innerHTML = MOVS.map(m=>`
    <tr>
      <td>${m.fecha_hora}</td>
      <td>${m.accion}</td>
      <td>${m.codigo||""}</td>
      <td>${m.nombre||""}</td>
      <td>${m.categoria||""}</td>
      <td>${m.cantidad??""}</td>
      <td>${[m.docente||"", m.proyecto||""].filter(Boolean).join(" / ")}</td>
      <td>${m.obs||""}</td>
    </tr>
  `).join('');
}

function exportHistCSV(){
  const headers = ["fecha_hora","accion","codigo","nombre","categoria","cantidad","docente","proyecto","obs"];
  const lines = [headers.join(",")].concat(MOVS.map(r=>headers.map(h=> (r[h]??"").toString().replaceAll(',',';')).join(',')));
  const csv = lines.join("\n");
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "movimientos.csv";
  a.click();
}

// Open/close historial modal
const modalH = document.querySelector("#modalHistorial");
document.querySelector("#btnHistorial").addEventListener("click", ()=>{ buildHistTable(); modalH.classList.remove("hidden"); });
document.querySelector("#histClose").addEventListener("click", ()=> modalH.classList.add("hidden"));
document.querySelector("#histOk").addEventListener("click", ()=> modalH.classList.add("hidden"));
document.querySelector("#histClear").addEventListener("click", ()=>{
  if(confirm("¿Borrar todo el historial?")){ MOVS = []; localStorage.setItem('movs','[]'); buildHistTable(); }
});
document.querySelector("#btnExportHist").addEventListener("click", exportHistCSV);

function setModalDisabled(dis){ /* deshabilitado a pedido del usuario */
  [m.codigo,m.nombre,m.categoria,m.unidad,m.cantidad,m.minimo,m.ubicacion,m.proveedor,m.valor,m.fecha,m.obs].forEach(inp=> inp.disabled = false);
  // estado queda editable por si se quiere levantar una BAJA
}
