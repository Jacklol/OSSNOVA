const i18nStorageKey = "ossnova-language";
const i18nDictionaryVersion = "nav-speed-1";
const i18nDictionaryCachePrefix = "ossnova-i18n";
const i18nPendingClass = "is-i18n-pending";
const i18nSupportedLanguages = ["ru", "en"];
let currentLanguage = "ru";
let currentDictionary = {};

const getStoredLanguage = () => {
  try {
    return window.localStorage.getItem(i18nStorageKey);
  } catch (error) {
    return null;
  }
};

const storeLanguage = (language) => {
  try {
    window.localStorage.setItem(i18nStorageKey, language);
  } catch (error) {
    // Language still works from the URL even when storage is unavailable.
  }
};

const getInitialLanguage = () => {
  const languageFromUrl = new URLSearchParams(window.location.search).get("lang");
  const storedLanguage = getStoredLanguage();
  const pageLanguage = document.documentElement.lang;
  const candidate = languageFromUrl || storedLanguage || pageLanguage || "ru";

  return i18nSupportedLanguages.includes(candidate) ? candidate : "ru";
};

const getI18nText = (key, fallback = "") => {
  if (!key) {
    return fallback;
  }

  return currentDictionary[key] ?? fallback;
};

const getCachedI18nDictionary = (language) => {
  try {
    const cachedDictionary = window.sessionStorage.getItem(`${i18nDictionaryCachePrefix}:${i18nDictionaryVersion}:${language}`);
    return cachedDictionary ? JSON.parse(cachedDictionary) : null;
  } catch (error) {
    return null;
  }
};

const cacheI18nDictionary = (language, dictionary) => {
  try {
    window.sessionStorage.setItem(
      `${i18nDictionaryCachePrefix}:${i18nDictionaryVersion}:${language}`,
      JSON.stringify(dictionary)
    );
  } catch (error) {
    // The dictionary can still be fetched normally when storage is unavailable.
  }
};

const loadI18nDictionary = async (language) => {
  const cachedDictionary = getCachedI18nDictionary(language);

  if (cachedDictionary) {
    return cachedDictionary;
  }

  const response = await fetch(`locales/${language}.json`, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Could not load ${language} dictionary`);
  }

  const dictionary = await response.json();
  cacheI18nDictionary(language, dictionary);
  return dictionary;
};

const updateLanguageUrl = (language) => {
  const url = new URL(window.location.href);

  if (language === "ru") {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", language);
  }

  window.history.replaceState(null, "", url);
};

const applyI18n = () => {
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = getI18nText(element.dataset.i18n, element.textContent);
  });

  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = getI18nText(element.dataset.i18nHtml, element.innerHTML);
  });

  [
    ["i18nContent", "content"],
    ["i18nAriaLabel", "aria-label"],
    ["i18nAlt", "alt"],
    ["i18nTitle", "title"],
    ["i18nPlaceholder", "placeholder"],
  ].forEach(([datasetKey, attributeName]) => {
    document.querySelectorAll(`[data-${datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`).forEach((element) => {
      const key = element.dataset[datasetKey];
      const fallback = element.getAttribute(attributeName) || "";
      element.setAttribute(attributeName, getI18nText(key, fallback));
    });
  });

  document.querySelectorAll("[data-language-toggle]").forEach((toggle) => {
    const nextLanguage = currentLanguage === "ru" ? "en" : "ru";
    const labelKey = nextLanguage === "en" ? "common.language.switchToEnglish.label" : "common.language.switchToRussian.label";
    const ariaKey = nextLanguage === "en" ? "common.language.switchToEnglish.aria" : "common.language.switchToRussian.aria";

    toggle.textContent = getI18nText(labelKey, nextLanguage.toUpperCase());
    toggle.lang = nextLanguage;
    toggle.setAttribute("aria-label", getI18nText(ariaKey, toggle.textContent));
  });
};

const setLanguage = async (language, { persist = true } = {}) => {
  const nextLanguage = i18nSupportedLanguages.includes(language) ? language : "ru";

  try {
    currentDictionary = await loadI18nDictionary(nextLanguage);
    currentLanguage = nextLanguage;

    if (persist) {
      storeLanguage(nextLanguage);
      updateLanguageUrl(nextLanguage);
    }

    applyI18n();
    document.documentElement.classList.remove(i18nPendingClass);
    window.dispatchEvent(new CustomEvent("ossnova:languagechange", { detail: { language: nextLanguage } }));
  } catch (error) {
    currentLanguage = "ru";
    currentDictionary = {};
    document.documentElement.classList.remove(i18nPendingClass);
  }
};

const initLanguageToggle = () => {
  document.querySelectorAll("[data-language-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      setLanguage(currentLanguage === "ru" ? "en" : "ru");
    });
  });
};

initLanguageToggle();
setLanguage(getInitialLanguage(), { persist: Boolean(new URLSearchParams(window.location.search).get("lang")) });

const introMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const homeMobileIntroQuery = window.matchMedia("(max-width: 640px)");
const homeRippleReveal = document.querySelector(".hero-ripple-reveal");
const homeMotionPendingClass = "is-home-motion-pending";
const homeMobileMotionPendingClass = "is-home-mobile-motion-pending";
let introCleanupTimer = 0;

const stopHomeIntro = () => {
  window.clearTimeout(introCleanupTimer);
  introCleanupTimer = 0;
  document.body.classList.remove("home-ripple-intro");
};

const startHomeIntro = () => {
  if (!homeRippleReveal || introMotionPreference.matches || homeMobileIntroQuery.matches) {
    return;
  }

  stopHomeIntro();
  void document.body.offsetWidth;
  document.body.classList.add("home-ripple-intro");
  window.dispatchEvent(new CustomEvent("home-ripple-intro:start"));
  introCleanupTimer = window.setTimeout(stopHomeIntro, 2600);
};

const startHomeMobileIntro = () => {
  document.documentElement.classList.remove(homeMotionPendingClass);

  if (!homeRippleReveal || introMotionPreference.matches) {
    document.documentElement.classList.remove(homeMobileMotionPendingClass);
    return;
  }

  document.body.classList.remove("home-mobile-intro");
  void document.body.offsetWidth;
  document.body.classList.add("home-mobile-intro");
  document.documentElement.classList.remove(homeMobileMotionPendingClass);
};

const waitForImageReady = (image, timeout = 1200) =>
  new Promise((resolve) => {
    if (!image || (image.complete && image.naturalWidth > 0)) {
      resolve();
      return;
    }

    let isResolved = false;
    const finish = () => {
      if (isResolved) {
        return;
      }

      isResolved = true;
      window.clearTimeout(timer);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeout);

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });

const waitForWindowReady = (timeout = 1600) =>
  new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }

    let isResolved = false;
    const finish = () => {
      if (isResolved) {
        return;
      }

      isResolved = true;
      window.clearTimeout(timer);
      window.removeEventListener("load", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeout);

    window.addEventListener("load", finish, { once: true });
  });

const setupProgressiveImages = () => {
  document.querySelectorAll("img[data-lqip]").forEach((image) => {
    image.style.setProperty("--lqip-image", `url("${image.dataset.lqip}")`);

    const markLoaded = () => image.classList.add("is-loaded");

    if (image.complete && image.naturalWidth > 0) {
      markLoaded();
      return;
    }

    image.addEventListener("load", markLoaded, { once: true });
    image.addEventListener("error", markLoaded, { once: true });
  });
};

setupProgressiveImages();

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  const setNavToggleLabel = (isOpen) => {
    navToggle.setAttribute(
      "aria-label",
      getI18nText(isOpen ? "common.nav.closeMenu" : "common.nav.openMenu", isOpen ? "Закрыть меню" : "Открыть меню")
    );
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    setNavToggleLabel(!isOpen);
    siteNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("is-nav-open", !isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      setNavToggleLabel(false);
      siteNav.classList.remove("is-open");
      document.body.classList.remove("is-nav-open");
    });
  });

  window.addEventListener("ossnova:languagechange", () => {
    setNavToggleLabel(navToggle.getAttribute("aria-expanded") === "true");
  });
}

const prefetchedNavPages = new Set();

const prefetchNavPage = (href) => {
  if (!href || href.startsWith("#")) {
    return;
  }

  const url = new URL(href, window.location.href);

  if (url.origin !== window.location.origin || prefetchedNavPages.has(url.href)) {
    return;
  }

  prefetchedNavPages.add(url.href);

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "document";
  link.href = url.href;
  document.head.append(link);
};

const setupNavPagePrefetch = () => {
  const navLinks = Array.from(document.querySelectorAll(".site-nav a[href]")).filter((link) => {
    const href = link.getAttribute("href") || "";
    return href && href !== "#" && !link.hasAttribute("data-language-toggle");
  });

  if (navLinks.length === 0) {
    return;
  }

  const prefetchAll = () => {
    navLinks.forEach((link) => prefetchNavPage(link.getAttribute("href")));
  };

  navLinks.forEach((link) => {
    const prefetchCurrentLink = () => prefetchNavPage(link.getAttribute("href"));

    link.addEventListener("pointerenter", prefetchCurrentLink, { passive: true });
    link.addEventListener("focus", prefetchCurrentLink);
    link.addEventListener("touchstart", prefetchCurrentLink, { passive: true });
  });

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prefetchAll, { timeout: 1800 });
  } else {
    window.setTimeout(prefetchAll, 900);
  }
};

setupNavPagePrefetch();

const setupSoftReveals = () => {
  const targets = [];
  const targetSet = new Set();
  const selectors = [
    ".partners",
    ".solution-card:not([aria-hidden='true']) .solution-media",
    ".solution-card:not([aria-hidden='true']) .solution-copy > *",
    ".belarus-network__copy > *",
    ".belarus-network__stats > div",
    ".belarus-map-card",
    ".home-about h2",
    ".home-about-copy",
    ".home-about-stats > div",
    ".home-about-media",
    ".materials-grid .material-card",
    ".home-contact-form",
    ".company-hero-media",
    ".company-hero-copy > *",
    ".company-metrics > div",
    ".company-red-inner > *",
    ".company-quote > *",
    ".about-hero-media",
    ".about-hero-copy > *",
    ".about-stats > div",
    ".about-red-grid > *",
    ".about-quote > *",
    ".cardiology-page-hero > *",
    ".specialty-hero > img",
    ".specialty-hero-copy > *",
    ".technologies > .section-shell > .section-title",
    ".technologies > .section-shell > .section-lead",
    ".tech-media",
    ".tech-copy > *",
    ".tech-specs > div",
    ".cardiology-feature-media",
    ".cardiology-feature-copy > *",
    ".cardiology-specs > div",
    ".detail-hero",
    ".detail-intro > *",
    ".detail-block",
    ".map-copy > *",
    ".map-frame",
    ".contact-panel",
    ".contact-details > div",
    ".contacts-content > h1",
    ".contacts-info-list > div",
    ".contacts-question",
    ".contacts-map",
    ".footer-main > *",
    ".footer-bottom > *",
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (targetSet.has(element) || element.closest(".hero")) {
        return;
      }

      targetSet.add(element);
      targets.push(element);
    });
  });

  if (targets.length === 0) {
    return () => {};
  }

  targets.forEach((element, index) => {
    element.classList.add("soft-reveal");
    element.style.setProperty("--soft-reveal-delay", `${Math.min((index % 6) * 55, 275)}ms`);
  });

  const revealVisibleTargets = () => {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    targets.forEach((element) => {
      const rect = element.getBoundingClientRect();

      if (rect.top < viewportHeight * 0.92 && rect.bottom > 0) {
        element.classList.add("is-visible");
      }
    });
  };

  if (introMotionPreference.matches || !("IntersectionObserver" in window)) {
    return () => {
      revealVisibleTargets();
      targets.forEach((element) => element.classList.add("is-visible"));
    };
  }

  let isStarted = false;

  return () => {
    if (isStarted) {
      return;
    }

    isStarted = true;
    revealVisibleTargets();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      },
    );

    targets.forEach((element) => observer.observe(element));
  };
};

const startSoftReveals = setupSoftReveals();
let softRevealFallbackTimer = 0;

if (homeRippleReveal) {
  softRevealFallbackTimer = window.setTimeout(startSoftReveals, 1800);
} else {
  startSoftReveals();
}

const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const track = carousel.querySelector(".solution-track");
  const slides = Array.from(carousel.querySelectorAll(".solution-card:not([aria-hidden='true'])"));
  const allSlides = Array.from(carousel.querySelectorAll(".solution-card"));
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  let current = 0;
  let isLoopResetting = false;

  const setTrackPosition = (index, animated = true) => {
    if (!track) {
      return;
    }

    track.style.transition = animated ? "" : "none";
    track.style.transform = `translateX(-${index * 100}%)`;

    if (!animated) {
      void track.offsetWidth;
      track.style.transition = "";
    }
  };

  const updateDots = () => {
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === current);
      dot.setAttribute("aria-current", dotIndex === current ? "true" : "false");
    });
  };

  const updateCarousel = (index) => {
    if (!track || slides.length === 0) {
      return;
    }

    if (index >= slides.length && allSlides.length > slides.length) {
      current = 0;
      updateDots();
      setTrackPosition(slides.length);
      isLoopResetting = true;
      return;
    }

    current = index < 0 ? slides.length - 1 : index;
    updateDots();
    setTrackPosition(current);
  };

  updateCarousel(0);

  track.addEventListener("transitionend", () => {
    if (!isLoopResetting) {
      return;
    }

    isLoopResetting = false;
    setTrackPosition(0, false);
  });

  prev.addEventListener("click", () => updateCarousel(current - 1));
  next.addEventListener("click", () => updateCarousel(current + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => updateCarousel(Number(dot.dataset.carouselDot)));
  });
}

const belarusMapRoot = document.querySelector("[data-belarus-map]");

if (belarusMapRoot) {
  const d3Api = window.d3;
  const geoData = window.OSSNOVA_BELARUS_ADM1;
  const loader = belarusMapRoot.querySelector("[data-belarus-loader]");
  const regionPanel = belarusMapRoot.querySelector(".belarus-region-panel");
  const regionName = belarusMapRoot.querySelector("[data-belarus-region-name]");
  const regionText = belarusMapRoot.querySelector("[data-belarus-region-text]");
  const regionMetrics = belarusMapRoot.querySelector("[data-belarus-region-metrics]");

  const regionDetails = {
    Brest: {
      title: "Брестская область",
      titleKey: "home.map.regions.brest.title",
      text: "Западное направление: логистика, офтальмологические решения и поддержка партнерских клиник.",
      textKey: "home.map.regions.brest.text",
      metrics: [
        ["34", "home.map.metrics.clinics", "клиники"],
        ["820+", "home.map.metrics.medicalWorkers", "медработников"],
        ["11", "home.map.metrics.partnerPoints", "партнерских точек"],
        ["6", "home.map.metrics.trainingVisits", "обучающих выездов"],
      ],
    },
    Vitebsk: {
      title: "Витебская область",
      titleKey: "home.map.regions.vitebsk.title",
      text: "Северный регион сети: поставки медицинских технологий и сопровождение специалистов на местах.",
      textKey: "home.map.regions.vitebsk.text",
      metrics: [
        ["29", "home.map.metrics.clinicsMany", "клиник"],
        ["690+", "home.map.metrics.medicalWorkers", "медработников"],
        ["9", "home.map.metrics.partnerPoints", "партнерских точек"],
        ["5", "home.map.metrics.trainingVisits", "обучающих выездов"],
      ],
    },
    Grodno: {
      title: "Гродненская область",
      titleKey: "home.map.regions.grodno.title",
      text: "Региональная работа с клиниками, где важны стабильные поставки и обучение врачебных команд.",
      textKey: "home.map.regions.grodno.text",
      metrics: [
        ["31", "home.map.metrics.clinic", "клиника"],
        ["760+", "home.map.metrics.medicalWorkers", "медработников"],
        ["10", "home.map.metrics.partnerPoints", "партнерских точек"],
        ["5", "home.map.metrics.trainingVisits", "обучающих выездов"],
      ],
    },
    Gomel: {
      title: "Гомельская область",
      titleKey: "home.map.regions.gomel.title",
      text: "Юго-восточное покрытие: технологические решения для офтальмологии и кардиологических направлений.",
      textKey: "home.map.regions.gomel.text",
      metrics: [
        ["38", "home.map.metrics.clinicsMany", "клиник"],
        ["910+", "home.map.metrics.medicalWorkers", "медработников"],
        ["12", "home.map.metrics.partnerPoints", "партнерских точек"],
        ["7", "home.map.metrics.trainingVisits", "обучающих выездов"],
      ],
    },
    Mogilev: {
      title: "Могилевская область",
      titleKey: "home.map.regions.mogilev.title",
      text: "Восточная часть партнерской сети: консультации, оборудование и сервисное взаимодействие.",
      textKey: "home.map.regions.mogilev.text",
      metrics: [
        ["27", "home.map.metrics.clinicsMany", "клиник"],
        ["640+", "home.map.metrics.medicalWorkers", "медработников"],
        ["8", "home.map.metrics.partnerPoints", "партнерских точек"],
        ["4", "home.map.metrics.trainingVisitsFew", "обучающих выезда"],
      ],
    },
    Minsk: {
      title: "Минская область",
      titleKey: "home.map.regions.minskRegion.title",
      text: "Центральный регион: связующее звено между столичным офисом и медицинскими учреждениями страны.",
      textKey: "home.map.regions.minskRegion.text",
      metrics: [
        ["42", "home.map.metrics.clinics", "клиники"],
        ["1 040+", "home.map.metrics.medicalWorkers", "медработников"],
        ["14", "home.map.metrics.partnerPoints", "партнерских точек"],
        ["8", "home.map.metrics.trainingVisits", "обучающих выездов"],
      ],
    },
    "Minsk City": {
      title: "Минск",
      titleKey: "home.map.regions.minskCity.title",
      text: "Центральный офис OSSNOVA: координация поставок, партнерских проектов и поддержки специалистов.",
      textKey: "home.map.regions.minskCity.text",
      metrics: [
        ["58", "home.map.metrics.clinicsMany", "клиник"],
        ["1 480+", "home.map.metrics.medicalWorkers", "медработников"],
        ["21", "home.map.metrics.partnerPoint", "партнерская точка"],
        ["12", "home.map.metrics.trainingVisits", "обучающих выездов"],
      ],
    },
  };

  const defaultRegion = {
    title: "Беларусь",
    titleKey: "home.map.panel.defaultTitle",
    text: "Наведите на область на карте, чтобы увидеть информацию о региональном покрытии.",
    textKey: "home.map.panel.defaultText",
    metrics: [
      ["259", "home.map.metrics.clinicsMany", "клиник"],
      ["6 340+", "home.map.metrics.medicalWorkers", "медработников"],
      ["85", "home.map.metrics.partnerPoints", "партнерских точек"],
      ["47", "home.map.metrics.trainingVisits", "обучающих выездов"],
    ],
  };
  let activeRegionDetails = defaultRegion;

  const translateMapDetails = (details) => ({
    title: getI18nText(details.titleKey, details.title || "Беларусь"),
    text: getI18nText(details.textKey, details.text || ""),
    metrics: (details.metrics || defaultRegion.metrics).map(([value, labelKey, labelFallback]) => [
      value,
      getI18nText(labelKey, labelFallback || labelKey),
    ]),
  });

  const setPanel = (details = defaultRegion) => {
    activeRegionDetails = details;
    const translatedDetails = translateMapDetails(details);

    if (regionName) {
      regionName.textContent = translatedDetails.title;
    }

    if (regionText) {
      regionText.textContent = translatedDetails.text;
    }

    if (regionMetrics) {
      const metrics = translatedDetails.metrics.slice(0, 2);

      regionMetrics.replaceChildren();
      metrics.forEach(([value, label]) => {
        const item = document.createElement("div");
        const number = document.createElement("strong");
        const caption = document.createElement("span");

        number.textContent = value;
        caption.textContent = label;
        item.append(number, caption);
        regionMetrics.append(item);
      });
    }

    if (regionPanel) {
      regionPanel.classList.remove("is-changing");
      void regionPanel.offsetWidth;
      regionPanel.classList.add("is-changing");
    }
  };

  const getFeatureName = (feature) => feature && feature.properties ? feature.properties.shapeName : "";

  const reverseGeometry = (geometry) => {
    if (!geometry) {
      return geometry;
    }

    if (geometry.type === "Polygon") {
      return {
        ...geometry,
        coordinates: [geometry.coordinates[0].slice().reverse()],
      };
    }

    if (geometry.type === "MultiPolygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => [polygon[0].slice().reverse()]),
      };
    }

    return geometry;
  };

  const normalizeFeature = (feature) => ({
    ...feature,
    geometry: reverseGeometry(feature.geometry),
  });

  const initBelarusMap = () => {
    if (!d3Api || !geoData || !Array.isArray(geoData.features)) {
      throw new Error("Map data is not available");
    }

    const mapData = {
      ...geoData,
      features: geoData.features.map(normalizeFeature),
    };
    const projection = d3Api.geoMercator().fitExtent([[58, 44], [704, 526]], mapData);
    const path = d3Api.geoPath(projection);
    const svg = d3Api.select(belarusMapRoot).select(".belarus-map");
    const haloLayer = svg.select("[data-belarus-halo]");
    const regionLayer = svg.select("[data-belarus-regions]");
    const mapCenter = path.centroid(mapData);

    haloLayer
      .append("path")
      .datum(mapData)
      .attr("class", "belarus-map__outline")
      .attr("d", path);

    const regions = regionLayer
      .selectAll(".belarus-region")
      .data(mapData.features, getFeatureName)
      .join((enter) => {
        const group = enter
          .append("g")
          .attr("class", "belarus-region")
          .attr("role", "button")
        .attr("tabindex", "0")
        .attr("aria-label", (feature) => {
          const details = regionDetails[getFeatureName(feature)] || defaultRegion;
          return translateMapDetails(details).title;
        });

        group.append("path").attr("class", "belarus-region__shape");
        group.append("path").attr("class", "belarus-region__hit");
        group.append("circle").attr("class", "belarus-region__hotspot");

        return group;
      });

    regions.each(function renderRegion(feature) {
      const group = d3Api.select(this);
      const centroid = path.centroid(feature);
      const vectorX = centroid[0] - mapCenter[0];
      const vectorY = centroid[1] - mapCenter[1];
      const vectorLength = Math.max(Math.hypot(vectorX, vectorY), 1);
      const lift = getFeatureName(feature) === "Minsk City" ? 14 : 9;

      group
        .style("--region-x", `${(vectorX / vectorLength) * lift}px`)
        .style("--region-y", `${(vectorY / vectorLength) * lift}px`);

      group.select(".belarus-region__shape").attr("d", path(feature));
      group.select(".belarus-region__hit").attr("d", path(feature));
      group
        .select(".belarus-region__hotspot")
        .attr("cx", centroid[0])
        .attr("cy", centroid[1])
        .attr("r", getFeatureName(feature) === "Minsk City" ? 26 : 0);
    });

    const setActiveRegion = (feature) => {
      const name = getFeatureName(feature);
      const details = regionDetails[name] || defaultRegion;

      regions.classed("is-active", (regionFeature) => getFeatureName(regionFeature) === name);
      setPanel(details);
    };

    regions
      .on("pointerenter", (event, feature) => setActiveRegion(feature))
      .on("focus", (event, feature) => setActiveRegion(feature))
      .on("click", (event, feature) => setActiveRegion(feature))
      .on("keydown", (event, feature) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        setActiveRegion(feature);
      });

    const capital = mapData.features.find((feature) => getFeatureName(feature) === "Minsk City") || mapData.features[0];
    setActiveRegion(capital);

    if (loader) {
      loader.hidden = true;
    }

    belarusMapRoot.classList.add("is-loaded");
    svg.attr("data-region-count", mapData.features.length);

    window.addEventListener("ossnova:languagechange", () => {
      regions.attr("aria-label", (feature) => {
        const details = regionDetails[getFeatureName(feature)] || defaultRegion;
        return translateMapDetails(details).title;
      });
      setPanel(activeRegionDetails);
    });
  };

  try {
    initBelarusMap();
  } catch (error) {
    setPanel({
      titleKey: "home.map.unavailable.title",
      textKey: "home.map.unavailable.text",
    });

    if (loader) {
      loader.textContent = getI18nText("home.map.unavailable.title", "Карта временно недоступна");
    }
  }
}

const belarusGlobeCanvas = document.querySelector("[data-belarus-globe]");

if (belarusGlobeCanvas) {
  const d3Api = window.d3;
  const worldData = window.OSSNOVA_WORLD_COUNTRIES;
  const globeSection = belarusGlobeCanvas.closest(".belarus-network");
  const context = belarusGlobeCanvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (d3Api && worldData && Array.isArray(worldData.features) && context) {
    const sphere = { type: "Sphere" };
    const countries = {
      type: "FeatureCollection",
      features: worldData.features,
    };
    const belarusFeature = worldData.features.find((feature) => feature.properties && feature.properties.name === "Belarus");
    const belarusCenter = belarusFeature ? d3Api.geoCentroid(belarusFeature) : null;
    const graticule = d3Api.geoGraticule10();
    const projection = d3Api.geoOrthographic().clipAngle(90).precision(0.7);
    const path = d3Api.geoPath(projection, context);
    const baseRotation = [8, -50, 0];
    const orbitDuration = 180000;
    const frameDelay = 1000 / 20;
    let animationFrame = 0;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let dpr = 1;
    let lastFrameAt = 0;
    let isVisible = true;
    let startTime = performance.now();

    const drawGlobe = (time = performance.now()) => {
      const size = Math.min(canvasWidth, canvasHeight);
      const rotationOffset = ((time - startTime) / orbitDuration) * 360;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, canvasWidth, canvasHeight);

      projection
        .translate([canvasWidth / 2, canvasHeight / 2])
        .scale(size * 0.47)
        .rotate([baseRotation[0] - rotationOffset, baseRotation[1], baseRotation[2]]);

      const oceanGradient = context.createRadialGradient(
        canvasWidth * 0.4,
        canvasHeight * 0.28,
        size * 0.04,
        canvasWidth * 0.5,
        canvasHeight * 0.52,
        size * 0.52,
      );

      oceanGradient.addColorStop(0, "rgba(255, 255, 255, 0.92)");
      oceanGradient.addColorStop(0.52, "rgba(236, 241, 247, 0.58)");
      oceanGradient.addColorStop(0.86, "rgba(245, 220, 228, 0.28)");
      oceanGradient.addColorStop(1, "rgba(200, 16, 46, 0.05)");

      context.save();

      context.beginPath();
      path(sphere);
      context.fillStyle = oceanGradient;
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "rgba(185, 14, 47, 0.08)";
      context.stroke();

      context.beginPath();
      path(graticule);
      context.lineWidth = 1.05;
      context.strokeStyle = "rgba(102, 112, 133, 0.13)";
      context.stroke();

      context.beginPath();
      path(countries);
      context.fillStyle = "rgba(184, 194, 207, 0.38)";
      context.fill();
      context.lineWidth = 1.35;
      context.strokeStyle = "rgba(78, 88, 108, 0.36)";
      context.stroke();

      if (belarusFeature && belarusCenter) {
        const globeCenter = [-projection.rotate()[0], -projection.rotate()[1]];
        const belarusVisible = d3Api.geoDistance(belarusCenter, globeCenter) < Math.PI / 2;

        context.save();
        context.beginPath();
        path(belarusFeature);
        context.shadowColor = "rgba(200, 16, 46, 0.34)";
        context.shadowBlur = Math.max(10, size * 0.018);
        context.fillStyle = "rgba(200, 16, 46, 0.86)";
        context.fill();
        context.lineWidth = 1.55;
        context.strokeStyle = "rgba(185, 14, 47, 0.9)";
        context.stroke();
        context.restore();

        if (belarusVisible) {
          const marker = projection(belarusCenter);

          if (marker) {
            const markerRadius = Math.max(5.5, size * 0.009);
            const haloRadius = markerRadius * 3.2;

            context.save();
            context.beginPath();
            context.arc(marker[0], marker[1], haloRadius, 0, Math.PI * 2);
            context.fillStyle = "rgba(200, 16, 46, 0.18)";
            context.fill();

            context.beginPath();
            context.arc(marker[0], marker[1], markerRadius, 0, Math.PI * 2);
            context.fillStyle = "rgba(200, 16, 46, 0.94)";
            context.fill();
            context.lineWidth = 1.1;
            context.strokeStyle = "rgba(255, 255, 255, 0.72)";
            context.stroke();
            context.restore();
          }
        }
      }

      context.beginPath();
      path(sphere);
      context.lineWidth = 1.8;
      context.strokeStyle = "rgba(185, 14, 47, 0.11)";
      context.stroke();

      context.restore();

      if (globeSection) {
        globeSection.classList.add("is-globe-ready");
      }
    };

    const resizeGlobe = () => {
      const rect = belarusGlobeCanvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);

      if (nextWidth === canvasWidth && nextHeight === canvasHeight && nextDpr === dpr) {
        return;
      }

      canvasWidth = nextWidth;
      canvasHeight = nextHeight;
      dpr = nextDpr;
      belarusGlobeCanvas.width = Math.round(canvasWidth * dpr);
      belarusGlobeCanvas.height = Math.round(canvasHeight * dpr);
      drawGlobe();
    };

    const stopGlobe = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    };

    const tickGlobe = (time) => {
      animationFrame = 0;

      if (reducedMotion.matches || document.hidden || !isVisible) {
        return;
      }

      if (time - lastFrameAt >= frameDelay) {
        lastFrameAt = time;
        drawGlobe(time);
      }

      animationFrame = requestAnimationFrame(tickGlobe);
    };

    const startGlobe = () => {
      if (!animationFrame && !reducedMotion.matches && !document.hidden && isVisible) {
        animationFrame = requestAnimationFrame(tickGlobe);
      }
    };

    const handleMotionChange = () => {
      stopGlobe();
      drawGlobe();
      startGlobe();
    };

    resizeGlobe();

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(resizeGlobe);
      resizeObserver.observe(belarusGlobeCanvas);
    } else {
      window.addEventListener("resize", resizeGlobe);
    }

    if ("IntersectionObserver" in window && globeSection) {
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;

          if (isVisible) {
            startGlobe();
          } else {
            stopGlobe();
          }
        },
        { threshold: 0.04 },
      );

      visibilityObserver.observe(globeSection);
    } else {
      startGlobe();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopGlobe();
      } else {
        startGlobe();
      }
    });

    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener("change", handleMotionChange);
    } else if (reducedMotion.addListener) {
      reducedMotion.addListener(handleMotionChange);
    }
  }
}

const heroWaterCanvas = document.querySelector("[data-hero-water]");

if (heroWaterCanvas) {
  const hero = heroWaterCanvas.closest(".hero");
  const heroImage = hero ? hero.querySelector(".hero-bg") : null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gl =
    heroWaterCanvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false }) ||
    heroWaterCanvas.getContext("experimental-webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
  const maxRipples = 14;
  const ripples = [];
  let animationFrame = 0;
  let dpr = 1;
  let canvasWidth = 1;
  let canvasHeight = 1;
  let lastRippleAt = 0;
  let lastX = 0;
  let lastY = 0;
  let ready = false;
  let rippleIntroRipplesPlayed = false;

  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;

    void main() {
      v_uv = a_uv;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    const int MAX_RIPPLES = 14;

    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform vec2 u_imageSize;
    uniform vec2 u_objectPosition;
    uniform float u_pixelRatio;
    uniform float u_time;
    uniform int u_rippleCount;
    uniform vec4 u_ripples[MAX_RIPPLES];

    varying vec2 v_uv;

    vec2 coverUv(vec2 uv) {
      float imageAspect = u_imageSize.x / u_imageSize.y;
      float canvasAspect = u_resolution.x / u_resolution.y;
      vec2 covered = uv;

      if (imageAspect > canvasAspect) {
        float visibleWidth = canvasAspect / imageAspect;
        covered.x = u_objectPosition.x * (1.0 - visibleWidth) + covered.x * visibleWidth;
      } else {
        float visibleHeight = imageAspect / canvasAspect;
        covered.y = u_objectPosition.y * (1.0 - visibleHeight) + covered.y * visibleHeight;
      }

      covered.x = 1.0 - covered.x;
      return covered;
    }

    void main() {
      vec2 pixel = v_uv * u_resolution;
      vec2 offset = vec2(0.0);
      float highlight = 0.0;
      float shade = 0.0;

      for (int i = 0; i < MAX_RIPPLES; i++) {
        if (i >= u_rippleCount) {
          break;
        }

        vec4 ripple = u_ripples[i];
        float age = u_time - ripple.z;

        if (age <= 0.0 || age >= 1.35) {
          continue;
        }

        vec2 delta = pixel - ripple.xy;
        float distanceToCenter = max(length(delta), 0.001);
        float radius = age * 138.0;
        float fade = 1.0 - age / 1.35;
        float ring = exp(-pow((distanceToCenter - radius) / 26.0, 2.0));
        float inner = exp(-pow(distanceToCenter / 72.0, 2.0)) * fade * 0.35;
        float wave = sin((distanceToCenter - radius) * 0.13) * ring * fade * ripple.w;
        float distortion = 23.0 * u_pixelRatio;
        vec2 direction = delta / distanceToCenter;

        offset += direction * wave * distortion;
        offset += direction * inner * -8.0 * u_pixelRatio * ripple.w;
        highlight += ring * fade * ripple.w;
        shade += inner * ripple.w;
      }

      vec2 sampleUv = coverUv(v_uv + offset / u_resolution);
      vec4 color = texture2D(u_image, clamp(sampleUv, vec2(0.001), vec2(0.999)));
      float waterDepth = smoothstep(0.0, 1.0, v_uv.x * 0.62 + (1.0 - v_uv.y) * 0.38);
      vec3 waterTint = mix(vec3(0.9, 0.97, 1.0), vec3(0.5, 0.8, 0.94), waterDepth);

      color.rgb = mix(color.rgb, waterTint, 0.035 + waterDepth * 0.055);

      color.rgb += vec3(0.08, 0.18, 0.24) * min(highlight, 1.0) * 0.38;
      color.rgb -= vec3(0.03, 0.06, 0.08) * min(shade, 1.0) * 0.18;

      gl_FragColor = color;
    }
  `;

  const createShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const createProgram = () => {
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  const readPositionRatio = (value, fallback = 0.5) => {
    if (!value) {
      return fallback;
    }

    const lower = value.toLowerCase();
    if (lower.includes("left") || lower.includes("top")) {
      return 0;
    }
    if (lower.includes("right") || lower.includes("bottom")) {
      return 1;
    }
    if (lower.includes("%")) {
      return Math.min(1, Math.max(0, parseFloat(lower) / 100));
    }

    return fallback;
  };

  const program = gl && createProgram();

  if (gl && program && hero && heroImage && !homeMobileIntroQuery.matches) {
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
    const objectPositionLocation = gl.getUniformLocation(program, "u_objectPosition");
    const pixelRatioLocation = gl.getUniformLocation(program, "u_pixelRatio");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const rippleCountLocation = gl.getUniformLocation(program, "u_rippleCount");
    const ripplesLocation = gl.getUniformLocation(program, "u_ripples[0]");
    const imageLocation = gl.getUniformLocation(program, "u_image");
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    const vertices = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]);
    const rippleUniforms = new Float32Array(maxRipples * 4);

    const resizeWater = () => {
      const rect = heroWaterCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.75);
      canvasWidth = Math.max(1, Math.round(rect.width * dpr));
      canvasHeight = Math.max(1, Math.round(rect.height * dpr));

      if (heroWaterCanvas.width !== canvasWidth || heroWaterCanvas.height !== canvasHeight) {
        heroWaterCanvas.width = canvasWidth;
        heroWaterCanvas.height = canvasHeight;
      }

      gl.viewport(0, 0, canvasWidth, canvasHeight);
    };

    const uploadTexture = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heroImage);
    };

    const updateObjectPosition = () => {
      const position = getComputedStyle(heroImage).objectPosition.split(/\s+/);
      gl.uniform2f(
        objectPositionLocation,
        readPositionRatio(position[0], 0.5),
        readPositionRatio(position[1], 0.5)
      );
    };

    const drawWater = (timestamp = performance.now()) => {
      if (!ready || reducedMotion.matches) {
        animationFrame = 0;
        return;
      }

      const time = timestamp * 0.001;

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        if (time - ripples[index].born > 1.35) {
          ripples.splice(index, 1);
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(imageLocation, 0);
      gl.uniform2f(resolutionLocation, canvasWidth, canvasHeight);
      gl.uniform2f(imageSizeLocation, heroImage.naturalWidth, heroImage.naturalHeight);
      gl.uniform1f(pixelRatioLocation, dpr);
      updateObjectPosition();
      gl.uniform1f(timeLocation, time);
      gl.uniform1i(rippleCountLocation, ripples.length);

      rippleUniforms.fill(0);
      ripples.forEach((ripple, index) => {
        const offset = index * 4;
        rippleUniforms[offset] = ripple.x;
        rippleUniforms[offset + 1] = ripple.y;
        rippleUniforms[offset + 2] = ripple.born;
        rippleUniforms[offset + 3] = ripple.strength;
      });
      gl.uniform4fv(ripplesLocation, rippleUniforms);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrame = ripples.length > 0 ? window.requestAnimationFrame(drawWater) : 0;
    };

    const startWater = () => {
      if (!animationFrame && ready && !reducedMotion.matches) {
        animationFrame = window.requestAnimationFrame(drawWater);
      }
    };

    const addRipple = (clientX, clientY, strength = 1) => {
      if (!ready || reducedMotion.matches) {
        return;
      }

      const rect = heroWaterCanvas.getBoundingClientRect();
      const x = (clientX - rect.left) * dpr;
      const y = (rect.bottom - clientY) * dpr;

      ripples.push({
        x,
        y,
        born: performance.now() * 0.001,
        strength: Math.min(strength, window.innerWidth < 700 ? 0.72 : 1),
      });

      if (ripples.length > maxRipples) {
        ripples.shift();
      }

      startWater();
    };

    const scheduleIntroRipples = (ripplesToPlay, introClass) => {
      ripplesToPlay.forEach((ripple) => {
        window.setTimeout(() => {
          if (!ready || !document.body.classList.contains(introClass)) {
            return;
          }

          const rect = heroWaterCanvas.getBoundingClientRect();
          addRipple(
            rect.left + rect.width * ripple.x,
            rect.top + rect.height * ripple.y,
            ripple.strength
          );
        }, ripple.delay);
      });
    };

    const playRippleIntroRipples = () => {
      if (
        !document.body.classList.contains("home-ripple-intro") ||
        rippleIntroRipplesPlayed ||
        reducedMotion.matches ||
        !ready
      ) {
        return;
      }

      rippleIntroRipplesPlayed = true;
      scheduleIntroRipples([
        { x: 0.62, y: 0.48, strength: 1, delay: 110 },
        { x: 0.62, y: 0.48, strength: 0.9, delay: 310 },
        { x: 0.35, y: 0.58, strength: 0.95, delay: 430 },
        { x: 0.78, y: 0.72, strength: 0.84, delay: 580 },
        { x: 0.22, y: 0.42, strength: 0.7, delay: 760 },
      ], "home-ripple-intro");
    };

    const bootWater = () => {
      if (reducedMotion.matches) {
        return;
      }

      resizeWater();
      uploadTexture();
      ready = true;
      hero.classList.add("is-water-ready");
      drawWater();
      playRippleIntroRipples();
    };

    window.addEventListener("home-ripple-intro:start", () => {
      rippleIntroRipplesPlayed = false;
      playRippleIntroRipples();
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

    window.addEventListener("resize", () => {
      if (!ready) {
        return;
      }

      resizeWater();
      drawWater();
    }, { passive: true });

    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      const now = performance.now();
      const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);

      if (now - lastRippleAt > 46 && distance > 7) {
        addRipple(event.clientX, event.clientY, 0.7 + Math.min(distance / 90, 0.35));
        lastRippleAt = now;
        lastX = event.clientX;
        lastY = event.clientY;
      }
    }, { passive: true });

    hero.addEventListener("pointerenter", (event) => {
      lastX = event.clientX;
      lastY = event.clientY;
      addRipple(event.clientX, event.clientY, 0.72);
    }, { passive: true });

    hero.addEventListener("pointerdown", (event) => {
      addRipple(event.clientX, event.clientY, 1);
    }, { passive: true });

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        hero.classList.remove("is-water-ready");
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      } else if (ready) {
        hero.classList.add("is-water-ready");
        drawWater();
      }
    };

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", handleMotionPreference);
    } else if (typeof reducedMotion.addListener === "function") {
      reducedMotion.addListener(handleMotionPreference);
    }

    heroWaterCanvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      ready = false;
      hero.classList.remove("is-water-ready");
    });

    if (heroImage.complete && heroImage.naturalWidth) {
      bootWater();
    } else {
      heroImage.addEventListener("load", bootWater, { once: true });
    }
  }
}

const startInitialMotion = async () => {
  if (!homeRippleReveal) {
    document.documentElement.classList.remove(homeMotionPendingClass);
    document.documentElement.classList.remove(homeMobileMotionPendingClass);
    return;
  }

  if (homeMobileIntroQuery.matches) {
    window.clearTimeout(softRevealFallbackTimer);
    startHomeMobileIntro();
    startSoftReveals();
    return;
  }

  const initialImage =
    document.querySelector(".hero-bg") ||
    document.querySelector("img[fetchpriority='high']") ||
    document.querySelector("img[data-lqip]");

  let hasStarted = false;
  const startMotion = () => {
    if (hasStarted) {
      return;
    }

    hasStarted = true;
    document.documentElement.classList.remove(homeMotionPendingClass);
    window.clearTimeout(softRevealFallbackTimer);
    startHomeIntro();
    startSoftReveals();
  };

  const fallbackTimer = window.setTimeout(startMotion, 1800);

  await Promise.all([
    waitForImageReady(initialImage, 1200),
    waitForWindowReady(1600),
  ]).catch(() => {});

  window.clearTimeout(fallbackTimer);
  startMotion();
};

startInitialMotion();

const contactModal = document.querySelector(".contact-modal");
const contactModalOpenButtons = document.querySelectorAll("[data-contact-modal-open]");
const contactModalCloseButtons = document.querySelectorAll("[data-contact-modal-close]");
let contactModalReturnFocus = null;

const getContactModalFocusableElements = () => {
  if (!contactModal) {
    return [];
  }

  return Array.from(
    contactModal.querySelectorAll(
      "button:not([disabled]):not([tabindex='-1']), input:not([disabled]), textarea:not([disabled]), a[href]"
    )
  ).filter((element) => element.getClientRects().length > 0);
};

const focusContactModalFirstField = () => {
  contactModal?.querySelector("input:not([disabled]), textarea:not([disabled])")?.focus();
};

const openContactModal = () => {
  if (!contactModal) {
    return;
  }

  contactModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  contactModal.inert = false;
  contactModal.classList.add("is-open");
  contactModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-modal-open");

  focusContactModalFirstField();
  window.requestAnimationFrame(focusContactModalFirstField);
  window.setTimeout(focusContactModalFirstField, 120);
};

const closeContactModal = () => {
  if (!contactModal || !contactModal.classList.contains("is-open")) {
    return;
  }

  contactModal.classList.remove("is-open");
  contactModal.setAttribute("aria-hidden", "true");
  contactModal.inert = true;
  document.body.classList.remove("is-modal-open");
  contactModalReturnFocus?.focus();
  contactModalReturnFocus = null;
};

contactModalOpenButtons.forEach((button) => {
  button.addEventListener("click", openContactModal);
});

contactModalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeContactModal);
});

document.addEventListener("keydown", (event) => {
  if (!contactModal || !contactModal.classList.contains("is-open")) {
    return;
  }

  if (event.key === "Escape") {
    closeContactModal();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getContactModalFocusableElements();

  if (focusableElements.length === 0) {
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
});

const getContactFormSuccessMessage = () =>
  getI18nText("common.form.status.success", "Запрос подготовлен. Подключите обработчик формы для отправки данных.");

// Реальную отправку формы нужно подключить здесь: функция используется всеми контактными формами.
const submitContactRequest = async (form, formData) => ({
  message: getContactFormSuccessMessage(),
  form,
  formData,
});

document.querySelectorAll("[data-contact-form]").forEach((contactForm) => {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const status = contactForm.querySelector(".form-status");
    const submitButton = contactForm.querySelector("button[type='submit']");

    if (status) {
      status.textContent = "";
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await submitContactRequest(contactForm, new FormData(contactForm));

      if (status) {
        status.textContent = result?.message || getContactFormSuccessMessage();
      }

      contactForm.reset();
    } catch (error) {
      if (status) {
        status.textContent = getI18nText("common.form.status.error", "Не удалось подготовить запрос. Попробуйте еще раз.");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
});
