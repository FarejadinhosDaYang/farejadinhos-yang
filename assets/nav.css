/* Farejadinhos da Yang — menu "três tracinhos" */

[data-yang-nav]{
    position:relative;
    z-index:40;
}

.yang-nav-toggle{
    position:relative;
    z-index:60;
    width:42px;
    height:42px;
    border-radius:12px;
    border:1.5px solid var(--line,#F0DFC4);
    background:#fff;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
    cursor:pointer;
    flex:none;
}

.yang-nav-toggle span{
    display:block;
    width:18px;
    height:2px;
    border-radius:2px;
    background:var(--red-dark,#C21A24);
}

.yang-nav-backdrop{
    position:fixed;
    inset:0;
    background:rgba(43,27,18,.35);
    opacity:0;
    pointer-events:none;
    transition:opacity .18s ease;
    z-index:45;
}

.yang-nav-drawer{
    position:fixed;
    top:0;
    right:0;
    bottom:0;
    width:78%;
    max-width:300px;
    background:var(--cream-2,#FFFAF1);
    box-shadow:-10px 0 30px rgba(0,0,0,.18);
    transform:translateX(100%);
    transition:transform .22s ease;
    z-index:50;
    padding:22px 20px;
    display:flex;
    flex-direction:column;
    gap:4px;
}

.yang-nav-drawer-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    font-family:'Baloo 2',sans-serif;
    color:var(--red-dark,#C21A24);
    margin-bottom:14px;
    padding-bottom:14px;
    border-bottom:1.5px solid var(--line,#F0DFC4);
}

.yang-nav-drawer-head-brand{
    display:flex;
    align-items:center;
    gap:10px;
    min-width:0;
}

.yang-nav-close{
    flex:none;
    width:32px;
    height:32px;
    border-radius:10px;
    border:1.5px solid var(--line,#F0DFC4);
    background:#fff;
    color:var(--muted,#8A7563);
    font-size:16px;
    line-height:1;
    cursor:pointer;
}

.yang-nav-drawer-head img{
    width:36px;
    height:36px;
    border-radius:50%;
}

.yang-nav-drawer a{
    display:block;
    padding:13px 10px;
    border-radius:11px;
    text-decoration:none;
    color:var(--ink,#2B1B12);
    font-weight:600;
    font-size:15px;
}

.yang-nav-drawer a:hover{
    background:#fff2e0;
}

[data-yang-nav].yang-nav-open .yang-nav-backdrop{
    opacity:1;
    pointer-events:auto;
}

[data-yang-nav].yang-nav-open .yang-nav-drawer{
    transform:translateX(0);
}

[data-yang-nav].yang-nav-open .yang-nav-toggle{
    visibility:hidden;
}
