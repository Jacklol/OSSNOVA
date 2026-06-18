const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    siteNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("is-nav-open", !isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
      document.body.classList.remove("is-nav-open");
    });
  });
}

const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const track = carousel.querySelector(".solution-track");
  const slides = Array.from(carousel.querySelectorAll(".solution-card"));
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  let current = 0;

  const updateCarousel = (index) => {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === current);
      dot.setAttribute("aria-current", dotIndex === current ? "true" : "false");
    });
  };

  prev.addEventListener("click", () => updateCarousel(current - 1));
  next.addEventListener("click", () => updateCarousel(current + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => updateCarousel(Number(dot.dataset.carouselDot)));
  });
}

const contactForm = document.querySelector(".contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = contactForm.querySelector(".form-status");
    status.textContent = "Запрос подготовлен. Подключите обработчик формы для отправки данных.";
  });
}
