
  let menu = ["Főoldal","Rólunk","Bejelentkezés"];
  let link = ["/","about-us","login"];
  
  const menulist = document.getElementById('menulist');
  

  const hd = document.getElementById("hd");
  const lk = document.createElement("link");


  lk.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous"';
  hd.appendChild(lk);
  let a = document.createElement("div");
  let i = 0;
    a.innerHTML = '<nav class="navbar navbar-expand-lg bg-body-tertiary">'+
                '<div class="container-fluid">'+
                  '<a class="navbar-brand" href="#">Navbar</a>'+
                  '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">'+
                    '<span class="navbar-toggler-icon"></span>'+
                  '</button>'+
                  '<div class="collapse navbar-collapse" id="navbarNavAltMarkup">'+
                    '<div class="navbar-nav">'+
                    menu.forEach(item => {     
                      '<a class="nav-link active" aria-current="page" href="'+ link[i] +'">'+item+'</a>'+
                      i++;
                    });
                    
                    '</div>'+
                    '</div>'+
                    '</div>'+
                    '</nav>';
                    
                    menulist.appendChild(a);

