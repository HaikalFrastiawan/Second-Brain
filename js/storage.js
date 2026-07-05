// ===================================
// LocalStorage Wrapper for Second Brain
// ===================================

class SecondBrainStorage {
    constructor() {
        this.NOTES_KEY = 'secondbrain_notes';
        this.SESSIONS_KEY = 'secondbrain_sessions';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.NOTES_KEY)) {
            localStorage.setItem(this.NOTES_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.SESSIONS_KEY)) {
            localStorage.setItem(this.SESSIONS_KEY, JSON.stringify([]));
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ===== NOTES CRUD =====

    getNotes() {
        try {
            return JSON.parse(localStorage.getItem(this.NOTES_KEY) || '[]');
        } catch {
            return [];
        }
    }

    getNote(id) {
        return this.getNotes().find(n => n.id === id);
    }

    addNote(data) {
        const notes = this.getNotes();
        const note = {
            id: this.generateId(),
            title: data.title,
            content: data.content,
            category: data.category || 'Idea',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        notes.unshift(note);
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
        return note;
    }

    updateNote(id, updates) {
        const notes = this.getNotes();
        const idx = notes.findIndex(n => n.id === id);
        if (idx !== -1) {
            notes[idx] = { ...notes[idx], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
            return notes[idx];
        }
        return null;
    }

    deleteNote(id) {
        const notes = this.getNotes().filter(n => n.id !== id);
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
    }

    getNotesCount() {
        return this.getNotes().length;
    }

    // ===== SESSION LOGS CRUD =====

    getSessions() {
        try {
            return JSON.parse(localStorage.getItem(this.SESSIONS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    getSession(id) {
        return this.getSessions().find(s => s.id === id);
    }

    addSession(data) {
        const sessions = this.getSessions();
        const session = {
            id: this.generateId(),
            date: data.date || new Date().toISOString().split('T')[0],
            builtToday: data.builtToday || '',
            problems: data.problems || '',
            learned: data.learned || '',
            focusTomorrow: data.focusTomorrow || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        sessions.unshift(session);
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
        return session;
    }

    updateSession(id, updates) {
        const sessions = this.getSessions();
        const idx = sessions.findIndex(s => s.id === id);
        if (idx !== -1) {
            sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
            return sessions[idx];
        }
        return null;
    }

    deleteSession(id) {
        const sessions = this.getSessions().filter(s => s.id !== id);
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    }

    getSessionsCount() {
        return this.getSessions().length;
    }

    // ===== EXPORT =====

    exportSessionAsMarkdown(id) {
        const s = this.getSession(id);
        if (!s) return null;

        return `# Dev Session Log\n\nTanggal: ${s.date}\n\n## 1. Apa yang dibangun hari ini\n${s.builtToday || '- (belum diisi)'}\n\n## 2. Masalah yang muncul\n${s.problems || '- (belum diisi)'}\n\n## 3. Yang gw pelajari\n${s.learned || '- (belum diisi)'}\n\n## 4. Fokus besok\n${s.focusTomorrow || '- (belum diisi)'}\n`;
    }

    exportAllSessionsAsMarkdown() {
        return this.getSessions().map(s => this.exportSessionAsMarkdown(s.id)).join('\n---\n\n');
    }
}

// Global instance
const storage = new SecondBrainStorage();
