const basePath = "/app127";

// Segédfüggvény egy konkrét süti értékének biztonságos kiolvasásához
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function isLoggedIn() {
  // Ellenőrizzük, hogy az authToken süti értéke pontosan "loggedin"-e
  return getCookie("authToken") === "loggedin";
}

function getUserRole() {
  return getCookie("userRole") || "guest"; // Ha nincs role, akkor "guest"
}

// Menüpontok összeállítása objektumokként
let navItems = [];

if (isLoggedIn()) {
  const role = getUserRole();
  
  // Alapvető menüpontok minden bejelentkezett felhasználónak
  navItems = [
    { label: "Főoldal", path: "" },
    { label: "Rólunk", path: "about-us" },
    { label: "Kapcsolat", path: "contact" },
    { label: "Hírek", path: "posts" },
    { label: "Dashboard", path: "dashboard" }
  ];

  // Admin specifikus menüpont hozzáadása
  if (role === "admin") {
    navItems.push({ label: "Admin", path: "admin" });
  }

  // A Kijelentkezés mindig az utolsó elem bejelentkezve
  navItems.push({ label: "Kijelentkezés", path: "logout" });

} else {
  // Vendég (kijelentkezett) menüpontok
  navItems = [
    { label: "Főoldal", path: "" },
    { label: "Rólunk", path: "about-us" },
    { label: "Kapcsolat", path: "contact" },
    { label: "Hírek", path: "posts" },
    { label: "Bejelentkezés", path: "login" },
    { label: "Regisztráció", path: "register" }
  ];
}

// --- CSS betöltése ---
// Csak akkor adjuk hozzá, ha még nincs az oldalon, elkerülve a duplikációt
if (!document.querySelector('link[href*="bootstrap"]')) {
  const hd = document.head || document.getElementsByTagName("head")[0];
  const lk = document.createElement("link");
  lk.rel = "stylesheet";
  lk.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
  hd.appendChild(lk);
}

// --- Menü generálása és beszúrása ---
const menulist = document.getElementById('menulist');

// A linkek HTML kódjának generálása a navItems tömbből
let navLinksHTML = navItems.map(item => {
  const actualLink = item.path === "" ? basePath : `${basePath}/${item.path}`;
  // Itt később hozzáadhatsz "active" osztály logikát is, ha szükséges
  return `<a class="nav-link" href="${actualLink}">${item.label}</a>`;
}).join('');

// A teljes Navbar HTML összeállítása
let navbarHTML = `
  <nav class="navbar navbar-expand-lg bg-body-tertiary">
    <div class="container-fluid">
      <a class="navbar-brand" href="${basePath}">Navbar</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNavAltMarkup">
        <div class="navbar-nav">
          ${navLinksHTML}
        </div>
      </div>
    </div>
  </nav>
`;

// Beszúrás az oldalra
menulist.innerHTML = navbarHTML;