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
  const primaryArtist = window.ArtistArt.primaryArtist;
  const artistSpotifySegments = window.ArtistArt.artistSpotifySegments;
  const itunesSearchUrl = window.ArtistArt.itunesSearchUrl;
  const wikipediaSummaryUrl = window.ArtistArt.wikipediaSummaryUrl;
  const artworkFromItunesJson = window.ArtistArt.artworkFromItunesJson;
  const artworkFromWikiJson = window.ArtistArt.artworkFromWikiJson;
  const readArtCache = window.ArtistArt.readArtCache;
  const writeArtCache = window.ArtistArt.writeArtCache;
  const cacheSet = window.ArtistArt.cacheSet;
  const cacheGet = window.ArtistArt.cacheGet;

  let allShows = [];
  let favoriteKeys = readFavoriteKeys(window.localStorage);
  let artEntries = readArtCache(window.localStorage);
  const artInflight = {};
  let artObserver = null;

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

  function lookupArtistArtwork(artist) {
    const key = String(artist || "").trim().toLowerCase();
    if (!key) return Promise.resolve(null);
    const cached = cacheGet(artEntries, key);
    if (cached !== undefined) return Promise.resolve(cached);
    if (artInflight[key]) return artInflight[key];

    artInflight[key] = fetch(itunesSearchUrl(artist))
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (data) {
        const itunesUrl = artworkFromItunesJson(data);
        if (itunesUrl) return itunesUrl;
        return fetch(wikipediaSummaryUrl(artist), {
          headers: {
            "Api-User-Agent":
              "ChicagoMusicShows/1.0 (https://github.com/tyler-morales/chicago-music-shows)",
          },
        }).then(function (r) {
          return r.ok ? r.json() : {};
        }).then(artworkFromWikiJson);
      })
      .then(function (url) {
        artEntries = cacheSet(artEntries, key, url || null);
        writeArtCache(window.localStorage, artEntries);
        delete artInflight[key];
        return url || null;
      })
      .catch(function () {
        artEntries = cacheSet(artEntries, key, null);
        writeArtCache(window.localStorage, artEntries);
        delete artInflight[key];
        return null;
      });

    return artInflight[key];
  }

  function makeArtistThumb(artists) {
    const name = primaryArtist(artists);
    const span = document.createElement("span");
    span.className = "artist-thumb";
    span.setAttribute("aria-hidden", "true");
    if (name) span.dataset.artist = name;
    span.textContent = (name.charAt(0) || "?").toUpperCase();
    return span;
  }

  function applyArtwork(placeholder, url) {
    if (!placeholder.isConnected || !url) return;
    const img = document.createElement("img");
    img.className = "artist-thumb";
    img.width = 40;
    img.height = 40;
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = url;
    img.addEventListener("error", function () {
      if (!img.isConnected) return;
      const fallback = document.createElement("span");
      fallback.className = "artist-thumb";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = placeholder.textContent || "?";
      img.replaceWith(fallback);
    });
    placeholder.replaceWith(img);
  }

  function watchArtistThumbs() {
    const nodes = document.querySelectorAll(".artist-thumb[data-artist]");
    function loadEl(el) {
      lookupArtistArtwork(el.dataset.artist).then(function (url) {
        applyArtwork(el, url);
      });
    }
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, loadEl);
      return;
    }
    if (artObserver) artObserver.disconnect();
    artObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          artObserver.unobserve(entry.target);
          loadEl(entry.target);
        });
      },
      { rootMargin: "160px 0px" }
    );
    Array.prototype.forEach.call(nodes, function (el) {
      artObserver.observe(el);
    });
  }

  function appendArtistNames(parent, artists) {
    const segs = artistSpotifySegments(artists);
    if (!segs.length) {
      parent.appendChild(document.createTextNode(artists == null ? "" : String(artists)));
      return;
    }
    segs.forEach(function (seg) {
      if (seg.type !== "artist" || !seg.href) {
        parent.appendChild(document.createTextNode(seg.text));
        return;
      }
      const a = document.createElement("a");
      a.className = "artist-spotify";
      a.href = seg.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = seg.text;
      a.setAttribute("aria-label", (seg.name || seg.text.trim()) + " on Spotify");
      parent.appendChild(a);
    });
  }

  function appendArtistCell(parent, artists, asParagraph) {
    const cell = document.createElement(asParagraph ? "p" : "td");
    if (asParagraph) {
      const label = document.createElement("strong");
      label.textContent = "Artists: ";
      cell.appendChild(label);
    }
    cell.appendChild(makeArtistThumb(artists));
    appendArtistNames(cell, artists);
    parent.appendChild(cell);
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
        "<td>" + escapeHtml(s.venue) + "</td>"
      );
      appendArtistCell(tr, s.artists, false);
      const linkTd = document.createElement("td");
      linkTd.innerHTML = linkCell(s.ticket_url);
      tr.appendChild(linkTd);
      frag.appendChild(tr);

      const article = document.createElement("article");
      article.appendChild(makeFavButton(s));
      const body = document.createElement("div");
      body.innerHTML =
        "<p><strong>Date:</strong> " + escapeHtml(s.date) + "</p>" +
        "<p><strong>Time:</strong> " + escapeHtml(s.doors_or_time) + "</p>" +
        "<p><strong>Venue:</strong> " + escapeHtml(s.venue) + "</p>";
      appendArtistCell(body, s.artists, true);
      const linkP = document.createElement("p");
      linkP.innerHTML = "<strong>Link:</strong> " + (s.ticket_url ? linkCell(s.ticket_url) : "—");
      body.appendChild(linkP);
      article.appendChild(body);
      cardsFrag.appendChild(article);
    });

    tbody.appendChild(frag);
    cardsEl.appendChild(cardsFrag);
    // Ensure cards element is not permanently hidden when CSS media query shows it
    cardsEl.hidden = false;
    watchArtistThumbs();
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
