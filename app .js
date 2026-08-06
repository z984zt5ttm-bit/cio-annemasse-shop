const API_URL = "https://script.google.com/macros/s/AKfycbwdPwpXZKo-rDdhrleOZNs-4VyQ5cdTYmzYiq-o9MbTDQeR2WTB-h8MXuEhup4R2V7s/exec";
const ADMIN_TELEGRAM_ID = "8878140883";

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

let products = [];
const cart = new Map();

const grid = document.querySelector("#productGrid");
const drawer = document.querySelector("#cartDrawer");
const overlay = document.querySelector("#overlay");

const money = value =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));

function imagePath(name) {

  if (!name) return "logo.jpeg";

  if (/^https?:\/\//i.test(name)) return name;

  return name.replace(/^assets\//, "");
}

async function loadProducts() {
  grid.innerHTML = '<p class="muted">Chargement du catalogue…</p>';

  try {
    const response = await fetch(`${API_URL}?action=products`, {
      redirect: "follow"
    });
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Erreur de chargement");
    }

    products = (data.products || [])
      .filter(product => product.disponible !== false)
      .map(product => ({
        id: String(product.id),
        name: product.nom,
        category: product.categorie,
        price: Number(product.prix || 0),
        unit: "Disponible",
        image: imagePath(product.image),
        desc: product.description || ""
      }));

    renderProducts(document.querySelector("#categoryFilter").value);
    renderCart();
  } catch (error) {
    grid.innerHTML =
      `<p class="status">Impossible de charger les produits : ${error.message}</p>`;
  }
}

function renderProducts(filter = "all") {
  grid.innerHTML = "";

  const visible = products.filter(
    product => filter === "all" || product.category === filter
  );

  if (!visible.length) {
    grid.innerHTML = '<p class="muted">Aucun produit dans cette catégorie.</p>';
    return;
  }

  visible.forEach(product => {
    const card = document.createElement("article");
    card.className = "product";
    card.innerHTML = `
      <div class="product-visual">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-body">
        <span class="badge">${product.unit}</span>
        <h3>${product.name}</h3>
        <p>${product.desc}</p>
        <div class="product-meta">
          <span class="price">${money(product.price)}</span>
          <small>18+</small>
        </div>
        <button class="btn primary full add" data-id="${product.id}">
          Ajouter au panier
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".add").forEach(button => {
    button.addEventListener("click", () => {
      const id = String(button.dataset.id);
      cart.set(id, (cart.get(id) || 0) + 1);
      renderCart();
      openCart();
      tg?.HapticFeedback?.impactOccurred("light");
    });
  });
}

function renderCart() {
  const items = document.querySelector("#cartItems");
  items.innerHTML = "";

  let total = 0;
  let count = 0;

  if (!cart.size) {
    items.innerHTML = '<p class="muted">Votre panier est vide.</p>';
  }

  for (const [id, quantity] of cart.entries()) {
    const product = products.find(item => String(item.id) === String(id));

    if (!product) {
      cart.delete(id);
      continue;
    }

    total += product.price * quantity;
    count += quantity;

    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div>
        <strong>${product.name}</strong>
        <small>${money(product.price)} × ${quantity}</small>
      </div>
      <div class="qty">
        <button data-action="minus" data-id="${id}">−</button>
        <span>${quantity}</span>
        <button data-action="plus" data-id="${id}">+</button>
      </div>
    `;
    items.appendChild(row);
  }

  document.querySelector("#cartTotal").textContent = money(total);
  document.querySelector("#cartCount").textContent = count;

  items.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const id = String(button.dataset.id);
      const next =
        (cart.get(id) || 0) +
        (button.dataset.action === "plus" ? 1 : -1);

      if (next <= 0) {
        cart.delete(id);
      } else {
        cart.set(id, next);
      }

      renderCart();
    });
  });
}

function openCart() {
  drawer.classList.add("open");
  overlay.classList.add("show");
  drawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  drawer.classList.remove("open");
  overlay.classList.remove("show");
  drawer.setAttribute("aria-hidden", "true");
}

function buildOrder() {
  if (!cart.size) {
    throw new Error("Ajoutez au moins un produit.");
  }

  const name = document.querySelector("#customerName").value.trim();
  const phone = document.querySelector("#customerPhone").value.trim();
  const address = document.querySelector("#customerAddress").value.trim();

  if (!name || !phone || !address) {
    throw new Error("Complétez le nom, le téléphone et le lieu.");
  }

  let total = 0;
  const lines = [];

  for (const [id, quantity] of cart.entries()) {
    const product = products.find(item => String(item.id) === String(id));
    if (!product) continue;

    total += product.price * quantity;
    lines.push(
      `• ${product.name} × ${quantity} — ${money(product.price * quantity)}`
    );
  }

  return {
    name,
    phone,
    address,
    mode: document.querySelector("#deliveryMode").value,
    note: document.querySelector("#customerNote").value.trim(),
    total,
    items: lines
  };
}

document.querySelector("#orderBtn").addEventListener("click", () => {
  const status = document.querySelector("#orderStatus");

  try {
    const order = buildOrder();
    const text =
      `Nouvelle demande CIO Annemasse\n\n` +
      `${order.items.join("\n")}\n\n` +
      `Total indicatif: ${money(order.total)}\n` +
      `Mode: ${order.mode}\n` +
      `Client: ${order.name}\n` +
      `Téléphone: ${order.phone}\n` +
      `Adresse/lieu: ${order.address}\n` +
      `Commentaire: ${order.note || "—"}`;

    if (tg?.sendData) {
      tg.sendData(JSON.stringify({ ...order, text }));
      status.textContent = "Demande transmise au bot Telegram.";
    } else {
      status.textContent =
        "Mode démo : ouvrez cette page depuis votre bot Telegram.";
    }
  } catch (error) {
    status.textContent = error.message;
  }
});

/* ADMINISTRATION */

let adminKey = "";

function telegramUserId() {
  return String(tg?.initDataUnsafe?.user?.id || "");
}

function installAdminInterface() {
  const style = document.createElement("style");
  style.textContent = `
    .cio-hidden{display:none!important}
    .cio-admin-button{
      border:1px solid rgba(141,61,255,.5);
      background:rgba(141,61,255,.16);
      color:#fff;
      border-radius:14px;
      padding:10px 14px;
      font-weight:800;
      margin-right:8px
    }
    .cio-admin-panel{
      position:fixed;
      inset:0;
      z-index:200;
      background:rgba(3,2,7,.92);
      backdrop-filter:blur(14px);
      padding:16px;
      overflow:auto
    }
    .cio-admin-card{
      width:min(760px,100%);
      margin:20px auto;
      background:#080610;
      border:1px solid rgba(255,255,255,.12);
      border-radius:24px;
      padding:20px;
      color:#fff
    }
    .cio-admin-head,.cio-admin-toolbar,.cio-admin-actions{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      flex-wrap:wrap
    }
    .cio-admin-list{display:grid;gap:12px;margin-top:16px}
    .cio-admin-item{
      display:grid;
      grid-template-columns:72px 1fr auto;
      gap:12px;
      align-items:center;
      border:1px solid rgba(255,255,255,.12);
      border-radius:16px;
      padding:12px
    }
    .cio-admin-item img{
      width:72px;height:72px;object-fit:cover;border-radius:12px
    }
    .cio-admin-item h3{margin:0 0 4px}
    .cio-admin-item p{margin:0;color:#b5abc8;font-size:13px}
    .cio-admin-item button,.cio-admin-card button{
      border:0;border-radius:12px;padding:10px 12px;font-weight:800
    }
    .cio-edit{background:#ffd54a;color:#17120a}
    .cio-delete{background:#e95555;color:#fff;margin-top:6px}
    .cio-primary{
      background:linear-gradient(135deg,#00eaff,#8d3dff);
      color:#07050d
    }
    .cio-secondary{
      background:#17102a;color:#fff;border:1px solid rgba(255,255,255,.12)!important
    }
    .cio-admin-form{
      display:grid;gap:12px;margin-top:18px;padding-top:18px;
      border-top:1px solid rgba(255,255,255,.12)
    }
    .cio-admin-form label{display:grid;gap:6px;color:#b5abc8}
    .cio-admin-form input,.cio-admin-form select,.cio-admin-form textarea{
      width:100%;background:#0a0712;border:1px solid rgba(255,255,255,.12);
      color:#fff;border-radius:13px;padding:12px
    }
    .cio-check{display:flex!important;align-items:center;gap:8px}
    .cio-check input{width:auto}
    .cio-status{color:#00eaff;margin-top:10px}
    @media(max-width:620px){
      .cio-admin-item{grid-template-columns:56px 1fr}
      .cio-admin-item img{width:56px;height:56px}
      .cio-admin-item-controls{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .cio-delete{margin-top:0}
    }
  `;
  document.head.appendChild(style);

  const cartButton = document.querySelector("#cartToggle");
  const adminButton = document.createElement("button");
  adminButton.id = "cioAdminButton";
  adminButton.className = "cio-admin-button";
  adminButton.textContent = "⚙️ Admin";
  cartButton.parentNode.insertBefore(adminButton, cartButton);

  const panel = document.createElement("section");
  panel.id = "cioAdminPanel";
  panel.className = "cio-admin-panel cio-hidden";
  panel.innerHTML = `
    <div class="cio-admin-card">
      <div class="cio-admin-head">
        <div>
          <p class="eyebrow">ADMINISTRATION</p>
          <h2>Gestion des produits</h2>
        </div>
        <button id="cioAdminClose" class="cio-secondary">Fermer</button>
      </div>

      <div class="cio-admin-toolbar">
        <button id="cioAdminRefresh" class="cio-secondary">Actualiser</button>
        <button id="cioAdminAdd" class="cio-primary">Ajouter un produit</button>
      </div>

      <div id="cioAdminMessage" class="cio-status"></div>
      <div id="cioAdminList" class="cio-admin-list"></div>

      <div id="cioAdminForm" class="cio-admin-form cio-hidden">
        <h3 id="cioAdminFormTitle">Produit</h3>
        <input id="cioProductId" type="hidden">

        <label>Nom
          <input id="cioProductName" type="text">
        </label>

        <label>Catégorie
          <select id="cioProductCategory">
            <option value="fleurs">Fleurs</option>
            <option value="resines">Résines</option>
            <option value="puffs">Puffs</option>
            <option value="collections">Collections</option>
          </select>
        </label>

        <label>Prix
          <input id="cioProductPrice" type="number" min="0" step="0.01">
        </label>

        <label>Image
          <input id="cioProductImage" type="text" placeholder="nom_image.jpeg">
        </label>

        <label>Description
          <textarea id="cioProductDescription" rows="3"></textarea>
        </label>

        <label class="cio-check">
          <input id="cioProductAvailable" type="checkbox" checked>
          Disponible
        </label>

        <div class="cio-admin-actions">
          <button id="cioAdminCancel" class="cio-secondary">Annuler</button>
          <button id="cioAdminSave" class="cio-primary">Enregistrer</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  adminButton.addEventListener("click", openAdmin);
  document.querySelector("#cioAdminClose").addEventListener("click", closeAdmin);
  document.querySelector("#cioAdminRefresh").addEventListener("click", refreshAdmin);
  document.querySelector("#cioAdminAdd").addEventListener("click", () => showAdminForm());
  document.querySelector("#cioAdminCancel").addEventListener("click", () => {
    document.querySelector("#cioAdminForm").classList.add("cio-hidden");
  });
  document.querySelector("#cioAdminSave").addEventListener("click", saveAdminProduct);
}

function openAdmin() {
  document.querySelector("#cioAdminPanel").classList.remove("cio-hidden");

  if (!adminKey) {
    adminKey = prompt("Entre ton code secret administrateur :") || "";
  }

  if (adminKey) {
    refreshAdmin();
  }
}

function closeAdmin() {
  document.querySelector("#cioAdminPanel").classList.add("cio-hidden");
  document.querySelector("#cioAdminForm").classList.add("cio-hidden");
}

async function adminPost(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      ...payload,
      adminKey
    })
  });

  return response.json();
}

async function refreshAdmin() {
  const message = document.querySelector("#cioAdminMessage");
  message.textContent = "Chargement…";

  try {
    const response = await fetch(`${API_URL}?action=products`, {
      redirect: "follow"
    });
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Erreur");
    }

    renderAdminList(data.products || []);
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

function renderAdminList(list) {
  const container = document.querySelector("#cioAdminList");
  container.innerHTML = "";

  list.forEach(product => {
    const item = document.createElement("div");
    item.className = "cio-admin-item";
    item.innerHTML = `
      <img src="${imagePath(product.image)}" alt="">
      <div>
        <h3>${product.nom}</h3>
        <p>
          ${product.categorie} • ${money(product.prix)} •
          ${product.disponible ? "Disponible" : "Indisponible"}
        </p>
      </div>
      <div class="cio-admin-item-controls">
        <button class="cio-edit" data-id="${product.id}">Modifier</button>
        <button class="cio-delete" data-id="${product.id}">Supprimer</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll(".cio-edit").forEach(button => {
    button.addEventListener("click", () => {
      const product = list.find(
        item => String(item.id) === String(button.dataset.id)
      );
      showAdminForm(product);
    });
  });

  container.querySelectorAll(".cio-delete").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Supprimer ce produit ?")) return;

      const message = document.querySelector("#cioAdminMessage");
      message.textContent = "Suppression…";

      try {
        const result = await adminPost({
          action: "delete",
          id: String(button.dataset.id)
        });

        if (!result.ok) {
          throw new Error(result.error || "Erreur");
        }

        await refreshAdmin();
        await loadProducts();
      } catch (error) {
        message.textContent = error.message;
      }
    });
  });
}

function showAdminForm(product = null) {
  const form = document.querySelector("#cioAdminForm");
  form.classList.remove("cio-hidden");

  document.querySelector("#cioAdminFormTitle").textContent =
    product ? "Modifier le produit" : "Ajouter un produit";

  document.querySelector("#cioProductId").value = product?.id || "";
  document.querySelector("#cioProductName").value = product?.nom || "";
  document.querySelector("#cioProductCategory").value =
    product?.categorie || "fleurs";
  document.querySelector("#cioProductPrice").value = product?.prix ?? "";
  document.querySelector("#cioProductImage").value = product?.image || "";
  document.querySelector("#cioProductDescription").value =
    product?.description || "";
  document.querySelector("#cioProductAvailable").checked =
    product ? Boolean(product.disponible) : true;
}

async function saveAdminProduct() {
  const message = document.querySelector("#cioAdminMessage");

  const product = {
    id: document.querySelector("#cioProductId").value || undefined,
    nom: document.querySelector("#cioProductName").value.trim(),
    categorie: document.querySelector("#cioProductCategory").value,
    prix: Number(document.querySelector("#cioProductPrice").value),
    image: document.querySelector("#cioProductImage").value.trim(),
    description: document
      .querySelector("#cioProductDescription")
      .value.trim(),
    disponible: document.querySelector("#cioProductAvailable").checked
  };

  message.textContent = "Enregistrement…";

  try {
    const result = await adminPost({
      action: product.id ? "update" : "add",
      product
    });

    if (!result.ok) {
      throw new Error(result.error || "Erreur");
    }

    document.querySelector("#cioAdminForm").classList.add("cio-hidden");
    await refreshAdmin();
    await loadProducts();
    message.textContent = "Produit enregistré.";
  } catch (error) {
    message.textContent = error.message;
  }
}

if (telegramUserId() === ADMIN_TELEGRAM_ID) {
  installAdminInterface();
}

document.querySelector("#ageYes").addEventListener("click", () => {
  document.querySelector("#ageGate").classList.add("hidden");
});

document.querySelector("#ageNo").addEventListener("click", () => {
  document.querySelector(".gate-card").innerHTML =
    "<h1>Accès refusé</h1><p>Cette boutique est réservée aux personnes majeures.</p>";
});

document.querySelector("#cartToggle").addEventListener("click", openCart);
document.querySelector("#cartClose").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

document
  .querySelector("#categoryFilter")
  .addEventListener("change", event => renderProducts(event.target.value));

document.querySelector("#contactBtn").addEventListener("click", () => {
  tg?.openTelegramLink?.("https://t.me/Ciogeneve_bot") ||
    alert("Contact Telegram : @Ciogeneve_bot");
});

loadProducts();
