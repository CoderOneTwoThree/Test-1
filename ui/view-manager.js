const hiddenClass = "screen--hidden";

const show = (screenId) => {
  const screens = Array.from(document.querySelectorAll("[data-screen-id]"));
  screens.forEach((screen) => {
    const isActive = screen.dataset.screenId === screenId;
    screen.classList.toggle(hiddenClass, !isActive);
  });
};

export { show };
