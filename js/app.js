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

    init() {
        // Initialize brain visualizer
        this.brain = new BrainVisualizer('brain-canvas');
        this.brain.onParticleClick = (noteId) => this.viewNote(noteId);

        // Load data
        this.loadNotes();
        this.loadSessions();
        this.updateStats();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add Note
        document.getElementById('add-note-btn').addEventListener('click', () => this.openNoteModal());

        // Add Session
        document.getElementById('add-session-btn').addEventListener('click', () => this.openSessionModal());

        // Note form
        document.getElementById('note-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNote();
        });

        // Session form
        document.getElementById('session-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSession();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Modal overlay click to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => this.closeAllModals());
        });

        // Session search
        document.getElementById('session-search').addEventListener('input', (e) => {
            this.filterSessions(e.target.value);
        });

        // Export button
        document.getElementById('export-session-btn').addEventListener('click', () => {
            if (this.viewingSessionId) this.exportSession(this.viewingSessionId);
        });

        // Edit from view modal
        document.getElementById('edit-from-view-btn').addEventListener('click', () => {
            if (this.viewingSessionId) {
                this.closeAllModals();
                this.editSession(this.viewingSessionId);
            }
        });

        // Sidebar toggle (mobile)
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.openNoteModal();
            }
        });

        // Note cancel button
        document.getElementById('note-cancel-btn').addEventListener('click', () => this.closeAllModals());

        // Session cancel button
        document.getElementById('session-cancel-btn').addEventListener('click', () => this.closeAllModals());
    }

    // ===== NOTES =====

    loadNotes() {
        const notes = storage.getNotes();
        this.brain.syncWithNotes(notes);
        this.renderNotesGrid(notes);
    }

    renderNotesGrid(notes) {
        const grid = document.getElementById('notes-grid');

        if (notes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📝</span>
                    <p>Belum ada notes. Mulai tambahkan ide pertamamu!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = notes.slice(0, 12).map(note => `
            <div class="note-card" data-category="${this.escapeHtml(note.category)}" onclick="app.viewNote('${note.id}')">
                <div class="note-card-header">
                    <span class="note-category cat-${note.category.toLowerCase()}">${this.escapeHtml(note.category)}</span>
                    <div class="note-actions">
                        <button class="btn-icon" onclick="event.stopPropagation(); app.editNote('${note.id}')" title="Edit">✏️</button>
                        <button class="btn-icon" onclick="event.stopPropagation(); app.deleteNote('${note.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <h4 class="note-title">${this.escapeHtml(note.title)}</h4>
                <p class="note-preview">${this.escapeHtml(note.content.substring(0, 120))}${note.content.length > 120 ? '...' : ''}</p>
                <div class="note-footer">
                    <span class="note-date">${this.formatDate(note.createdAt)}</span>
                </div>
            </div>
        `).join('');
    }

    openNoteModal(note = null) {
        this.editingNoteId = note ? note.id : null;
        const modal = document.getElementById('note-modal');
        const title = document.getElementById('note-modal-title');
        const form = document.getElementById('note-form');

        title.textContent = note ? 'Edit Note' : '✨ New Note';
        form.elements['note-title'].value = note ? note.title : '';
        form.elements['note-content'].value = note ? note.content : '';
        form.elements['note-category'].value = note ? note.category : 'Idea';

        modal.classList.add('active');
        setTimeout(() => form.elements['note-title'].focus(), 100);
    }

    saveNote() {
        const form = document.getElementById('note-form');
        const data = {
            title: form.elements['note-title'].value.trim(),
            content: form.elements['note-content'].value.trim(),
            category: form.elements['note-category'].value
        };

        if (!data.title) {
            form.elements['note-title'].focus();
            return;
        }

        if (this.editingNoteId) {
            storage.updateNote(this.editingNoteId, data);
        } else {
            storage.addNote(data);
        }

        this.closeAllModals();
        this.loadNotes();
        this.updateStats();
    }

    editNote(id) {
        const note = storage.getNote(id);
        if (note) this.openNoteModal(note);
    }

    viewNote(id) {
        const note = storage.getNote(id);
        if (!note) return;

        const modal = document.getElementById('view-note-modal');
        document.getElementById('view-note-title').textContent = note.title;
        const catEl = document.getElementById('view-note-category');
        catEl.textContent = note.category;
        catEl.className = `note-category cat-${note.category.toLowerCase()}`;
        document.getElementById('view-note-content').textContent = note.content;
        document.getElementById('view-note-date').textContent = `Created: ${this.formatDate(note.createdAt)}`;

        // Setup edit button
        document.getElementById('edit-note-from-view-btn').onclick = () => {
            this.closeAllModals();
            this.editNote(id);
        };

        modal.classList.add('active');
    }

    deleteNote(id) {
        if (confirm('Hapus note ini?')) {
            storage.deleteNote(id);
            this.loadNotes();
            this.updateStats();
        }
    }

    // ===== SESSIONS =====

    loadSessions() {
        const sessions = storage.getSessions();
        this.renderSessionList(sessions);
    }

    renderSessionList(sessions) {
        const list = document.getElementById('session-list');

        if (sessions.length === 0) {
            list.innerHTML = `
                <div class="empty-state-sidebar">
                    <p>📋 Belum ada session log</p>
                    <p style="font-size: 0.75rem; margin-top: 6px;">Klik + untuk mulai mencatat</p>
                </div>
            `;
            return;
        }

        list.innerHTML = sessions.map(session => `
            <div class="session-item" onclick="app.viewSession('${session.id}')">
                <div class="session-item-header">
                    <span class="session-date-badge">${this.formatDateShort(session.date)}</span>
                    <div class="session-item-actions">
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); app.editSession('${session.id}')" title="Edit">✏️</button>
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); app.deleteSession('${session.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <p class="session-preview">${this.escapeHtml(session.builtToday.substring(0, 80))}${session.builtToday.length > 80 ? '...' : ''}</p>
            </div>
        `).join('');
    }

    openSessionModal(session = null) {
        this.editingSessionId = session ? session.id : null;
        const modal = document.getElementById('session-modal');
        const title = document.getElementById('session-modal-title');
        const form = document.getElementById('session-form');

        title.textContent = session ? 'Edit Session Log' : '📋 New Session Log';
        form.elements['session-date'].value = session ? session.date : new Date().toISOString().split('T')[0];
        form.elements['session-built'].value = session ? session.builtToday : '';
        form.elements['session-problems'].value = session ? session.problems : '';
        form.elements['session-learned'].value = session ? session.learned : '';
        form.elements['session-focus'].value = session ? session.focusTomorrow : '';

        modal.classList.add('active');
        setTimeout(() => form.elements['session-built'].focus(), 100);
    }

    saveSession() {
        const form = document.getElementById('session-form');
        const data = {
            date: form.elements['session-date'].value,
            builtToday: form.elements['session-built'].value.trim(),
            problems: form.elements['session-problems'].value.trim(),
            learned: form.elements['session-learned'].value.trim(),
            focusTomorrow: form.elements['session-focus'].value.trim()
        };

        if (this.editingSessionId) {
            storage.updateSession(this.editingSessionId, data);
        } else {
            storage.addSession(data);
        }

        this.closeAllModals();
        this.loadSessions();
        this.updateStats();
    }

    editSession(id) {
        const session = storage.getSession(id);
        if (session) this.openSessionModal(session);
    }

    viewSession(id) {
        const session = storage.getSession(id);
        if (!session) return;
        this.viewingSessionId = id;

        const modal = document.getElementById('view-session-modal');
        document.getElementById('view-session-date').textContent = `📅 ${session.date}`;
        document.getElementById('view-session-built').textContent = session.builtToday || '(belum diisi)';
        document.getElementById('view-session-problems').textContent = session.problems || '(belum diisi)';
        document.getElementById('view-session-learned').textContent = session.learned || '(belum diisi)';
        document.getElementById('view-session-focus').textContent = session.focusTomorrow || '(belum diisi)';

        modal.classList.add('active');
    }

    deleteSession(id) {
        if (confirm('Hapus session log ini?')) {
            storage.deleteSession(id);
            this.loadSessions();
            this.updateStats();
        }
    }

    exportSession(id) {
        const markdown = storage.exportSessionAsMarkdown(id);
        if (!markdown) return;

        const session = storage.getSession(id);
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
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
            ? sessions.filter(s =>
                s.builtToday.toLowerCase().includes(q) ||
                s.date.includes(q) ||
                s.problems.toLowerCase().includes(q) ||
                s.learned.toLowerCase().includes(q) ||
                s.focusTomorrow.toLowerCase().includes(q)
            )
            : sessions;
        this.renderSessionList(filtered);
    }

    // ===== UI HELPERS =====

    updateStats() {
        document.getElementById('total-notes').textContent = storage.getNotesCount();
        document.getElementById('total-sessions').textContent = storage.getSessionsCount();
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        this.editingNoteId = null;
        this.editingSessionId = null;
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        this.sidebarOpen = !this.sidebarOpen;
        sidebar.classList.toggle('open', this.sidebarOpen);
    }

    formatDate(dateStr) {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    formatDateShort(dateStr) {
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        } catch {
            return dateStr;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize on DOM ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SecondBrainApp();
});
