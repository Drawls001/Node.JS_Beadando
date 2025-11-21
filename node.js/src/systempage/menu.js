
  let menu = ["Főoldal","Rólunk","Bejelentkezés"];
  let link = ["/","about-us","login"];
  
  const menulist = document.getElementById('menulist');
  

  const hd = document.getElementById("hd");
  const lk = document.createElement("link");

  lk.rel = "stylesheet";
  lk.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css";
  hd.appendChild(lk);
  let navbarHTML = `
  <nav class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container-fluid">
    <a class="navbar-brand" href="/">Navbar</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarNavAltMarkup">
      <div class="navbar-nav">
`;

// menüpontok hozzáadása
for (let i = 0; i < menu.length; i++) {
  navbarHTML += `
        <a class="nav-link" href="${link[i]}">${menu[i]}</a>
  `;
}

navbarHTML += `
      </div>
    </div>
  </div>
</nav>
`;

// --- Menüsáv beszúrása az oldalra ---
let wrapper = document.createElement("div");
wrapper.innerHTML = navbarHTML;
menulist.appendChild(wrapper);