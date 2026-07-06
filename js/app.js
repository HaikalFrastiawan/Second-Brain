// ===================================
// Second Brain - Main Application Logic
// ===================================

class SecondBrainApp {
  constructor() {
    this.brain = null;
    this.editingNoteId = null;
    this.editingSessionId = null;
    this.viewingSessionId = null;
    this.sidebarOpen = false;

    this.init();
  }

  async init() {
    // Initialize brain visualizer
    this.brain = new BrainVisualizer("brain-canvas");
    this.brain.onParticleClick = (noteId) => this.viewNote(noteId);

    // Load folder handle from storage (IndexedDB)
    if (storage.isFileSystemSupported()) {
      const hasStoredHandle = await storage.loadDirectoryHandle();
      if (hasStoredHandle) {
        // Try to verify permission (without prompting if already granted)
        const hasPermission = await storage.verifyPermission(false);
        this.updateFolderButtonState(hasPermission);
      } else {
        this.updateFolderButtonState(false);
      }
    } else {
      // Hide the connect folder button if API is not supported by the browser
      const btn = document.getElementById("connect-folder-btn");
      if (btn) btn.style.display = "none";
    }

    // Load data
    await this.loadNotes();
    this.loadSessions();
    await this.updateStats();

    // Setup event listeners
    this.setupEventListeners();
  }

  updateFolderButtonState(connected) {
    const btn = document.getElementById("connect-folder-btn");
    if (!btn) return;
    if (connected) {
      btn.textContent = "📁 Connected: log/";
      btn.classList.remove("btn-secondary");
      btn.style.background = "rgba(34, 197, 94, 0.1)";
      btn.style.borderColor = "rgba(34, 197, 94, 0.3)";
      btn.style.color = "#22c55e";
      btn.title = "Click to disconnect folder";
    } else {
      btn.textContent = "📁 Connect Folder";
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
      btn.classList.add("btn-secondary");
      btn.title = "Connect local folder for md storage";
    }
  }

  setupEventListeners() {
    // Connect/Disconnect folder
    const connectBtn = document.getElementById("connect-folder-btn");
    if (connectBtn) {
      connectBtn.addEventListener("click", async () => {
        if (storage.directoryHandle) {
          if (confirm("Disconnect folder and switch back to LocalStorage?")) {
            await storage.disconnectDirectory();
            this.updateFolderButtonState(false);
            await this.loadNotes();
            await this.updateStats();
          }
        } else {
          const success = await storage.selectDirectory();
          if (success) {
            const hasPermission = await storage.verifyPermission(true);
            this.updateFolderButtonState(hasPermission);
            await this.loadNotes();
            await this.updateStats();
          }
        }
      });
    }

    // Add Note
    document
      .getElementById("add-note-btn")
      .addEventListener("click", () => this.openNoteModal());

    // Add Session
    document
      .getElementById("add-session-btn")
      .addEventListener("click", () => this.openSessionModal());

    // Note form
    document
      .getElementById("note-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveNote();
      });

    // Session form
    document
      .getElementById("session-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveSession();
      });

    // Modal close buttons
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => this.closeAllModals());
    });

    // Modal overlay click to close
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", () => this.closeAllModals());
    });

    // Session search
    document.getElementById("session-search").addEventListener("input", (e) => {
      this.filterSessions(e.target.value);
    });

    // Export button
    document
      .getElementById("export-session-btn")
      .addEventListener("click", () => {
        if (this.viewingSessionId) this.exportSession(this.viewingSessionId);
      });

    // Edit from view modal
    document
      .getElementById("edit-from-view-btn")
      .addEventListener("click", () => {
        if (this.viewingSessionId) {
          this.closeAllModals();
          this.editSession(this.viewingSessionId);
        }
      });

    // Sidebar toggle (mobile)
    document.getElementById("sidebar-toggle").addEventListener("click", () => {
      this.toggleSidebar();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeAllModals();
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        this.openNoteModal();
      }
    });

    // Note cancel button
    document
      .getElementById("note-cancel-btn")
      .addEventListener("click", () => this.closeAllModals());

    // Session cancel button
    document
      .getElementById("session-cancel-btn")
      .addEventListener("click", () => this.closeAllModals());
  }

  // ===== NOTES =====

  async loadNotes() {
    const notes = await storage.getNotes();
    this.brain.syncWithNotes(notes);
    this.renderNotesGrid(notes);
  }

  renderNotesGrid(notes) {
    const grid = document.getElementById("notes-grid");

    if (notes.length === 0) {
      grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📝</span>
                    <p>Belum ada notes. Mulai tambahkan ide pertamamu!</p>
                </div>
            `;
      return;
    }

    grid.innerHTML = notes
      .slice(0, 12)
      .map(
        (note) => `
            <div class="note-card" data-category="${this.escapeHtml(note.category)}" onclick="app.viewNote('${note.id}')">
                <div class="note-card-header">
                    <span class="note-category cat-${note.category.toLowerCase()}">${this.escapeHtml(note.category)}</span>
                    <div class="note-actions">
                        <button class="btn-icon" onclick="event.stopPropagation(); app.editNote('${note.id}')" title="Edit">✏️</button>
                        <button class="btn-icon" onclick="event.stopPropagation(); app.deleteNote('${note.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <h4 class="note-title">${this.escapeHtml(note.title)}</h4>
                <p class="note-preview">${this.escapeHtml(note.content.substring(0, 120))}${note.content.length > 120 ? "..." : ""}</p>
                <div class="note-footer">
                    <span class="note-date">${this.formatDate(note.createdAt)}</span>
                </div>
            </div>
        `,
      )
      .join("");
  }

openNoteModal(note = null) {
        this.editingNoteId = note ? note.id : null;
        const modal = document.getElementById('note-modal');
        const title = document.getElementById('note-modal-title');
        const form = document.getElementById('note-form');

        if (!modal || !form) return;

        title.textContent = note ? 'Edit Note' : '✨ New Note';
        form.elements['note-title'].value = note ? note.title : '';
        form.elements['note-content'].value = note ? note.content : '';
        form.elements['note-category'].value = note ? note.category : 'Idea';

        const sessionSelect = document.getElementById('note-session') || document.getElementById('note-session-date');
        
        if (sessionSelect) {
            const todayStr = new Date().toISOString().split('T')[0];
            const sessionMap = new Map();
            
            // 1. Ambil data session secara aman
            let sessions = [];
            try {
                if (typeof storage !== 'undefined' && typeof storage.getSessions === 'function') {
                    sessions = storage.getSessions() || [];
                }
            } catch (err) {
                console.error("Gagal mengambil session:", err);
            }
            
            // 2. Masukkan ke dalam Map
            if (sessions && sessions.length > 0) {
                sessions.forEach(s => {
                    if (s && s.date) {
                        const previewText = s.builtToday && s.builtToday.trim() !== '' 
                            ? s.builtToday.substring(0, 15) 
                            : 'Session Log';
                        sessionMap.set(s.date, previewText);
                    }
                });
            }
            
            // 3. Pastikan hari ini selalu ada
            if (!sessionMap.has(todayStr)) {
                sessionMap.set(todayStr, 'Hari ini');
            }
            
            // 4. Pastikan tanggal catatan lama tetap masuk jika sedang edit
            if (note && note.createdAt) {
                const noteDateStr = note.createdAt.split('T')[0];
                if (!sessionMap.has(noteDateStr)) {
                    sessionMap.set(noteDateStr, 'Log Note');
                }
            }
            
            // 5. Urutkan tanggal terbaru ke terlama
            const sortedDates = Array.from(sessionMap.keys()).sort((a, b) => new Date(b) - new Date(a));
            
            // 6. Membuat fungsi format tanggal lokal sendiri agar tidak butuh objek luar/app
            const safeFormatDateShort = (dateStr) => {
                try {
                    const d = new Date(dateStr + 'T00:00:00');
                    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                } catch {
                    return dateStr;
                }
            };

            // 7. Render ke innerHTML
            sessionSelect.innerHTML = sortedDates.map(date => {
                const logTitle = sessionMap.get(date);
                const formatted = safeFormatDateShort(date); // menggunakan fungsi mandiri di atas
                
                let label = `📅 ${formatted} (${logTitle})`;
                if (date === todayStr && logTitle === 'Hari ini') {
                    label = `📅 Hari ini (${formatted})`;
                }
                
                return `<option value="${date}">${label}</option>`;
            }).join('');
            
            // 8. Berikan value bawaan
            sessionSelect.value = note ? note.createdAt.split('T')[0] : todayStr;
        }

        modal.classList.add('active');
        setTimeout(() => {
            if (form.elements['note-title']) form.elements['note-title'].focus();
        }, 100);
    }

async saveNote() {
        const form = document.getElementById('note-form');
        if (!form) return;

        // Ambil elemen secara langsung menggunakan ID (Jauh lebih aman dari crash)
        const titleEl = document.getElementById('note-title');
        const contentEl = document.getElementById('note-content');
        const categoryEl = document.getElementById('note-category');
        const sessionSelect = document.getElementById('note-session') || document.getElementById('note-session-date');

        // Validasi pengaman: jika elemen tidak ditemukan, jangan biarkan script crash
        const titleVal = titleEl ? titleEl.value.trim() : '';
        const contentVal = contentEl ? contentEl.value.trim() : '';
        const categoryVal = categoryEl ? categoryEl.value : 'Idea';
        const sessionDateVal = sessionSelect ? sessionSelect.value : new Date().toISOString().split('T')[0];

        if (!titleVal) {
            if (titleEl) titleEl.focus();
            return;
        }

        const data = {
            title: titleVal,
            content: contentVal,
            category: categoryVal,
            sessionDate: sessionDateVal
        };

        try {
            if (this.editingNoteId) {
                await storage.updateNote(this.editingNoteId, data);
            } else {
                await storage.addNote(data);
            }

            this.closeAllModals();
            await this.loadNotes();
            await this.updateStats();
        } catch (err) {
            console.error("Gagal menyimpan note:", err);
        }
    }

  async editNote(id) {
    const note = await storage.getNote(id);
    if (note) this.openNoteModal(note);
  }

  async viewNote(id) {
    const note = await storage.getNote(id);
    if (!note) return;

    const modal = document.getElementById("view-note-modal");
    document.getElementById("view-note-title").textContent = note.title;
    const catEl = document.getElementById("view-note-category");
    catEl.textContent = note.category;
    catEl.className = `note-category cat-${note.category.toLowerCase()}`;
    document.getElementById("view-note-content").textContent = note.content;
    document.getElementById("view-note-date").textContent =
      `Created: ${this.formatDate(note.createdAt)}`;

    // Setup edit button
    document.getElementById("edit-note-from-view-btn").onclick = async () => {
      this.closeAllModals();
      await this.editNote(id);
    };

    modal.classList.add("active");
  }

  async deleteNote(id) {
    if (confirm("Hapus note ini?")) {
      await storage.deleteNote(id);
      await this.loadNotes();
      await this.updateStats();
    }
  }

  // ===== SESSIONS =====

  loadSessions() {
    const sessions = storage.getSessions();
    this.renderSessionList(sessions);
  }

  renderSessionList(sessions) {
    const list = document.getElementById("session-list");

    if (sessions.length === 0) {
      list.innerHTML = `
                <div class="empty-state-sidebar">
                    <p>📋 Belum ada session log</p>
                    <p style="font-size: 0.75rem; margin-top: 6px;">Klik + untuk mulai mencatat</p>
                </div>
            `;
      return;
    }

    list.innerHTML = sessions
      .map(
        (session) => `
            <div class="session-item" onclick="app.viewSession('${session.id}')">
                <div class="session-item-header">
                    <span class="session-date-badge">${this.formatDateShort(session.date)}</span>
                    <div class="session-item-actions">
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); app.editSession('${session.id}')" title="Edit">✏️</button>
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); app.deleteSession('${session.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <p class="session-preview">${this.escapeHtml(session.builtToday.substring(0, 80))}${session.builtToday.length > 80 ? "..." : ""}</p>
            </div>
        `,
      )
      .join("");
  }

  openSessionModal(session = null) {
    this.editingSessionId = session ? session.id : null;
    const modal = document.getElementById("session-modal");
    const title = document.getElementById("session-modal-title");
    const form = document.getElementById("session-form");

    title.textContent = session ? "Edit Session Log" : "📋 New Session Log";
    form.elements["session-date"].value = session
      ? session.date
      : new Date().toISOString().split("T")[0];
    form.elements["session-built"].value = session ? session.builtToday : "";
    form.elements["session-problems"].value = session ? session.problems : "";
    form.elements["session-learned"].value = session ? session.learned : "";
    form.elements["session-focus"].value = session ? session.focusTomorrow : "";

    modal.classList.add("active");
    setTimeout(() => form.elements["session-built"].focus(), 100);
  }

  async saveSession() {
    const form = document.getElementById("session-form");
    const data = {
      date: form.elements["session-date"].value,
      builtToday: form.elements["session-built"].value.trim(),
      problems: form.elements["session-problems"].value.trim(),
      learned: form.elements["session-learned"].value.trim(),
      focusTomorrow: form.elements["session-focus"].value.trim(),
    };

    if (this.editingSessionId) {
      await storage.updateSession(this.editingSessionId, data);
    } else {
      await storage.addSession(data);
    }

    this.closeAllModals();
    this.loadSessions();
    await this.updateStats();
  }

  editSession(id) {
    const session = storage.getSession(id);
    if (session) this.openSessionModal(session);
  }

  viewSession(id) {
    const session = storage.getSession(id);
    if (!session) return;
    this.viewingSessionId = id;

    const modal = document.getElementById("view-session-modal");
    document.getElementById("view-session-date").textContent =
      `📅 ${session.date}`;
    document.getElementById("view-session-built").textContent =
      session.builtToday || "(belum diisi)";
    document.getElementById("view-session-problems").textContent =
      session.problems || "(belum diisi)";
    document.getElementById("view-session-learned").textContent =
      session.learned || "(belum diisi)";
    document.getElementById("view-session-focus").textContent =
      session.focusTomorrow || "(belum diisi)";

    modal.classList.add("active");
  }

  async deleteSession(id) {
    if (confirm("Hapus session log ini?")) {
      await storage.deleteSession(id);
      this.loadSessions();
      await this.updateStats();
    }
  }

  exportSession(id) {
    const markdown = storage.exportSessionAsMarkdown(id);
    if (!markdown) return;

    const session = storage.getSession(id);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dev-log-${session.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  filterSessions(query) {
    const sessions = storage.getSessions();
    const q = query.toLowerCase();
    const filtered = q
      ? sessions.filter(
          (s) =>
            s.builtToday.toLowerCase().includes(q) ||
            s.date.includes(q) ||
            s.problems.toLowerCase().includes(q) ||
            s.learned.toLowerCase().includes(q) ||
            s.focusTomorrow.toLowerCase().includes(q),
        )
      : sessions;
    this.renderSessionList(filtered);
  }

  // ===== UI HELPERS =====

  async updateStats() {
    document.getElementById("total-notes").textContent =
      await storage.getNotesCount();
    document.getElementById("total-sessions").textContent =
      storage.getSessionsCount();
  }

  closeAllModals() {
    document
      .querySelectorAll(".modal")
      .forEach((m) => m.classList.remove("active"));
    this.editingNoteId = null;
    this.editingSessionId = null;
  }

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    this.sidebarOpen = !this.sidebarOpen;
    sidebar.classList.toggle("open", this.sidebarOpen);
  }

  formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  formatDateShort(dateStr) {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    } catch {
      return dateStr;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize on DOM ready
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new SecondBrainApp();
});
