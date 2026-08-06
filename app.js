const API_URL = "https://script.google.com/macros/s/AKfycbwdPwpXZKo-rDdhrleOZNs-4VyQ5cdTYmzYiq-o9MbTDQeR2WTB-h8MXuEhup4R2V7s/exec";
const ADMIN_TELEGRAM_ID = "8878140883";
const CONTACT_USERNAME = "cioswiss";

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

let products = [];
let adminKey = "";
const cart = new Map();

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(value||0));
const tgUser = () => tg?.initDataUnsafe?.user || {};
const imagePath = value => !value ? "logo.jpeg" : /^https?:\/\//i.test(value) ? value : value.replace(/^assets\//,"");
const splitList = value => Array.isArray(value) ? value : String(value||"").split(/[|,\n]/).map(x=>x.trim()).filter(Boolean);
const parseVariants = value => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]"); } catch { return []; }
};

function showTelegramIdentity(){
  const user=tgUser();
  $("#telegramIdentity").textContent = user.id
    ? `Telegram : ${user.username ? "@"+user.username : user.first_name||"Utilisateur"} • ID ${user.id}`
    : "Informations Telegram disponibles uniquement dans le bot.";
  if(user.first_name && !$("#customerName").value) $("#customerName").value=[user.first_name,user.last_name].filter(Boolean).join(" ");
}

async function apiGet(action, extra={}){
  const url=new URL(API_URL);
  url.searchParams.set("action",action);
  Object.entries(extra).forEach(([k,v])=>url.searchParams.set(k,v));
  const r=await fetch(url,{redirect:"follow"});
  const data=await r.json();
  if(!data.ok) throw new Error(data.error||"Erreur serveur");
  return data;
}
async function apiPost(payload){
  const r=await fetch(API_URL,{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
  const data=await r.json();
  if(!data.ok) throw new Error(data.error||"Erreur serveur");
  return data;
}

async function loadProducts(){
  $("#productGrid").innerHTML='<p class="muted">Chargement du catalogue…</p>';
  try{
    const data=await apiGet("products");
    products=(data.products||[]).map(p=>({
      id:String(p.id), name:p.nom||"", category:p.categorie||"collections",
      price:Number(p.prix||0), image:imagePath(p.image), desc:p.description||"",
      available:p.disponible!==false, images:splitList(p.images||p.image),
      videos:splitList(p.videos), variants:parseVariants(p.variants)
    })).filter(p=>p.available);
    renderProducts();
  }catch(e){$("#productGrid").innerHTML=`<p class="status">${e.message}</p>`;}
}
function renderProducts(){
  const filter=$("#categoryFilter").value, q=$("#searchInput").value.trim().toLowerCase();
  const list=products.filter(p=>(filter==="all"||p.category===filter)&&(!q||`${p.name} ${p.desc}`.toLowerCase().includes(q)));
  $("#productGrid").innerHTML="";
  if(!list.length){$("#productGrid").innerHTML='<p class="muted">Aucun produit trouvé.</p>';return;}
  list.forEach(p=>{
    const card=document.createElement("article"); card.className="product";
    const minPrice=p.variants.length?Math.min(...p.variants.map(v=>Number(v.price||v.prix||0))):p.price;
    card.innerHTML=`<div class="product-visual" data-detail="${p.id}"><img src="${p.images[0]||p.image}" alt="${p.name}"></div>
      <div class="product-body"><span class="badge">${p.variants.length?`${p.variants.length} formats`:"Disponible"}</span>
      <h3>${p.name}</h3><p>${p.desc}</p><div class="product-meta"><span class="price">${money(minPrice)}</span><small>18+</small></div>
      <button class="btn primary full" data-detail="${p.id}">Voir le produit</button></div>`;
    $("#productGrid").appendChild(card);
  });
  document.querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>openProduct(b.dataset.detail)));
}
function openProduct(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const variants=p.variants.length?p.variants:[{label:"Standard",price:p.price,stock:null}];
  $("#productDetails").innerHTML=`<img id="mainProductImage" class="gallery-main" src="${p.images[0]||p.image}" alt="${p.name}">
    <div class="thumbs">${p.images.map(i=>`<button data-image="${imagePath(i)}"><img src="${imagePath(i)}" alt=""></button>`).join("")}</div>
    <h2>${p.name}</h2><p class="muted">${p.desc}</p>
    ${p.videos.map(v=>`<video class="media-video" controls playsinline src="${v}"></video>`).join("")}
    <div class="variant-list">${variants.map((v,i)=>`<label class="variant-row"><span>${v.label||v.grammage||"Format"}</span><span><strong>${money(v.price||v.prix)}</strong> <input type="radio" name="variant" value="${i}" ${i===0?"checked":""}></span></label>`).join("")}</div>
    <button id="addVariant" class="btn primary full">Ajouter au panier</button>`;
  $("#productModal").classList.remove("hidden");
  document.querySelectorAll("[data-image]").forEach(b=>b.addEventListener("click",()=>$("#mainProductImage").src=b.dataset.image));
  $("#addVariant").addEventListener("click",()=>{
    const i=Number(document.querySelector('input[name="variant"]:checked').value), v=variants[i];
    const key=`${p.id}:${i}`;
    cart.set(key,{productId:p.id,variantIndex:i,qty:(cart.get(key)?.qty||0)+1,label:v.label||v.grammage||"Standard",price:Number(v.price||v.prix||p.price)});
    renderCart(); $("#productModal").classList.add("hidden"); openCart();
  });
}
function renderCart(){
  $("#cartItems").innerHTML=""; let total=0,count=0;
  if(!cart.size) $("#cartItems").innerHTML='<p class="muted">Votre panier est vide.</p>';
  for(const [key,item] of cart){
    const p=products.find(x=>x.id===item.productId); if(!p)continue;
    total+=item.price*item.qty; count+=item.qty;
    const row=document.createElement("div"); row.className="cart-row";
    row.innerHTML=`<div><strong>${p.name}</strong><small>${item.label} • ${money(item.price)} × ${item.qty}</small></div>
      <div class="qty"><button data-key="${key}" data-change="-1">−</button><span>${item.qty}</span><button data-key="${key}" data-change="1">+</button></div>`;
    $("#cartItems").appendChild(row);
  }
  $("#cartTotal").textContent=money(total); $("#cartCount").textContent=count;
  document.querySelectorAll("[data-change]").forEach(b=>b.addEventListener("click",()=>{const x=cart.get(b.dataset.key);x.qty+=Number(b.dataset.change);if(x.qty<=0)cart.delete(b.dataset.key);renderCart();}));
}
function openCart(){showTelegramIdentity();$("#cartDrawer").classList.add("open");$("#overlay").classList.add("show");}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#overlay").classList.remove("show");}
function updateDeliveryFields(){
  const pickup=$("#deliveryMode").value==="pickup";
  $("#addressLabel").classList.toggle("hidden",pickup);
  $("#pickupNotice").classList.toggle("hidden",!pickup);
  $("#customerAddress").required=!pickup;
}
function buildOrder(){
  if(!cart.size)throw new Error("Ajoutez au moins un produit.");
  const name=$("#customerName").value.trim(),phone=$("#customerPhone").value.trim(),mode=$("#deliveryMode").value;
  const address=mode==="pickup"?"Adresse envoyée en privé":$("#customerAddress").value.trim();
  if(!name||!phone||(mode==="delivery"&&!address))throw new Error("Complétez les informations obligatoires.");
  let total=0; const items=[];
  for(const item of cart.values()){
    const p=products.find(x=>x.id===item.productId);if(!p)continue;
    total+=item.price*item.qty;
    items.push({productId:p.id,name:p.name,variant:item.label,unitPrice:item.price,qty:item.qty,lineTotal:item.price*item.qty});
  }
  const u=tgUser();
  return {name,phone,mode,address,note:$("#customerNote").value.trim(),total,items,
    telegramId:String(u.id||""),telegramUsername:u.username||"",telegramFirstName:u.first_name||"",telegramLastName:u.last_name||""};
}
async function submitOrder(){
  const status=$("#orderStatus"); status.textContent="Envoi de la commande…";
  try{
    const data=await apiPost({action:"createOrder",order:buildOrder()});
    status.textContent=`✅ Commande ${data.orderNumber} enregistrée. Statut : ${data.status}.`;
    $("#contactAfterOrder").classList.remove("hidden"); cart.clear();renderCart();
    tg?.HapticFeedback?.notificationOccurred("success");
  }catch(e){status.textContent=`❌ ${e.message}`;}
}
async function openOrders(){
  $("#ordersPanel").classList.remove("hidden"); $("#ordersList").innerHTML='<p class="muted">Chargement…</p>';
  try{
    const id=String(tgUser().id||""); if(!id)throw new Error("Ouvrez la boutique depuis Telegram.");
    const data=await apiGet("myOrders",{telegramId:id});
    $("#ordersList").innerHTML=(data.orders||[]).map(o=>`<article class="order-card"><header><strong>${o.orderNumber}</strong><span class="status-pill">${o.status}</span></header><p>${o.createdAt}</p><p>${o.itemsSummary}</p><strong>${money(o.total)}</strong></article>`).join("")||'<p class="muted">Aucune commande.</p>';
  }catch(e){$("#ordersList").innerHTML=`<p class="status">${e.message}</p>`;}
}

async function openAdmin(){
  if(!adminKey)adminKey=prompt("Code administrateur :")||"";
  if(!adminKey)return;
  $("#adminPanel").classList.remove("hidden"); await renderAdminTab("dashboard");
}
async function adminCall(action,payload={}){return apiPost({action,adminKey,...payload});}
async function renderAdminTab(tab){
  document.querySelectorAll(".admin-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  $("#adminContent").innerHTML='<p class="muted">Chargement…</p>';
  try{
    if(tab==="dashboard"){
      const d=await adminCall("dashboard");
      $("#adminContent").innerHTML=`<div class="stats-grid">
        <div class="stat"><strong>${money(d.todayRevenue)}</strong><span>CA aujourd’hui</span></div>
        <div class="stat"><strong>${money(d.monthRevenue)}</strong><span>CA du mois</span></div>
        <div class="stat"><strong>${d.orderCount}</strong><span>Commandes</span></div>
        <div class="stat"><strong>${d.clientCount}</strong><span>Clients</span></div></div>`;
    }else if(tab==="orders"){
      const d=await adminCall("listOrders");
      $("#adminContent").innerHTML=`<table class="admin-table"><thead><tr><th>N°</th><th>Client</th><th>Total</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${d.orders.map(o=>`<tr><td>${o.orderNumber}</td><td>${o.name}<br><small>${o.telegramUsername?"@"+o.telegramUsername:o.telegramId}</small></td><td>${money(o.total)}</td><td>${o.status}</td><td class="admin-actions">${["Acceptée","Préparation","En livraison","Prête sur place","Terminée","Annulée"].map(s=>`<button data-order="${o.orderNumber}" data-status="${s}">${s}</button>`).join("")}</td></tr>`).join("")}</tbody></table>`;
      document.querySelectorAll("[data-order]").forEach(b=>b.addEventListener("click",async()=>{await adminCall("updateOrderStatus",{orderNumber:b.dataset.order,status:b.dataset.status});renderAdminTab("orders");}));
    }else if(tab==="clients"){
      const d=await adminCall("listClients");
      $("#adminContent").innerHTML=`<table class="admin-table"><thead><tr><th>Client</th><th>Téléphone</th><th>Commandes</th><th>Total</th></tr></thead><tbody>${d.clients.map(c=>`<tr><td>${c.name}<br><small>${c.telegramUsername?"@"+c.telegramUsername:c.telegramId}</small></td><td>${c.phone}</td><td>${c.orderCount}</td><td>${money(c.totalSpent)}</td></tr>`).join("")}</tbody></table>`;
    }else if(tab==="accounting"){
      const d=await adminCall("accounting");
      $("#adminContent").innerHTML=`<div class="stats-grid"><div class="stat"><strong>${money(d.revenue)}</strong><span>Ventes terminées</span></div><div class="stat"><strong>${money(d.expenses)}</strong><span>Dépenses</span></div><div class="stat"><strong>${money(d.profit)}</strong><span>Bénéfice estimé</span></div><div class="stat"><strong>${d.completedOrders}</strong><span>Commandes terminées</span></div></div>
      <div class="admin-form"><h3>Ajouter une dépense</h3><div class="admin-row"><input id="expenseLabel" placeholder="Libellé"><input id="expenseAmount" type="number" placeholder="Montant"></div><button id="addExpense" class="btn primary">Enregistrer</button></div>`;
      $("#addExpense").addEventListener("click",async()=>{await adminCall("addExpense",{label:$("#expenseLabel").value,amount:Number($("#expenseAmount").value)});renderAdminTab("accounting");});
    }else if(tab==="products"){
      const d=await apiGet("products");
      $("#adminContent").innerHTML=`<button id="newProduct" class="btn primary">Ajouter un produit</button><div id="productAdminList">${d.products.map(p=>`<article class="order-card"><strong>${p.nom}</strong><p>${p.categorie} • ${money(p.prix)}</p><button data-edit="${p.id}">Modifier</button></article>`).join("")}</div><div id="productAdminForm"></div>`;
      $("#newProduct").addEventListener("click",()=>showProductAdminForm());
      document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>showProductAdminForm(d.products.find(p=>String(p.id)===b.dataset.edit))));
    }
  }catch(e){$("#adminContent").innerHTML=`<p class="status">${e.message}</p>`;}
}
function showProductAdminForm(p={}){
  $("#productAdminForm").innerHTML=`<div class="admin-form"><h3>${p.id?"Modifier":"Ajouter"} le produit</h3>
    <div class="admin-row"><input id="pName" placeholder="Nom" value="${p.nom||""}"><input id="pCategory" placeholder="Catégorie" value="${p.categorie||"collections"}"></div>
    <div class="admin-row"><input id="pPrice" type="number" placeholder="Prix de base" value="${p.prix||""}"><input id="pImage" placeholder="Image principale" value="${p.image||""}"></div>
    <textarea id="pDescription" placeholder="Description">${p.description||""}</textarea>
    <textarea id="pImages" placeholder="Photos séparées par |">${p.images||p.image||""}</textarea>
    <textarea id="pVideos" placeholder="Vidéos séparées par |">${p.videos||""}</textarea>
    <textarea id="pVariants" placeholder='Variantes JSON : [{"label":"1 g","price":10,"stock":20}]'>${typeof p.variants==="string"?p.variants:JSON.stringify(p.variants||[])}</textarea>
    <label><input id="pAvailable" type="checkbox" ${p.disponible!==false?"checked":""}> Disponible</label>
    <div class="admin-actions"><button id="saveProduct" class="btn primary">Enregistrer</button>${p.id?'<button id="deleteProduct" class="btn danger">Supprimer</button>':""}</div></div>`;
  $("#saveProduct").addEventListener("click",async()=>{await adminCall(p.id?"updateProduct":"addProduct",{product:{id:p.id,nom:$("#pName").value,categorie:$("#pCategory").value,prix:Number($("#pPrice").value),image:$("#pImage").value,description:$("#pDescription").value,images:$("#pImages").value,videos:$("#pVideos").value,variants:$("#pVariants").value,disponible:$("#pAvailable").checked}});renderAdminTab("products");});
  if(p.id)$("#deleteProduct").addEventListener("click",async()=>{if(confirm("Supprimer ?")){await adminCall("deleteProduct",{id:p.id});renderAdminTab("products");}});
}

$("#ageYes").addEventListener("click",()=>$("#ageGate").classList.add("hidden"));
$("#ageNo").addEventListener("click",()=>$(".gate-card").innerHTML="<h1>Accès refusé</h1>");
$("#cartToggle").addEventListener("click",openCart);$("#cartClose").addEventListener("click",closeCart);$("#overlay").addEventListener("click",closeCart);
$("#deliveryMode").addEventListener("change",updateDeliveryFields);$("#orderBtn").addEventListener("click",submitOrder);
$("#categoryFilter").addEventListener("change",renderProducts);$("#searchInput").addEventListener("input",renderProducts);
$("#productClose").addEventListener("click",()=>$("#productModal").classList.add("hidden"));
$("#ordersToggle").addEventListener("click",openOrders);$("#ordersClose").addEventListener("click",()=>$("#ordersPanel").classList.add("hidden"));
$("#contactBtn").addEventListener("click",()=>tg?.openTelegramLink?.(`https://t.me/${CONTACT_USERNAME}`)||window.open(`https://t.me/${CONTACT_USERNAME}`,"_blank"));
$("#adminToggle").addEventListener("click",openAdmin);$("#adminClose").addEventListener("click",()=>$("#adminPanel").classList.add("hidden"));
document.querySelectorAll(".admin-tabs button").forEach(b=>b.addEventListener("click",()=>renderAdminTab(b.dataset.tab)));

if(String(tgUser().id||"")===ADMIN_TELEGRAM_ID)$("#adminToggle").classList.remove("hidden");
updateDeliveryFields();showTelegramIdentity();loadProducts();renderCart();
