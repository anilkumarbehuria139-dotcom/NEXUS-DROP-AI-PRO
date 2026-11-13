
/*
 * NEXUS DROP AI PRO
 * Storefront, Supabase authentication, orders and CSV management
 */

const CONFIG = window.NEXUS_CONFIG || {};

const hasConfig = Boolean(
  CONFIG.SUPABASE_URL &&
  CONFIG.SUPABASE_ANON_KEY &&
  window.supabase
);

const db = hasConfig
  ? window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    )
  : null;

let products = [];
let selectedProduct = null;
let session = null;

const $ = (selector) => document.querySelector(selector);

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);

function toast(message) {
  const element = $("#toast");
  if (!element) {
    alert(message);
    return;
  }

  element.textContent = message;
  element.classList.remove("hidden");

  setTimeout(() => {
    element.classList.add("hidden");
  }, 3500);
}

// CSV parser
function csvParse(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if (
      (character === "\n" || character === "\r") &&
      !quoted
    ) {
      if (character === "\r" && text[i + 1] === "\n") {
        i++;
      }

      row.push(value);

      if (row.some(item => item !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);

  if (row.some(item => item !== "")) {
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(item => item.trim());

  return rows.map(record =>
    Object.fromEntries(
      headers.map((header, index) => [
        header,
        (record[index] || "").trim()
      ])
    )
  );
}

// CSV download
function csvDownload(filename, rows) {
  if (!rows || !rows.length) {
    return toast("No data available for export.");
  }

  const keys = Object.keys(rows[0]);

  const escapeCSV = value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';

  const content = [
    keys.map(escapeCSV).join(","),
    ...rows.map(record =>
      keys.map(key => escapeCSV(record[key])).join(",")
    )
  ].join("\r\n");

  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Display products
function showProducts(list) {
  const root = $("#products");
  if (!root) return;

  root.innerHTML = "";

  if (!list.length) {
    root.innerHTML = `
      <p class="muted">
        No products available yet.
        Admin can import supplier stock CSV.
      </p>
    `;
    return;
  }

  list.forEach(product => {
    const element = document.createElement("article");
    element.className = "product";

    const image = document.createElement("img");

    image.src =
      product.image_url ||
      "https://placehold.co/600x400/eaf0f4/233?text=NEXUS+Product";

    image.alt = product.name;

    image.onerror = () => {
      image.src =
        "https://placehold.co/600x400/eaf0f4/233?text=NEXUS+Product";
    };

    const content = document.createElement("div");
    content.className = "pad";

    const heading = document.createElement("h3");
    heading.textContent = product.name;

    const description = document.createElement("p");
    description.className = "muted";
    description.textContent =
      product.description ||
      product.category ||
      "Useful everyday product";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = money(product.selling_price);

    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Order now";
    button.disabled = Number(product.stock_qty) <= 0;

    button.onclick = () => openOrder(product);

    content.append(heading, description, price, button);
    element.append(image, content);
    root.append(element);
  });
}

// Load products
async function loadProducts() {
  if (!db) {
    products = [];
    showProducts([]);
    toast("Supabase configuration is missing.");
    return;
  }

  const { data, error } = await db
    .from("products")
    .select(
      "id,sku,name,description,category,image_url,selling_price,stock_qty"
    )
    .eq("is_active", true)
    .gt("stock_qty", 0)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Product loading error:", error);
    toast("Unable to load products: " + error.message);
    return;
  }

  products = data || [];
  showProducts(products);
}

// Open customer order form
function openOrder(product) {
  selectedProduct = product;

  const label = $("#orderProduct");

  if (label) {
    label.textContent =
      product.name + " · " + money(product.selling_price);
  }

  $("#orderModal")?.classList.remove("hidden");
}

// Customer order submission
$("#orderForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    return toast("Store is not configured yet.");
  }

  if (!selectedProduct) {
    return toast("Please select a product.");
  }

  const form = Object.fromEntries(
    new FormData(event.target)
  );

  const payload = {
    product_id: selectedProduct.id,
    quantity: 1,
    customer_name: form.customer_name,
    phone: form.phone,
    email: form.email || null,
    address: form.address,
    pincode: form.pincode,
    payment_method: form.payment_method
  };

  const { data, error } = await db.functions.invoke(
    "create-order",
    { body: payload }
  );

  if (error) {
    console.error("Order error:", error);
    return toast("Order request failed: " + error.message);
  }

  $("#orderModal")?.classList.add("hidden");
  event.target.reset();

  toast(
    "Order request received. Reference: " +
    (data?.order_id || "check your confirmation")
  );
});

// Close modals
document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => {
    const modal = $("#" + button.dataset.close);
    modal?.classList.add("hidden");
  };
});

// Open administrator login
$("#adminOpen")?.addEventListener("click", () => {
  $("#adminModal")?.classList.remove("hidden");
});

// Administrator login
$("#loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    return toast("Configure Supabase first.");
  }

  const form = Object.fromEntries(
    new FormData(event.target)
  );

  const { data, error } = await db.auth.signInWithPassword({
    email: form.email,
    password: form.password
  });

  if (error) {
    console.error("Login error:", error);
    return toast("Login failed: " + error.message);
  }

  session = data.session;

  await adminReady();
});

// Verify administrator membership
async function adminReady() {
  if (!db) return;

  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();

  if (sessionError || !sessionData.session) {
    return;
  }

  session = sessionData.session;

  const { data: admin, error: adminError } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (adminError || !admin) {
    await db.auth.signOut();
    session = null;
    toast("This account is not registered as an administrator.");
    return;
  }

  $("#adminModal")?.classList.add("hidden");
  $("#adminLogin")?.classList.add("hidden");
  $("#adminPanel")?.classList.remove("hidden");

  await loadStats();
  await loadOrders();

  switchTab("overview");
}

// Administrator logout
$("#logout")?.addEventListener("click", async () => {
  if (db) {
    await db.auth.signOut();
  }

  session = null;

  $("#adminPanel")?.classList.add("hidden");
  $("#adminLogin")?.classList.remove("hidden");

  toast("Signed out successfully.");
});

// Dashboard tabs
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(element => {
    element.classList.add("hidden");
  });

  $("#tab-" + name)?.classList.remove("hidden");

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === name
    );
  });
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.onclick = () => switchTab(button.dataset.tab);
});

// Dashboard statistics
async function loadStats() {
  if (!db) return;

  const [productsResult, ordersResult] = await Promise.all([
    db.from("products").select("id", {
      count: "exact",
      head: true
    }),

    db.from("orders").select("id", {
      count: "exact",
      head: true
    })
  ]);

  if (productsResult.error || ordersResult.error) {
    console.error(
      "Statistics error:",
      productsResult.error || ordersResult.error
    );
    return toast("Unable to load dashboard statistics.");
  }

  const stats = $("#stats");
  if (!stats) return;

  stats.innerHTML = `
    <div class="stat">
      <b>${productsResult.count || 0}</b>
      <span>Products</span>
    </div>

    <div class="stat">
      <b>${ordersResult.count || 0}</b>
      <span>Order requests</span>
    </div>

    <div class="stat">
      <b>₹0</b>
      <span>Ad spend (manual)</span>
    </div>
  `;
}

// Load customer orders
async function loadOrders() {
  if (!db) return;

  const { data, error } = await db
    .from("orders")
    .select(
      "id,product_sku,product_name,quantity,customer_name,phone,address,pincode,payment_method,payment_status,fulfilment_status,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Orders loading error:", error);
    return toast("Unable to load orders: " + error.message);
  }

  window.adminOrders = data || [];

  const table = $("#ordersTable");
  if (!table) return;

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Product</th>
          <th>Customer</th>
          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        ${window.adminOrders.map(order => `
          <tr>
            <td>${safe(order.id.slice(0, 8))}</td>
            <td>${safe(order.product_name)}</td>
            <td>${safe(order.customer_name)}</td>
            <td>${safe(order.fulfilment_status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// HTML escaping
function safe(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

// Import supplier stock CSV
$("#importStock")?.addEventListener("click", async () => {
  if (!db) return toast("Supabase is not configured.");

  const file = $("#stockFile")?.files[0];

  if (!file) {
    return toast("Choose a stock CSV file.");
  }

  const rows = csvParse(await file.text());

  if (!rows.length) {
    return toast("CSV is empty.");
  }

  const { data, error } = await db.functions.invoke(
    "admin-stock-import",
    { body: { rows } }
  );

  const message = $("#stockMsg");

  if (error) {
    console.error("Stock import error:", error);
    if (message) message.textContent = error.message;
    return;
  }

  if (message) {
    message.textContent =
      `Imported ${data?.imported || 0}; rejected ${data?.rejected || 0}.`;
  }

  await loadProducts();
  await loadStats();
});

// Export supplier orders
$("#exportOrders")?.addEventListener("click", () => {
  if (!window.adminOrders?.length) {
    return toast("No orders to export.");
  }

  const rows = window.adminOrders
    .filter(order =>
      order.payment_status === "verified" ||
      order.payment_method === "COD"
    )
    .map(order => ({
      nexus_order_id: order.id,
      sku: order.product_sku,
      product_name: order.product_name,
      quantity: order.quantity,
      customer_name: order.customer_name,
      phone: order.phone,
      address: order.address,
      pincode: order.pincode,
      payment_method: order.payment_method
    }));

  if (!rows.length) {
    return toast(
      "No eligible orders. Verify prepaid payments first."
    );
  }

  csvDownload("nexus-deodap-orders.csv", rows);
});

// Import shipment tracking CSV
$("#importTracking")?.addEventListener("click", async () => {
  if (!db) return toast("Supabase is not configured.");

  const file = $("#trackingFile")?.files[0];

  if (!file) {
    return toast("Choose a tracking CSV.");
  }

  const rows = csvParse(await file.text());

  if (!rows.length) {
    return toast("Tracking CSV is empty.");
  }

  const { data, error } = await db.functions.invoke(
    "admin-tracking-import",
    { body: { rows } }
  );

  const message = $("#trackingMsg");

  if (error) {
    console.error("Tracking import error:", error);
    if (message) message.textContent = error.message;
    return;
  }

  if (message) {
    message.textContent =
      `Updated ${data?.updated || 0}; rejected ${data?.rejected || 0}.`;
  }

  await loadOrders();
});

// Product search
$("#search")?.addEventListener("input", event => {
  const term = event.target.value.toLowerCase();

  showProducts(
    products.filter(product =>
      (
        product.name + " " +
        product.category + " " +
        product.description
      ).toLowerCase().includes(term)
    )
  );
});

// Current year
if ($("#year")) {
  $("#year").textContent = new Date().getFullYear();
}

// Start application
if (db) {
  adminReady();
} else {
  console.warn("NEXUS DROP AI PRO: Supabase configuration missing.");
}

loadProducts();
