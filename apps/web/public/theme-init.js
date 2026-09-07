try {
  if (localStorage.getItem("visual-style-theme") === "dark") {
    document.documentElement.dataset.theme = "dark"
  }
} catch {}
