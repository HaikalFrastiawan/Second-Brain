// ===================================
// LocalStorage & File System Access API Wrapper for Second Brain
// ===================================

// IndexedDB helpers to store DirectoryHandle across sessions
const DB_NAME = 'SecondBrainDB';
const STORE_NAME = 'handles';
const KEY_NAME = 'directory_handle';

function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(request.error);
    });
}

async function storeDirectoryHandle(handle) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(handle, KEY_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getStoredDirectoryHandle() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function removeStoredDirectoryHandle() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(KEY_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Markdown parser & serializer for notes
function parseMarkdownNotes(content) {
    const notes = [];
    const blocks = content.split(/---\r?\n/);
    
    for (let i = 1; i < blocks.length; i += 2) {
        const metaBlock = blocks[i];
        const contentBlock = blocks[i + 1];
        if (!metaBlock || !contentBlock) break;

        const lines = metaBlock.split('\n');
        const meta = {};
        for (const line of lines) {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex !== -1) {
                const key = line.slice(0, separatorIndex).trim();
                let val = line.slice(separatorIndex + 1).trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1);
                } else if (val.startsWith("'") && val.endsWith("'")) {
                    val = val.slice(1, -1);
                }
                meta[key] = val;
            }
        }

        if (meta.id && meta.title) {
            notes.push({
                id: meta.id,
                title: meta.title,
                category: meta.category || 'Idea',
                createdAt: meta.createdAt || new Date().toISOString(),
                content: contentBlock.trim()
            });
        }
    }
    return notes;
}

function serializeNotesToMarkdown(notes, dateStr, headerContent = '') {
    let md = headerContent.trim();
    if (!md) {
        md = `# Dev Session Log - ${dateStr}`;
    }
    md += `\n\n`;
    for (const note of notes) {
        md += `---\n`;
        md += `id: "${note.id}"\n`;
        md += `title: "${note.title}"\n`;
        md += `category: "${note.category}"\n`;
        md += `createdAt: "${note.createdAt}"\n`;
        md += `---\n`;
        md += `${note.content}\n\n`;
    }
    return md;
}

class SecondBrainStorage {
    constructor() {
        this.NOTES_KEY = 'secondbrain_notes';
        this.SESSIONS_KEY = 'secondbrain_sessions';
        this.directoryHandle = null;
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

    // ===== FILE SYSTEM ACCESS API =====

    isFileSystemSupported() {
        return 'showDirectoryPicker' in window;
    }

    async selectDirectory() {
        try {
            const handle = await window.showDirectoryPicker();
            await storeDirectoryHandle(handle);
            this.directoryHandle = handle;
            return true;
        } catch (e) {
            console.error('Error selecting directory:', e);
            return false;
        }
    }

    async disconnectDirectory() {
        await removeStoredDirectoryHandle();
        this.directoryHandle = null;
    }

    async loadDirectoryHandle() {
        try {
            const handle = await getStoredDirectoryHandle();
            if (handle) {
                this.directoryHandle = handle;
                return true;
            }
        } catch (e) {
            console.error('Error loading directory handle:', e);
        }
        return false;
    }

    async verifyPermission(readWrite = true) {
        if (!this.directoryHandle) return false;
        const options = { mode: readWrite ? 'readwrite' : 'read' };
        try {
            if ((await this.directoryHandle.queryPermission(options)) === 'granted') {
                return true;
            }
            if ((await this.directoryHandle.requestPermission(options)) === 'granted') {
                return true;
            }
        } catch (e) {
            console.error('Permission verification failed:', e);
        }
        return false;
    }

    getFilenameForDate(dateString) {
        const date = new Date(dateString);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `dev-log-${yyyy}-${mm}-${dd}.md`;
    }

    // ===== NOTES CRUD =====

    async getNotes() {
        if (this.directoryHandle) {
            const hasPermission = await this.verifyPermission(false);
            if (hasPermission) {
                try {
                    const allNotes = [];
                    for await (const entry of this.directoryHandle.values()) {
                        if (entry.kind === 'file' && entry.name.startsWith('dev-log-') && entry.name.endsWith('.md')) {
                            const file = await entry.getFile();
                            const content = await file.text();
                            const notes = parseMarkdownNotes(content);
                            allNotes.push(...notes);
                        }
                    }
                    // Sort notes by createdAt descending
                    allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    return allNotes;
                } catch (e) {
                    console.error('Failed to read notes from files:', e);
                }
            }
        }

        // Fallback to LocalStorage
        try {
            return JSON.parse(localStorage.getItem(this.NOTES_KEY) || '[]');
        } catch {
            return [];
        }
    }

    async getNote(id) {
        const notes = await this.getNotes();
        return notes.find(n => n.id === id) || null;
    }

    async addNote(data) {
        const createdAtDate = data.sessionDate ? new Date(data.sessionDate + 'T12:00:00') : new Date();
        const note = {
            id: this.generateId(),
            title: data.title,
            content: data.content,
            category: data.category || 'Idea',
            createdAt: createdAtDate.toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (this.directoryHandle) {
            const hasPermission = await this.verifyPermission(true);
            if (hasPermission) {
                try {
                    const filename = this.getFilenameForDate(note.createdAt);
                    let fileContent = '';
                    let existingNotes = [];
                    let headerContent = '';

                    try {
                        const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
                        const file = await fileHandle.getFile();
                        fileContent = await file.text();
                        
                        const blocks = fileContent.split(/---\r?\n/);
                        headerContent = blocks[0] || '';
                        existingNotes = parseMarkdownNotes(fileContent);
                    } catch (e) {
                        // File doesn't exist or is empty
                    }

                    existingNotes.unshift(note);
                    const newContent = serializeNotesToMarkdown(existingNotes, note.createdAt.split('T')[0], headerContent);

                    const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(newContent);
                    await writable.close();
                    return note;
                } catch (e) {
                    console.error('Failed to write note to file:', e);
                }
            }
        }

        // LocalStorage fallback
        const notes = JSON.parse(localStorage.getItem(this.NOTES_KEY) || '[]');
        notes.unshift(note);
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
        return note;
    }

    async updateNote(id, updates) {
        let note = null;

        if (this.directoryHandle) {
            const hasPermission = await this.verifyPermission(true);
            if (hasPermission) {
                try {
                    const notes = await this.getNotes();
                    const targetNote = notes.find(n => n.id === id);
                    if (targetNote) {
                        const oldDateStr = targetNote.createdAt.split('T')[0];
                        const newDateStr = updates.sessionDate || oldDateStr;

                        note = { ...targetNote, ...updates, updatedAt: new Date().toISOString() };
                        
                        if (updates.sessionDate && updates.sessionDate !== oldDateStr) {
                            const oldTime = targetNote.createdAt.split('T')[1] || '12:00:00.000Z';
                            note.createdAt = `${newDateStr}T${oldTime}`;
                        }

                        // Remove from old file if date changed
                        if (newDateStr !== oldDateStr) {
                            const oldFilename = this.getFilenameForDate(targetNote.createdAt);
                            try {
                                const oldFileHandle = await this.directoryHandle.getFileHandle(oldFilename, { create: false });
                                const oldFile = await oldFileHandle.getFile();
                                const oldFileContent = await oldFile.text();
                                
                                const oldBlocks = oldFileContent.split(/---\r?\n/);
                                const oldHeader = oldBlocks[0] || '';
                                const oldFileNotes = parseMarkdownNotes(oldFileContent);
                                const remainingNotes = oldFileNotes.filter(n => n.id !== id);

                                const cleanHeader = oldHeader.trim();
                                const isHeaderEmptyOrPlaceholder = !cleanHeader || cleanHeader === `# Dev Session Log - ${oldDateStr}`;
                                
                                if (remainingNotes.length === 0 && isHeaderEmptyOrPlaceholder) {
                                    await this.directoryHandle.removeEntry(oldFilename);
                                } else {
                                    const newOldContent = serializeNotesToMarkdown(remainingNotes, oldDateStr, oldHeader);
                                    const oldWritable = await oldFileHandle.createWritable();
                                    await oldWritable.write(newOldContent);
                                    await oldWritable.close();
                                }
                            } catch (e) {
                                console.error('Failed to remove note from old file:', e);
                            }
                        }

                        // Save to new/target file
                        const filename = this.getFilenameForDate(note.createdAt);
                        let fileContent = '';
                        let fileNotes = [];
                        let headerContent = '';

                        try {
                            const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
                            const file = await fileHandle.getFile();
                            fileContent = await file.text();
                            
                            const blocks = fileContent.split(/---\r?\n/);
                            headerContent = blocks[0] || '';
                            fileNotes = parseMarkdownNotes(fileContent);
                        } catch (e) {
                            // File doesn't exist
                        }

                        if (newDateStr === oldDateStr) {
                            const idx = fileNotes.findIndex(n => n.id === id);
                            if (idx !== -1) {
                                fileNotes[idx] = note;
                            } else {
                                fileNotes.unshift(note);
                            }
                        } else {
                            fileNotes.unshift(note);
                        }

                        const newContent = serializeNotesToMarkdown(fileNotes, newDateStr, headerContent);
                        const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(newContent);
                        await writable.close();
                        return note;
                    }
                } catch (e) {
                    console.error('Failed to update note in file:', e);
                }
            }
        }

        // LocalStorage fallback
        const notes = JSON.parse(localStorage.getItem(this.NOTES_KEY) || '[]');
        const idx = notes.findIndex(n => n.id === id);
        if (idx !== -1) {
            const oldDateStr = notes[idx].createdAt.split('T')[0];
            const newDateStr = updates.sessionDate || oldDateStr;
            
            let createdAt = notes[idx].createdAt;
            if (updates.sessionDate && updates.sessionDate !== oldDateStr) {
                const oldTime = notes[idx].createdAt.split('T')[1] || '12:00:00.000Z';
                createdAt = `${newDateStr}T${oldTime}`;
            }

            notes[idx] = { 
                ...notes[idx], 
                ...updates, 
                createdAt,
                updatedAt: new Date().toISOString() 
            };
            localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
            return notes[idx];
        }
        return null;
    }

    async deleteNote(id) {
        if (this.directoryHandle) {
            const hasPermission = await this.verifyPermission(true);
            if (hasPermission) {
                try {
                    const notes = await this.getNotes();
                    const targetNote = notes.find(n => n.id === id);
                    if (targetNote) {
                        const filename = this.getFilenameForDate(targetNote.createdAt);
                        const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
                        const file = await fileHandle.getFile();
                        const fileContent = await file.text();

                        const blocks = fileContent.split(/---\r?\n/);
                        const headerContent = blocks[0] || '';
                        const fileNotes = parseMarkdownNotes(fileContent);

                        const remainingNotes = fileNotes.filter(n => n.id !== id);

                        const cleanHeader = headerContent.trim();
                        const isHeaderEmptyOrPlaceholder = !cleanHeader || cleanHeader === `# Dev Session Log - ${targetNote.createdAt.split('T')[0]}`;
                        
                        if (remainingNotes.length === 0 && isHeaderEmptyOrPlaceholder) {
                            await this.directoryHandle.removeEntry(filename);
                        } else {
                            const newContent = serializeNotesToMarkdown(remainingNotes, targetNote.createdAt.split('T')[0], headerContent);
                            const writable = await fileHandle.createWritable();
                            await writable.write(newContent);
                            await writable.close();
                        }
                        return;
                    }
                } catch (e) {
                    console.error('Failed to delete note in file:', e);
                }
            }
        }

        // LocalStorage fallback
        const notes = JSON.parse(localStorage.getItem(this.NOTES_KEY) || '[]');
        const filtered = notes.filter(n => n.id !== id);
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(filtered));
    }

    async getNotesCount() {
        const notes = await this.getNotes();
        return notes.length;
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

    async addSession(data) {
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

        // Save to LocalStorage
        const sessions = this.getSessions();
        sessions.unshift(session);
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

        // Save to directory if connected
        if (this.directoryHandle) {
            const hasPermission = await this.verifyPermission(true);
            if (hasPermission) {
                try {
                    const filename = this.getFilenameForDate(session.date);
                    let fileContent = '';
                    let existingNotes = [];

                    try {
                        const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
                        const file = await fileHandle.getFile();
                        fileContent = await file.text();
                        existingNotes = parseMarkdownNotes(fileContent);
                    } catch (e) {
                        // File doesn't exist
                    }

                    const headerContent = this.exportSessionAsMarkdownContent(session);
                    const newContent = serializeNotesToMarkdown(existingNotes, session.date, headerContent);

                    const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(newContent);
                    await writable.close();
                } catch (e) {
                    console.error('Failed to save session log to file:', e);
                }
            }
        }

        return session;
    }

    async updateSession(id, updates) {
        const sessions = this.getSessions();
        const idx = sessions.findIndex(s => s.id === id);
        if (idx !== -1) {
            const session = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
            sessions[idx] = session;
            localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

            // Update in directory if connected
            if (this.directoryHandle) {
                const hasPermission = await this.verifyPermission(true);
                if (hasPermission) {
                    try {
                        const filename = this.getFilenameForDate(session.date);
                        let fileContent = '';
                        let existingNotes = [];

                        try {
                            const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
                            const file = await fileHandle.getFile();
                            fileContent = await file.text();
                            existingNotes = parseMarkdownNotes(fileContent);
                        } catch (e) {
                            // File doesn't exist
                        }

                        const headerContent = this.exportSessionAsMarkdownContent(session);
                        const newContent = serializeNotesToMarkdown(existingNotes, session.date, headerContent);

                        const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(newContent);
                        await writable.close();
                    } catch (e) {
                        console.error('Failed to update session log in file:', e);
                    }
                }
            }

            return session;
        }
        return null;
    }

    async deleteSession(id) {
        const session = this.getSession(id);
        const sessions = this.getSessions().filter(s => s.id !== id);
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

        if (session && this.directoryHandle) {
            const hasPermission = await this.verifyPermission(true);
            if (hasPermission) {
                try {
                    const filename = this.getFilenameForDate(session.date);
                    const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
                    const file = await fileHandle.getFile();
                    const fileContent = await file.text();

                    const fileNotes = parseMarkdownNotes(fileContent);

                    if (fileNotes.length === 0) {
                        // Delete the file if no notes are left
                        await this.directoryHandle.removeEntry(filename);
                    } else {
                        // Strip the header and rewrite the file with default header
                        const newContent = serializeNotesToMarkdown(fileNotes, session.date, '');
                        const writable = await fileHandle.createWritable();
                        await writable.write(newContent);
                        await writable.close();
                    }
                } catch (e) {
                    console.error('Failed to delete session log from file:', e);
                }
            }
        }
    }

    getSessionsCount() {
        return this.getSessions().length;
    }

    // ===== EXPORT =====

    exportSessionAsMarkdownContent(s) {
        return `# Dev Session Log\n\nTanggal: ${s.date}\n\n## 1. Apa yang dibangun hari ini\n${s.builtToday || '- (belum diisi)'}\n\n## 2. Masalah yang muncul\n${s.problems || '- (belum diisi)'}\n\n## 3. Yang gw pelajari\n${s.learned || '- (belum diisi)'}\n\n## 4. Fokus besok\n${s.focusTomorrow || '- (belum diisi)'}`;
    }

    exportSessionAsMarkdown(id) {
        const s = this.getSession(id);
        if (!s) return null;
        return this.exportSessionAsMarkdownContent(s) + '\n';
    }

    exportAllSessionsAsMarkdown() {
        return this.getSessions().map(s => this.exportSessionAsMarkdown(s.id)).join('\n---\n\n');
    }
}

// Global instance
const storage = new SecondBrainStorage();
