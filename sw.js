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
    e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (janelas) {
        for (var i = 0; i < janelas.length; i++) {
            if (janelas[i].url === url && "focus" in janelas[i]) return janelas[i].focus();
        }
        return self.clients.openWindow(url);
    }));
});
