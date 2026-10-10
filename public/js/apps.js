// ---------------------------------------------------------------------------
// MangoDash App Catalog – single source of truth for the education app suite.
// Drives both the App Launcher widget (display.js) and the Connections
// Portal (connect.html): icons, brand colors, auth requirements, and links.
// ---------------------------------------------------------------------------
window.MangoApps = [
  { id: "classroom",   name: "Google Classroom", icon: "&#127891;", brand: "#0f9d58", auth: "google",
    link: "https://classroom.google.com", desc: "Courses, homework &amp; due dates" },
  { id: "calendar",    name: "Google Calendar",  icon: "&#128197;", brand: "#3d9be9", auth: "google",
    link: "https://calendar.google.com", desc: "School events &amp; schedule" },
  { id: "gmail",       name: "Gmail",            icon: "&#128231;", brand: "#ea4335", auth: "google",
    link: "https://mail.google.com", desc: "School inbox digest" },
  { id: "gdocs",       name: "Google Docs",      icon: "&#128209;", brand: "#4285f4", auth: "google",
    link: "https://docs.google.com", desc: "Recent documents" },
  { id: "alma",        name: "Alma",             icon: "&#128218;", brand: "#7c3aed", auth: "email-digest",
    link: "https://app.alma.school", desc: "Grades &amp; progress via email digest" },
  { id: "parentsquare",name: "ParentSquare",     icon: "&#128172;", brand: "#e8760e", auth: "email-digest",
    link: "https://www.parenetsquare.com", desc: "School announcements via email digest" },
  { id: "solitaire",   name: "Solitaire",        icon: "&#127183;", brand: "#16a34a", auth: "none",
    link: "", game: true, desc: "Classic Klondike – playable right here" },
  { id: "minesweeper", name: "Minesweeper",      icon: "&#128163;", brand: "#64748b", auth: "none",
    link: "", game: true, desc: "Classic mine hunt – playable right here" }
];