(function () {
  "use strict";

  const venueSelect = document.getElementById("venue-filter");
  const fromDateInput = document.getElementById("from-date");
  const toDateInput = document.getElementById("to-date");
  const favoritesOnlyInput = document.getElementById("favorites-only");
  const resetBtn = document.getElementById("reset-filters");
  const statusEl = document.getElementById("status");
  const tbody = document.getElementById("shows-body");
  const cardsEl = document.getElementById("shows-cards");
  const lastUpdatedEl = document.getElementById("last-updated");
  const filterShows = window.ShowsFilter.filterShows;
  const selectedVenueValues = window.ShowsFilter.selectedVenueValues;
  const clearVenueSelection = window.ShowsFilter.clearVenueSelection;
  const showKey = window.ShowsFilter.showKey;
  const readFavoriteKeys = window.ShowsFilter.readFavoriteKeys;
  const writeFavoriteKeys = window.ShowsFilter.writeFavoriteKeys;

  let allShows = [];
  let favoriteKeys = readFavoriteKeys(window.localStorage);

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkCell(url) {
    if (!url) return "";
    const safe = escapeHtml(url);
    return '<a href="' + safe + '" rel="noopener noreferrer" target="_blank">tickets</a>';
  }

  function populateVenues(shows) {
    const venues = Array.from(
      new Set(shows.map(function (s) { return s.venue || ""; }).filter(Boolean))
    ).sort(function (a, b) {
      return a.localeCompare(b);
    });
    venues.forEach(function (v) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      venueSelect.appendChild(opt);
    });
  }

  function makeFavButton(show) {
    const key = showKey(show);
    const isFav = favoriteKeys.has(key);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-btn";
    btn.dataset.showKey = key;
    btn.setAttribute("aria-pressed", isFav ? "true" : "false");
    btn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
    btn.textContent = isFav ? "★" : "☆";
    return btn;
  }

  function visibleShows() {
    return filterShows(
      allShows,
      selectedVenueValues(venueSelect),
      fromDateInput.value || todayISO(),
      toDateInput.value || "",
      favoritesOnlyInput.checked,
      favoriteKeys
    );
  }

  function render() {
    const shows = visibleShows();
    statusEl.textContent = shows.length + " show(s) shown (of " + allShows.length + " loaded).";

    tbody.innerHTML = "";
    cardsEl.innerHTML = "";

    const frag = document.createDocumentFragment();
    const cardsFrag = document.createDocumentFragment();

    shows.forEach(function (s) {
      const tr = document.createElement("tr");
      const favTd = document.createElement("td");
      favTd.appendChild(makeFavButton(s));
      tr.appendChild(favTd);
      tr.insertAdjacentHTML(
        "beforeend",
        "<td>" + escapeHtml(s.date) + "</td>" +
        "<td>" + escapeHtml(s.doors_or_time) + "</td>" +
        "<td>" + escapeHtml(s.venue) + "</td>" +
        "<td>" + escapeHtml(s.artists) + "</td>" +
        "<td>" + linkCell(s.ticket_url) + "</td>"
      );
      frag.appendChild(tr);

      const article = document.createElement("article");
      article.appendChild(makeFavButton(s));
      const body = document.createElement("div");
      body.innerHTML =
        "<p><strong>Date:</strong> " + escapeHtml(s.date) + "</p>" +
        "<p><strong>Time:</strong> " + escapeHtml(s.doors_or_time) + "</p>" +
        "<p><strong>Venue:</strong> " + escapeHtml(s.venue) + "</p>" +
        "<p><strong>Artists:</strong> " + escapeHtml(s.artists) + "</p>" +
        "<p><strong>Link:</strong> " + (s.ticket_url ? linkCell(s.ticket_url) : "—") + "</p>";
      article.appendChild(body);
      cardsFrag.appendChild(article);
    });

    tbody.appendChild(frag);
    cardsEl.appendChild(cardsFrag);
    // Ensure cards element is not permanently hidden when CSS media query shows it
    cardsEl.hidden = false;
  }

  function toggleFavorite(key) {
    if (!key) return;
    if (favoriteKeys.has(key)) favoriteKeys.delete(key);
    else favoriteKeys.add(key);
    writeFavoriteKeys(window.localStorage, favoriteKeys);
    render();
  }

  function onFavClick(e) {
    const btn = e.target.closest(".fav-btn");
    if (!btn) return;
    toggleFavorite(btn.dataset.showKey);
  }

  function resetFilters() {
    clearVenueSelection(venueSelect);
    fromDateInput.value = todayISO();
    toDateInput.value = "";
    favoritesOnlyInput.checked = false;
    render();
  }

  venueSelect.addEventListener("change", render);
  fromDateInput.addEventListener("change", render);
  toDateInput.addEventListener("change", render);
  favoritesOnlyInput.addEventListener("change", render);
  resetBtn.addEventListener("click", resetFilters);
  tbody.addEventListener("click", onFavClick);
  cardsEl.addEventListener("click", onFavClick);

  Promise.all([
    fetch("./data/shows.json").then(function (r) {
      if (!r.ok) throw new Error("shows.json " + r.status);
      return r.json();
    }),
    fetch("./data/meta.json").then(function (r) {
      if (!r.ok) return {};
      return r.json();
    }).catch(function () { return {}; })
  ])
    .then(function (results) {
      allShows = Array.isArray(results[0]) ? results[0] : [];
      allShows.sort(function (a, b) {
        const da = (a.date || "") + "\0" + (a.doors_or_time || "") + "\0" + (a.venue || "");
        const db = (b.date || "") + "\0" + (b.doors_or_time || "") + "\0" + (b.venue || "");
        return da < db ? -1 : da > db ? 1 : 0;
      });
      populateVenues(allShows);
      fromDateInput.value = todayISO();
      const meta = results[1] || {};
      lastUpdatedEl.textContent = meta.last_updated || "unknown";
      if (meta.last_updated) {
        lastUpdatedEl.setAttribute("datetime", meta.last_updated);
      }
      render();
    })
    .catch(function (err) {
      statusEl.textContent = "Failed to load shows: " + err.message;
    });
})();
