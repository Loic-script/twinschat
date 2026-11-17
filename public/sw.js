/*
 * Service worker de TwinsChat : reçoit les notifications push (même application fermée),
 * les affiche dans le système de l'appareil (son et vibration selon l'appareil) et ouvre la bonne page au clic.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "TwinsChat";
  const url = data.url || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Les pages ouvertes se mettent à jour tout de suite (nouveaux messages, compteurs)
      windows.forEach((client) => client.postMessage({ type: "push", url }));
      // Discussion déjà affichée et au premier plan : pas de notification système en double
      const target = new URL(url, self.location.origin);
      const viewing = windows.some((client) => {
        if (!client.focused || client.visibilityState !== "visible") return false;
        const here = new URL(client.url);
        return here.pathname === target.pathname && here.search === target.search;
      });
      if (viewing) return;

      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: data.tag || undefined,
        // Même discussion : la nouvelle notification remplace l'ancienne, mais sonne et vibre de nouveau
        renotify: Boolean(data.tag),
        vibrate: [120, 60, 120],
        silent: false,
        timestamp: Date.now(),
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Une fenêtre TwinsChat est ouverte : on l'utilise (premier plan + bonne page), sinon on en ouvre une
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if (existing.url !== url && "navigate" in existing) await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Abonnement renouvelé par le navigateur : la page le réenregistre à sa prochaine ouverture.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => windows.forEach((client) => client.postMessage({ type: "push-resubscribe" }))),
  );
});
