/* Farejadinhos da Yang — receptor dos avisos (service worker)
 * Mostra a notificação que chega do Worker farejadinhos-push e, ao
 * tocar nela, abre a oferta. Não guarda nada nem faz cache do site.
 */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
    var d = {};
    try { d = e.data ? e.data.json() : {}; } catch (x) { d = { mensagem: e.data ? e.data.text() : "" }; }
    var opcoes = {
        body: d.mensagem || "",
        icon: "/assets/favicon-192.png",
        data: { url: d.url || "/" },
        lang: "pt-BR"
    };
    if (d.imagem) opcoes.image = d.imagem;
    e.waitUntil(self.registration.showNotification(d.titulo || "🐶 Farejadinhos da Yang", opcoes));
});

self.addEventListener("notificationclick", function (e) {
    e.notification.close();
    var url = (e.notification.data && e.notification.data.url) || "/";
    try { url = new URL(url, self.location.origin).href; } catch (x) {}
    // Com o app (ou o site) já aberto, o celular só trazia a janela pra frente
    // na página em que ela estava (ex.: a home). Agora a janela aberta NAVEGA
    // até a oferta; sem janela aberta, abre uma nova direto na oferta.
    e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (janelas) {
        for (var i = 0; i < janelas.length; i++) {
            if (janelas[i].url === url && "focus" in janelas[i]) return janelas[i].focus();
        }
        var j = janelas.filter(function (c) { return c.url.indexOf(self.location.origin) === 0; })[0];
        if (j && "navigate" in j) {
            return j.navigate(url).then(function (c) { return (c || j).focus(); })
                .catch(function () { return self.clients.openWindow(url); });
        }
        return self.clients.openWindow(url);
    }));
});
